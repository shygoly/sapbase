## 1. 领域模型与 DDL

- [x] 1.1 在 `shared-schemas` 定义 Release / Draft / Proposal / Activation / Approval 的状态词与视图类型
- [x] 1.2 新建 `backend/src/releases/ddl/release-lifecycle.ddl.ts`，集中声明 8 张表的 DDL（camelCase 列名、`timestamptz`、CHECK、索引、外键）
- [x] 1.3 DDL 包含：`app_drafts`、`app_change_proposals`、`app_releases`、`app_release_items`、`app_release_activations`、`app_release_approvals`、`app_release_events`、`app_user_release_views`
- [x] 1.4 为 `app_releases` 建两条 partial unique index：平台级 `(appKey, version) WHERE organizationId IS NULL`；租户级 `(organizationId, appKey, version) WHERE organizationId IS NOT NULL`
- [x] 1.5 为 `app_release_activations` 建唯一索引：`(appInstallationId) WHERE status='active' AND cohort IS NULL`
- [x] 1.6 为 `app_release_items` 建 `(releaseId, itemType)` 索引；为 `app_change_proposals` 建 `(organizationId, appKey, status, createdAt DESC)` 索引
- [x] 1.7 新建 TypeORM `*.entity.ts`，与 DDL 列名一一对应；`app_release_items` 不单独带 `organizationId`
- [x] 1.8 新建 migration `CreateReleaseLifecycle<timestamp>`，`up` 消费 DDL，`down` 只删本变更新增表/列
- [x] 1.9 把新表登记进 `contracts/schema-manifest.json`（重新生成）与 `DOMAIN.md` 覆盖矩阵/关系/不变量
- [x] 1.10 在 `DOMAIN.md` 登记 `INV-REL-01..10` 与 `D-1` 发布不可变决策

## 2. 不可变与状态机

- [x] 2.1 新建 `app_release_guard()` 触发器：`published` 行只允许 `status` 改为 `published/superseded/revoked`，`manifest/changelog/digest/version/appKey` 不得变化
- [x] 2.2 新建 `app_release_no_delete()` 触发器：`app_releases` 行拒绝 `DELETE`
- [x] 2.3 新建 `libs/release-kernel`：semver 解析/比较、digest 重算、状态迁移断言、impact/diff 纯函数
- [x] 2.4 服务层 `PublishService.publish()` 先校验状态，再由平台重算 digest；客户端提交的 digest 只用于比对
- [x] 2.5 服务层 `ActivateService.activate()` 只追加 activation；`rollback()` 生成 `action='rollback'` 新记录
- [x] 2.6 回退前检查目标 Release 存在、未 `revoked`、数据 schema 兼容、`rollbackSafe` 或补偿计划
- [x] 2.7 为上述状态机写单测：非法迁移必须拒绝；`published` 内容更新必须被触发器拒绝

## 3. 发布闸门与证据

- [ ] 3.1 新建 `ReleaseValidationService`，按 G0–G8 顺序执行并记录证据
- [ ] 3.2 G0 调用 `check:domain` / `check:meta` / `check:agent-tools`，失败即 `validating → draft`
- [ ] 3.3 G1 调用现有 Blueprint 编译/校验，记录 IR digest
- [ ] 3.4 G2 产出权限 diff（新增/收紧/删除、受影响角色）；高风险标记需要安全审批
- [ ] 3.5 G3 执行迁移 dry-run 与回退计划检查；缺失 `rollbackSafe` 且无补偿计划即拒绝
- [ ] 3.6 G4 调用后端测试；G5/G6 预留接口并显式记录 `notApplicableReason`（本变更不假装完成）
- [x] 3.7 G7 校验 `approverId !== authorId`；高风险变更要求第二审批人
- [x] 3.8 G8 重算 digest、复用 Blueprint Ed25519 验签、写入 changelog、创建不可变 Release 行与事件
- [ ] 3.9 校验失败必须可解释：返回 `{ gate, rule, path, howToFix }`

