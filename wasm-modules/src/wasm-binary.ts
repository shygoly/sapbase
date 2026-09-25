// 准入闸 1 —— Wasm 二进制的**结构化**解析。
//
// 只解析"能给出确定答案"的部分：段表、导入段、内存段、表段、导出段、类型段。
// 不做 opcode 级扫描 —— 裸字节扫描会把立即数误判成指令前缀（假阳性），而
// "拒错一个合法模块"和"放过一个恶意模块"一样糟。可判定的能力边界见 static-gate.ts：
// 零函数导入 + 宿主提供的非共享内存 + 无表 + 无 tag 段，已经从**结构上**堵死
// threads / 间接调用 / 异常这几类；剩下的由沙箱资源上限与输出闸门兜。
//
// 移植来源：medtrust/packages/wasm-algorithms（见 README 的来源与改动说明）。

export const WASM_MAGIC = 0x6d736100; // "\0asm"

/** 段 id（Wasm core spec §5.5.2；13 = tag，异常处理提案）。 */
export const SECTION_ID = {
  custom: 0,
  type: 1,
  import: 2,
  function: 3,
  table: 4,
  memory: 5,
  global: 6,
  export: 7,
  start: 8,
  element: 9,
  code: 10,
  data: 11,
  dataCount: 12,
  tag: 13,
} as const;

export type ImportKind = "function" | "table" | "memory" | "global" | "tag";

export interface WasmLimits {
  min: number;
  max?: number;
  /** threads 提案：共享内存标志位。 */
  shared: boolean;
}

export interface WasmImportEntry {
  module: string;
  name: string;
  kind: ImportKind;
  /** kind === 'memory' 时携带声明的页数上下限与 shared 标志。 */
  limits?: WasmLimits;
}

export interface WasmExportEntry {
  name: string;
  kind: ImportKind;
}

export interface WasmSection {
  id: number;
  size: number;
  start: number;
}

export interface ParsedWasm {
  sections: WasmSection[];
  imports: WasmImportEntry[];
  exports: WasmExportEntry[];
  /** 模块**自己定义**的内存个数（准入要求为 0：内存必须由宿主注入）。 */
  definedMemories: number;
  /** 模块自己定义的表个数（准入要求为 0）。 */
  definedTables: number;
  hasStartSection: boolean;
  hasTagSection: boolean;
  /** 类型段里出现了 GC 提案的复合类型（struct / array / rec / sub）。 */
  usesGcTypes: boolean;
  byteLength: number;
}

export class WasmParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WasmParseError";
  }
}

class Reader {
  offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get eof(): boolean {
    return this.offset >= this.bytes.length;
  }

  u8(): number {
    if (this.offset >= this.bytes.length) {
      throw new WasmParseError("字节流提前结束");
    }
    return this.bytes[this.offset++];
  }

  /** LEB128 无符号整数（Wasm 用它编码一切长度/索引）。 */
  u32(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.u8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) throw new WasmParseError("LEB128 整数过长");
    }
    return result >>> 0;
  }

  bytes_(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) {
      throw new WasmParseError("字节流提前结束");
    }
    const out = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  name(): string {
    const length = this.u32();
    return new TextDecoder("utf-8", { fatal: false }).decode(
      this.bytes_(length),
    );
  }

  limits(): WasmLimits {
    // flags: bit0 = 有 max；bit1 = shared（threads 提案）；0x04 = 64 位内存索引。
    const flags = this.u8();
    if (flags & 0x04) {
      throw new WasmParseError("不支持 memory64（地址空间超出宿主约定）");
    }
    const min = this.u32();
    const max = flags & 0x01 ? this.u32() : undefined;
    return { min, max, shared: (flags & 0x02) !== 0 };
  }
}

const IMPORT_KINDS: Record<number, ImportKind> = {
  0x00: "function",
  0x01: "table",
  0x02: "memory",
  0x03: "global",
  0x04: "tag",
};

/** GC 提案在类型段引入的复合类型标签。 */
const GC_TYPE_TAGS = new Set([
  0x50 /* sub */, 0x4f /* sub final */, 0x4e /* rec */, 0x5f /* struct */,
  0x5e /* array */,
]);

