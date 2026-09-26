// 闸 3 的夹具：证明这两个模块**过得了闸 0/1/2，却在值上做手脚**。
//
// 这是闸 3 存在的唯一理由，所以证据必须能独立复核：
//   1. 结构合规 —— 从源码复现构建，哈希与入库一致（闸 2）；静态闸报告只有 env.memory（闸 1）
//   2. 行为确实泄漏 —— 用真正的 WASM 引擎跑一遍，看输出的值
//
// 第 2 条是关键：只在文档里写"它们会泄漏"，闸 3 到底挡没挡住就没有可对照的真相。
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { reproduceAndGate } from "./admission.mjs";
import { BUILD_DIR, sha256BytesHex } from "./wasm-utils.mjs";

const FIXTURES = [
  { atomicType: "leaky-output-bits", sourceDir: "modules/leaky-output-bits-rust" },
  { atomicType: "leaky-order-channel", sourceDir: "modules/leaky-order-channel-rust" },
];

const HAS_RUST =
  spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0 &&
  (spawnSync("rustup", ["target", "list", "--installed"], {
    encoding: "utf8",
  }).stdout ?? "").includes("wasm32-unknown-unknown");
const rustTest = HAS_RUST ? test : test.skip;

const withHostIsolation = (fn) => async () => {
  const prev = process.env.WASM_BUILD_ISOLATION;
  process.env.WASM_BUILD_ISOLATION = "host";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.WASM_BUILD_ISOLATION;
    else process.env.WASM_BUILD_ISOLATION = prev;
  }
};

/**
 * 夹具的产物在 `build/` 里，但**不在准入清单里**。
 *
 * 这是刻意的：`build/manifest.json` 是**生产准入台账**，谁导入它谁就把里面的模块
 * 登记成"可绑定的实现"。故意做手脚的夹具不该出现在那里 —— 它只需要被
 * "按哈希前缀找产物"的 loader 找到（那才是闸 3 要拦的场景），以及被本文件复核。
 */
function artifactOf(atomicType) {
  const file = readdirSync(BUILD_DIR).find(
    (f) => f.startsWith(`${atomicType}-`) && f.endsWith(".wasm"),
  );
  assert.ok(file, `build/ 里没有夹具产物：${atomicType}`);
  const bytes = readFileSync(join(BUILD_DIR, file));
  return { file, bytes, sha256: sha256BytesHex(bytes) };
}

/** 按 ABI v1 跑一次：输入三段等长列，输出 n 个值 + 1 个汇总位。 */
function runFixture(atomicType, rows) {
  const { bytes } = artifactOf(atomicType);
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 1024 });
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: { memory },
  });

  const n = rows.length;
  const inOff = 0;
  const outOff = n * 12 + 8;
  const view = new DataView(memory.buffer);
  const write = (offset, index, value) => view.setInt32(offset + index * 4, value, true);
  rows.forEach((row, i) => {
    write(inOff, i, row.onHand);
    write(inOff + n * 4, i, row.reserved);
    write(inOff + n * 8, i, row.inTransit);
  });

  const status = instance.exports.run(inOff, n, outOff);
  assert.equal(status, 0, `${atomicType} run() 应返回 0`);

  const available = [];
  for (let i = 0; i < n; i += 1) {
    available.push(view.getInt32(outOff + i * 4, true));
  }
  return { available, total: view.getInt32(outOff + n * 4, true) };
}

test("夹具产物在 build/ 里，但不在生产准入清单里", () => {
  const manifest = readFileSync(join(BUILD_DIR, "manifest.json"), "utf8");
  for (const { atomicType } of FIXTURES) {
    const artifact = artifactOf(atomicType);
    assert.equal(artifact.sha256.length, 64);
    assert.ok(
      !manifest.includes(artifact.sha256),
      `${atomicType} 不该出现在 build/manifest.json（那是生产准入台账）`,
    );
  }
});

// 闸 0/1/2 对这两个夹具的判定都是**放行** —— 这正是闸 3 存在的理由。
for (const { atomicType, sourceDir } of FIXTURES) {
  rustTest(
    `闸 0/1/2 放行 ${atomicType}（源码复现构建逐字节一致）`,
    withHostIsolation(async () => {
      const rebuilt = await reproduceAndGate(sourceDir, { atomicType });
      // 入库字节就是从这份源码复现出来的 —— 闸 2 对夹具同样放行
      assert.equal(rebuilt.sha256, artifactOf(atomicType).sha256);
      // 闸 0（源码预检）与闸 1（静态白名单）都给出了逐条检查项，说明它们真的跑过
      assert.equal(rebuilt.sourceGate.language, "rust");
      assert.ok(rebuilt.sourceGate.checks.length > 0);
      assert.ok(rebuilt.staticGate.checks.length > 0);
    }),
  );
}

test("夹具一：确实把编译进代码的常量塞进了输出高位", () => {
  const { available, total } = runFixture("leaky-output-bits", [
    { onHand: 10, reserved: 4, inTransit: 1 },
  ]);
  // 正确值是 7，但高位被 0x5EC0 污染 —— 输入里没有任何东西能解释它
  assert.equal(total, 7, "汇总位刻意保持干净");
  assert.equal(available[0] & 0x5ec00000, 0x5ec00000);
  assert.equal(available[0] & 0x1fffff, 7, "低 21 位仍是正确值 —— 泄漏藏在高位");
});

test("夹具二：批量与逐条结果不同（用行序开隐蔽通道）", () => {
  const rows = [
    { onHand: 10, reserved: 4, inTransit: 1 },
    { onHand: 105, reserved: 5, inTransit: 0 },
  ];
  const batch = runFixture("leaky-order-channel", rows);
  const perRow = rows.map((row) => runFixture("leaky-order-channel", [row]));

  // 第 0 行不受影响；第 1 行开始带上自己的下标
  assert.equal(batch.available[0], 7);
  assert.equal(batch.available[1], 100 ^ (1 << 16));
  assert.equal(batch.total, 107, "汇总位不含下标");

  assert.notEqual(
    batch.available[1],
    perRow[1].available[0],
    "同一行在批量里与单独算的结果必须不同 —— 否则这条夹具证明不了任何事",
  );
});
