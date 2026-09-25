// 准入闸 2 —— 平台复现构建 + 双构建器对拍。
//
// 核心不变量：**Blueprint 固定的模块哈希必须由平台从提交的源码复现产出**。
// 于是"只交二进制"的模块结构性地无法入册 —— 不是政策上拒绝，是复现不出哈希
// 就签不了、固定不了。两个独立构建器产出的哈希不一致同样拒（宁拒不放）。
//
// 移植来源：medtrust/packages/wasm-algorithms（SM3 → SHA-256、analysisType → atomicType，
// 见 README 的来源与改动说明）。
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sha256BytesHex } from "./wasm-utils.mjs";
import {
  assertSourceLanguage,
  buildIsolationMode,
  builderDockerArgs,
  builderImage,
  detectLanguage,
  hermeticEnv,
  rustBuildArgs,
  rustChannel,
  rustLinkFlags,
} from "./toolchains.mjs";

const require = createRequire(import.meta.url);
const { staticGate, sourceGate, nodeSourceFs, SourceGateError } = require(
  "../dist/index.js",
);

export class AdmissionError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = "AdmissionError";
    this.reason = reason;
  }
}

/**
 * 一次 hermetic 构建。
 *
 * 默认在隔离容器里编译（`cargo build` 会跑第三方 build.rs / proc-macro —— 编译期
 * 执行点，闸 1 / 闸 3 都不覆盖）。宿主构建必须显式 `WASM_BUILD_ISOLATION=host`，
 * **绝不静默回退**：静默回退等于隔离没做。
 */
function buildRust(sourceDir, targetDir) {
  return buildIsolationMode() === "container"
    ? buildRustInContainer(sourceDir, targetDir)
    : buildRustOnHost(sourceDir, targetDir);
}

