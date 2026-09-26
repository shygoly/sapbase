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

/**
 * 默认核对**清单里的每一个模块**，而不是只看第一条。
 *
 * 为什么：只核第一条时，"新加一个原子"可以悄悄绕过复现闸 —— 入库字节只要和清单自洽，
 * 就没有任何东西证明它真的能从这份源码、这把工具链重建出来。
 * 目录约定与 `modules/` 一致（`<atomicType>-rust`）；没有对应源码目录的模块明确跳过并说明，
 * 不静默放过。
 */
async function main() {
  const sourceDir = process.argv[2];
  if (sourceDir) {
    const { entry } = await checkReproducible({ sourceDir });
    console.log(
      `reproducible: ${entry.file} sha256=${entry.sha256}` +
        `（入库字节一致，源码重建逐字节一致，只导入 env.memory）`,
    );
    return;
  }

  const manifest = readManifest();
  let verified = 0;
  let skipped = 0;
  for (const entry of manifest.modules) {
    const dir = join("modules", `${entry.atomicType}-rust`);
    if (!existsSync(dir)) {
      skipped += 1;
      console.log(`skip: ${entry.atomicType}（没有源码目录 ${dir}，只核入库字节与清单自洽）`);
      await checkReproducible({ atomicType: entry.atomicType });
      continue;
    }
    await checkReproducible({ sourceDir: dir, atomicType: entry.atomicType });
    verified += 1;
    console.log(`reproducible: ${entry.file} sha256=${entry.sha256}（源码重建逐字节一致）`);
  }
  console.log(`reproducible: 共 ${manifest.modules.length} 个模块，源码重建核对 ${verified} 个，跳过 ${skipped} 个`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
