# Design: 资产与媒体管道

## Context

已核对的现状：

- `libs/platform-core/src/common/storage/storage.service.ts`：
  - 只允许图片 MIME（png/jpeg/gif/svg/ico），单文件 5MB；
  - 写本地 `UPLOAD_DIR`，URL 为 `${PUBLIC_URL}/uploads/...`；
  - `multerConfig` 使用 memoryStorage，5MB 限制；
  - `deleteFile` 只处理本地 URL。
- 没有对象存储、分片/断点续传、病毒扫描、元数据、缩略图、文档预览、音视频转码、签名 URL、配额、保留策略。
- 语义层字段类型没有资产/文件类型；业务只能存 URL 文本。
- 教育项目需要 200MB/800MB/5GB、7+ 格式、视频 720P/5min、MP4/HLS、离线缓存、水印。

## Goals / Non-Goals

**Goals**

1. 统一资产管道：上传、存储、扫描、处理、访问、配额、保留。
2. 支持大文件、分片/断点续传、直传对象存储、校验和与去重。
3. 支持图片/文档/音频/视频的预览、缩略图、转码与串流。
4. 业务实体可声明 `asset` 字段，运行时拿到受权限约束的签名 URL。
5. 兼容现有品牌图片上传；不破坏旧 URL。
6. 为 AI 内容治理、离线包、素材标签提供钩子。

**Non-Goals**

- 不做视频生成/合成算法（由外部 provider 或业务模块负责）。
- 不做完整 DAM（数字资产管理）UI、在线剪辑、素材市场。
- 不锁定 CDN/云厂商；用 provider 接口。
- 不做跨租户共享资产（v1 资产归属单一组织/应用）。

## Decisions

### D1：存储抽象

```ts
interface ObjectStorage {
  createUpload(input: CreateUploadInput): Promise<UploadHandle>
  completeUpload(handle, parts): Promise<StoredObject>
  putObject(key, body, contentType): Promise<StoredObject>
  getSignedUrl(key, ttl, response?: ResponseOverrides): Promise<string>
  deleteObject(key): Promise<void>
  headObject(key): Promise<ObjectHead>
}
```

实现：

- `LocalObjectStorage`：开发/单机；路径隔离到 `org/<orgId>/...`。
- `S3ObjectStorage`：S3 兼容（AWS S3 / MinIO / 阿里云 OSS / 腾讯 COS 通过 endpoint 配置）。
- 生产默认对象存储；本地实现只用于开发/测试。
- 配置按平台/环境；租户只配置配额与保留，不直接接触密钥。

### D2：上传会话与分片

`asset_upload_sessions`：

- `id`、`organizationId`、`appInstallationId?`、`userId`
- `originalName`、`mime`、`size`、`checksum`
- `provider`、`bucket`、`objectKey`、`uploadId`
- `status`（`initiated` / `uploading` / `completing` / `completed` / `aborted` / `expired`）
- `parts`（JSONB：partNumber/etag/size）
- `expiresAt`

流程：

1. `POST /assets/uploads` 创建会话，返回分片大小/已上传分片/签名 URL（或直传配置）。
2. 客户端分片上传；服务端记录 parts。
3. `POST /assets/uploads/:id/complete` 校验分片、大小、校验和，合并/完成。
4. 进入扫描/处理；`status=processing`，完成后 `ready`。
5. 失败可重试/续传；过期清理。

### D3：资产注册表

`assets`：

- `id`、`organizationId`、`appInstallationId?`
- `kind`（`image` / `document` / `audio` / `video` / `archive` / `other`）
- `provider`、`bucket`、`objectKey`
- `originalName`、`mime`、`size`、`checksum`
- `status`（`uploading` / `scanning` / `processing` / `ready` / `failed` / `quarantined` / `deleted`）
- `scanStatus`（`pending` / `clean` / `infected` / `error`）
- `metadata`（宽高、时长、页数、EXIF 剥离标记等）
- `tags`（text[] 或 JSONB）
- `createdBy`、`createdAt`、`expiresAt`、`deletedAt`

`asset_variants`：

