# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **B0** 工程转正 | 依赖收敛 + CI 转强制 | `npx tsc --noEmit` 0 错误；`npm run build --workspace backend` 与 `--workspace speckit` 通过；全量测试保持全绿 |
| **B1** 协议冻结 | 包格式 + manifest + IR 规范 | `openspec validate --strict` 通过；两个 Schema 能校验正例、拒绝 5 类负例 |
| **B2** 打包与解包 | `.erpkg` 读写 + 校验和 | jest：打包→解包往返等价；篡改任一文件被拒；manifest 与内容不符被拒 |
| **B3** 编译器 | 校验 → 依赖闭包 → 冲突检测 → IR | jest：四类冲突各有负例；原子依赖不可用被拒；IR 文本/结构往返一致 |
| **B4** 运行时可加载 | Loader/Verifier | jest：合法包加载成功并给出 `resolvedAtomics`；哈希/IR 摘要/依赖任一不符即拒且**不部分加载** |
| **B5** 端到端 | 模块 → 包 → 编译 → 加载 → 原子解析 | e2e：真实模块导出包，编译通过，加载后原子依赖解析到 `available-inventory`，并可经 HTTP 调用该原子 |

### 执行约定

> **B1 证据（2026-09-25）**：`jest src/blueprint` → **22 passed**；
> 全量回归：单元 **145** × 两引擎（123 + 22 新增）、e2e **3**、wasm-modules **53**、`tsc --noEmit` **0 错误**；
> `shared-schemas` 构建通过（类型可编译）。
>
> **B2 证据（2026-09-25）**：`jest src/blueprint` → **45 passed**（validator 22 + packager 18 + controller 5）；
> 全量回归：单元 **168** × 两引擎、e2e **3**、`tsc --noEmit` **0**、`nest build` 通过。
> 一处如实标注：路径穿越**没有**用 `adm-zip` 造出集成样本（它在写入时会自行清理 `../`），
> 因此改为对纯函数 `assertSafeEntryName` 做 6 类恶意条目名的表驱动测试 —— 检查仍然必要，
> 因为来自外部的恶意包不受那层清理保护。
>
> **B3 证据（2026-09-25）**：`jest src/blueprint` → **61 passed**（validator 22 + packager 18 + controller 7 + compiler 14）；
> 全量回归：单元 **184** × 两引擎、e2e **3**、`tsc --noEmit` **0**。
> 编译器负例覆盖：未覆盖文件被拒 / 形状非法 / 原子依赖不可满足 / 四类冲突（重复定义、悬空引用、流程成环、状态机三种非法）/
> 实体关系成环**不**报错（防误报的反例）。IR 往返：结构与文本互相导出等价，且文本→结构→文本逐字节一致。
> 顺带发现：`shared-schemas` 是**构建产物**被后端消费，改了类型必须重建（CI 的 apps job 已先 build shared-schemas）。
>
> **B4 证据（2026-09-25）**：`jest src/blueprint` → **77 passed**（validator 22 + packager 20 + controller 12 + compiler 14 + loader 11，本里程碑新增 16）；
> 全量回归：单元 **200** × 两引擎、e2e **3**、`tsc --noEmit` **0**。
> 加载负例：IR 摘要漂移 / 原子依赖不可满足 / Wasm 实现缺 `moduleSha256` / 包内有未覆盖文件；
> 另有"计划里出现悬空动作"的纯函数负例 —— 这条在正常路径够不到（编译器只允许调用已声明的原子），
> 保留它作纵深防御，并在测试里写明为什么只能以纯函数方式测。
> 确定性：同一包重复加载得到同一 `irDigest` 与逐字节相同的 `irText`。
>
> **B5 证据（2026-09-25）**：`jest src/module-registry` → **28 passed**（既有 4 + 导出 24）；
> e2e `test/blueprint-pipeline.e2e-spec.ts` → **2 passed**（真实 PostgreSQL + 真实 Wasm 产物）。
> 全量回归：单元 **212** × 两引擎、e2e **5**（原子 3 + 蓝图管线 2）、wasm-modules **53**、`tsc --noEmit` **0**。
> 收口用例逐步断言：模块记录 → 骨架内容（实体名、字段为空）→ manifest 依赖 → 编译摘要写回 → 清单里的 `compiled.irDigest` →
> 加载后的 `resolvedAtomics` → 经 HTTP 调用该原子返回的 `moduleSha256` 与计划里的绑定**一致**。
>
> **顺带发现（既有缺口，不在本变更范围）**：`ModuleRegistryService.findOne` 会 JOIN `createdBy`，
> 而 `User` 实体仍声明着库里没有的 `role` / `department` / `permissions` 列
> （库侧已迁到 `roleId` / `departmentId`），于是那条查询在真实库上直接报
> `column ModuleRegistry__ModuleRegistry_createdBy.role does not exist` ——
> 受影响的既有接口包括 `GET /api/module-registry/:id`、`:id/capabilities`、`:id/relationships`、`:id/configurations`
> 与 `addCapability` 等（同一实体的查询都受牵连，含登录路径）。本次**不顺手改**：
> 它属"用户模型与迁移的一致性"，改动面覆盖 auth 与组织成员，应另立变更。
> 导出路径因此改用**窄查询**（只要模块行 + capabilities），并在代码里写明原因；
> e2e 里那一行 capability 用 SQL 造，是为了不把无关失败掩进蓝图管线用例。

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. 协议先行：B1 未完成不进 B2。
3. fail-closed：任何校验失败都拒绝，不提供部分加载、不静默降级。
4. 每个里程碑结束跑一次全量回归（123 单元 + 3 e2e + 53 wasm-modules）。

