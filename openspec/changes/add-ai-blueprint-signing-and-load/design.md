## Context

`deliver` 目前只接受 `templates/<id>/` 源码目录；AI 产出的是已存在于 packagesDir 的
`.erpkg`。要给它签名，必须先“解包 → 加 license → 重新打包 → 盖章 → 签名”。

## Goals / Non-Goals

**Goals**

1. 已有 `.erpkg` 能补 license 并签名。
2. 签名后能按租户 `load` 成功（证明授权/验签/绑定都成立）。
3. 模板交付与 AI 包交付共用同一顺序，避免两套实现漂移。

**Non-Goals**

- 不自动安装/激活业务应用。
- 不管理私钥；私钥仍来自环境。
- 不改 Blueprint 包协议。

## Decisions

### D1. `deliverDirectory` 是唯一交付实现

顺序固定：license 校验 → 写 license.json → pack → compile/stamp → sign。
`deliver(templateId)` 先复制模板目录再调用；`deliverPackage(id)` 先解包到临时目录再调用。

### D2. 交付后必须 `load` 验证

AI 服务在签名后调用 `BlueprintService.load(packageId, { tenantId })`。
只有 load 成功才写 `loadedAt`；否则请求失败（包已签名但不假装“可运行”）。

### D3. 只存摘要，不存私钥/签名原文

`metadata.blueprint` 记录 `signedAt` / `loadedAt` / `grantedTo` / `expiresAt` / `irDigest`。
签名在 manifest 内，不复制到业务表。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| 重签改变 manifest/文件哈希 | 旧包引用失效 | 包 id 不变但内容更新；发布应 bump 版本 |
| 私钥/公钥未配置 | 交付/装载失败 | 明确 400；测试用临时密钥对 |
| 给错误租户签名 | load 失败 | deliver 后立即以当前组织 load |