- `assetId`、`kind`（`thumbnail` / `preview` / `mp4` / `hls` / `subtitle` / `waveform`）
- `provider`、`bucket`、`objectKey`、`mime`、`size`、`width`、`height`、`bitrate`、`status`、`metadata`

去重：同一组织内 `(checksum, size)` 可复用对象，但资产记录仍按业务引用独立（权限/保留不同）。

### D4：处理管道

通过 `add-async-job-and-callback-facade` 执行：

```text
upload completed
  → mime sniff / extension check
  → virus scan
  → image: EXIF strip, thumbnail, crop variants
  → document: page count, preview images/PDF
  → audio: waveform, transcode (optional)
  → video: probe, transcode MP4/HLS, thumbnail, subtitle
  → optional watermark hook
  → status=ready
```

Provider 接口：

```ts
interface AssetProcessor {
  key: string
  supports(asset: AssetRef): boolean
  process(input: ProcessInput): Promise<ProcessResult>
}
```

- 内置：MIME 嗅探、图片缩略图/裁剪（可用 sharp 或外部）、文件校验。
- 外部：病毒扫描、文档预览、视频转码、TTS/水印，走插件/连接器。
- 失败：`failed`/`quarantined`；业务不可用；不静默降级为原始文件。
- 扫描未完成前资产不可被业务引用（`ready` 才可）。

### D5：访问控制

- 资产默认私有；业务记录引用资产时，访问必须同时满足：
  租户隔离 + 业务记录权限/数据范围 + 资产状态 `ready`。
- 签名 URL：短时（默认 5—15 分钟），绑定 `organizationId`、可选 `userId`、`appInstallationId`；
  不支持永久公开 URL（公开资产需显式标记）。
- Range 请求/串流：视频走 HLS/MP4，支持 Range；CDN 可选。
- 下载/导出：可要求重新鉴权；离线 manifest 走 `add-offline-content-package`。
- 删除：软删除 + 延迟清理；被引用的资产不能物理删除，除非显式迁移。

### D6：语义层资产字段

在 `blueprint-semantic` 增加字段类型 `asset`（或 `file`）：

```json
{ "name": "cover", "type": "asset", "assetKind": "image" }
```

- 存储：记录里存 `assetId`（字符串），不存 URL；
- 运行时：解析为 `{ assetId, url, mime, size, width, height, variants }`；
- 读：受字段权限 + 数据范围约束；无权限返回省略/空；
- 写：校验 assetId 属于当前组织、状态 `ready`、kind 匹配；
- 编译期：`assetKind` 合法；不允许多个 `asset` 主键；不改变旧字段类型。
- 兼容：现有 text URL 字段继续可用；新实体优先用 `asset`。

### D7：配额与保留

- 配额按组织/应用：单文件、单次总量、总存储、并发上传数。
- 用量：`assets.size` 汇总 + `asset_usage` 快照（可选）；与 `refactor-ai-native` 的配额/计量对齐。
- 保留：按 kind/业务策略设置 `expiresAt`；到期转 `expired`/软删除；审计/合规可延长。
- 超限：拒绝新上传，返回明确配额错误；不静默删旧资产。

### D8：安全

- MIME 嗅探 + 扩展名 allowlist；不信任客户端 Content-Type。
- 文件大小/分片数/总时长限制；防止 zip bomb/解压炸弹（文档预览）。
- 病毒扫描 fail-closed；`infected` 隔离，不提供下载。
- 图片 EXIF 剥离；SVG 作为不可信内容（禁止脚本/外部引用）或直接拒绝。
- 对象 key 不含用户输入；签名 URL 不暴露存储密钥。
- 文件名/元数据转义；下载 `Content-Disposition` 安全。
- 所有上传/下载/删除/转码/扫描写审计。

### D9：兼容与迁移

- 现有 `StorageService.uploadFile` 保留，内部转调资产管道；品牌图片仍走图片校验。
- 旧 `/uploads/...` URL 继续可访问；迁移任务把旧文件登记为 `assets`（可选）。
- 现有数据库中的 URL 文本字段不强制迁移；新实体可用 `asset`。
- 回滚：停用新 provider，回退本地存储；资产表保留。

