## 1. 契约与元语

- [ ] 1.1 定义 `asset` / `asset-variant` / `upload-session` 的持久化形状与 JSON Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记资产/媒体术语与不变量（INV-AS-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增资产小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记存储抽象、签名 URL、scan fail-closed、资产字段类型
- [ ] 1.5 更新 `docs/META_LANGUAGE.md` 文档真源索引（如新增协议文本）

## 2. 存储抽象

- [ ] 2.1 `ObjectStorage` 接口与配置（local / S3-compatible / OSS / MinIO）
- [ ] 2.2 `LocalObjectStorage`：开发/测试；按组织路径隔离
- [ ] 2.3 `S3ObjectStorage`：presigned upload/download、multipart、head、delete
- [ ] 2.4 provider 兼容测试：分片、Range、签名 URL 过期、删除
- [ ] 2.5 存储密钥/凭证走 secretRef，不落明文

## 3. 上传会话

- [ ] 3.1 `asset_upload_sessions` 表与状态机
- [ ] 3.2 `POST /assets/uploads` 初始化（大小/MIME/配额校验）
- [ ] 3.3 分片上传/断点续传/已上传分片查询
- [ ] 3.4 `complete` 校验分片、大小、校验和；异常可重试
- [ ] 3.5 过期清理/中止；幂等 complete
- [ ] 3.6 单测/负例：超配额、伪造分片、校验和不符、重复 complete

## 4. 资产注册表

- [ ] 4.1 `assets` 表与状态机（uploading/scanning/processing/ready/failed/quarantined/deleted）
- [ ] 4.2 `asset_variants` 表与查询
- [ ] 4.3 元数据：宽高、时长、页数、EXIF 剥离标记、标签
- [ ] 4.4 去重：同组织 checksum/size 复用对象；业务引用独立
- [ ] 4.5 软删除/恢复/保留期
- [ ] 4.6 RLS 与跨租户负例

## 5. 处理管道

- [ ] 5.1 `AssetProcessor` 接口与 registry
- [ ] 5.2 MIME 嗅探 + 扩展名 allowlist + 大小/时长限制
- [ ] 5.3 病毒扫描 provider；infected 隔离、不可下载
- [ ] 5.4 图片：EXIF 剥离、缩略图、裁剪/封面变体
- [ ] 5.5 文档：页数、预览图/PDF（v1 可先图片/PDF）
- [ ] 5.6 音频：波形/转码（可选）
- [ ] 5.7 视频：probe、MP4/HLS、缩略图、字幕
- [ ] 5.8 水印/内容标识钩子（供 AI 内容治理）
- [ ] 5.9 处理任务走 `add-async-job-and-callback-facade`；失败 fail-closed
- [ ] 5.10 单测：pass/fail/timeout/provider 异常

## 6. 访问控制

- [ ] 6.1 私有/公开资产策略
- [ ] 6.2 短时签名 URL：组织/用户/应用绑定、TTL
- [ ] 6.3 Range 串流与 HLS/MP4 播放
- [ ] 6.4 下载/导出重新鉴权
- [ ] 6.5 业务记录权限 + 数据范围 + 资产状态组合
- [ ] 6.6 负例：跨租户、过期 URL、未 ready、infected、越权下载

## 7. 语义层资产字段

- [ ] 7.1 `blueprint-semantic` 增加 `asset` 字段类型与 `assetKind`
- [ ] 7.2 编译器校验：assetKind、必填、不能作为主键
- [ ] 7.3 运行时：存 assetId、读时解析摘要/签名 URL/variants
- [ ] 7.4 字段权限 + 数据范围组合
- [ ] 7.5 旧 text URL 字段兼容
- [ ] 7.6 编译/运行时负例：跨组织 assetId、kind 不匹配、未 ready

## 8. 配额与保留

- [ ] 8.1 配额：单文件/单次/总存储/并发上传
- [ ] 8.2 用量统计与查询；与 `refactor-ai-native` 配额/计量对齐
- [ ] 8.3 生命周期/保留期/软删除清理
- [ ] 8.4 超限错误与管理员调整
- [ ] 8.5 单测：超限拒绝、到期清理、保留期延长

## 9. 兼容与 UI

- [ ] 9.1 旧 `StorageService` 入口转调资产管道；品牌图片回归
- [ ] 9.2 旧 `/uploads/...` URL 继续可访问
- [ ] 9.3 旧文件迁移为资产（可选、幂等）
- [ ] 9.4 上传/预览/裁剪/进度组件（Portal/Console）
- [ ] 9.5 视频播放器/HLS/清晰度/倍速（供教育模块）
- [ ] 9.6 API 文档与 `api-client`

## 10. 验收

- [ ] 10.1 200MB 单文件、800MB 单次、5GB 知识源（分片）上传成功
- [ ] 10.2 断点续传/暂停/取消/重试
- [ ] 10.3 图片裁剪/缩略图、文档预览、视频 MP4/HLS
- [ ] 10.4 病毒扫描 fail-closed；infected 不可下载
- [ ] 10.5 签名 URL 过期/跨租户/越权负例
- [ ] 10.6 `openspec validate add-asset-and-media-pipeline --strict`
- [ ] 10.7 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
