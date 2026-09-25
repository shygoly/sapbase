# Change: Add Wasm Atomic Runtime

## Why

`wasm-modules/` 已经能产出**经过准入的** Wasm 原子模块（零能力 ABI、复现构建、静态白名单、
入库清单 `build/manifest.json`），但后端**无法加载、注册与执行**它们：

- 模块只是磁盘上的字节与一份 JSON 清单，没有进入数据库，也没有和 `module-registry` 关联；
- 没有宿主侧运行时来"先校验、再执行"，准入闸的结论没有被执行侧复用；
- 平台自研与第三方提交的原子在能力上与普通 TypeScript Service 无法区分，
  "客户可见契约、不可见实现"这条边界在代码里没有落点。

结果是：技术性保护的**管道**已经就位，但保护本身尚未生效（见 `docs/TECH_STACK_GAP.md` §7）。
本次变更把这段接上，并为后续 Blueprint / 许可（v3 设计 §5.2、§5.3、§11）提供承载点。

## What Changes

- **ADDED**: 原子契约注册表（Atomic Registry）—— 原子类型、版本、输入输出契约、权限、
  错误码、实现绑定（`sha256` / `abiVersion` / 准入层级 / 审查背书）
- **ADDED**: 模块清单导入 —— 读取 `wasm-modules/build/manifest.json`，落库并**重新校验字节**
  （不采信清单自述的哈希）
- **ADDED**: 宿主侧 Wasm 运行时 —— 加载、缓存实例、注入宿主内存、投影输入、调用 `run`、读回输出
- **ADDED**: 执行前检查 —— 静态白名单（复用 `@speckit/wasm-modules`）+ 吊销名单 + 准入状态 + 租户/权限
- **ADDED**: 资源限制与审计 —— 墙钟超时、输出上限、每次调用写审计（含模块哈希）
- **ADDED**: 原子调用 API（REST）与后端内部调用入口
- **MODIFIED**: `module-registry` —— 模块可声明其依赖的原子，注册表记录原子与模块的关联

## Impact

- **Affected specs**: 新能力 `atomic-registry`、`wasm-atomic-runtime`
- **Affected code**:
  - 复用：`wasm-modules/dist`（静态闸与吊销判定，两端共享同一份实现）
  - 新增：`backend/src/atomic-registry/`（实体、服务、控制器）
  - 新增：`backend/src/atomic-runtime/`（加载器、执行器、资源限制、审计）
  - 修改：`backend/src/module-registry/`（模块 → 原子依赖关联）
  - 新增迁移：`backend/src/migrations/*-CreateAtomicRegistry.ts`
- **Breaking changes**: 无（纯新增；未注册原子的模块行为不变）
- **Migration**: 现有 Service 方法可逐批登记为原子（先 TS 实现、后 Wasm 实现），登记前后行为一致

## Decisions Made

1. **宿主运行时选 Node 内置 WebAssembly（V8），不引入 Wasmtime**
   —— 理由与代价见 `design.md` 的"运行时选型"。核心权衡：V8 已在运行时内、零新增依赖、
   静态闸已能约束内存与能力面；代价是**没有 fuel 计费式的指令级限流**，
   因此 v1 用"静态闸 + 墙钟超时 + 输出上限"三道约束替代，指令级限流留到 Phase 4 评估。
2. **判定权在宿主，不在清单**：导入清单时对字节重算 SHA-256，与清单不符即拒。
3. **fail-closed**：静态闸不过、状态非可执行、命中吊销名单 —— 一律拒绝执行，
   **不回退到内置实现**（静默回退等于这道闸不存在）。
4. **原子契约与模块解耦**：原子是"能力"，Wasm 模块是"实现之一"。同一原子类型可以有
   TypeScript 实现（平台自研、跑在内核里）与 Wasm 实现（可交付、跑在沙箱里），
   契约相同、实现可换。
5. **v1 只做"计算型原子"**：`kind: calculation | query`。写入型原子（Command / Effect）
   涉及事务、幂等与补偿，需要与 Workflow Engine 的 Saga 一起设计，另立变更。
6. **权限沿用现有 RBAC**：原子声明所需权限点，复用 `backend/src/permissions`，
   不新造一套授权模型。

## Out of Scope

- 控制面签名与 License（v3 §11）——本次只在数据结构上预留 `signature` / `review` 字段
- Blueprint 包格式与编译器（v3 §5.3、§7）
- 第三方插件的完整沙箱（`backend/src/plugins` 的改造）
- 闸 3（输出管控）与闸 4（影子发布）
