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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reproduceAndGate } from "./admission.mjs";
import { BUILD_DIR, readManifest } from "./wasm-utils.mjs";

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

function entryOf(atomicType) {
  const entry = readManifest().modules.find((m) => m.atomicType === atomicType);
  assert.ok(entry, `清单里没有夹具：${atomicType}`);
  return entry;
}

/** 按 ABI v1 跑一次：输入三段等长列，输出 n 个值 + 1 个汇总位。 */
function runFixture(atomicType, rows) {
  const entry = entryOf(atomicType);
  const bytes = readFileSync(join(BUILD_DIR, entry.file));
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

test("两个夹具都在清单里，且结构上就是普通模块（tier A / abi 1）", () => {
  for (const { atomicType } of FIXTURES) {
    const entry = entryOf(atomicType);
    assert.equal(entry.tier, "A");
    assert.equal(entry.abiVersion, 1);
    assert.equal(entry.language, "rust");
    // 静态闸只看到"导入 env.memory、导出 run" —— 它没有理由拒绝
    assert.equal(entry.staticGate.memoryPages.max, 1024);
    assert.ok(entry.staticGate.checks.includes("import=env.memory(min=2,max=1024)"));
  }
});

// 闸 0/1/2 对这两个夹具的判定都是**放行** —— 这正是闸 3 存在的理由。
for (const { atomicType, sourceDir } of FIXTURES) {
  rustTest(
    `闸 0/1/2 放行 ${atomicType}（源码复现构建逐字节一致）`,
    withHostIsolation(async () => {
      const entry = entryOf(atomicType);
      const rebuilt = await reproduceAndGate(sourceDir, { atomicType });
      assert.equal(rebuilt.sha256, entry.sha256);
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
