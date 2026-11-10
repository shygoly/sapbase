# 新增一个业务域（以航运为样板）

> 真源：`docs/META_LANGUAGE.md` §5.2、`docs/ARCHITECTURE.md` §1–§2。
> 本文只回答一个问题：**从零加一个业务域，要动哪些文件、跑哪些检查**。
> 样板：`libs/domain-shipping`（后端）+ `libs/ui-shipping`（前端）。

## 0. 先判断边界

一个业务域 = 一个限界上下文，必须能回答：

- 它拥有哪些表 / 实体？表前缀统一（如航运 `ships` / `voyages` / `charters`）。
- 它对外暴露哪些用例？用例是 service 的公开方法，不是 Controller 本身。
- 它依赖谁？只允许 `platform-*` / `agent-tools` / `shared-*`。
- 谁依赖它？`apps/api` 装配它；其他域只能走公开入口或事件。

不满足这四条，先拆域，不要先写代码。

## 1. 建两个 Nx project

业务域固定一对：

| 项目 | 目录 | tags |
| --- | --- | --- |
| `domain-<name>` | `libs/domain-<name>` | `type:lib,scope:<name>,layer:domain,runtime:node` |
| `ui-<name>` | `libs/ui-<name>` | `type:lib,scope:<name>,layer:ui,runtime:browser` |

以航运为例：

```text
libs/domain-shipping/
  project.json      # name: domain-shipping, tags: type:lib,scope:shipping,layer:domain,runtime:node
  package.json      # name: @sap/domain-shipping, main/types: dist/*
  tsconfig.json     # extends ../../tsconfig.base.json, outDir dist
  src/index.ts      # 公开入口（只导出用例与类型）
  src/migrations/   # 本域迁移；文件名仍用 <timestamp>-<Name>.ts
  src/scripts/      # 本域运维脚本（导入 / 重算）
```

```text
libs/ui-shipping/
  project.json      # name: ui-shipping, tags: type:lib,scope:shipping,layer:ui,runtime:browser
  package.json      # name: @sap/ui-shipping, main/types: ./src/index.ts（源码直引）
  tsconfig.json     # jsx preserve / noEmit
  src/index.ts      # 公开组件出口
  src/components/   # 域内组件
  src/pages/        # Next 页面组件（路由壳在 app 里 re-export）
```

为什么要拆两个 project：`runtime:browser → runtime:node` 是必须守的边；
把前后端塞进一个 project 会让这条规则失效（见 `docs/ARCHITECTURE.md` §2）。

## 2. 后端：实体、迁移、用例

1. **实体**：`src/**/*.entity.ts`，继承 `@sap/platform-core` 的基类约定。
   如果本域没有 ORM 实体（例如航运当前由 Semantic Runtime 承载），跳过实体，
   但仍要把迁移和领域脚本放进 `domain-<name>`。
2. **迁移**：放 `libs/domain-<name>/src/migrations/`。文件名保持
   `<13 位时间戳>-<ClassName>.ts`，类名 `implements MigrationInterface`。
   `apps/api/scripts/rebuild-database.ts` 会自动扫描 `libs/domain-shipping/src/migrations`
   并把它们并入「从零重建」台账；新增域时把目录补进 `legacyMigrations()` 的 `dirs`。
3. **用例**：service 只依赖 `@sap/platform-core`、`@sap/platform-release`、
   `@sap/shared-*` 与端口。**不要 import 另一个域的内部实现**。
   - 需要应用层能力（通知、Outbox、AI 模块）时，在本域声明结构化端口，
     由 `apps/api` 的 module 用工厂注入（参考 `releases/release-ports.ts`）。
4. **模块装配**：本域的 `*.module.ts` 留在 `apps/api` 组合根（D5），
   或提供 `forRoot/register` 让组合根传端口；不要让它反向依赖应用层。
5. **注册**：
   - 实体加进 `apps/api/src/app.entities.ts` 的 `APP_ENTITIES`；
   - Nest module 加进 `apps/api/src/app.module.ts` 的 `imports`；
   - 有 cron 的，同步 `FLOWS.md` + `monitor/scheduled-job.registry.ts` + `@Cron(name:)`。

## 3. 前端：页面与组件

1. 组件放 `libs/ui-<name>/src/components/`。
2. 页面组件放 `libs/ui-<name>/src/pages/`；Next 路由目录只留一行兼容壳：

   ```tsx
   // apps/web-portal/src/app/dashboard/<name>/page.tsx
   export { default } from '@sap/ui-shipping/pages/shipping/ships'
   ```

3. 加 `tsconfig.base.json` 与两个 app 的 `tsconfig.json` 路径别名：

   ```jsonc
   "@sap/ui-shipping": ["libs/ui-shipping/src/index.ts"],
   "@sap/ui-shipping/*": ["libs/ui-shipping/src/*"]
   ```

4. 域组件只能 import `@sap/ui-kit` / `@sap/ui-theme` / `@sap/ui-layout` /
   `@sap/ui-runtime` / `@sap/api-client` / `@sap/shared-*`；
   **不得** import `@sap/app-shared` 的内部路径（app-shared 是应用层，会反向依赖）。
5. 治理台复用域组件时，直接 import `@sap/ui-<name>`；不要复制一份。

## 4. 跑检查（四道）

```bash
npm run build --workspace @sap/domain-<name>    # 后端域可编译
npm run build --workspace @sap/ui-<name>        # 前端域 typecheck（源码直引）
npm run check:boundaries                        # B0–B5，0 violation
npm run lint:boundaries                         # ESLint 规则，0 error
npx nx graph                                    # 图里能看到两个新节点与允许的边
```

允许的边（单向）：

```text
apps/*        → 任意 lib
ui-*          → ui-kit / ui-theme / ui-layout / ui-runtime / api-client / shared-*
domain-*      → platform-* / shared-*（不得 import ui-*）
platform-*    → shared-* / release-kernel（不得 import domain-* / ui-*）
agent-tools   → platform-* / domain-*（仅公开入口）
agent-kernel  → shared-*（不得 import platform / domain）
```

## 5. 验收清单

- [ ] `nx graph` 里 `domain-<name>` / `ui-<name>` 的入边/出边符合 §4。
- [ ] 页面路由在 `next build` 输出里出现，且数量与设计一致。
- [ ] `npm run check:all` 0 error（DOMAIN / FLOWS / DECISIONS / AGENT-TOOLS / boundaries）。
- [ ] 新增迁移进入「从零重建」台账：`npx ts-node scripts/rebuild-database.ts --db=sapbase_rebuild`。
- [ ] 域内没有 `backend/`、`speckit/` 之类的旧路径引用。