/** 隔离容器构建：无网络 / 只读根 / 非 root / 无能力 / 无凭据。 */
function buildRustInContainer(sourceDir, targetDir) {
  const channel = rustChannel(sourceDir);
  const crateLib = crateLibName(sourceDir);
  const image = builderImage(channel);
  const args = builderDockerArgs({
    sourceDir: resolve(sourceDir),
    outDir: resolve(targetDir),
    crateLib,
    channel,
  });
  try {
    execFileSync("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? "";
    const hint = /Unable to find image|No such image/.test(stderr)
      ? `\n提示：隔离构建器镜像 ${image} 不存在。构建它：\n` +
        `  docker build -f wasm-modules/Dockerfile.builder ` +
        `-t ${image} wasm-modules`
      : "";
    throw new AdmissionError(
      `隔离容器构建失败（${image}，无网络/只读/非 root）：\n${stderr.slice(-2000)}${hint}`,
      "build-failed",
    );
  }
  const wasmPath = join(targetDir, "module.wasm");
  if (!existsSync(wasmPath)) {
    throw new AdmissionError(`隔离构建未产出 ${wasmPath}`, "build-failed");
  }
  return {
    bytes: new Uint8Array(readFileSync(wasmPath)),
    toolchain: {
      language: "rust",
      channel,
      isolation: "container",
      image,
      rustflags: rustLinkFlags("/tmp/src"),
      cargoArgs: rustBuildArgs("<target-dir>"),
    },
  };
}

/** 宿主构建（仅开发/CI 自证，须显式开启）。 */
function buildRustOnHost(sourceDir, targetDir) {
  const channel = rustChannel(sourceDir);
  try {
    execFileSync("cargo", rustBuildArgs(targetDir), {
      cwd: sourceDir,
      env: hermeticEnv(sourceDir, { RUSTUP_TOOLCHAIN: channel }),
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? "";
    throw new AdmissionError(
      `Rust 构建失败（锁定工具链 ${channel}，断网 hermetic）：\n${stderr.slice(-2000)}`,
      "build-failed",
    );
  }
  const outDir = join(targetDir, "wasm32-unknown-unknown", "release");
  const name = crateLibName(sourceDir);
  const wasmPath = join(outDir, `${name}.wasm`);
  if (!existsSync(wasmPath)) {
    throw new AdmissionError(`构建未产出 ${wasmPath}`, "build-failed");
  }
  return {
    bytes: new Uint8Array(readFileSync(wasmPath)),
    toolchain: {
      language: "rust",
      channel,
      isolation: "host",
      rustflags: rustLinkFlags(sourceDir),
      cargoArgs: rustBuildArgs("<target-dir>"),
    },
  };
}

/** crate 名（Cargo.toml 的 package.name，连字符转下划线）。 */
export function crateLibName(sourceDir) {
  const toml = readFileSync(join(sourceDir, "Cargo.toml"), "utf8");
  const m = toml.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (!m) {
    throw new AdmissionError("Cargo.toml 未声明 package.name", "build-failed");
  }
  return m[1].replace(/-/g, "_");
}

/**
 * 闸 2 全流程：语言白名单 → 闸 0 源码预检 → 双独立构建器复现 → 哈希一致 → 闸 1 静态校验。
 *
 * 两次构建放在**两个互不相干的临时目录**里，且都用 hermeticEnv（断网、固定
 * SOURCE_DATE_EPOCH、抹掉绝对路径）。哈希不一致即拒：不可复现的东西不予签名，
 * 因为"客户同意跑的那一份"就无法被指认。
 */
export async function reproduceAndGate(
  sourceDir,
  { language, limits, atomicType } = {},
) {
  const lang = assertSourceLanguage(language ?? detectLanguage(sourceDir));

  // 闸 0：**在编译之前**排除编译期执行点（build.rs / proc-macro / .cargo runner /
  // npm 生命周期）。容器隔离是第二层兜底，不是第一层 ——
  // 被隔离住的坏东西仍然可以污染产物字节。
  let source;
  try {
    source = sourceGate(lang, nodeSourceFs(sourceDir));
  } catch (err) {
    if (err instanceof SourceGateError) {
      throw new AdmissionError(
        `源码预检失败[${err.reason}]：${err.message}`,
        "source-gate",
      );
    }
    throw err;
  }

  const dirs = [
    mkdtempSync(join(tmpdir(), "speckit-admit-a-")),
    mkdtempSync(join(tmpdir(), "speckit-admit-b-")),
  ];
  try {
    const first = buildRust(sourceDir, dirs[0]);
    const second = buildRust(sourceDir, dirs[1]);
    const hashA = sha256BytesHex(first.bytes);
    const hashB = sha256BytesHex(second.bytes);
    if (hashA !== hashB) {
      throw new AdmissionError(
        `不可复现构建：两个独立构建器哈希不一致（${hashA} ≠ ${hashB}）——拒绝入册，不予签名`,
        "not-reproducible",
      );
    }
    // 闸 1：复现出来的产物还得过静态白名单，否则同样拒。
    const report = staticGate(first.bytes, limits);
    return {
      atomicType: atomicType ?? null,
      language: lang,
      sha256: hashA,
      sizeBytes: first.bytes.length,
      bytes: first.bytes,
      toolchain: first.toolchain,
      sourceGate: source,
      staticGate: report,
      /** 复现构建证明引用：两构建器 + 同一哈希的凭据（写进审查背书）。 */
      reproducibleBuildRef: `repro:${lang}:${first.toolchain.channel}:${hashA}`,
    };
  } finally {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }
}

/**
 * "只交二进制"的负例。给一个 .wasm 而没有可复现构建的源码 →
 * 平台复现不出哈希 → MUST 拒绝入册。
 */
export async function admitBinaryOnly(sourceDir) {
  throw new AdmissionError(
    `无法从 ${sourceDir} 复现构建：只提供 .wasm 二进制而无源码时，` +
      `平台复现不出其哈希，模块 MUST 被拒（不接受不透明二进制）`,
    "no-reproducible-source",
  );
}
