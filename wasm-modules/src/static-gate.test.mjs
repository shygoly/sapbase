// 闸 1 静态拒绝集 —— 每类违规一个负例，全部 fail-closed。
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STATIC_REJECTION_FIXTURES,
  StaticGateError,
  buildFixtureWasm,
  staticGate,
} from "../dist/index.js";

test("合法最小模块通过，并报告内存页数与导出", () => {
  const report = staticGate(
    buildFixtureWasm({ memoryMax: 1024, exportMemory: true }),
  );
  assert.equal(report.memoryPages.max, 1024);
  assert.deepEqual(report.exports.sort(), ["abi_version", "memory", "run"]);
  assert.ok(report.checks.includes("no-start-section"));
});

for (const { label, spec, reason } of STATIC_REJECTION_FIXTURES) {
  test(`拒绝：${label}`, () => {
    let thrown;
    try {
      staticGate(buildFixtureWasm(spec));
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof StaticGateError, `${label} 未被拒绝`);
    assert.equal(thrown.reason, reason, `${label} 拒绝原因不符：${thrown.message}`);
  });
}

test("模块字节数超上限 → 在解析之前就拒（不给畸形大模块解析机会）", () => {
  const big = buildFixtureWasm({ memoryMax: 16, padToBytes: 4096 });
  assert.throws(
    () => staticGate(big, { maxModuleBytes: 1024 }),
    (err) => err instanceof StaticGateError && err.reason === "limit-exceeded",
  );
  // 放宽上限后同一模块应当通过 —— 证明拒的是大小，不是别的。
  assert.ok(staticGate(big, { maxModuleBytes: 1 << 20 }));
});

test("解析不动的字节一律拒（不是「看不懂就放行」）", () => {
  for (const bad of [
    new Uint8Array([]),
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x02, 0x00, 0x00, 0x00]),
    buildFixtureWasm({ memoryMax: 16 }).subarray(0, 20),
  ]) {
    assert.throws(
      () => staticGate(bad),
      (err) => err instanceof StaticGateError && err.reason === "malformed",
    );
  }
});

test("内存下限 > 上限 → 拒", () => {
  assert.throws(
    () => staticGate(buildFixtureWasm({ memoryMin: 64, memoryMax: 8 })),
    (err) => err instanceof StaticGateError && err.reason === "limit-exceeded",
  );
});

test("禁 SIMD 请求被如实拒绝，而非假装禁掉", () => {
  assert.throws(
    () => staticGate(buildFixtureWasm({ memoryMax: 16 }), { allowSimd: false }),
    /无法在不做 opcode 扫描的前提下禁用 SIMD/,
  );
});

test("两种 abi_version 形态都认，并如实报告读取方式", () => {
  assert.equal(staticGate(buildFixtureWasm({})).abiVersionExportKind, "global");
});

test("工具链链接常量只在「全局」形态下放行（函数形态的同名导出照旧拒）", () => {
  assert.throws(
    () => staticGate(buildFixtureWasm({ extraExport: "__data_end" })),
    (err) => err instanceof StaticGateError && err.reason === "illegal-export",
  );
});

test("入库产物（真实构建物）同样过闸 1", async () => {
  const { BUILD_DIR, readManifest } = await import("../scripts/wasm-utils.mjs");
  const manifestPath = join(BUILD_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return; // 未构建时跳过
  for (const m of readManifest().modules) {
    const bytes = new Uint8Array(readFileSync(join(BUILD_DIR, m.file)));
    const report = staticGate(bytes);
    assert.equal(report.byteLength, bytes.length);
  }
});

test("真实 Rust 产物：abi_version 为函数导出，run 存在", async () => {
  const { existsSync: exists, readFileSync: read } = await import("node:fs");
  const path =
    "modules/available-inventory-rust/target/wasm32-unknown-unknown/release/" +
    "speckit_atomic_available_inventory.wasm";
  if (!exists(path)) return; // 未做本机构建时跳过
  const report = staticGate(new Uint8Array(read(path)));
  assert.equal(report.abiVersionExportKind, "function");
  assert.ok(report.exports.includes("run"));
});
