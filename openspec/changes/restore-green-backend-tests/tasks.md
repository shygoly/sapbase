# Implementation Tasks

## 验收门

```bash
cd backend && npx jest --config jest.config.js --runInBand
# 期望：Test Suites: 53 passed, 53 total；Tests: 全部通过（0 failed）
```

分域推进，每修完一个域跑一次上面这条命令并附结果。

### 执行约定

1. **先判定谁错了**：spec 与实现不一致时，默认按"实现是当前意图"处理，但逐处确认；
   若某行为是被**静默删除**的，单列出来（那是实现的问题，不是 spec 的）。
2. **不靠删测试凑绿**：允许删除"被测行为已不存在"的用例，但必须在下表逐条登记。
3. **不用模糊匹配掩盖导入错误**（`moduleNameMapper` 之类）。
4. 每个域完成后附证据：命令 + 输出行。

## 进度

| # | 域 | 套件 | 状态 |
| --- | --- | --- | --- |
| 0 | 路径与工具模块（`test/utils` 相对深度） | 跨域 8 文件 | ✅ 2026-09-25（20 → 19 套件失败） |
| 1 | `organization-context` | 9 | ✅ 2026-09-25（9 套件 / **61 用例全绿**；整仓 13 → 9 套件失败） |
| 2 | `auth-context` + `auth` | 6 | ✅ 2026-09-25（6 套件 / **23 用例全绿**；整仓 9 → 3 套件失败） |
| 3 | `common/events` | 2 | ✅ 2026-09-25（含一处**实现加固**：审计脱敏改为递归） |
| 4 | `ai-modules` | 1 | ✅ 2026-09-25（四个"断言失败"实为 DI 缺供应商） |
| 5 | `ai-module-context` | 2 | ✅ 2026-09-25 |
| 6 | CI 门禁诚实化（`.github/workflows/ci.yml` 的证据/范围说明） | — | ⏳ |

### 里程碑：整仓回绿（2026-09-25 达成）

```text
起点  Test Suites: 20 failed, 33 passed, 53 total
      Tests:       4 failed, 394 passed, 398 total
终点  Test Suites: 53 passed, 53 total
      Tests:       492 passed, 492 total
```

`npx jest --config jest.config.js --runInBand`（即 CI 里 `npm run test --workspace backend`
实际执行的东西）现在是**真绿**，不是子集绿。已绿部分（atomic / blueprint / module-registry /
plugins 共 344 项）全程未变红。

## 被测行为已删除的用例（逐条登记）

| 文件 | 用例 / 断言 | 为什么删 | 该行为现在由什么覆盖 |
| --- | --- | --- | --- |
| `organization-context/domain/entities/organization.entity.spec.ts` | `updateSlug` 的用例 | `Organization.updateSlug()` 在实现里不存在（slug 只由 name 推导，构造后不可改） | 无（能力已移除，不是漏测） |
| 同上 | `removeMemberFromCollection()` 的两个用例 | 方法不存在；当前是 `removeMember(userId, removerId)`，且带 owner 权限与"最后一个 owner 不能删"的规则 | 新写的 `removeMember` 三例（owner 可删 / 非 owner 拒绝 / 最后一个 owner 拒绝） |
| 同上 | `hasOwner()` 的两个用例 | 方法不存在；owner 判定改成 `canBeUpdatedBy(userId)` 与各方法内部的 owner 校验 | 新写的 `canBeUpdatedBy` 一例 + `updateMemberRole` 的 owner 校验两例 |
| `organization-slug.vo.spec.ts` | `create()` 上的 5 个校验负例（空/过短/非法字符/首尾连字符） | `OrganizationSlug.create()` 只做**归一化**不做校验（校验在 `fromString`）—— 旧断言对着不存在的校验 | 新写的 `fromString` 三例（空 / 大写下划线 / 合法） |
| `organization-member.entity.spec.ts` | `isOwner()` / `isAdmin()` / `OrganizationRole.ADMIN` 相关用例 | 实现里角色只有 `OWNER` / `MEMBER`，也没有 `isOwner` / `isAdmin` 方法 | 角色用 `role` getter 断言；成员权限规则改在 `organization.entity.spec.ts` 测（owner 才能移除/改角色） |
| `invitation.entity.spec.ts` | `acceptedAt` / `isAccepted()` 断言、7 参 `create(id, …, expiresAt)` 用例 | 现在的模型是**状态机**（`status` + `isPending/accept/expire/cancel`）+ 仓储分配 id + 按天数算过期 | 新写的状态机用例（accept 一次性、过期、cancel 权限、expire） |
| `invite-member.service.spec.ts` | `should throw error if invitation already exists` | 行为已**有意改成幂等**：重复邀请不再报错，而是刷新那条待接受邀请的有效期后复用 | 改写成 `should refresh the pending invitation instead of failing`：断言复用同一条（id 不变）、有效期被推后、写回仓储 |
| `add-member.service.spec.ts` | 用 `memberRepository.findByOrganizationAndUser` 造"已存在" | 重复校验已移到**聚合内部**（`Organization.validateCanAddMember`），不再查仓储 | 改为把既有成员放进聚合（`OrganizationBuilder.withMembers`）后再断言抛错 |
| `auth-context/…/services/{password,jwt}.service.spec.ts` | 整文件跑不起来 | 实现一直在 `infrastructure/external/`，spec 却写在 `infrastructure/services/` 并引用不存在的 `./password.service` / `./jwt.service`；类名也不是 `*Impl` | 按「spec 与实现同目录」归位到 `external/`，类名改成 `PasswordService` / `JwtService` |
| 同上（jwt） | `should throw error for invalid token` | 真实契约是**无效 token 返回 `null`**（`verify(): Promise<Payload \| null>`），实现里 `catch` 后返回 null | 改写成 `should return null for an invalid token` |
| `auth-context/login.service.spec.ts` | `result.accessToken` / `result.organization` / `findById` 安排 | 响应体现在是 `{ access_token, user(脱敏摘要), organizations, currentOrganizationId }`；组织来自 `findAll(userId)` | 断言改为 `access_token` + 组织列表；"无访问权"用例改为 `findAll` 返回别的组织 |
| `auth-context/switch-organization.service.spec.ts` | `result.accessToken` / `result.organization` | 返回值只有 `{ access_token }` | 断言改为 `access_token`（去掉 organization 断言） |
| `auth/jwt.strategy.spec.ts` | `should reject token without userId` | `validate()` 只做 payload → 身份的映射，**不做拒绝**（拒绝在 passport 校验与守卫处） | 改写成 `should map an incomplete payload without throwing`：断言缺 sub 时 `id` 为 undefined |
| `auth/auth.service.spec.ts` | `validateToken` 的"过期/畸形 token 应抛错"两例 | 真实契约是**捕获后返回 null**（`Promise<JwtPayload \| null>`） | 改写为断言 `null`（并补 `bcrypt` mock，否则 `validateUser` 永远为 null） |
| 同上 | `login` 响应断言（`user` = 整个实体、无 organizations） | 现在 user 是**脱敏摘要**（不含 passwordHash/dataScope），并带 `organizations` / `currentOrganizationId` | 断言改为当前形状，并显式断言 `not.toHaveProperty('passwordHash')` |
| `common/events/audit-log-handler.spec.ts` | "无 organizationId 也要落审计" | `audit_logs` 是租户实体，实现里 `if (organizationId)` 才写 —— 没有组织上下文就没有审计 | 改写成 `should skip logging when the event has no organizationId`（断言不写、且不抛错） |
| 同上 | "敏感字段替换为 `[REDACTED]`" | 实现是**整键剔除**（连键名都不出现），且键在**嵌套**载荷里 | 断言改为"嵌套路径下该键不存在" |
| `ai-module-context/domain/entities/ai-module.entity.spec.ts` | `submitReview(review 对象)` + `module.reviews` | 评审模型改成**一次决策**（`submitReview(decision, reviewerId, comments?, rejectionReason?)`，状态转 approved/rejected），没有 reviews 集合 | 重写评审一节：记录决策、拒绝带理由、二次评审被拒、draft 不能评审 |
| 同上 | `updatePatchContent()` / `create(id, org, name, description)` / `publish()` 直接发 draft | 现在叫 `updatePatch()`；`create` 第四参是 `createdById`（描述另设）；`publish` 要求状态为 approved | 改名为 `updatePatch`；描述断言改为 null；发布改为"先送审并通过再发布"，并补"draft 不能发布""不能发布两次" |

