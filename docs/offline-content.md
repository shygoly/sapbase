# Offline Content（离线内容）

离线是可选能力；未启用时不产生包/授权，在线播放/资产/旧客户端行为不变。

## 离线包

`POST /api/offline/packages`：

```json
{
  "key": "course.v1",
  "title": "课程离线包",
  "expiresAt": "2026-12-31T00:00:00Z",
  "publish": true,
  "assets": [{ "assetId": "uuid", "variant": "mp4" }]
}
```

- 资产必须 `status=ready`；`variant` 必须是已存在离线变体（MP4/HLS 由资产管道生成）。
- manifest 含 asset/objectKey/variant/mime/size/checksum/label；
  `contentHash = sha256(canonical manifest)`；Ed25519 签名（`OFFLINE_SIGNING_PRIVATE_KEY`，缺省进程内生成）。
- AI 内容（有 provenance）必须有显式+隐式标识，否则拒绝打包。

## 设备与授权

- `POST /devices` 注册设备；`OFFLINE_MAX_DEVICES`（默认 3）超限拒绝。
- `POST /packages/:id/entitlements` 绑定 `userId+deviceId` 与有效期。
- 撤销：单条 `POST /entitlements/:id/revoke`，批量 `POST /entitlements/revoke`，
  设备 `POST /devices/:deviceId/revoke`，包 `POST /packages/:id/revoke`。
- 过期/撤销后 manifest 与下载均 403。

## 下载

`GET /packages/:id/manifest?deviceId=` 返回签名 manifest + 每个资产的 5 分钟 HMAC 下载令牌。

`GET /offline/download/:token`：

- 令牌含 org/user/device/package/asset/objectKey/exp；伪造/过期/跨用户拒绝。
- 支持 `Range: bytes=start-end` → 206 + `Content-Range`，客户端分片/续传。
- 不暴露永久对象 URL。

## 客户端 SDK

`@sap/api-client` 导出：

- `OfflineCache`：按 `user/device/package` 命名空间存储、SHA-256 校验、LRU 上限。
- `OfflineDownloader`：Range 分片、批量、暂停/取消、完成校验。
- `OfflinePlayer`：过期/设备/标识校验；播放偏好按用户隔离（localStorage）。
- `LocalStorageOfflineStorage` / `MemoryOfflineStorage`。

## 清理

`POST /offline/cleanup` 标记过期授权、撤销包的授权；客户端 `OfflineCache.clearExpired`
按本地 manifest 过期时间清理。

## 审计

`offline.package.create/publish/revoke`、`offline.entitlement.grant/revoke`、
`offline.device.revoke`、`offline.cleanup` 写入审计链。
