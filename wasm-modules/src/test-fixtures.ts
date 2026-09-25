// 静态拒绝集夹具：每一类违规手写一个最小 Wasm 模块，用来证明闸 1 真的挡得住，
// 而不是"没见过这种模块所以没报错"。夹具只服务于负路径可达性，永远不进生产分发
// （生产模块一律由平台工具链从源码复现构建）。
//
// 夹具里的 run 签名与本仓库 ABI v1 一致：(i32,i32,i32) -> i32。
//
// 移植来源：medtrust/packages/wasm-algorithms（见 README 的来源与改动说明）。

function uleb(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

function utf8(text: string): number[] {
  // 用 TextEncoder 而不是 Buffer：本包不引入 @types/node，纯 Web 平台即可编译。
  const bytes = Array.from(new TextEncoder().encode(text));
  return [...uleb(bytes.length), ...bytes];
}

function vec(items: number[][]): number[] {
  return [...uleb(items.length), ...items.flat()];
}

function section(id: number, content: number[]): number[] {
  return [id, ...uleb(content.length), ...content];
}

export interface FixtureSpec {
  /** 导入 env.memory（缺省导入）。 */
  importMemory?: boolean;
  /** 导入内存的 min / max 页数（max 缺省 1024）。 */
  memoryMin?: number;
  memoryMax?: number;
  /** 不声明内存上限（应被拒）。 */
  noMemoryMax?: boolean;
  /** threads 提案的共享内存标志（应被拒）。 */
  sharedMemory?: boolean;
  /** 用 memory64 的 limits flag（应被拒）。 */
  memory64?: boolean;
  /** 额外导入一个 env 函数（应被拒）。 */
  importFunc?: string;
  /** 从 wasi_snapshot_preview1 导入（应被拒）。 */
  importWasi?: string;
  /** 导入一张表（应被拒）。 */
  importTable?: boolean;
  /** 导入一个全局量（应被拒）。 */
  importGlobal?: boolean;
  /** 模块自己定义内存（应被拒）。 */
  defineMemory?: boolean;
  /** 模块自己定义表（应被拒）。 */
  defineTable?: boolean;
  /** 含 start 段（应被拒）。 */
  startSection?: boolean;
  /** 含 tag 段 = 异常处理提案（应被拒）。 */
  tagSection?: boolean;
  /** 类型段里放一个 GC struct 类型（应被拒）。 */
  gcType?: boolean;
  exportRun?: boolean;
  /** 把 run 导成全局而不是函数（应被拒）。 */
  runAsGlobal?: boolean;
  exportAbi?: boolean;
  /** 把 abi_version 导成内存（既非常量全局也非无参函数，应被拒）。 */
  abiAsMemory?: boolean;
  exportMemory?: boolean;
  /** 额外导出一个未授权符号（应被拒）。 */
  extraExport?: string;
  abiVersion?: number;
  /** 追加一个自定义段把模块撑到指定字节数（测字节上限）。 */
  padToBytes?: number;
}

/** 手写一个最小合法模块 / 各类违规变体。 */
export function buildFixtureWasm(spec: FixtureSpec = {}): Uint8Array {
  const importMemory = spec.importMemory ?? true;
  const abiVersion = spec.abiVersion ?? 1;
  const exportRun = spec.exportRun ?? true;
  const exportAbi = spec.exportAbi ?? true;

  const bytes: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  // ── type：run 的 (i32,i32,i32)->i32；可选追加一个 GC struct 类型。
  const types: number[][] = [[0x60, 0x03, 0x7f, 0x7f, 0x7f, 0x01, 0x7f]];
  if (spec.gcType) types.push([0x5f, 0x00]); // struct with 0 fields
  bytes.push(...section(1, vec(types)));

  // ── import
  const imports: number[][] = [];
  if (importMemory) {
    const min = spec.memoryMin ?? 1;
    const max = spec.noMemoryMax ? undefined : (spec.memoryMax ?? 1024);
    let flags = max === undefined ? 0x00 : 0x01;
    if (spec.sharedMemory) flags |= 0x02;
    if (spec.memory64) flags |= 0x04;
    imports.push([
      ...utf8("env"),
      ...utf8("memory"),
      0x02,
      flags,
      ...uleb(min),
      ...(max === undefined ? [] : uleb(max)),
    ]);
  }
  if (spec.importFunc) {
    imports.push([...utf8("env"), ...utf8(spec.importFunc), 0x00, ...uleb(0)]);
  }
  if (spec.importWasi) {
    imports.push([
      ...utf8("wasi_snapshot_preview1"),
      ...utf8(spec.importWasi),
      0x00,
      ...uleb(0),
    ]);
  }
  if (spec.importTable) {
    imports.push([
      ...utf8("env"),
      ...utf8("__indirect_function_table"),
      0x01,
      0x70, // funcref
      0x01,
      ...uleb(1),
      ...uleb(1),
    ]);
  }
  if (spec.importGlobal) {
    imports.push([...utf8("env"), ...utf8("__stack_pointer"), 0x03, 0x7f, 0x01]);
  }
  if (imports.length) bytes.push(...section(2, vec(imports)));

  // ── function（一个内部函数 = run 的实现）
  bytes.push(...section(3, vec([[0x00]])));

  // ── table（模块自定义表）
  if (spec.defineTable) {
    bytes.push(...section(4, vec([[0x70, 0x01, ...uleb(1), ...uleb(1)]])));
  }

  // ── memory（模块自定义内存）
  if (spec.defineMemory) {
    bytes.push(...section(5, vec([[0x01, ...uleb(1), ...uleb(2)]])));
  }

  // ── global abi_version（i32 const，不可变）
  bytes.push(
    ...section(6, vec([[0x7f, 0x00, 0x41, ...uleb(abiVersion), 0x0b]])),
  );

  // ── export
  const importedFuncCount =
    (spec.importFunc ? 1 : 0) + (spec.importWasi ? 1 : 0);
  const exports: number[][] = [];
  if (exportRun) {
    exports.push(
      spec.runAsGlobal
        ? [...utf8("run"), 0x03, ...uleb(0)]
        : [...utf8("run"), 0x00, ...uleb(importedFuncCount)],
    );
  }
  if ((spec.exportMemory ?? false) && importMemory) {
    exports.push([...utf8("memory"), 0x02, 0x00]);
  }
  if (exportAbi) {
    exports.push(
      spec.abiAsMemory
        ? [...utf8("abi_version"), 0x02, ...uleb(0)]
        : [...utf8("abi_version"), 0x03, ...uleb(0)],
    );
  }
  if (spec.extraExport) {
    exports.push([...utf8(spec.extraExport), 0x00, ...uleb(importedFuncCount)]);
  }
  if (exports.length) bytes.push(...section(7, vec(exports)));

  // ── start
  if (spec.startSection) {
    bytes.push(...section(8, uleb(importedFuncCount)));
  }

  // ── code：i32.const 0 ; end
  const bodyBytes = [0x00, 0x41, 0x00, 0x0b];
  bytes.push(...section(10, vec([[...uleb(bodyBytes.length), ...bodyBytes]])));

  // ── tag（异常处理提案）：放在 code 之后不影响本闸的段表扫描
  if (spec.tagSection) {
    bytes.push(...section(13, vec([[0x00, ...uleb(0)]])));
  }

  // ── 自定义段填充到指定字节数（测模块字节上限）
  if (spec.padToBytes && spec.padToBytes > bytes.length) {
    const name = utf8("pad");
    const overhead = 1 + 5 + name.length; // id + 长度(保守 5 字节) + 段名
    const fill = Math.max(0, spec.padToBytes - bytes.length - overhead);
    bytes.push(...section(0, [...name, ...new Array<number>(fill).fill(0)]));
  }

  return new Uint8Array(bytes);
}

/** 静态拒绝集：每类违规一个负例。 */
export const STATIC_REJECTION_FIXTURES: Array<{
  label: string;
  spec: FixtureSpec;
  reason: string;
}> = [
  { label: "WASI 导入", spec: { importWasi: "fd_write" }, reason: "illegal-import" },
  { label: "env 函数导入", spec: { importFunc: "leak" }, reason: "illegal-import" },
  { label: "表导入", spec: { importTable: true }, reason: "illegal-import" },
  { label: "全局量导入", spec: { importGlobal: true }, reason: "illegal-import" },
  { label: "无任何导入（内存不是宿主给的）", spec: { importMemory: false }, reason: "illegal-import" },
  { label: "共享内存（threads）", spec: { sharedMemory: true }, reason: "forbidden-feature" },
  { label: "memory64", spec: { memory64: true }, reason: "malformed" },
  { label: "模块自定义内存", spec: { defineMemory: true }, reason: "forbidden-feature" },
  { label: "模块自定义表", spec: { defineTable: true }, reason: "forbidden-feature" },
  { label: "start 段", spec: { startSection: true }, reason: "start-section" },
  { label: "tag 段（异常）", spec: { tagSection: true }, reason: "forbidden-feature" },
  { label: "GC 类型", spec: { gcType: true }, reason: "forbidden-feature" },
  { label: "内存无上限", spec: { noMemoryMax: true }, reason: "limit-exceeded" },
  { label: "内存上限超配置", spec: { memoryMax: 65536 }, reason: "limit-exceeded" },
  { label: "未导出 run", spec: { exportRun: false }, reason: "illegal-export" },
  { label: "run 不是函数", spec: { runAsGlobal: true }, reason: "illegal-export" },
  { label: "未导出 abi_version", spec: { exportAbi: false }, reason: "illegal-export" },
  { label: "abi_version 既非全局也非函数", spec: { abiAsMemory: true }, reason: "illegal-export" },
  { label: "冒充工具链常量的函数导出", spec: { extraExport: "__heap_base" }, reason: "illegal-export" },
  { label: "导出未授权符号", spec: { extraExport: "exfiltrate" }, reason: "illegal-export" },
];
