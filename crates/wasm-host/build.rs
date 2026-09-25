//! 把实际解析到的 wasmtime 版本编进二进制，供握手时报告给宿主做诊断与版本校验。
//!
//! 为什么不直接读常量：wasmtime 48 不再导出 `VERSION`。
//! 从 Cargo.lock 取是"实际参与构建的那个版本"，比写死在源码里更可信。
use std::fs;

fn main() {
    let lock = fs::read_to_string("Cargo.lock").unwrap_or_default();
    let mut version = "unknown".to_string();
    let mut lines = lock.lines().peekable();
    while let Some(line) = lines.next() {
        if line.trim() == "name = \"wasmtime\"" {
            if let Some(next) = lines.peek() {
                if let Some(value) = next.trim().strip_prefix("version = \"") {
                    version = value.trim_end_matches('"').to_string();
                    break;
                }
            }
        }
    }
    println!("cargo:rustc-env=WASMTIME_VERSION={version}");
    println!("cargo:rerun-if-changed=Cargo.lock");
}
