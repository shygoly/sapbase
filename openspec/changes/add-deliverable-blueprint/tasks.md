# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **D0** 现状与判定 | 分层收敛（BOM/Form 不做层） | design.md 的对照与前置记录；`openspec validate --strict` 通过 |
| **D1** 协议冻结 | 三个新 Schema + 判据文本 | 每个 Schema 正例通过、5 类负例被拒；`layout` 之类字段被拒 |
| **D2** 编译器接入 | 覆盖两层 + 新判据 | jest：规则引用不存在实体/字段/状态被拒；借贷不平衡被拒；experience 引用不存在动作被拒 |
| **D3** 授权链 | `license.json` + Ed25519 验签 + 租户/到期检查 | jest：篡改后签名失效；跨租户被拒；过期被拒；豁免只在非生产生效 |
| **D4** 交付验证 | 跨租户装载（**换租户不改代码**） | e2e：租户 A 签名 → 租户 B 装载运行成功；三个反例都拒 |
| **D5** 文档与回归 | 协议文本、元语、IR 文档 | 全量回归全绿；`META_LANGUAGE` 补 Experience Policy |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. **协议先行**：D1 未完成不进 D2/D3（元语不变量 10）。
3. **加严而不是放松**：新层是可选；未覆盖文件仍拒；IR 摘要仍比对；授权门在装载器里。
4. fail-closed：验签失败 / 授权不匹配 / 过期 / 未知 layer 键，一律拒且不部分加载。
5. 不新造第二份判定：Ed25519 与 `wasm-modules` 的签名选择一致；权限判定继续复用既有实现。
6. 每个里程碑结束跑一次全量回归（单元 + e2e + wasm-modules + tsc）。

## Phase D0: 现状与判定

- [ ] 记录现状（实测）：单库共享 schema、12 个租户实体、Stripe 订阅、35 个固定页面中 6 个走运行时渲染
- [ ] 收敛分层判定：**BOM 不做层**（属 `semantic.json` 的实体关系）；**Form 不做层**
      （与 `add-chat-first-erp` 的交互即时生成冲突）—— 两条都写进 design.md

## Phase D1: 协议冻结

- [ ] `schemas/blueprint-rules.schema.json`：validation / approval / accounting 三类；
      `additionalProperties: false`；不允许"自由表达式求值"这类无法静态判定的字段
- [ ] `schemas/blueprint-experience.schema.json`：priority / confirm / automate / surfaces；
      **禁止布局字段**（`layout` / `width` / `position` / `component` 一律非法）
- [ ] `schemas/blueprint-license.schema.json`：grantedTo / resell / expiresAt / issuer / signature
- [ ] `docs/protocols/blueprint-delivery.md`：分层表、编译期判据清单、验签链顺序、
      开发豁免的边界（豁免什么、不豁免什么、生产为什么必须拒绝）
- [ ] 负例：未知 layer 键、借贷方向非法、expiresAt 形状非法、layout 字段、grantedTo 非数组

## Phase D2: 编译器接入

- [ ] `FILE_SCHEMAS` 增两条（未覆盖文件仍拒 —— 这条不许放松）
- [ ] 规则判据：entity/field/状态/事件引用必须存在；`steps[].role` 必须已知
- [ ] 记账平衡：字面量要求借贷相等；引用要求左右同表达式（**不做代数化简**，写进协议）
- [ ] experience 判据：`priority` 引用的字段存在；`confirm`/`automate` 引用的动作必须能找到；
      `surfaces` 的标识合法
- [ ] IR 摘要覆盖新层：改一行 `rules.json` → `irDigest` 变 → 防漂移能发现
- [ ] jest：每条判据各有正例与负例

## Phase D3: 授权链

- [ ] `backend/src/blueprint/license.ts`：`signManifest()` / `verifySignature()`（Ed25519，Node 内置）
- [ ] 授权检查：`grantedTo` 含当前租户（空数组 = 平台自用）、`expiresAt` 未过期
- [ ] 装载链顺序固定：完整性 → 编译 → 防漂移 → 授权形状 → 验签 → 授权匹配 → 绑定
- [ ] 开发豁免：`BLUEPRINT_ALLOW_UNSIGNED`（只豁免授权链）+ 审计 `blueprint.load.unsigned` +
      `NODE_ENV=production` 下**忽略并报错**
- [ ] jest：篡改文件 / 篡改 license / 跨租户 / 过期 / 缺签名 / 生产下开豁免 —— 各自被拒

## Phase D4: 交付验证（关键判据）

- [ ] e2e：租户 A 导出 → 写 license（grantedTo 含 B）→ 签名 → 租户 B 装载 → 运行成功
- [ ] e2e 反例：改 grantedTo 不重签 → 签名失效拒；未授权租户装载 → 拒；过期 → 拒
- [ ] 记录可复现证据：命令 + 输出（含"未改一行代码"的证明：两次装载走同一入口）

## Phase D5: 文档与回归

- [ ] `docs/META_LANGUAGE.md`：补 `Experience Policy`（与 Interaction Surface 配对）
- [ ] `docs/protocols/blueprint-ir.md`：IR 现在覆盖五层，兼容性规则更新
- [ ] 全量回归：单元 + e2e + wasm-modules + tsc + lint + `openspec validate --strict`
