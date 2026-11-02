## Context

现有 npm workspaces 已经能构建与测试，但项目之间没有声明依赖方向。
Nx 的价值不是“换构建工具”，而是把工程结构变成可检查的图：
`app → domain → shared`，`infra` 只通过端口被依赖，Agent 只能经工具面进入业务。

迁移原则：**每一步都可发布，不搞大爆炸**。先用 Nx 包住旧结构，再逐步移动文件。

## Goals / Non-Goals

- Goals
  - `nx graph` 能列出四个现有项目
  - 每个项目有 `type` / `scope` / `layer` / `runtime` 四个 tag
  - 越界依赖在 ESLint 中可见（先 warn）
  - 至少抽出一个纯函数 lib，证明抽取路径可行
- Non-Goals
  - 不重命名目录、不改业务代码结构
  - 不开启 Nx Cloud、不引入远程缓存
  - 不用 `affected` 替代关键路径全量回归

## Decisions

- Decision: 保留 npm workspaces，Nx 只做 project graph 与任务编排。
  - 理由：唯一锁文件必须保持根 `package-lock.json`；不能引入 pnpm/yarn/bun。
  - 命令在 PowerShell 下若 `npx.ps1` 被执行策略阻止，使用 `npm exec --` 形式。
- Decision: 先给现有四个 workspace 建 `project.json`，不移动目录。
  - 理由：先让 `nx graph` 可见，再谈物理拆分。
- Decision: 边界规则初始 `warn`，违规清单进 CI 报告。
  - 理由：存量越界可能不少，直接 `error` 会阻塞所有 PR。
- Decision: 第一个抽出 `libs/shared-core`，包含 `money.ts` 与 `canonical-json.ts`。
  - 理由：两者都是零 IO 纯函数，且被 Blueprint 摘要/金额计算共用，风险最低。
  - 兼容：旧文件保留 `export * from '@sap/shared-core'`，避免一次性改所有 import。

## Risks / Trade-offs

- 风险：Nx 版本与现有 TypeScript/ESLint 版本冲突 → 先只装 Nx 核心与 eslint 插件，锁定版本。
- 风险：根 ESLint flat config 与 `speckit`/`backend` 各自的 ESLint 配置冲突 → 边界规则只加在根配置，子项目仍用自己的配置。
- 风险：抽取 `money.ts` 改变模块解析 → 先建 lib、再 re-export、最后跑全量后端测试。
- 权衡：本变更不会立刻把违规降为零，但会让“新增越界”可见。

## Migration Plan

1. 安装 Nx 依赖并生成 `nx.json` / `tsconfig.base.json`。
2. 给四个 workspace 加 `project.json` 与 tags，跑 `nx graph`。
3. 加边界规则（warn），记录违规清单。
4. 抽 `libs/shared-core` 并保留兼容 re-export。
5. 回退：删除 Nx 配置与 devDependencies，旧 npm scripts 不受影响。

## Open Questions

- `libs/domain-*` 的第一批候选是 Blueprint 规则还是 Chat 意图规则？
  - 本变更只做 `shared-core`；domain 抽取在后续变更按限界上下文逐个进行。
- 是否为 `shared-schemas` 增加 `@sap/shared-schemas` 别名？
  - 本变更先保留 `@speckit/shared-schemas`，新代码才使用 `@sap/*`，避免大规模改 import。
