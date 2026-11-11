# Change: Add Blueprint Package and Compiler

## Why

平台的定义是「客户购买、设计和组合一个 **Blueprint**，由统一 Runtime 编译成可运行的企业系统」。
现在这条链上只有**最后一环**是实的：

```text
模块定义（部分：ai-modules 固定步骤生成）
   ↓
Blueprint 包         ❌ 没有格式、没有分层、没有依赖声明
   ↓
编译器 / IR          ❌ 没有（无法声明"这份蓝图能不能跑"）
   ↓
Runtime 加载          ❌ 没有加载入口
   ↓
原子执行             ✅ 已落地（Wasmtime sidecar + 原子注册表 + 闸 + 审计）
```

后果很具体：`module-registry` 里的模块只是数据库记录，**无法导出、无法版本化、无法在别处重建**；
`atomic-registry` 的能力也只在运行时被解析，没有一份可交付、可校验的"业务定义"。
于是 v3 设计的核心承诺（蓝图可交易、可迁移、可本地运行）三个都不成立。

## What Changes

- **ADDED**: `schemas/blueprint-package.schema.json` —— 蓝图包格式（manifest / 分层可见性 / 依赖 / 校验和 / 签名位）
- **ADDED**: `docs/protocols/blueprint-ir.md` —— IR 规范（编译器输出、Runtime 输入；文本形态便于审计）
- **ADDED**: 编译器 `backend/src/blueprint/compiler/`：
  Schema 校验 → 依赖解析（semver + 原子依赖）→ 冲突检测（状态机合法性、重复定义、循环依赖）→ IR 生成
- **ADDED**: 打包/解包（`.erpkg` = zip + manifest）：`POST /api/blueprints/package`、`POST /api/blueprints/compile`
- **ADDED**: 运行时 Loader/Verifier：加载蓝图包并校验哈希、manifest 与依赖，接入现有 `AtomicRegistryService.resolve`
- **ADDED**: 端到端：一个真实模块定义 → 蓝图包 → 编译 → 加载 → 其原子依赖解析到已实现原子

## Impact

- **Affected specs**: 新能力 `blueprint-package`、`blueprint-compiler`；`atomic-registry` 的 MODIFIED（清单导入要能接受蓝图包内的原子依赖声明）
- **Affected code**:
  - 新增：`schemas/blueprint-package.schema.json`、`docs/protocols/blueprint-ir.md`
  - 新增：`backend/src/blueprint/`（compiler / packager / loader / controller）
  - 复用：`atomic-registry`（原子解析）、`module-registry`（模块与原子依赖）、`shared-schemas`（类型）
- **Breaking changes**: 无（纯新增；现有模块记录不受影响）
- **Migration**: 现有 `module-registry` 记录可被导出一个"最小蓝图"（只含语义与依赖声明），逐步补全 flows/rules/forms

## Decisions Made

1. **包是 zip + manifest，不是目录**：可交付、可校验、可签名；`.erpkg` 后缀用于区分。
2. **先冻结格式再写编译器**：协议先行（元语不变量 10）。本轮只冻结 v1 需要的最小子集：
   `manifest`（含分层与依赖）+ 各层 JSON 文件清单 + 校验和；**签名位预留但不要求**（属 License 协议那条线）。
3. **IR 是文本 + 结构化双形态**：文本供审计与 diff，结构化供 Runtime 加载；两者必须能互相导出（有测试）。
4. **冲突检测只做能确定性判定的那几类**：重复定义、悬空引用、循环依赖、状态机不可达/无终态、依赖版本不可满足。
   **不做**语义相似度、命名风格这类需要判断的检查（会变成假阳性来源）。
5. **加载必须 fail-closed**：哈希不符、manifest 与内容不一致、依赖不可解析 → 拒绝加载并给出确切原因；
   不提供"部分加载"。
6. **与原子运行时的关系**：蓝图**声明**依赖哪些原子（`atomicType@range`），加载时用现有
   `AtomicRegistryService.resolve` 校验可用性；蓝图**不包含**原子实现（实现走 Wasm 模块那条线）。

## Out of Scope

- 模板加密与 Capsule（属 License / Encryption Protocol，v3 §11）
- 行业模板市场与交易流程
- 表单/工作台的前端渲染（本轮只到"可编译、可加载"）
- Space Delta 协议演进（`space-delta/v2`，另立变更）
