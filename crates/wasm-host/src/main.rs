//! 原子执行引擎宿主（Wasmtime）—— 行分隔 JSON over stdio。
//!
//! 职责边界（见 openspec/changes/add-wasmtime-host/design.md）：
//!   · 只做两件事：`load`（编译并缓存模块）与 `call`（按偏移/长度执行）
//!   · **不解释业务语义**：契约、投影、权限、审计全在 NestJS 侧
//!   · 每次调用新建 Store/Memory/Instance —— 模块全局状态不跨调用残留
//!   · 约束三道：fuel（指令预算）+ epoch（时间片中断）+ 宿主墙钟兜底
//!
//! 为什么 sidecar 而不是 napi：Node 生态没有可用的 Wasmtime 绑定，
//! 且进程级隔离能挡住"模块或引擎崩溃带走宿主进程"。

use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::time::Duration;

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use wasmtime::{
    Config, Engine, ExternType, Linker, Memory, MemoryType, Module, Store,
};

const PROTOCOL_VERSION: u32 = 1;
const DEFAULT_FUEL: u64 = 1_000_000;
const DEFAULT_EPOCH_TICKS: u64 = 40; // × tick_ms 即大致时间片
const TICK_MS: u64 = 25;
const INITIAL_PAGES: u32 = 2;
const MAX_PAGES: u32 = 1024;

#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum Request {
    Hello {
        protocol: u32,
    },
    Ping {
        id: u64,
    },
    Load {
        id: u64,
        sha256: String,
        bytes: String,
    },
    Call {
        id: u64,
        sha256: String,
        input: String,
        rows: i32,
        #[serde(rename = "inOff")]
        in_off: i32,
        #[serde(rename = "outOff")]
        out_off: i32,
        #[serde(rename = "outLength")]
        out_length: i32,
        #[serde(default)]
        fuel: Option<u64>,
        #[serde(rename = "deadlineMs", default)]
        deadline_ms: Option<u64>,
    },
}

#[derive(Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum Response {
    Ready {
        protocol: u32,
        engine: String,
        wasmtime: String,
    },
    Pong {
        id: u64,
    },
    Ok {
        id: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        cached: Option<bool>,
    },
    Result {
        id: u64,
        rc: i32,
        out: String,
        fuel_used: u64,
    },
    Error {
        id: u64,
        code: &'static str,
        message: String,
    },
}

/// 只允许一种导入：`env.memory`（能力面收窄到"一块宿主给的内存"）。
/// 这是宿主侧闸 1 的**双保险**：sidecar 不采信宿主已经验过。
fn assert_zero_capability(module: &Module, bytes: &[u8]) -> Result<()> {
    let imports: Vec<_> = module.imports().collect();
    if imports.len() != 1 {
        return Err(anyhow!(
            "模块必须恰好导入一块宿主内存，实际 {} 个导入",
            imports.len()
        ));
    }
    let import = &imports[0];
    if import.module() != "env" || import.name() != "memory" {
        return Err(anyhow!(
            "只允许导入 env.memory，实际 {}.{}",
            import.module(),
            import.name()
        ));
    }
    match import.ty() {
        ExternType::Memory(memory_ty) => {
            if memory_ty.is_shared() {
                return Err(anyhow!("不允许共享内存（threads 提案）"));
            }
            if memory_ty.maximum().is_none() {
                return Err(anyhow!("导入内存必须声明上限"));
            }
            if memory_ty.maximum().unwrap_or(0) > MAX_PAGES as u64 {
                return Err(anyhow!("导入内存上限超过允许页数"));
            }
        }
        other => return Err(anyhow!("env.memory 的类型不是内存：{:?}", other)),
    }
    if bytes.len() < 8 {
        return Err(anyhow!("模块过短，不是合法 Wasm"));
    }
    Ok(())
}

struct Handler {
    engine: Engine,
    modules: HashMap<String, Module>,
}

