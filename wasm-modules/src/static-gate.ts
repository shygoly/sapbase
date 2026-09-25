// 准入闸 1 —— 静态白名单校验（不运行就挡）。
//
// 在**任何执行之前**把模块的能力面收窄到"一块宿主给的有上限内存 + 一个 run 导出"：
//   · import 白名单：只许 env.memory；WASI / env 函数 / table / global / tag 一律拒；
//   · export 固定：只许 run(函数) + abi_version(函数或常量全局) + memory(重导出宿主那块)；
//   · 拒 start 段（实例化时偷跑，绕过"先校验后调用"的顺序）；
//   · 特性白名单：拒共享内存(threads)、拒 GC 类型、拒 tag 段(异常)、拒表/引用类型、拒 memory64；
//   · 上限：模块字节数 + 声明内存页数。
//
// 判据全部是**结构化**的（解析段表/导入段/导出段/类型段），没有 opcode 猜测，
// 因此既无假阳性也无"看不懂就放行"。解析不动 = 拒（见 parseWasm）。
//
// fail-closed：任一不满足即抛 StaticGateError，调用方 MUST 拒绝执行且
// **不回退到内置实现** —— 静默回退等于这条闸不存在。
//
// 移植来源：medtrust/packages/wasm-algorithms（见 README 的来源与改动说明）。
import {
  type ParsedWasm,
  WasmParseError,
  parseWasm,
  type WasmImportEntry,
} from "./wasm-binary";

/** 允许的唯一导入。 */
export const ALLOWED_IMPORT = {
  module: "env",
  name: "memory",
  kind: "memory",
} as const;

/** 允许的导出名。`run` 必须是函数；`abi_version` 允许函数或全局（见下）。 */
export const ALLOWED_EXPORTS = ["run", "abi_version", "memory"] as const;

/**
 * 工具链链接期常量 —— Rust/LLVM 的 wasm 链接器无条件导出这两个不可变 i32 全局，
 * 无法用链接参数关掉。允许它们是**精确枚举**而非放宽白名单：
 * 全局导出不携带任何能力（不能调用、不能写宿主内存），值是链接期定下的布局常量；
 * 名字之外的任何符号照旧拒。
 */
export const ALLOWED_TOOLCHAIN_GLOBALS = ["__heap_base", "__data_end"] as const;

export const DEFAULT_MAX_MODULE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const DEFAULT_MAX_MEMORY_PAGES = 1024; // 64 MiB，与沙箱内存上限同量级

export type StaticGateReason =
  | "malformed"
  | "illegal-import"
  | "illegal-export"
  | "start-section"
  | "forbidden-feature"
  | "limit-exceeded";

export class StaticGateError extends Error {
  constructor(
    message: string,
    readonly reason: StaticGateReason,
  ) {
    super(message);
    this.name = "StaticGateError";
  }
}

export interface StaticGateLimits {
  /** 模块字节数上限。 */
  maxModuleBytes?: number;
  /** 模块声明的内存页数上限（1 页 = 64KiB）。 */
  maxMemoryPages?: number;
  /**
   * 是否允许 SIMD。默认 true —— v128 整数运算是确定的，且本闸无法在不做
   * opcode 扫描的前提下精确判定 SIMD 使用；真要禁必须换能做指令级校验的引擎。
   * 置 false 时本闸会**如实抛错说明它管不了**，而不是假装禁掉。
   */
  allowSimd?: boolean;
}

export interface StaticGateReport {
  byteLength: number;
  memoryPages: { min: number; max: number };
  exports: string[];
  /** abi_version 的导出形态（AssemblyScript = global，Rust = function）。 */
  abiVersionExportKind: "global" | "function";
  /** 逐条通过的检查项，供审计/准入记录留痕。 */
  checks: string[];
}

export function maxModuleBytes(limits?: StaticGateLimits): number {
  return limits?.maxModuleBytes ?? DEFAULT_MAX_MODULE_BYTES;
}

export function maxMemoryPages(limits?: StaticGateLimits): number {
  return limits?.maxMemoryPages ?? DEFAULT_MAX_MEMORY_PAGES;
}

/**
 * 闸 1 全部校验。通过返回报告，不通过抛 StaticGateError。
 * 纯静态：不实例化、不调用模块任何导出。
 */
