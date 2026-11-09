# Design: 离线内容包

## Context

- `add-asset-and-media-pipeline` 提供资产、变体、签名 URL、转码（MP4/HLS）。
- `add-ai-content-governance` 要求标识/水印在下载/离线/导出链路保留。
- 教育项目需要移动端离线下载、断点续传、缓存、播放偏好、用户隔离。
- 当前没有离线 manifest/授权/设备绑定/撤销。

## Goals / Non-Goals

**Goals**

1. 定义可签名、可版本化、可撤销的离线包。
2. 用户/设备/课程/租户绑定授权，控制下载与离线播放。
3. 分片下载/续传/暂停/取消/批量/校验和。
4. 离线播放与偏好（倍速/清晰度）本地保存。
5. 用户数据隔离；过期/撤销清理。
6. AI 标识/水印在离线链路保留。
7. 不牺牲在线播放/资产管道。

**Non-Goals**

- 不做完整 DRM/密钥服务器/硬件绑定。
- 不做 P2P/CDN 自建。
- 不做离线创作/测评提交/同步冲突。
- 不做跨设备同步/共享。

## Decisions

### D1：离线包

`offline_packages`：

- `organizationId`、`appInstallationId?`
- `key`、`name`、`version`
- `resources`（JSONB：course/lesson/asset ids + variants）
- `manifest`（JSONB：生成后的清单）
- `size`、`status`（`draft` / `published` / `revoked`）
- `signature`、`signedAt`、`expiresAt`
- `createdBy`、`createdAt`

包内容可以是课程/课时/资料集合；版本变化生成新包，旧包可保留/撤销。

### D2：签名 manifest

```json
{
  "format": "offline-package/v1",
  "packageId": "...",
  "version": "2026.11.1",
  "organizationId": "...",
  "createdAt": "...",
  "expiresAt": "...",
  "assets": [
    {
      "assetId": "...",
      "variant": "mp4-720p",
      "mime": "video/mp4",
      "size": 123,
      "checksum": "sha256:...",
      "url": "/offline/assets/...?token=...",
      "labels": [{ "type": "explicit", "text": "AI 生成" }]
    }
  ],
  "labels": [...],
  "signature": "ed25519:..."
}
```

- 签名覆盖 canonical manifest（不含签名本身）；平台密钥签名/租户密钥。
- 客户端 MUST 校验签名、过期、包 ID/组织/设备绑定。
- 资产 URL 短期令牌/签名；manifest 可缓存但过期后不可续播。

### D3：授权与设备绑定

`offline_entitlements`：

- `organizationId`、`userId`、`deviceId`
- `packageId`、`courseId?`
- `grantedAt`、`expiresAt`、`revokedAt`、`revokeReason`
- `maxDevices`、`status`

`offline_devices`（可选）：

- `userId`、`deviceId`、`deviceName`、`platform`、`lastSeenAt`、`status`

规则：

- 下载前校验用户对课程/资源的访问权 + 数据范围 + 设备上限。
- 授权绑定用户+设备；换设备需重新授权/占用名额。
- 授权过期/撤销：联网时拒绝续期；客户端按策略清理。
- 管理员可撤销用户/设备/包授权。

### D4：下载与续传

- 服务端提供 manifest + 分片/Range URL（短期）。
- 客户端：
  - 暂停/继续/取消/批量；
  - 分片校验和；断点续传；
  - 缓存上限/淘汰策略（LRU/按课程）；
  - 下载完成校验 manifest/资产。
- 服务端可选记录下载进度/审计（不强制逐片）。
- 大文件走 Range/CDN；不一次性内存加载。

### D5：离线播放与偏好

- 客户端播放器读取本地 manifest，校验签名/过期/用户/设备。
- 播放偏好（倍速/清晰度）本地保存，按用户隔离；可选同步到服务端（v1 本地）。
- 离线学习记录：v1 只本地记录，联网后可选上报（交给学习记录模块）；冲突策略后置。
- 标识/水印：manifest 带 labels；播放器显示显式标识；文件隐式标识由资产管道保留。

### D6：过期与撤销

- manifest/entitlement 有 `expiresAt`；过期后客户端不可继续播放/续期。
- 撤销：服务端标记 revoked；联网时客户端收到并清理；离线期间到过期时间失效。
- 清理策略：按用户/课程/包；不删除其他用户/其他包数据。
- 审计：授权/撤销/下载（可选）/清理。

### D7：安全与用户隔离

- 短期签名 URL/令牌；不暴露永久对象 URL。
- 可选本地加密（密钥绑定用户/设备）；v1 至少签名+校验和。
- 设备绑定/用户隔离；缓存目录按 userId/packageId 隔离。
- 防止跨用户读取缓存；根设备/越狱无法完全防御，明确边界。
- 不记录敏感 PII；下载审计脱敏。

### D8：兼容

- 在线播放/资产 URL 不变；离线为新增能力。
- 旧客户端不受影响；新客户端逐步接入。
- 回滚：停用离线包/授权；在线播放继续。

## Data Model

```sql
offline_packages (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  key varchar(128) not null,
  name varchar(255) not null,
  version varchar(64) not null,
  resources jsonb not null default '{}',
  manifest jsonb not null default '{}',
  size bigint not null default 0,
  status varchar(32) not null default 'draft',
  signature text,
  "signedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdBy" uuid,
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", key, version)
)

offline_entitlements (
  id uuid pk,
  "organizationId" uuid not null,
  "userId" uuid not null,
  "deviceId" varchar(255) not null,
  "packageId" uuid not null,
  "courseId" varchar(128),
  "grantedAt" timestamptz not null default now(),
  "expiresAt" timestamptz,
  "revokedAt" timestamptz,
  "revokeReason" varchar(255),
  status varchar(32) not null default 'active',
  unique ("organizationId", "userId", "deviceId", "packageId")
)

offline_devices (
  id uuid pk,
  "organizationId" uuid not null,
  "userId" uuid not null,
  "deviceId" varchar(255) not null,
  "deviceName" varchar(255),
  platform varchar(32),
  "lastSeenAt" timestamptz,
  status varchar(32) not null default 'active',
  unique ("organizationId", "userId", "deviceId")
)
```

新表纳入 RLS；manifest/entitlement 按组织/用户隔离。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 内容泄露/破解 | 短期令牌、签名、可选加密、设备绑定；明确不可完全防根设备 |
| 设备绑定绕过 | 设备上限、撤销、重新授权；审计 |
| 缓存不一致 | manifest 版本/校验和；过期/撤销；客户端校验 |
| 标识丢失 | manifest labels + 文件隐式标识；播放器显示 |
| 存储/带宽 | 按需下载、清晰度选择、配额、CDN |
| 离线学习记录冲突 | v1 本地记录，后置同步策略 |
| 旧客户端 | 新能力可选；在线不变 |

## Migration Plan

1. 新增表 + manifest 签名/授权 API。
2. 资产管道支持离线变体（MP4/HLS）。
3. 客户端 SDK/播放器接入下载/校验/缓存。
4. 先教育课程视频试点，再接资料/离线学习记录。
5. 回滚：停用离线包/授权；在线继续。

## Open Questions

- 是否需要本地加密？按客户合规要求；v1 可选。
- 离线学习记录是否上报？建议 v1 本地，后续接学习记录模块。
- 多设备上限/换设备策略？按套餐/组织配置。
- 是否需要 CDN？按部署形态，接口预留。
