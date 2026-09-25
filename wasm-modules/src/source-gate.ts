// 准入闸 0 —— 源码预检：排除**编译期**代码执行点。
//
// 为什么需要这一道：闸 1 只看产物 `.wasm`、闸 3 只看运行期，而 `cargo build` 会执行
// 第三方的 `build.rs` 与 proc-macro —— **编译期本身就是一个完整的代码执行点**，
// 且不被后面任何一道闸覆盖。
//
// 与"用平台复现构建作排除机制"同一思路：不是"政策上禁止在 build.rs 里干坏事"，
// 而是**带 build.rs 的源码根本进不来**。容器隔离（Dockerfile.builder）是第二层兜底，
// 不是第一层 —— 第一层在这里，因为被隔离的坏东西仍然可以污染产物字节。
//
// 纯文件系统读取，不执行任何被提交的内容。
//
// 移植来源：medtrust/packages/wasm-algorithms（见 README 的来源与改动说明）。

export type SourceGateReason =
  | "build-script" // build.rs / [package].build / [build-dependencies]
  | "dependencies" // 非空依赖（依赖可携带 build.rs 或 proc-macro）
  | "proc-macro" // 本 crate 即 proc-macro
  | "cargo-config" // .cargo/config.toml 可设 runner / linker → 任意命令
  | "as-transform" // asconfig.json 的 transform → 编译期 require 任意 js
  | "npm-lifecycle" // package.json scripts / node_modules 夹带
  | "workspace" // 多成员 workspace：审查面不可控
  | "layout"; // 布局不符合约定（缺 Cargo.toml / assembly 等）

export class SourceGateError extends Error {
  constructor(
    message: string,
    readonly reason: SourceGateReason,
  ) {
    super(message);
    this.name = "SourceGateError";
  }
}

export interface SourceGateReport {
  language: "rust" | "assemblyscript";
  /** 逐条通过的检查项，写进准入记录留痕。 */
  checks: string[];
}

/** 注入的文件系统读取接口 —— 便于测试与跨环境（控制面 / CLI）复用。 */
export interface SourceFs {
  exists(relPath: string): boolean;
  readText(relPath: string): string;
  /** 递归列出相对路径（用于查禁止的文件名）。 */
  list(): string[];
}

/** Rust：编译期执行点全部堵死。 */
export function rustSourceGate(fs: SourceFs): SourceGateReport {
  const checks: string[] = [];

  if (!fs.exists("Cargo.toml")) {
    throw new SourceGateError("Rust 源码缺少 Cargo.toml", "layout");
  }
  const manifest = fs.readText("Cargo.toml");

  // ── build.rs：cargo 会在编译期以宿主权限执行它。
  const files = fs.list();
  const buildScripts = files.filter((f) => /(^|\/)build\.rs$/.test(f));
  if (buildScripts.length > 0) {
    throw new SourceGateError(
      `源码含 build script（编译期任意代码执行，不被闸 1/闸 3 覆盖）：${buildScripts.join(", ")}`,
      "build-script",
    );
  }
  if (/^\s*build\s*=/m.test(stripComments(manifest))) {
    throw new SourceGateError(
      "Cargo.toml 声明了 [package].build（自定义 build script）——编译期执行点，拒绝",
      "build-script",
    );
  }
  checks.push("no-build-script");

  const sections = tomlSections(manifest);

  if (sectionHasEntries(sections["build-dependencies"])) {
    throw new SourceGateError(
      "Cargo.toml 含 [build-dependencies]（构建依赖在编译期执行）——拒绝",
      "build-script",
    );
  }

  // ── 依赖必须为空：任何依赖都可能自带 build.rs 或 proc-macro，
  //    而"平台审查过这份源码"的承诺要求审查面是封闭的。
  for (const name of Object.keys(sections)) {
    if (name !== "dependencies" && !name.endsWith(".dependencies")) continue;
    if (name.startsWith("dev-") || name.includes(".dev-dependencies")) continue;
    if (sectionHasEntries(sections[name])) {
      throw new SourceGateError(
        `Cargo.toml 的 [${name}] 非空。第一版要求**零依赖**：依赖可携带 build.rs / ` +
          `proc-macro，且会把审查面扩散到平台没审过的代码。需要依赖请走 vendored + 白名单（另立变更）`,
        "dependencies",
      );
    }
  }
  checks.push("no-dependencies");

  // ── 本 crate 不得是 proc-macro（proc-macro 就是在编译期跑的代码）。
  if (/proc-macro\s*=\s*true/.test(stripComments(manifest))) {
    throw new SourceGateError(
      "Cargo.toml 声明 proc-macro = true（编译期执行）——拒绝",
      "proc-macro",
    );
  }
  checks.push("not-proc-macro");

  // ── .cargo/config.toml 可设 runner / linker / rustflags → 编译或"运行"时任意命令。
  const cargoConfigs = files.filter((f) =>
    /(^|\/)\.cargo\/config(\.toml)?$/.test(f),
  );
  if (cargoConfigs.length > 0) {
    throw new SourceGateError(
      `源码含 .cargo 配置（可覆盖 runner / linker / rustflags，等于任意命令执行）：${cargoConfigs.join(", ")}`,
      "cargo-config",
    );
  }
  checks.push("no-cargo-config");

  // ── 只接受单 crate：workspace 成员会把审查面扩散到未声明的目录。
  if (sections["workspace"] !== undefined) {
    throw new SourceGateError(
      "Cargo.toml 含 [workspace]：准入只接受单 crate（审查面必须封闭）",
      "workspace",
    );
  }
  checks.push("single-crate");

  assertNoNpmLifecycle(fs, checks);
  return { language: "rust", checks };
}

