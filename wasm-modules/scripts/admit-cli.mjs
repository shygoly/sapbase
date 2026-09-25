#!/usr/bin/env node
// 准入构建 CLI（控制面"构建触发"的执行体）。
//
// 控制面不在 API 进程里编译第三方代码：构建是**另起进程**的平台侧动作，
// 由本 CLI 执行（锁定工具链、断网 hermetic、双构建器对拍），把产物落到 build/
// 并在 stdout 打印一行 JSON 准入记录。API 只消费这条记录。
//
// 用法：
//   node scripts/admit-cli.mjs --source modules/available-inventory-rust \
//        --atomic-type available-inventory --tier A [--emit-base64]
//   WASM_BUILD_ISOLATION=host node scripts/admit-cli.mjs ...   # 本机自证
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUILD_DIR, MANIFEST_PATH, sha256BytesHex } from "./wasm-utils.mjs";
import { reproduceAndGate } from "./admission.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** 把复现出来的产物写进分发目录并登记到清单（同哈希幂等覆盖）。 */
export function publishToBuildDir(record, { tier = "A" } = {}) {
  mkdirSync(BUILD_DIR, { recursive: true });
  const file = `${record.atomicType}-${record.sha256.slice(0, 12)}.wasm`;
  writeFileSync(join(BUILD_DIR, file), record.bytes);

  const manifest = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : { generatedBy: "wasm-modules/scripts/admit-cli.mjs", modules: [] };
  const entry = {
    atomicType: record.atomicType,
    file,
    tier,
    abiVersion: 1,
    sha256: record.sha256,
    sizeBytes: record.sizeBytes,
    compiler: {
      name: record.toolchain.language,
      version: record.toolchain.channel,
    },
    language: record.language,
    reproducibleBuildRef: record.reproducibleBuildRef,
    staticGate: record.staticGate,
  };
  const idx = manifest.modules.findIndex(
    (m) => m.atomicType === entry.atomicType && m.file === entry.file,
  );
  if (idx >= 0) manifest.modules[idx] = entry;
  else manifest.modules.push(entry);
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  return { file, entry };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.source || !args["atomic-type"]) {
    console.error(
      "用法: node scripts/admit-cli.mjs --source <源码目录> --atomic-type <原子类型> " +
        "[--tier A|B] [--language rust] [--no-publish] [--emit-base64]",
    );
    process.exit(2);
  }
  try {
    const record = await reproduceAndGate(args.source, {
      language: args.language === true ? undefined : args.language,
      atomicType: args["atomic-type"],
    });
    const published = args["no-publish"]
      ? null
      : publishToBuildDir(record, { tier: args.tier === true ? "A" : (args.tier ?? "A") });
    // stdout 只有一行 JSON —— 控制面直接 JSON.parse。
    process.stdout.write(
      JSON.stringify({
        ok: true,
        atomicType: record.atomicType,
        language: record.language,
        sha256: record.sha256,
        sizeBytes: record.sizeBytes,
        toolchain: record.toolchain,
        staticGate: record.staticGate,
        sourceGate: record.sourceGate,
        reproducibleBuildRef: record.reproducibleBuildRef,
        file: published?.file ?? null,
        // --emit-base64：把产物字节一并交出，供独立构建环境提交给控制面。
        // 控制面不信任这里声称的哈希，会对字节自行重算。
        ...(args["emit-base64"]
          ? { wasmBase64: Buffer.from(record.bytes).toString("base64") }
          : {}),
      }) + "\n",
    );
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        reason: err.reason ?? err.name ?? "error",
        error: err.message,
      }) + "\n",
    );
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