impl Handler {
    fn handle(&mut self, request: Request) -> Option<Response> {
        match request {
            Request::Hello { protocol } => {
                if protocol != PROTOCOL_VERSION {
                    // 不匹配即拒（由宿主决定是否致命），不尝试"尽量兼容"
                    eprintln!(
                        "protocol mismatch: host={} sidecar={}",
                        protocol, PROTOCOL_VERSION
                    );
                    return Some(Response::Error {
                        id: 0,
                        code: "PROTOCOL_MISMATCH",
                        message: format!(
                            "宿主协议 {} ≠ sidecar 协议 {}",
                            protocol, PROTOCOL_VERSION
                        ),
                    });
                }
                Some(Response::Ready {
                    protocol: PROTOCOL_VERSION,
                    engine: "wasmtime".to_string(),
                    // 版本来自 build.rs 从 Cargo.lock 解析的实际依赖版本（wasmtime 48 不导出 VERSION）
                    wasmtime: env!("WASMTIME_VERSION").to_string(),
                })
            }
            Request::Ping { id } => Some(Response::Pong { id }),
            Request::Load { id, sha256, bytes } => {
                if self.modules.contains_key(&sha256) {
                    // 幂等：重复 load 不重编译
                    return Some(Response::Ok {
                        id,
                        cached: Some(true),
                    });
                }
                let raw = match B64.decode(bytes) {
                    Ok(raw) => raw,
                    Err(error) => {
                        return Some(Response::Error {
                            id,
                            code: "BAD_BASE64",
                            message: error.to_string(),
                        })
                    }
                };
                let module = match Module::new(&self.engine, &raw) {
                    Ok(module) => module,
                    Err(error) => {
                        return Some(Response::Error {
                            id,
                            code: "BAD_MODULE",
                            message: error.to_string(),
                        })
                    }
                };
                if let Err(error) = assert_zero_capability(&module, &raw) {
                    return Some(Response::Error {
                        id,
                        code: "BAD_MODULE",
                        message: error.to_string(),
                    });
                }
                self.modules.insert(sha256, module);
                Some(Response::Ok {
                    id,
                    cached: Some(false),
                })
            }
            Request::Call {
                id,
                sha256,
                input,
                rows,
                in_off,
                out_off,
                out_length,
                fuel,
                deadline_ms,
            } => Some(self.call(
                id,
                &sha256,
                &input,
                rows,
                in_off,
                out_off,
                out_length,
                fuel.unwrap_or(DEFAULT_FUEL),
                deadline_ms,
            )),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn call(
        &self,
        id: u64,
        sha256: &str,
        input_b64: &str,
        rows: i32,
        in_off: i32,
        out_off: i32,
        out_length: i32,
        fuel: u64,
        deadline_ms: Option<u64>,
    ) -> Response {
        let Some(module) = self.modules.get(sha256) else {
            return Response::Error {
                id,
                code: "UNKNOWN_MODULE",
                message: format!("未加载的模块：{sha256}"),
            };
        };
        let Ok(input_bytes) = B64.decode(input_b64) else {
            return Response::Error {
                id,
                code: "BAD_BASE64",
                message: "input 不是合法 base64".to_string(),
            };
        };

        let mut store = Store::new(&self.engine, ());
        if store.set_fuel(fuel).is_err() {
            return Response::Error {
                id,
                code: "FUEL_UNSUPPORTED",
                message: "引擎未启用 fuel 计费".to_string(),
            };
        }
        // epoch 死线：tick 线程每 TICK_MS 递增一次
        let ticks = deadline_ms.map_or(DEFAULT_EPOCH_TICKS, |ms| {
            (ms / TICK_MS).max(1)
        });
        store.set_epoch_deadline(ticks);

        // 每次调用新建内存（有上限，由宿主注入）
        let memory = match Memory::new(
            &mut store,
            MemoryType::new(INITIAL_PAGES, Some(MAX_PAGES)),
        ) {
            Ok(memory) => memory,
            Err(error) => {
                return Response::Error {
                    id,
                    code: "TRAP",
                    message: format!("创建内存失败：{error}"),
                }
            }
        };

        let mut linker: Linker<()> = Linker::new(&self.engine);
        if let Err(error) = linker.define(&mut store, "env", "memory", memory) {
            return Response::Error {
                id,
                code: "TRAP",
                message: format!("注入内存失败：{error}"),
            };
        }

        let instance = match linker.instantiate(&mut store, module) {
            Ok(instance) => instance,
            Err(error) => {
                return Response::Error {
                    id,
                    code: "TRAP",
                    message: format!("实例化失败：{error}"),
                }
            }
        };

        // 按"输入 + 输出"需要的内存增长（上限仍是模块声明的 max，最多 MAX_PAGES）。
        // 漏掉这一步会在大批量输入时报"输入超出内存范围" —— 对拍 V8 时抓到的差异。
        let needed = ((in_off.max(0) as usize) + input_bytes.len())
            .max((out_off.max(0) as usize) + (out_length.max(0) as usize) * 4);
        let current_bytes = memory.data_size(&store);
        if needed > current_bytes {
            let pages_needed = needed.div_ceil(65536) as u64;
            let current_pages = memory.size(&store) as u64;
            let grow_by = pages_needed.saturating_sub(current_pages);
            if grow_by > 0 {
                if let Err(error) = memory.grow(&mut store, grow_by) {
                    return Response::Error {
                        id,
                        code: "TRAP",
                        message: format!("内存增长失败（需要 {needed} 字节）：{error}"),
                    };
                }
            }
        }

        // 写入整数列投影
        if !input_bytes.is_empty() {
            let data = memory.data_mut(&mut store);
            let start = in_off as usize;
            let end = start + input_bytes.len();
            if end > data.len() {
                return Response::Error {
                    id,
                    code: "TRAP",
                    message: "输入超出内存范围".to_string(),
                };
            }
            data[start..end].copy_from_slice(&input_bytes);
        }

        let run = match instance.get_typed_func::<(i32, i32, i32), i32>(&mut store, "run") {
            Ok(run) => run,
            Err(error) => {
                return Response::Error {
                    id,
                    code: "BAD_MODULE",
                    message: format!("模块未导出签名匹配的 run：{error}"),
                }
            }
        };

        let call_result = run.call(&mut store, (in_off, rows, out_off));
        let fuel_used = fuel.saturating_sub(store.get_fuel().unwrap_or(0));

        match call_result {
            Ok(rc) => {
                let data = memory.data(&store);
                let start = out_off as usize;
                let end = start + (out_length.max(0) as usize) * 4;
                if end > data.len() {
                    return Response::Error {
                        id,
                        code: "TRAP",
                        message: "输出超出内存范围".to_string(),
                    };
                }
                Response::Result {
                    id,
                    rc,
                    out: B64.encode(&data[start..end]),
                    fuel_used,
                }
            }
            Err(error) => {
                let trap = error.downcast_ref::<wasmtime::Trap>();
                let code = match trap {
                    Some(wasmtime::Trap::OutOfFuel) => "FUEL_EXHAUSTED",
                    Some(wasmtime::Trap::Interrupt) => "EPOCH_TIMEOUT",
                    _ => "TRAP",
                };
                Response::Error {
                    id,
                    code,
                    message: format!("{error}（fuel_used={fuel_used}）"),
                }
            }
        }
    }
}

fn build_engine() -> Result<Engine> {
    let mut config = Config::new();
    config.consume_fuel(true); // fuel 计费：确定性指令预算
    config.epoch_interruption(true); // epoch：时间片中断
    // 关闭不需要的能力面：本引擎只跑"只有一块宿主内存"的模块
    config.wasm_threads(false);
    config.wasm_reference_types(false);
    config.wasm_simd(false);
    config.wasm_relaxed_simd(false);
    config.wasm_multi_memory(false);
    Ok(Engine::new(&config)?)
}

fn main() -> Result<()> {
    let engine = build_engine()?;

    // epoch 递增线程：只做一次原子加，开销可忽略
    let ticker_engine = engine.clone();
    let ticker_ms: u64 = std::env::var("ATOMIC_EPOCH_TICK_MS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(TICK_MS);
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(ticker_ms));
        ticker_engine.increment_epoch();
    });

