// 闸 2 —— 复现构建 + 语言白名单 + 「只交二进制」负例 + 真实产物过闸。
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdmissionError, admitBinaryOnly, reproduceAndGate } from "./admission.mjs";
import {
  UnsupportedLanguageError,
  assertSourceLanguage,
  detectLanguage,
  rustChannel,
  rustLinkFlags,
} from "./toolchains.mjs";
import { sha256BytesHex } from "./wasm-utils.mjs";

const SOURCE_DIR = "modules/available-inventory-rust";

// Rust 工具链不在的环境跳过真构建用例 —— 但**不**跳过白名单/负例，
// 那些是纯逻辑判据，任何环境都必须绿。
const HAS_RUST =
  spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0 &&
  (spawnSync("rustup", ["target", "list", "--installed"], {
    encoding: "utf8",
  }).stdout ?? "").includes("wasm32-unknown-unknown");
const rustTest = HAS_RUST ? test : test.skip;

// 真构建很慢（两次 cargo build），且默认隔离模式是 container。
// 测试显式以 host 模式跑，并把它标注成"开发/CI 自证"路径。
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

test("语言白名单 v1 只认 Rust", () => {
  assert.equal(assertSourceLanguage("rust"), "rust");
  for (const bad of ["assemblyscript", "python", "c", "go", "wasm", "javascript", ""]) {
    assert.throws(() => assertSourceLanguage(bad), UnsupportedLanguageError);
  }
});

test("按源码目录识别语言；识别不出即拒", () => {
  assert.equal(detectLanguage(SOURCE_DIR), "rust");
  const empty = mkdtempSync(join(tmpdir(), "speckit-nolang-"));
  try {
    assert.throws(() => detectLanguage(empty), UnsupportedLanguageError);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("只交 .wasm 二进制 → 复现不出哈希，MUST 拒绝入册", async () => {
  const dir = mkdtempSync(join(tmpdir(), "speckit-binonly-"));
  try {
    writeFileSync(join(dir, "module.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    // 走正常准入入口：没有源码 → 连语言都识别不出 → 在提交环节就拒。
    await assert.rejects(
      () => reproduceAndGate(dir),
      (err) => err instanceof UnsupportedLanguageError,
    );
    // 显式表达同一条不变量。
    await assert.rejects(
      () => admitBinaryOnly(dir),
      (err) => err instanceof AdmissionError && err.reason === "no-reproducible-source",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("闸 0 在编译之前挡住 build.rs（而不是编译后才发现）", async () => {
  const dir = mkdtempSync(join(tmpdir(), "speckit-badrs-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "Cargo.toml"),
      '[package]\nname = "m"\nversion = "1.0.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["cdylib"]\n',
    );
    writeFileSync(
      join(dir, "rust-toolchain.toml"),
      '[toolchain]\nchannel = "1.95.0"\n',
    );
    writeFileSync(join(dir, "src/lib.rs"), "#![no_std]\n");
    const marker = join(dir, "EXFILTRATED.txt");
    writeFileSync(
      join(dir, "build.rs"),
      `fn main() { std::fs::write(${JSON.stringify(marker)}, "pwned").ok(); }\n`,
    );
    await assert.rejects(
      () => reproduceAndGate(dir),
      (err) => err instanceof AdmissionError && err.reason === "source-gate",
    );
    assert.equal(existsSync(marker), false, "build.rs 从未被执行");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

rustTest(
  "闸 2：双构建器复现一致 + 产物过闸 1（工具链从 rust-toolchain.toml 读）",
  withHostIsolation(async () => {
    const record = await reproduceAndGate(SOURCE_DIR, {
      atomicType: "available-inventory",
    });
    assert.match(record.sha256, /^[0-9a-f]{64}$/);
    assert.equal(record.language, "rust");
    assert.equal(record.toolchain.channel, rustChannel(SOURCE_DIR));
    assert.equal(record.abiVersion ?? record.staticGate.exports.includes("run"), true);
    assert.equal(record.staticGate.abiVersionExportKind, "function");
    assert.ok(record.sourceGate.checks.includes("no-build-script"));
    assert.equal(record.reproducibleBuildRef.includes(record.sha256), true);
  }),
);

rustTest(
  "ABI v1 功能正确：可用库存 = 现有 - 预留 + 在途",
  withHostIsolation(async () => {
    const { bytes } = await reproduceAndGate(SOURCE_DIR, {
      atomicType: "available-inventory",
    });
    const mod = new WebAssembly.Module(bytes);
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 1024 });
    const { exports: e } = new WebAssembly.Instance(mod, { env: { memory } });

    // abi_version：Rust 形态导出为函数。
    assert.equal(typeof e.abi_version, "function");
    assert.equal(e.abi_version(), 1);

    const view = new DataView(memory.buffer);
    const n = 3;
    const inOff = 0;
    const outOff = 1024;
    const onHand = [10, 5, 0];
    const reserved = [4, 0, 7];
    const inTransit = [1, 2, 3];
    // 输入三段依次排布：on_hand | reserved | in_transit，各 n 个 i32。
    onHand.forEach((v, i) => view.setInt32(inOff + i * 4, v, true));
    reserved.forEach((v, i) => view.setInt32(inOff + n * 4 + i * 4, v, true));
    inTransit.forEach((v, i) => view.setInt32(inOff + n * 8 + i * 4, v, true));

    assert.equal(e.run(inOff, n, outOff), 0);
    const available = [0, 1, 2].map((i) => view.getInt32(outOff + i * 4, true));
    const total = view.getInt32(outOff + n * 4, true);
    assert.deepEqual(available, [7, 7, -4]);
    assert.equal(total, 10);
  }),
);

rustTest(
  "闸 2：同一源码两次独立构建哈希一致（可复现性断言，不依赖入库清单）",
  withHostIsolation(async () => {
    const a = await reproduceAndGate(SOURCE_DIR, { atomicType: "available-inventory" });
    const b = await reproduceAndGate(SOURCE_DIR, { atomicType: "available-inventory" });
    assert.equal(a.sha256, b.sha256);
    assert.equal(sha256BytesHex(a.bytes), sha256BytesHex(b.bytes));
  }),
);

test("Rust 链接配方：内存必须来自宿主导入且声明上限", () => {
  const flags = rustLinkFlags("modules/available-inventory-rust");
  assert.ok(flags.includes("--import-memory"));
  assert.ok(flags.includes("--no-entry"));
  assert.ok(flags.includes("--max-memory="));
  assert.ok(flags.includes("--remap-path-prefix"));
});