### 发现：实现加固（本次顺手做掉的）

| 位置 | 问题 | 处理 |
| --- | --- | --- |
| `common/events/handlers/audit-log-handler.ts` | 脱敏清单**漏了 `password`**（只有 passwordHash/apiKey/token），而且**只过滤顶层键** —— 事件载荷 `{ type, data: { password } }` 会把密码明文写进审计 | 清单补入 `password` / `secret` / `authorization`，并改为**递归**剔除；数组保持形状。这是"收紧审计"，不是放松 |

> 判定：这三条都属于**能力被有意移除**（不是实现漏做）——它们在当前 API 里没有对应物，
> 而新 API 用更细的规则覆盖了同类关注点。整仓 `tsc` 也从未接受过旧断言，说明它们
> 不是"曾经绿过之后被改坏"，而是**写下来就没跑过**。

### 发现：实现缺口（不是 spec 的问题，单列出来）

| 位置 | 现象 | 影响 |
| --- | --- | --- |
| `OrganizationSlug.create()` → `Organization.create(id, name)` | **由名字推导的 slug 不校验**：`generateFromName('已存在模块')` → `''`，于是可以建出 slug 为空的组织 | 组织标识（用于 URL/查找）可能为空；建议单独变更补校验，或明确允许并写进协议 |
| `test/utils/domain-builders.ts` | 与实现漂移严重（`Invitation.create` 7 参、`Organization.create` 3 参、`WorkflowInstance.create` 传 id 而非实例、成员构造参数顺序） | 它是**共享测试基础设施**：它错一处，所有 import 它的 spec 一起挂。本次已按当前实现逐个改正 |
| `test/utils/test-helpers.ts` 的 `createMockRepository()` | 按**方法名列表**建替身，接口加方法它就少一个，用它的 spec 在运行时报 `Cannot read properties of undefined` | 本次补齐了 organization-context 三个仓储接口的方法；长期修法是给每个接口一个 `jest.Mocked<IXxxRepository>` 类型的工厂 —— 接口一变就在编译期报错 |

## 里程碑 0：路径与工具模块（已完成）

- [x] 修 spec 里 `test/utils` 的相对路径深度（8 文件 / 12 处）
- [x] 证据：`npx jest --config jest.config.js --runInBand` → 套件失败 20 → **19**，
      用例数 398 → **400**（两个套件此前连用例都没收集到）

## 里程碑：历史 e2e 的事实记录（不修，只写清）

- [ ] 记录：`test/auth|roles|departments|users|plugins|ai-module-lifecycle.e2e-spec.ts`
      需要真实库与完整 AppModule，当前整目录跑会挂住（早先实测 10 分钟不返回）；
      本仓库长期只跑 `atomic-runtime` / `blueprint-pipeline` / `atomic-gates` 三个 e2e。
      建议单独立变更决定它们的去留（修/删/标注 skip），不要装作它们不存在。