    let mut handler = Handler {
        engine,
        modules: HashMap::new(),
    };

    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<Request>(&line) {
            Ok(request) => handler.handle(request),
            Err(error) => Some(Response::Error {
                id: 0,
                code: "BAD_REQUEST",
                message: error.to_string(),
            }),
        };
        if let Some(response) = response {
            writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
            stdout.flush()?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 只导入 env.memory 的最小模块 —— 应通过零能力校验。
    const LEGAL_WAT: &str = r#"
        (module
          (import "env" "memory" (memory 2 1024))
          (func (export "run") (param i32 i32 i32) (result i32)
            i32.const 0))
    "#;

    /// 多了一个 WASI 导入 —— 必须被拒（宿主闸 1 的双保险）。
    const ROGUE_WAT: &str = r#"
        (module
          (import "env" "memory" (memory 2 1024))
          (import "wasi_snapshot_preview1" "fd_write"
            (func (param i32 i32 i32 i32) (result i32)))
          (func (export "run") (param i32 i32 i32) (result i32)
            i32.const 0))
    "#;

    fn engine() -> Engine {
        build_engine().expect("engine")
    }

    #[test]
    fn accepts_zero_capability_module() {
        let module = Module::new(&engine(), LEGAL_WAT).expect("compile");
        assert!(assert_zero_capability(&module, &[0; 8]).is_ok());
    }

    #[test]
    fn rejects_module_with_extra_import() {
        let module = Module::new(&engine(), ROGUE_WAT).expect("compile");
        let error = assert_zero_capability(&module, &[0; 8]).unwrap_err();
        assert!(
            error.to_string().contains("恰好导入一块宿主内存"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn parses_protocol_messages() {
        let request: Request =
            serde_json::from_str(r#"{"t":"call","id":7,"sha256":"ab","input":"","rows":1,"inOff":0,"outOff":4,"outLength":1}"#)
                .expect("call parses");
        match request {
            Request::Call { id, rows, fuel, .. } => {
                assert_eq!(id, 7);
                assert_eq!(rows, 1);
                assert!(fuel.is_none(), "fuel 缺省时应为 None（由调用方兜底）");
            }
            _ => panic!("expected call"),
        }

        let ready = serde_json::to_string(&Response::Ready {
            protocol: PROTOCOL_VERSION,
            engine: "wasmtime".to_string(),
            wasmtime: "test".to_string(),
        })
        .expect("serialize");
        assert!(ready.contains(r#""t":"ready""#));
    }
}
