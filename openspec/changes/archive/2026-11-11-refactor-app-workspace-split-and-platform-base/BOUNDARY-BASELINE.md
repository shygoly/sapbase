# P0 边界基线（refactor-app-workspace-split-and-platform-base）

> 记录时间：2026-11-04
> 命令：`npm run check:boundaries` / `npm run lint:boundaries`
> 图规模：7 projects，2 edges

## 结论

| 检查 | 结果 |
|---|---|
| `check-boundaries.mjs`（B0–B5，图级） | **0 violation** |
| `lint:boundaries`（ESLint 规则，文件级） | **0 problem**（0 error / 0 warn） |

基线为空，P5 可直接把 `warn` 升 `error`，不需要逐条豁免。

## P0 期间的三个发现

### 1. `lint:boundaries` 之前是「假绿」

修复前：

```
$ npm run lint:boundaries
warning No cached ProjectGraph is available. The rule will be skipped.
          @nx/enforce-module-boundaries
```

`@nx/enforce-module-boundaries` 拿不到 ProjectGraph 时**整条规则跳过**，退出码 0。
加上配置本身是 `warn`，等于「边界可机器检查」在 P0 之前从未成立。

修复：`lint:boundaries` 先 `nx graph --file=.nx/boundary-graph.json` 预热再跑 ESLint。
验证方法（已实测）：在 `libs/agent-kernel/src` 放一个跨层 import，
规则会报 `Projects cannot be imported by a relative or absolute path`。

### 2. 激活规则后立刻暴露 6 条 tag 配置矛盾

规则恢复后报出 6 条（全是同一个根因）：

```
backend/src/agent-feedback/agent-feedback.service.ts:6     @sap/agent-kernel
backend/src/agent-sessions/agent-sessions.service.ts:5      @sap/agent-kernel
backend/src/agent-sessions/agent-sessions.service.spec.ts:1 @sap/agent-kernel
backend/src/agent-tools/agent-tool.registry.ts:28           @sap/agent-kernel
backend/src/releases/releases.service.ts:5                  @sap/release-kernel
backend/src/releases/release-kernel.spec.ts:1               @sap/release-kernel
```

根因：`backend` 同时声明 `type:app` 与 `layer:app`。Nx 的 `depConstraints` 是 **AND 语义**，
两条规则同时命中时取更严的那条：

```js
{ sourceTag: 'layer:app', onlyDependOnLibsWithTags: ['layer:domain','layer:app','layer:infra','layer:shared'] }
{ sourceTag: 'type:app', onlyDependOnLibsWithTags: [...,'layer:agent','layer:release','layer:ui'] }
```

于是组合根**永远**无法装配 agent / release 库。这不是代码违规，是 tag 模型缺陷。

修复：`layer` 只描述**库**的架构层，组合根（`type:app`）不声明 `layer`。
已从 `backend`、`speckit` 移除 `layer`，并同步到规则 `B0`。

### 3. `backend` 仍是混层单体（P3 偿还）

移除 `layer:app` 后，`backend` 内部「基座 + 平台能力 + 业务域」混在一起的问题**没有消失**，
只是不再由 tag 规则误报。这部分由 P3（抽 `platform-core` / `platform-release`）偿还。

**P3 完成前，`backend` 的依赖方向不具约束力**——它没有 `layer`，只受 `type:app` 的宽松规则约束。

## 已知盲区（P1–P4 期间逐步补齐）

| 规则 | 现状 | 何时真正有约束力 |
|---|---|---|
| B1/B2（基座不依赖域/前端） | 无 `layer:platform` 项目，规则空转 | P3 |
| B3（域间不互依赖） | 无 `layer:domain` 项目，规则空转 | P4 |
| B4（浏览器不依赖 Node） | `speckit` 无出边，规则空转 | P2 |
| B5（agent 内核不直达业务） | `agent-kernel` 无出边，规则空转 | P3 |

> 空转不等于没用：`boundaries.test.mjs` 用夹具覆盖了每条规则的正例与反例（15 个用例），
> 规则本身是可验证的；只是仓库里还没有可被它抓到的真实结构。

## 如何更新基线

```bash
# 把当前违规写入 meta-baseline.json 的 check-boundaries 键
node scripts/meta/check-boundaries.mjs --baseline meta-baseline.json --update-baseline

# 之后运行会把这些条目标记为 [WARN][baseline]，不阻塞；新增违规仍然是 error
node scripts/meta/check-boundaries.mjs --baseline meta-baseline.json
```

当前基线为空，不需要 `--baseline`。
