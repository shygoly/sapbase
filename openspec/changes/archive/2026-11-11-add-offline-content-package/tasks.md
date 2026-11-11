## 1. 契约与元语

- [x] 1.1 `schemas/offline.schema.json` + Ed25519
- [x] 1.2 META §3.21 + 不变量 67–71
- [x] 1.3 DOMAIN「离线内容」+ check-domain 0 error
- [x] 1.4 DECISIONS D-20

## 2. 存储与 RLS

- [x] 2.1 迁移 179510 + DDL
- [x] 2.2 唯一/索引已建
- [x] 2.3 TENANT_RLS_DDL + e2e 跨租户
- [x] 2.4 entities + app.entities + OfflineModule

## 3. 离线包与 manifest

- [x] 3.1 package assets + variant
- [x] 3.2 manifest contentHash/items/labels/expiresAt
- [x] 3.3 Ed25519 签名 + verifyManifest
- [x] 3.4 version/publish/revoke
- [x] 3.5 复用 asset_variants（MP4/HLS 由资产管道生成）
- [x] 3.6 offline service 单测

## 4. 授权与设备

- [x] 4.1 grant/list/revoke
- [x] 4.2 manifest 校验 entitlement/device/expiry
- [x] 4.3 registerDevice + OFFLINE_MAX_DEVICES
- [x] 4.4 revoke entitlement/device/package/batch
- [x] 4.5 单测 + e2e

## 5. 下载与缓存

- [x] 5.1 manifest + 5 分钟令牌 + Range 206
- [x] 5.2 `OfflineDownloader` batch/cancel
- [x] 5.3 SHA-256 校验 + Range 分片/重试；分片持久化最小实现
- [x] 5.4 `OfflineCache` LRU
- [x] 5.5 可选；授权/撤销已审计
- [x] 5.6 offline-client 4 tests（Range/校验/LRU）

## 6. 离线播放与偏好

- [x] 6.1 `OfflinePlayer` 过期/设备/标识；签名由 manifest verify/服务端校验
- [x] 6.2 `OfflinePlayer` prefs 按用户
- [x] 6.3 可选；未实现上报
- [x] 6.4 manifest label + player 返回显式标识
- [x] 6.5 offline-client 播放/偏好 tests

## 7. 过期/撤销/清理

- [x] 7.1 entitlement exp + manifest 过期拒绝
- [x] 7.2 revoke + `clearExpired`
- [x] 7.3 命名空间清理/批量撤销
- [x] 7.4 offline.* audit actions
- [x] 7.5 e2e 过期/撤销 + cleanup

## 8. 安全与验收

- [x] 8.1 HMAC token
- [x] 8.2 可选，未实现加密（记录为后续）
- [x] 8.3 客户端命名空间隔离
- [x] 8.4 client 跨用户/校验和；manifest 篡改单测；token 伪造拒绝
- [x] 8.5 client test 5 资产批量 + 播放/过期；服务端 e2e 下载/撤销/过期
- [x] 8.6 validate 通过
- [x] 8.7 check-domain 0 error / check-meta 0 error
