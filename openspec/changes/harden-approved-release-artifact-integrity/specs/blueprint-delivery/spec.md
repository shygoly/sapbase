## MODIFIED Requirements

### Requirement: Licensed and Signed Delivery

蓝图包 SHALL 能声明授权范围（可运行的租户、可否再销售、到期时间）并携带签名。
装载器 MUST 在装载前验签并校验授权；任一项不通过 MUST 拒绝装载，
MUST NOT 以"先跑起来"的方式降级。

受治理新发布 SHALL 复用既有完整 manifest 去 signature 的规范化 Ed25519 载荷和先编译盖章后签名顺序；最终包 MUST 与批准冻结候选的文件/unsigned manifest/IR/compiled 章及固定依赖闭包等价，并由完整目录 envelope 绑定实际 artifactDigest。解析 MUST 同时验证目录签名、实际包字节摘要、Blueprint 七道装载判据及许可，不以目录标签替代包验证。签名/许可签发及写入 MUST 来自平台授权，既有 Blueprint package/out、compile(stamp)、deliver/deliverPackage、AI materialize/deliver 和 module-registry export MUST 仅操作受控 staging/隔离开发候选或经过同摘要发布门禁的新不可变引用，MUST NOT 绕过批准/证据、覆盖封存包或重定向已发布别名。开发未签名豁免 MUST 保持正式 Explicit Unsigned Exemption 的判据，MUST NOT 用于生产发布/安装资格或必需 gate。resell 保持原声明/审计语义，不因缺交易上下文新增装载限制。

#### Scenario: 授权范围内的租户

**Given** 一个已签名、`grantedTo` 含当前租户且未过期的包
**When** 装载该包
**Then** 装载 SHALL 成功
**And** 审计 SHALL 记录授权校验结果

#### Scenario: 未授权租户

**Given** 一个 `grantedTo` 不含当前租户的包
**When** 装载该包
**Then** 装载 SHALL 失败并说明该租户不在授权范围内
**And** MUST NOT 产生任何可执行计划

#### Scenario: 包被篡改

**Given** 一个已签名的包
**When** 任一文件或清单被修改（授权字段包含在内）而签名未更新
**Then** 验签 SHALL 失败
**And** 装载 SHALL 被拒

#### Scenario: 授权过期

**Given** 一个 `expiresAt` 已过去的包
**When** 装载该包
**Then** 装载 SHALL 被拒

#### Scenario: Approved immutable AI or template package is resolved

- **GIVEN** 平台授权签名者按同候选证据/批准生成新不可变包，所有文件、UI/权限及固定依赖均匹配
- **WHEN** 安装消费方按 expectedReleaseDigest 解析并在许可租户装载同一返回包引用
- **THEN** 平台 MUST 核验目录与包的完整签名/摘要及七道装载判据，返回只读引用
- **AND** AI metadata.loadedAt MUST 仅在该同一引用真实 load 成功后写入，publish 不修改安装指针

#### Scenario: Legacy delivery or unsigned exemption cannot bypass approval

- **WHEN** 旧交付路由仅凭 JWT/自报许可尝试生产签发或覆盖 published 包，caller out/stamp 指向封存地址，或用开发豁免/目录标签/漂移 Registry 依赖充当发布证据
- **THEN** 平台 MUST 因平台授权/封存/同摘要门禁或签名依赖不符而拒绝，不公开可消费新发布
- **AND** 未签名开发装载仍只允许显式隔离用途并保留完整性/编译/防漂移/绑定/审计，生产豁免 MUST 报错；失败 MUST NOT 写 loadedAt

## ADDED Requirements

### Requirement: Blueprint Artifacts Use Digest Addressed Conditional Writes

平台 SHALL 按最终 signed .erpkg 全部实际字节重算 artifactDigest 并以服务端安全 digest 路径条件创建；MUST 在 staging 完整构建/盖章/签名、fsync 后不覆盖原子提交，MUST NOT 使用 exists→write 或普通覆盖 rename 模拟 write-once。版本别名 MUST 在组织或平台发布命名空间内唯一固定映射摘要，已 published 后任何状态不得换向/复用，同版本不同摘要 MUST 拒绝。相同摘要重复写 MUST 重读验证整包一致后返回既有引用；目标损坏/驱动不支持条件创建 MUST 拒绝而非覆盖/降级。旧包迁移 MUST 只读验证并复制到 digest 地址，不就地重签覆盖历史。包先写、目录后提交的失败 MUST 不公开半包或完整孤儿，存储引用 MUST 不充当授权证明。

#### Scenario: Competing conditional writes preserve a single complete artifact

- **GIVEN** 已批准候选的最终包在 staging 完整签名，平台重算实际字节 SHA
- **WHEN** 多个进程竞争同 artifactDigest 条件创建并读取
- **THEN** 存储 MUST 只提交一份完整已验证原字节，重复请求返回同只读引用
- **AND** 版本别名和目录 MUST 只在完整校验后固定映射该摘要，重复操作不换向

#### Scenario: A different digest or damaged address is not overwritten

- **WHEN** 同版本提出不同 artifactDigest，digest 地址现字节不匹配，或驱动无法条件创建
- **THEN** 平台 MUST 明确拒绝冲突/完整性失败/不可用并留真实审计，旧字节与别名不变
- **AND** superseded/revoked、AI redeliver 或紧急理由 MUST NOT 释放版本、覆盖损坏地址或原包

#### Scenario: Interrupted publishing exposes no partial or orphan package

- **WHEN** staging/签名/fsync/目录事务期间失败并重启恢复
- **THEN** 目录及业务读取 MUST 不公开半写包或无成功发布关联的完整孤儿
- **AND** 恢复只可重新校验完整孤儿并在同门禁下完成持久结果，不报告假 succeeded、不启用同版本覆盖
