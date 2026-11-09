## 1. 契约与元语

- [ ] 1.1 定义 offline-package/manifest/entitlement/device 的 Schema 与签名格式
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记离线包术语与不变量（INV-OF-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增离线包小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记 manifest 签名、设备绑定、过期/撤销、标识保留

## 2. 存储与 RLS

- [ ] 2.1 迁移：`offline_packages` / `offline_entitlements` / `offline_devices`
- [ ] 2.2 索引/唯一约束：package key+version、user+device+package
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 离线包与 manifest

- [ ] 3.1 包定义：课程/课时/资产/变体
- [ ] 3.2 manifest 生成：校验和、大小、labels、expiresAt
- [ ] 3.3 manifest 签名/验签（Ed25519/HMAC）
- [ ] 3.4 版本/发布/撤销
- [ ] 3.5 资产离线变体（MP4/HLS）生成
- [ ] 3.6 单测：manifest 稳定、签名、篡改、过期

## 4. 授权与设备

- [ ] 4.1 `offline_entitlements` 授予/查询/撤销
- [ ] 4.2 下载前校验访问权/数据范围/设备上限
- [ ] 4.3 设备注册/换设备/上限
- [ ] 4.4 管理员撤销用户/设备/包
- [ ] 4.5 单测：越权、跨租户、设备上限、撤销

## 5. 下载与缓存

- [ ] 5.1 manifest/分片/Range URL（短期）
- [ ] 5.2 客户端 SDK：下载/暂停/继续/取消/批量
- [ ] 5.3 校验和/断点续传/失败重试
- [ ] 5.4 缓存上限/淘汰/LRU
- [ ] 5.5 下载审计（可选）
- [ ] 5.6 单测：续传、校验失败、缓存淘汰

## 6. 离线播放与偏好

- [ ] 6.1 播放器校验 manifest/签名/过期/设备
- [ ] 6.2 倍速/清晰度偏好本地保存/按用户隔离
- [ ] 6.3 离线学习记录（本地，可选上报）
- [ ] 6.4 标识/水印显示
- [ ] 6.5 单测：过期拒绝、标识显示、用户隔离

## 7. 过期/撤销/清理

- [ ] 7.1 过期策略/联网校验
- [ ] 7.2 撤销下发/本地清理
- [ ] 7.3 按用户/课程/包清理；不误删他人
- [ ] 7.4 审计
- [ ] 7.5 单测：过期、撤销、清理

## 8. 安全与验收

- [ ] 8.1 短期令牌/不暴露永久 URL
- [ ] 8.2 可选本地加密
- [ ] 8.3 缓存目录按用户/包隔离
- [ ] 8.4 负例：跨用户缓存、伪造 manifest、篡改资产
- [ ] 8.5 e2e：下载 5 个视频→断网播放→续传→过期清理
- [ ] 8.6 `openspec validate add-offline-content-package --strict`
- [ ] 8.7 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