/**
 * 解析模块的结构信息。任何格式异常抛 WasmParseError —— 解析不动的模块一律拒
 * （"看不懂就放行"是准入闸最常见的破绽）。
 */
export function parseWasm(bytes: Uint8Array): ParsedWasm {
  if (bytes.length < 8) throw new WasmParseError("模块过短，不是合法 Wasm");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== WASM_MAGIC) {
    throw new WasmParseError("魔数不是 \\0asm，不是 Wasm 模块");
  }
  const version = view.getUint32(4, true);
  if (version !== 1) {
    throw new WasmParseError(`Wasm 版本 ${version} 不受支持（只接受 1）`);
  }

  const parsed: ParsedWasm = {
    sections: [],
    imports: [],
    exports: [],
    definedMemories: 0,
    definedTables: 0,
    hasStartSection: false,
    hasTagSection: false,
    usesGcTypes: false,
    byteLength: bytes.length,
  };

  const reader = new Reader(bytes);
  reader.offset = 8;
  while (!reader.eof) {
    const id = reader.u8();
    const size = reader.u32();
    const start = reader.offset;
    if (start + size > bytes.length) {
      throw new WasmParseError(`段 ${id} 声明长度 ${size} 超出字节流`);
    }
    parsed.sections.push({ id, size, start });

    const body = new Reader(bytes.subarray(start, start + size));
    switch (id) {
      case SECTION_ID.type:
        parsed.usesGcTypes = scanTypeSection(body);
        break;
      case SECTION_ID.import:
        parsed.imports = readImportSection(body);
        break;
      case SECTION_ID.table:
        parsed.definedTables = body.u32();
        break;
      case SECTION_ID.memory:
        parsed.definedMemories = body.u32();
        break;
      case SECTION_ID.export:
        parsed.exports = readExportSection(body);
        break;
      case SECTION_ID.start:
        parsed.hasStartSection = true;
        break;
      case SECTION_ID.tag:
        parsed.hasTagSection = true;
        break;
      default:
        break;
    }
    reader.offset = start + size;
  }
  return parsed;
}

function readImportSection(r: Reader): WasmImportEntry[] {
  const count = r.u32();
  const out: WasmImportEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const module = r.name();
    const name = r.name();
    const kindByte = r.u8();
    const kind = IMPORT_KINDS[kindByte];
    if (!kind) {
      throw new WasmParseError(`未知的导入种类 0x${kindByte.toString(16)}`);
    }
    const entry: WasmImportEntry = { module, name, kind };
    switch (kind) {
      case "function":
        r.u32(); // type index
        break;
      case "table":
        r.u8(); // reftype
        r.limits();
        break;
      case "memory":
        entry.limits = r.limits();
        break;
      case "global":
        r.u8(); // valtype
        r.u8(); // mutability
        break;
      case "tag":
        r.u8(); // attribute
        r.u32(); // type index
        break;
    }
    out.push(entry);
  }
  return out;
}

function readExportSection(r: Reader): WasmExportEntry[] {
  const count = r.u32();
  const out: WasmExportEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const name = r.name();
    const kindByte = r.u8();
    const kind = IMPORT_KINDS[kindByte];
    if (!kind) {
      throw new WasmParseError(`未知的导出种类 0x${kindByte.toString(16)}`);
    }
    r.u32(); // index
    out.push({ name, kind });
  }
  return out;
}

/** 类型段里只要出现 GC 复合类型标签即判定用了 GC 提案。 */
function scanTypeSection(r: Reader): boolean {
  const count = r.u32();
  for (let i = 0; i < count; i += 1) {
    const tag = r.u8();
    if (GC_TYPE_TAGS.has(tag)) return true;
    if (tag !== 0x60) {
      // 非函数类型且非已知 GC 标签 —— 保守起见当作未知扩展，由调用方拒。
      return true;
    }
    // func: params + results，跳过。
    const params = r.u32();
    for (let p = 0; p < params; p += 1) r.u8();
    const results = r.u32();
    for (let q = 0; q < results; q += 1) r.u8();
  }
  return false;
}
