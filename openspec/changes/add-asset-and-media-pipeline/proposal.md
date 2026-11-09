# Change: 资产与媒体管道

## Why

当前文件能力只适合品牌图片：

- `StorageService` 只允许 png/jpeg/gif/svg/ico，单文件 5MB，写本地磁盘；
- 没有对象存储、断点续传、分片上传、病毒扫描、元数据、缩略图、文档预览、音视频转码、串流、签名 URL、配额与保留策略；
- 教育项目要求单文件 ≥200MB、单次 ≥800MB、知识源单次 5GB/单文件 1GB、≥7 种格式、视频 720P/5 分钟、MP4/HLS、离线缓存、AI 内容水印。

这些是跨行业通用能力，不应写进教育业务；教育项目只配置格式/配额/转码模板。

## What Changes

- **ADDED** `asset-pipeline`：存储抽象（本地 / S3 兼容 / OSS / MinIO）、
  分片/断点续传、直传签名、上传会话、校验和、去重。
- **ADDED** 资产注册表：`assets` + `asset_variants`，记录 MIME、大小、校验和、
  元数据、标签、状态、扫描结果、创建者、保留期。
- **ADDED** 处理管道：MIME 嗅探、病毒扫描、图片裁剪/缩略图、文档预览、
  音频/视频转码（MP4/HLS）、字幕、封面、水印钩子；全部通过异步任务执行。
- **ADDED** 访问控制：私有/公开资产、短时签名 URL、按组织/用户/应用绑定、
  Range 串流、下载授权、离线 manifest 钩子。
- **ADDED** 配额与保留：按组织/应用统计用量、单文件/单次/总量限制、
  生命周期与软删除、保留期；与 `refactor-ai-native-business-app-platform` 的配额/计量对齐。
- **ADDED** 语义层 `asset` 字段类型（或 `file`）：蓝图实体可引用资产，
  运行时解析为签名 URL；编译期校验。
- **ADDED** 处理 provider 接口：病毒扫描、文档预览、转码、水印可由内置或插件提供；
  provider 失败按 fail-closed 处理。
- **MODIFIED** 现有 `StorageService`：保留兼容入口，内部改走资产管道；品牌图片仍可用。
- **NOT CHANGED** 租户隔离、RLS、数据范围；资产元数据与业务记录同样受范围约束。
- **NON-GOALS** 视频生成算法、完整数字资产管理 UI、CDN 厂商锁定、在线剪辑套件。
- **BREAKING** 无。旧图片 URL 与品牌上传保持可用。

## Impact

- 受影响规格：`asset-pipeline`（新增）、`semantic-runtime`（资产字段）、`blueprint-semantic`（字段类型）
- 受影响代码：
  - `libs/platform-core/src/common/storage/**`
  - 新模块 `apps/api/src/assets/**` 或 `libs/platform-core/src/assets/**`
  - `apps/api/src/semantic-runtime/**`（资产字段解析）
  - `schemas/blueprint-semantic.schema.json`、`libs/shared-schemas`
  - `apps/web-portal` / `web-console` 上传/预览组件
  - `DOMAIN.md`、`DECISIONS.md`、`docs/META_LANGUAGE.md`
- 依赖：`add-async-job-and-callback-facade`（扫描/转码/预览）、
  `refactor-ai-native-business-app-platform`（应用上下文/配额）。
- 迁移：新增表；旧 `uploads/` 文件可通过迁移任务登记为资产；不删除旧文件。
- 风险：大文件/断点续传、转码成本、病毒扫描误报、签名 URL 泄露、存储厂商差异。