## 4. API 与上下文

- [x] 4.1 管理端 API：drafts 创建/读取；proposals 创建/读取/validate/preview/approve/reject；releases publish/activate/rollback/impact/changelog/list
- [x] 4.2 业务端 API：`GET /api/apps/:appKey/release`、`GET /api/apps/:appKey/whats-new`、`POST /api/apps/:appKey/whats-new/:id/read`、`GET /api/apps/:appKey/preview/:token`
- [ ] 4.3 所有写命令要求 `Idempotency-Key`；发布/激活/回退返回 `202 + jobId`
- [x] 4.4 预览 token 使用签名 JWT，claims 含 `userId/organizationId/releaseId/roles`，TTL ≤ 24h；无效/过期返回 403
- [ ] 4.5 在 `BusinessAppExecutionContext` 增加 `releaseId`；从 activation 解析，不从请求体信任
- [ ] 4.6 业务请求与审计写入 `releaseId`；Agent turn 记录预留字段（变更 5 消费）
- [x] 4.7 `release.enabled=false` 时，新发布 API 返回 `UNAVAILABLE`，现有 install/upgrade/rollback 路径不变

## 5. 业务可见性

- [ ] 5.1 激活后按参考包顺序执行：递增 `cache:release:active` 版本 → `revalidateTag('release:<appKey>')` → Outbox `release.activated` → 通知 → `app_release_events`
- [ ] 5.2 业务端首次登录提示 + 更新记录页：只展示本 org 当前 active Release 的 changelog
- [ ] 5.3 菜单/页面 `NEW` / `UPDATED` 徽标：基于 `app_user_release_views.lastSeenReleaseId` 计算
- [ ] 5.4 灰度用户显示“体验版”标识；反馈自动带 `releaseId + cohort`
- [ ] 5.5 PiAgent 不得提及未激活版本；本变更先保证 API 不返回未激活 changelog

## 6. 管理端最小页面

- [ ] 6.1 在现有 `speckit` 应用内新增发布台路由：Release 列表、详情、changelog、激活/回退入口
- [ ] 6.2 提议详情页展示 diff、证据、影响面、闸门结果、审批记录、回退计划
- [ ] 6.3 所有按钮的可见性只是体验；服务端仍校验权限点
- [ ] 6.4 发布/激活/回退操作显示 job 状态与审计号

## 7. 权限与职责分离

- [ ] 7.1 新增权限点：`app:release:read/propose/validate/approve/approve:security/publish/activate/rollback`
- [x] 7.2 服务端校验审批人 ≠ 作者；高风险变更要求第二审批人（安全/技术负责人）
- [ ] 7.3 平台管理员紧急发布必须写 `emergency=true` 并留事后复核记录

## 8. 测试与验收

- [x] 8.1 单测：状态机非法迁移、digest 重算、审批人=作者被拒
- [ ] 8.2 数据库测试：`published` Release 改 `manifest` 被拒绝；`DELETE` 被拒绝
- [ ] 8.3 唯一索引测试：同一安装不能有两个非 cohort `active`
- [ ] 8.4 回退测试：回退 = 新 activation，旧 Release 内容不变
- [ ] 8.5 预览测试：无效 token 403；业务用户看不到预览 Release
- [ ] 8.6 端到端演练：创建 draft → proposal → validate → approve → publish → 灰度激活 → whats-new → 回退
- [x] 8.7 跑 `check:domain` / `check:meta` / `check:agent-tools`，更新 `DOMAIN.md` 与 `DECISIONS.md`


## ??????

- ????8 ??????DDL/????migration?release-kernel???/??/?? API??? token?changelog/whats-new API???? `releaseId` ???
- ????G0?G6 ???????????? validateProposal ???????????????? UI?????/Outbox/??????DB ???????? E2E?
