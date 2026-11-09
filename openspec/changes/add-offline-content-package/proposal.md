# Change: 离线内容包

## Why

在线播放/资产管道只能解决联网场景；教育项目 B-030—B-032、B-017—B-019 要求：

- 学生把课程视频/资料下载到本地，无网络学习；
- 单次 ≥5 个视频、暂停/继续/取消/批量管理、≥1GB 缓存；
- 播放偏好（倍速/清晰度）按用户保存；
- 离线数据按用户隔离；
- 下载/离线/分享/导出仍保留 AI 生成内容标识/水印。

平台已有资产管道（规划）与签名 URL，但没有离线 manifest、授权、设备绑定、过期/撤销。

## What Changes

- **ADDED** `offline-content`：
  - 离线包定义：课程/课时/资产集合、版本、大小、清单。
  - 签名 manifest：包 ID/版本、资产校验和、变体、标识/水印、过期时间、签名。
  - 授权：用户/设备/课程/租户绑定、下载令牌、设备上限、过期、撤销。
  - 下载：分片/Range、断点续传、暂停/取消/批量、校验和。
  - 客户端契约：manifest 校验、离线播放、缓存管理、偏好、按用户隔离、过期清理。
  - 撤销/过期：联网时校验；按策略清理本地缓存。
- **ADDED** 内容保护钩子：签名 URL/短期令牌、可选加密、AI 标识/水印保留。
- **MODIFIED** 资产管道：支持离线变体/打包；不改变在线播放。
- **NOT CHANGED** 在线播放、资产上传、现有移动端页面。
- **NON-GOALS** 完整 DRM、P2P 分发、离线创作/提交、跨设备同步。
- **BREAKING** 无。离线能力可选；在线行为不变。

## Impact

- 受影响规格：`offline-content`（新增）、`asset-pipeline`（打包/变体）、
  `ai-content-governance`（标识保留）
- 受影响代码：
  - 新模块 `apps/api/src/offline/**` 或 `libs/platform-core/src/offline/**`
  - `apps/api/src/assets/**`（离线变体/打包）
  - 移动端/客户端 SDK（下载/缓存/播放）
  - `DOMAIN.md`、`DECISIONS.md`
- 依赖：`add-asset-and-media-pipeline`（资产/转码/签名 URL）、
  `add-ai-content-governance`（标识/水印）、`add-identity-federation...`（设备/用户）。
- 迁移：新增表；在线播放不变；客户端逐步接入。
- 风险：内容泄露、设备绑定绕过、缓存一致性、过期清理、标识丢失、存储/带宽。