## Phase B0: 工程转正（前置）

- [x] `npm install` 收敛依赖树（1502 包；workspace 链接 `@speckit/wasm-modules` 就位）
- [x] 修掉两个被缺依赖掩盖的真实问题：`seeds/seed.ts` 字段名（password → passwordHash）、`/login` 缺 Suspense 边界
- [x] 移除"未安装依赖"时期的临时桥接（jest moduleNameMapper / tsconfig paths）
- [x] CI 的 `apps` job 转强制门禁；`docs/PACKAGE_MANAGER.md` 遗留项标记已解决
- [x] 提交 `8848e28`（含 package-lock.json）

## Phase B1: 协议冻结

- [x] `schemas/blueprint-package.schema.json`（manifest：id/version/runtime/依赖/分层/files 校验和/license 位；`filePath` 模式禁止 `..` 与绝对路径）
- [x] `schemas/blueprint-ir.schema.json`（结构化 IR：`blueprint-ir/v1`；动作 `kind` 决定必填字段）
- [x] `docs/protocols/blueprint-ir.md`（文本语法 + 结构形态 + 往返等价要求 + 兼容性判据）
- [x] `shared-schemas/src/v1/blueprint.ts` 暴露类型（**只放类型不放判定**，权威仍是 Schema）
- [x] `backend/src/blueprint/blueprint-validator.ts`：形状校验（jsonschema）+ **跨字段一致性**（分层⊆files、files 全覆盖、不得跨层重复）——后者是 draft-07 表达不了的部分
- [x] 测试 **22 项**：正例 + 10 类形状负例 + 3 类一致性负例 + 路径穿越 + 6 类 IR 负例
- [x] 顺带：schema 加载器从 `atomic-registry/schema-loader.ts` 挪到 `common/protocol/schema-loader.ts`（原子与蓝图两个上下文共用，命名不再误导）

## Phase B2: 打包与解包