## Data Model

```sql
asset_upload_sessions (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  "userId" uuid not null,
  "originalName" varchar(512) not null,
  mime varchar(128) not null,
  size bigint not null,
  checksum varchar(128),
  provider varchar(64) not null,
  bucket varchar(128) not null,
  "objectKey" varchar(1024) not null,
  "uploadId" varchar(512),
  status varchar(32) not null,
  parts jsonb not null default '[]',
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
)

assets (
  id uuid pk,
  "organizationId" uuid not null,
  "appInstallationId" uuid,
  kind varchar(32) not null,
  provider varchar(64) not null,
  bucket varchar(128) not null,
  "objectKey" varchar(1024) not null,
  "originalName" varchar(512) not null,
  mime varchar(128) not null,
  size bigint not null,
  checksum varchar(128),
  status varchar(32) not null,
  "scanStatus" varchar(32) not null default 'pending',
  metadata jsonb not null default '{}',
  tags text[] not null default '{}',
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz,
  "deletedAt" timestamptz
)
-- index ("organizationId", status), index ("organizationId", "createdAt")

asset_variants (
  id uuid pk,
  "organizationId" uuid not null,
  "assetId" uuid not null,
  kind varchar(32) not null,
  provider varchar(64) not null,
  bucket varchar(128) not null,
  "objectKey" varchar(1024) not null,
  mime varchar(128),
  size bigint,
  width int,
  height int,
  bitrate int,
  status varchar(32) not null,
  metadata jsonb not null default '{}',
  "createdAt" timestamptz not null default now()
)
```

所有新表纳入 RLS；`asset_variants` 通过 `assetId` 继承组织隔离。

## Flows

### 大文件上传

```text
POST /assets/uploads { fileName, size, mime, checksum }
  → 校验配额/格式 → 创建 upload session
  → 返回 partSize / presigned URLs / uploaded parts
PUT /assets/uploads/:id/parts/:n
  → 客户端直传对象存储（或服务端中转）
POST /assets/uploads/:id/complete { parts }
  → 校验大小/校验和 → 合并 → asset(status=scanning)
  → enqueue scan/process jobs
  → ready 后业务可引用
```

### 引用与访问

```text
业务记录写入 assetId
  → 校验组织/状态/kind/权限
读取记录
  → 字段权限 + 数据范围
  → 生成短时签名 URL（org/user/app 绑定）
  → 返回 asset 摘要 + variants
```

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| 大文件/断点续传复杂 | 分片 + 校验和 + 过期清理；先支持 S3 兼容协议 |
| 转码成本/排队 | 异步 job + 并发/配额；按需转码，不预生成所有清晰度 |
| 病毒扫描误报 | 隔离 + 人工复核 + provider 可替换；不静默放行 |
| 签名 URL 泄露 | 短 TTL + 组织/用户绑定 + 审计；公开资产显式标记 |
| 存储厂商差异 | `ObjectStorage` 接口 + 兼容测试；不绑定 SDK 细节 |
| 旧 URL 迁移 | 保留旧路径；迁移任务可选；不强制改历史数据 |
| SVG/文档安全 | 不可信内容隔离/拒绝；预览在沙箱渲染 |
| 配额误伤 | 明确错误 + 用量查询 + 管理员调整；不静默删数据 |

## Migration Plan

1. 新增表 + RLS + 存储 provider 配置。
2. 保留旧 `StorageService` 入口，内部切新管道；品牌图片回归。
3. 迁移旧 `uploads/` 文件为资产（可选、幂等）。
4. 先接图片/文档，再接音频/视频转码；按业务优先级启用。
5. 回滚：切回本地 provider；旧 URL 仍可用。

## Open Questions

- 视频转码用内置 ffmpeg 还是外部 provider？建议外部 provider + 本地可选，避免平台镜像膨胀。
- 文档预览用 LibreOffice/OnlyOffice 还是外部服务？v1 可先图片/PDF 预览，Office 后置。
- 是否引入 CDN？按客户部署形态决定，接口预留。
- 资产标签是自由文本还是层级 taxonomy？v1 自由标签 + 可选标签表。