export function staticGate(
  bytes: Uint8Array,
  limits?: StaticGateLimits,
): StaticGateReport {
  const checks: string[] = [];

  // ── 上限：先看字节数，免得给畸形大模块解析的机会。
  const byteCap = maxModuleBytes(limits);
  if (bytes.byteLength > byteCap) {
    throw new StaticGateError(
      `模块字节数 ${bytes.byteLength} > 上限 ${byteCap}`,
      "limit-exceeded",
    );
  }
  checks.push(`byteLength<=${byteCap}`);

  let parsed: ParsedWasm;
  try {
    parsed = parseWasm(bytes);
  } catch (err) {
    if (err instanceof WasmParseError) {
      throw new StaticGateError(
        `模块结构解析失败（解析不动一律拒）：${err.message}`,
        "malformed",
      );
    }
    throw err;
  }

  if (limits?.allowSimd === false) {
    throw new StaticGateError(
      "本闸按结构判定，无法在不做 opcode 扫描的前提下禁用 SIMD；" +
        "需要禁 SIMD 请换支持指令级校验的引擎，不要靠本闸假装禁掉",
      "forbidden-feature",
    );
  }

  // ── start 段：实例化就跑，绕过"先校验后调用"的顺序，直接拒。
  if (parsed.hasStartSection) {
    throw new StaticGateError(
      "模块含 start 段（实例化时自动执行），拒绝",
      "start-section",
    );
  }
  checks.push("no-start-section");

  // ── 特性白名单（全部结构化判定）。
  if (parsed.hasTagSection) {
    throw new StaticGateError(
      "模块使用异常处理提案（tag 段），不在特性白名单内",
      "forbidden-feature",
    );
  }
  if (parsed.usesGcTypes) {
    throw new StaticGateError(
      "模块类型段含 GC / 未知扩展类型，不在特性白名单内",
      "forbidden-feature",
    );
  }
  if (parsed.definedTables > 0) {
    throw new StaticGateError(
      `模块自定义了 ${parsed.definedTables} 张表（间接调用面），不在特性白名单内`,
      "forbidden-feature",
    );
  }
  if (parsed.definedMemories > 0) {
    throw new StaticGateError(
      `模块自己定义了 ${parsed.definedMemories} 块内存；内存必须由宿主注入（有上限、可回收）`,
      "forbidden-feature",
    );
  }
  checks.push("features:no-tag/no-gc/no-table/no-own-memory");

  // ── import 白名单：必须恰好一个 env.memory。
  assertSoleMemoryImport(parsed.imports);
  const memoryImport = parsed.imports[0];
  const declared = memoryImport.limits!;
  if (declared.shared) {
    throw new StaticGateError(
      "模块要求共享内存（threads 提案），不在特性白名单内",
      "forbidden-feature",
    );
  }
  if (declared.max === undefined) {
    throw new StaticGateError(
      "导入内存未声明上限（无上限内存可被无限增长撑爆宿主）",
      "limit-exceeded",
    );
  }
  const pageCap = maxMemoryPages(limits);
  if (declared.max > pageCap) {
    throw new StaticGateError(
      `模块声明内存上限 ${declared.max} 页 > 允许 ${pageCap} 页`,
      "limit-exceeded",
    );
  }
  if (declared.min > declared.max) {
    throw new StaticGateError(
      `模块声明内存下限 ${declared.min} 页 > 上限 ${declared.max} 页`,
      "limit-exceeded",
    );
  }
  checks.push(`import=env.memory(min=${declared.min},max=${declared.max})`);

  // ── export 固定签名。
  const abiVersionExportKind = assertExports(parsed);
  checks.push("exports=run(func)+abi_version(func|global)[+memory]");

  return {
    byteLength: parsed.byteLength,
    memoryPages: { min: declared.min, max: declared.max },
    exports: parsed.exports.map((e) => e.name),
    abiVersionExportKind,
    checks,
  };
}

function assertSoleMemoryImport(imports: WasmImportEntry[]): void {
  const illegal = imports.filter(
    (i) =>
      !(
        i.module === ALLOWED_IMPORT.module &&
        i.name === ALLOWED_IMPORT.name &&
        i.kind === ALLOWED_IMPORT.kind
      ),
  );
  if (illegal.length > 0) {
    const detail = illegal
      .map((i) => `${i.module}.${i.name}(${i.kind})`)
      .join(", ");
    throw new StaticGateError(
      `模块含非白名单导入（只允许 env.memory）：${detail}`,
      "illegal-import",
    );
  }
  if (imports.length !== 1) {
    throw new StaticGateError(
      `模块必须恰好导入一块宿主内存，实际 ${imports.length} 个导入`,
      "illegal-import",
    );
  }
}

function assertExports(parsed: ParsedWasm): "global" | "function" {
  const run = parsed.exports.find((e) => e.name === "run");
  if (!run) {
    throw new StaticGateError("模块未导出 run", "illegal-export");
  }
  if (run.kind !== "function") {
    throw new StaticGateError(
      `run 必须是函数导出，实际 ${run.kind}`,
      "illegal-export",
    );
  }
  const abi = parsed.exports.find((e) => e.name === "abi_version");
  if (!abi) {
    throw new StaticGateError("模块未导出 abi_version", "illegal-export");
  }
  // AssemblyScript 导出常量全局；Rust/wasm-ld 导不出"值型"全局，只能导函数。
  // 两种形态宿主都认，读取方式由 abiVersionExportKind 告诉 worker。
  if (abi.kind !== "global" && abi.kind !== "function") {
    throw new StaticGateError(
      `abi_version 必须是常量全局或无参函数，实际 ${abi.kind}`,
      "illegal-export",
    );
  }
  const unexpected = parsed.exports.find(
    (e) =>
      !(ALLOWED_EXPORTS as readonly string[]).includes(e.name) &&
      !(
        (ALLOWED_TOOLCHAIN_GLOBALS as readonly string[]).includes(e.name) &&
        e.kind === "global"
      ),
  );
  if (unexpected) {
    throw new StaticGateError(
      `模块导出了未授权符号 ${unexpected.name}(${unexpected.kind})`,
      "illegal-export",
    );
  }
  const memory = parsed.exports.find((e) => e.name === "memory");
  if (memory && memory.kind !== "memory") {
    throw new StaticGateError(
      `导出名 memory 必须是内存导出，实际 ${memory.kind}`,
      "illegal-export",
    );
  }
  return abi.kind as "global" | "function";
}
