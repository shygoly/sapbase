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
| 2 | `auth-context` + `auth` | 5 | ⏳ |
| 3 | `common/events` | 1 | ⏳ |
| 4 | `ai-modules` | 1（4 个断言失败） | ⏳ |
| 5 | `ai-module-context` | 1 | ⏳ |
| 6 | CI 门禁诚实化（`.github/workflows/ci.yml` 的证据/范围说明） | — | ⏳ |

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
