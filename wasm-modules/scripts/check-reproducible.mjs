// 可复现性闸门：
//   1. 入库产物字节的 SHA-256 必须等于清单里的 sha256；
//   2. 以锁定工具链从源码重新构建（双构建器）必须得到同一哈希；
//   3. 重新构建的产物同样只导入 env.memory、导出 run / abi_version，并过闸 1。
//
// 挂进 `npm test`（package.json 的 test 脚本会跑 scripts/*.test.mjs，
// 而本文件的校验由 admission.test.mjs 的同名用例覆盖；也可单独执行）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILD_DIR, MANIFEST_PATH, readManifest, sha256BytesHex } from "./wasm-utils.mjs";
import { reproduceAndGate } from "./admission.mjs";

export async function checkReproducible({ sourceDir, atomicType } = {}) {
  const manifest = readManifest();
  const entry = atomicType
    ? manifest.modules.find((m) => m.atomicType === atomicType)
    : manifest.modules[0];
  if (!entry) throw new Error(`清单里没有模块：${atomicType ?? "<第一个>"}`);

  const shippedPath = join(BUILD_DIR, entry.file);
  if (!existsSync(shippedPath)) {
    throw new Error(`入库产物缺失：${shippedPath}`);
  }
  const shippedHash = sha256BytesHex(readFileSync(shippedPath));
  if (shippedHash !== entry.sha256) {
    throw new Error(
      `入库产物与清单不符：build/${entry.file} sha256=${shippedHash} ≠ manifest=${entry.sha256}`,
    );
  }

  if (sourceDir) {
    const rebuilt = await reproduceAndGate(sourceDir, { atomicType: entry.atomicType });
    if (rebuilt.sha256 !== entry.sha256) {
      throw new Error(
        `不可复现构建：源码重建 sha256=${rebuilt.sha256} ≠ 入库 ${entry.sha256}` +
          `（工具链 ${entry.compiler.version}）`,
      );
    }
  }
  return { entry, shippedHash, manifestPath: MANIFEST_PATH };
}

async function main() {
  const sourceDir = process.argv[2];
  const { entry } = await checkReproducible({ sourceDir });
  console.log(
    `reproducible: ${entry.file} sha256=${entry.sha256}` +
      `（入库字节一致${sourceDir ? "，源码重建逐字节一致" : ""}，只导入 env.memory）`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
