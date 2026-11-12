# 默认应用安装 Backfill（2.7）

已有 Blueprint 记录的组织可以通过管理端接口幂等映射到默认应用安装。

## 接口

```http
POST /api/apps/backfill-default
Authorization: Bearer <system:manage JWT>
X-Organization-Id: <organizationId>
Content-Type: application/json

{
  "packageId": "auto-parts-1.1.0",
  "blueprintId": "auto-parts",
  "dryRun": true
}
```

- 只处理 `blueprint_records` 中存在指定 `blueprintId` 记录的组织。
- 已有同 `appKey` 安装：直接返回现有安装，`created=false`；
  版本不同只返回 `needsUpgrade=true`，不静默升级。
- 无记录：`skipped=true, reason=no-blueprint-records`。
- `dryRun=true`：返回 `wouldCreate=true`，不写库。
- 实际执行：`dryRun=false`，走既有 `install()` 的签名/授权/摘要/修订链。
- 重复调用幂等，不会产生重复安装或修订。

## 操作步骤

1. 先对每个组织 dry-run，确认 `wouldCreate`/`needsUpgrade`。
2. 确认包已签名/授权（开发期可 `BLUEPRINT_ALLOW_UNSIGNED=true`）。
3. 逐组织执行 `dryRun=false`。
4. 用 `GET /api/apps` 核对安装；`GET /api/apps/:id/revisions` 核对 `installed` 修订。

> 跨组织批量脚本不内置到仓库：管理员需具备目标组织成员关系；
> 避免用全局 bypass 写入租户安装。
