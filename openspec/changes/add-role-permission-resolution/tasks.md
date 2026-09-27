# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **P1** 解析判定 | `RolesService.findByName` + 有效权限服务 | 单元测试：并集/去重/组织隔离/停用角色/角色缺失，各一条 |
| **P2** 接进签发 | `login` 与 `switchOrganization` 共用同一判定 | 单元测试：两者签发的 `permissions` 一致且等于有效权限 |
| **P3** 真库证明 | 角色权限真的从库里来 | e2e（真 Postgres）：建组织 + 角色 + 用户 → 登录 → JWT 里含角色权限；跨组织/停用两条负例 |
| **P4** 回归 | 没弄坏既有 | 全量单测 + 既有 e2e 清单全绿；`verify-from-zero` 零结构差异 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 真实输出）。
2. **并集、不减权限**：直授权限在任何分支下都必须保留 —— 有专门一条测试。
3. **组织隔离**：`findByName` 的签名必须强制带 `organizationId`，
   不允许出现"按名字全局查角色"的入口。
4. 角色解析失败（不存在/停用/无组织上下文）**不许**让登录失败，只给直授。
5. 不新增 npm 依赖；不动 schema（`roles` 表已存在，本变更只读它）。

## Phase P1: 解析判定

- [ ] `backend/src/roles/roles.service.ts`：新增 `findByName(name, organizationId)`，
      只返回 `status='active'` 且属于该组织的角色（或返回 `null`）
- [ ] 有效权限服务（单一判定）：输入 `{ userId 的 role, 直授权限, organizationId }`，
      输出有效权限 = 组织内同名 active 角色权限 ∪ 直授，去重、顺序稳定
- [ ] 单元测试：并集；去重；**其它组织的同名角色不生效**；**停用角色不生效**；
      角色不存在 → 只留直授；`organizationId` 缺失 → 只留直授

## Phase P2: 接进签发

- [ ] `AuthService.login` 用有效权限替换 `user.permissions`
      （JWT payload 与响应里的 `user.permissions` 都要换）
- [ ] `AuthService.switchOrganization` 用**同一个**服务解析（不许内联第二份逻辑）
- [ ] 单元测试：两条路径签发的 `permissions` 一致且等于有效权限；
      `role` 字段行为不变
- [ ] 单元测试：直授 ∪ 角色 → 结果是并集（不是覆盖，也不是只取角色）

## Phase P3: 真库证明

- [ ] e2e（真 Postgres，照既有骨架）：插入组织 + 角色（带权限点）+ 用户（`role` 指向该角色），
      走真实 HTTP 登录，断言返回的 JWT payload 里含角色权限点
- [ ] e2e 负例：另建一个组织放同名角色（权限不同）→ 该角色权限**不**出现在 JWT 里
- [ ] e2e 负例：把角色置为 `inactive` → 角色权限**不**出现在 JWT 里，且登录仍然成功
- [ ] 若有新增 e2e spec，追加进 `.github/workflows/ci.yml` 的 e2e 清单

## Phase P4: 回归与文档

- [ ] 全量单测全绿（基线随前一变更而定，只准增加）
- [ ] 既有 e2e 清单全绿
- [ ] `rebuild-database` + `verify-from-zero` 零结构差异
- [ ] 在 backend 结构化文档（`backend/AGENTS.md` 指向的既有文档，**不要新建文件**）
      记一句：有效权限 = 组织内同名 active 角色 ∪ 直授；这是访问控制行为，不是展示字段
- [ ] `openspec validate add-role-permission-resolution --strict` 通过
