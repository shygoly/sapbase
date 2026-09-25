// 构建与校验共用的工具：SHA-256 摘要、模块导入/导出检查、清单读写。
//
// 零外部依赖：摘要用 node:crypto，模块结构检查用引擎自带的 WebAssembly API。
// 移植来源：medtrust/packages/wasm-algorithms（SM3 → SHA-256，见 README）。
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BUILD_DIR = join(PACKAGE_ROOT, "build");
/**
 * 提交形状的源码目录根。`modules/<name>/` 下**只放源码**，不含 cargo 之外的工程机制
 * —— 平台自研（Tier A）与第三方（Tier B）走完全相同的目录形状与闸门，
 * "分层"只是来源标注，不是安全豁免。
 */
export const MODULES_DIR = join(PACKAGE_ROOT, "modules");
export const MANIFEST_PATH = join(BUILD_DIR, "manifest.json");

/** 模块字节的 SHA-256（64 hex 小写）—— 它就是"客户同意跑的那一份代码"的指纹。 */
export function sha256BytesHex(bytes) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function sha256FileHex(path) {
  return sha256BytesHex(readFileSync(path));
}

/**
 * 静态检查：导入必须恰好是 {module:'env', name:'memory', kind:'memory'}；
 * 导出只许 run(函数)、abi_version(函数或常量全局)、被重新导出的那同一块内存。
 * 返回 { imports, exports, abiVersion, abiVersionExportKind }。
 */
export function inspectModule(bytes, watText) {
  const mod = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(mod).map((i) => ({
    module: i.module,
    name: i.name,
    kind: i.kind,
  }));
  const exports = WebAssembly.Module.exports(mod).map((e) => ({
    name: e.name,
    kind: e.kind,
  }));

  const badImport = imports.find(
    (i) => !(i.module === "env" && i.name === "memory" && i.kind === "memory"),
  );
  if (badImport) {
    throw new Error(
      `模块含非零能力导入（必须只有 env.memory）: ${badImport.module}.${badImport.name} (${badImport.kind})`,
    );
  }
  if (imports.length !== 1) {
    throw new Error(`模块必须恰好导入一块内存，实际 ${imports.length} 个导入`);
  }
  const run = exports.find((e) => e.name === "run");
  if (!run || run.kind !== "function") {
    throw new Error("模块必须导出函数 run");
  }
  const abi = exports.find((e) => e.name === "abi_version");
  if (!abi || (abi.kind !== "global" && abi.kind !== "function")) {
    throw new Error("模块必须导出 abi_version（函数或常量全局）");
  }
  const unexpected = exports.find(
    (e) => !["run", "abi_version", "memory"].includes(e.name),
  );
  if (unexpected) {
    throw new Error(`模块导出了未授权符号 ${unexpected.name} (${unexpected.kind})`);
  }
  if (watText !== undefined) {
    const memoryImports = watText.match(/\(import "env" "memory" \(memory/g) ?? [];
    const memoryDefs = watText.match(/^\s*\(memory /gm) ?? [];
    if (memoryImports.length !== 1 || memoryDefs.length !== 0) {
      throw new Error(
        `内存必须恰好来自一次 env.memory 导入（宿主注入且有上限），实际导入 ${memoryImports.length} 次、自定义内存 ${memoryDefs.length} 处`,
      );
    }
  }

  // abi_version 的真实取值：用宿主内存实例化后读取。
  // 内存页数须落在模块声明的 [initial, max] 之内（链接参数固定为 2 页 / 1024 页）。
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 1024 });
  const instance = new WebAssembly.Instance(mod, { env: { memory } });
  const abiExport = instance.exports.abi_version;
  const abiVersionExportKind = typeof abiExport === "function" ? "function" : "global";
  const abiVersion =
    abiVersionExportKind === "function" ? abiExport() : abiExport.value;
  if (abiVersion !== 1) {
    throw new Error(`abi_version 必须是 1，实际 ${abiVersion}`);
  }
  return { imports, exports, abiVersion, abiVersionExportKind };
}

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}