- [x] `backend/src/blueprint/packager.ts`：目录 → `.erpkg`（清单由打包器**生成**：逐文件 sha256 + 按路径约定分层，生成后立即用协议校验器自检）
- [x] 解包：`.erpkg` → **内存结构（不落盘）**；`assertSafeEntryName` 拒绝穿越 / 绝对路径 / 盘符
- [x] 失败路径逐类给原因码：缺清单、哈希不符、缺文件、多出未声明文件
- [x] `POST /api/blueprints/package`、`GET /api/blueprints`、`GET /api/blueprints/:id/manifest`（v1 的"注册表"= 服务器上一个目录，`BLUEPRINT_PACKAGES_DIR`）
- [x] 测试：往返等价、分层推导、篡改/缺失/多余被拒、6 类可疑条目名被拒、解包不落盘

## Phase B3: 编译器

- [x] 补两个**内容 Schema**（B1 只冻了包与 IR）：`blueprint-semantic.schema.json`、`blueprint-flows.schema.json`
- [x] `compiler.ts`：逐文件 Schema（**未覆盖的文件拒绝，不跳过**）→ 依赖闭包（`AtomicRegistryService.resolve`）→ 冲突检测 → IR（生成后自检）
- [x] 冲突检测四类：重复定义 / 悬空引用 / **流程成环** / 状态机合法性（初始态唯一、有终态、无不可达、迁移目标已声明），每类都有负例
- [x] IR 生成：结构 + 文本；`parseIrText(toIrText(ir))` 等价 + 文本↔结构逐字节往返
- [x] `POST /api/blueprints/:id/compile`（冲突明细逐条返回，不是一句"编译失败"）
- [x] **自我修正**：初稿的"实体关系图环检测"会大量误报（`Employee.manager` 自引用、`Order.billingCustomer` 回指都合法）。
      改为只对 flow 步骤图检测，并把"**v1 的 flow 是 DAG**"作为协议约定写进 design.md（回环场景用事件再次触发流程表达）
- [x] 引用了 v1 未覆盖的规则层 → 明确报为悬空，而不是静默放过

## Phase B4: 运行时可加载

- [x] `loader.ts`：包完整性（解包自验）→ 编译（Schema/依赖闭包/冲突/IR）→ **防漂移**（比对 `compiled.irDigest`）→ 绑定 → `LoadedBlueprint`
- [x] 绑定把"要跑哪一份代码"定在加载期：每个 `check` 动作带 `binding`（契约版本 + `moduleSha256` + tier），而不是等第一次调用才查
- [x] 编译记录**可写回**（`stampCompiled`）：`POST /:id/compile` 带 `{stamp:true}` 时把 IR 摘要写进包内清单 —— 否则 `compiled` 字段只是协议里的死字段，"防漂移"无从发生
- [x] fail-closed：任一不过即拒，无部分加载；错误类型不混用（编译期 `CompileError` / 加载期 `LoadError` / 包 `PackageError`）
- [x] `POST /api/blueprints/:id/load`（返回可执行计划 + `resolvedAtomics`）

## Phase B5: 端到端

- [x] `module-registry` 增加"导出最小蓝图"能力：`blueprint-export.ts`（纯函数）+ `exportBlueprint(moduleId, org, {dir,out})` + `POST /api/module-registry/:id/export-blueprint`
- [x] 导出只声明模块**确实拥有**的东西（实体名来自 capability / `metadata.entities`；原子依赖来自 `dependsOnAtomics`），字段与生命周期**不编**；不合命名约定的候选连原因一起回报，不静默丢弃
- [x] 原子依赖逐条解析（与发布同一判据）：解析不到即拒，不交付"编译必然失败"的包
- [x] e2e：真实模块 → 导出 → 打包 → 编译（写回摘要）→ 加载 → 原子绑定 → **经 HTTP 调用该原子**，并断言计划里的 `moduleSha256` 与调用返回值一致
- [x] 文档：`META_LANGUAGE.md` 协议状态位（协议 2 📋→✅、协议 3 ❌→🟡、协议 4 补落点）+ 新增 §3.8 编译与加载链；`TECH_STACK_GAP.md` 第 3 / 5.1 / 5.3 节对应行更新