/** AssemblyScript：asc 的编译期插件（transform）是同类执行点。 */
export function assemblyScriptSourceGate(fs: SourceFs): SourceGateReport {
  const checks: string[] = [];

  if (!fs.exists("assembly")) {
    throw new SourceGateError(
      "AssemblyScript 源码缺少 assembly/ 目录",
      "layout",
    );
  }

  // asc 会自动读取 cwd 下的 asconfig.json；其中的 transform 会被 require() 执行。
  for (const candidate of ["asconfig.json", "asconfig.js"]) {
    if (!fs.exists(candidate)) continue;
    const raw = fs.readText(candidate);
    if (/"?transform"?\s*:/.test(raw)) {
      throw new SourceGateError(
        `${candidate} 声明了 transform（asc 编译期插件，会 require 任意 js）——拒绝`,
        "as-transform",
      );
    }
    if (candidate === "asconfig.js") {
      throw new SourceGateError(
        "asconfig.js 是可执行配置（编译期求值）——只接受 asconfig.json",
        "as-transform",
      );
    }
  }
  checks.push("no-as-transform");

  assertNoNpmLifecycle(fs, checks);
  return { language: "assemblyscript", checks };
}

/** 两种语言共用：npm 生命周期脚本与夹带的 node_modules。 */
function assertNoNpmLifecycle(fs: SourceFs, checks: string[]): void {
  if (fs.exists("package.json")) {
    let pkg: { scripts?: Record<string, unknown> };
    try {
      pkg = JSON.parse(fs.readText("package.json")) as typeof pkg;
    } catch {
      throw new SourceGateError(
        "package.json 解析失败（解析不动一律拒）",
        "layout",
      );
    }
    const scripts = Object.keys(pkg.scripts ?? {});
    if (scripts.length > 0) {
      throw new SourceGateError(
        `源码 package.json 含 scripts（${scripts.join(", ")}）——npm 生命周期是编译期执行点，拒绝`,
        "npm-lifecycle",
      );
    }
  }
  if (fs.exists("node_modules")) {
    throw new SourceGateError(
      "源码夹带 node_modules（未经审查的第三方代码）——拒绝",
      "npm-lifecycle",
    );
  }
  checks.push("no-npm-lifecycle");
}

/** 粗粒度去注释：只为避免注释里的字样造成误判，不做完整 TOML 解析。 */
function stripComments(toml: string): string {
  return toml
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("#");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
}

/** 极简 TOML 分节：够用来判断某个 section 是否存在、是否有条目。 */
function tomlSections(toml: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let current: string | null = null;
  for (const raw of stripComments(toml).split("\n")) {
    const line = raw.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      current = header[1].trim();
      out[current] ??= [];
      continue;
    }
    if (current && line.length > 0) out[current].push(line);
  }
  return out;
}

function sectionHasEntries(lines: string[] | undefined): boolean {
  return (lines ?? []).some((l) => l.includes("="));
}

/** 按语言分派。语言由调用方（detectLanguage）先定好。 */
export function sourceGate(
  language: "rust" | "assemblyscript",
  fs: SourceFs,
): SourceGateReport {
  return language === "rust"
    ? rustSourceGate(fs)
    : assemblyScriptSourceGate(fs);
}

// ── Node 文件系统实现 ────────────────────────────────────────────────────────

/**
 * 真实目录上的 SourceFs。**只读不执行**：不 require、不 spawn、不解析为代码。
 * 不下潜 `target/` 与 `node_modules/`（体量大且无需逐个列举——存在性本身就够判定）。
 */
export function nodeSourceFs(rootDir: string): SourceFs {
  // 延迟到调用时才 require，使本模块在非 Node 环境下仍可被打包引用。
  // 类型上用 any：本包不引入 @types/node（编译零依赖），但运行时只在 Node 下调用。
  const nodeFs = require("node:fs") as NodeFsLike;
  const nodePath = require("node:path") as NodePathLike;
  const SKIP_DESCENT = new Set(["target", "node_modules", ".git"]);
  const MAX_ENTRIES = 5000;

  const abs = (rel: string) => nodePath.join(rootDir, rel);

  return {
    exists: (rel) => nodeFs.existsSync(abs(rel)),
    readText: (rel) => nodeFs.readFileSync(abs(rel), "utf8"),
    list: () => {
      const out: string[] = [];
      const walk = (dir: string, prefix: string): void => {
        if (out.length >= MAX_ENTRIES) return;
        let entries: NodeDirentLike[];
        try {
          entries = nodeFs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const rel = prefix ? `${prefix}/${e.name}` : e.name;
          out.push(rel);
          if (e.isDirectory() && !SKIP_DESCENT.has(e.name)) {
            walk(nodePath.join(dir, e.name), rel);
          }
        }
      };
      walk(rootDir, "");
      return out;
    },
  };
}

// ── 最小运行时类型（不引入 @types/node 的代价） ──────────────────────────────

interface NodeDirentLike {
  name: string;
  isDirectory(): boolean;
}

interface NodeFsLike {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string, options: { withFileTypes: true }): NodeDirentLike[];
}

interface NodePathLike {
  join(...parts: string[]): string;
}

declare const require: (id: string) => unknown;
