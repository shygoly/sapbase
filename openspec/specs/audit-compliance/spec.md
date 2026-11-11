# audit-compliance Specification

## Purpose
TBD - created by archiving change add-audit-compliance-and-tamper-evidence. Update Purpose after archive.
## Requirements
### Requirement: Append-Only Audit Record

审计记录 MUST 追加写入，MUST NOT 被普通应用路径更新或删除。
数据库 MUST 拒绝非 break-glass 的 UPDATE/DELETE；break-glass MUST 留痕并告警。

#### Scenario: 尝试修改审计

- **WHEN** 应用或普通管理员尝试更新一条审计记录
- **THEN** 数据库/服务 SHALL 拒绝
- **AND** 记录 MUST NOT 改变

#### Scenario: break-glass

- **WHEN** 授权人员执行 break-glass 修改
- **THEN** 系统 SHALL 写入“审计的审计”事件
- **AND** 触发告警

### Requirement: Hash Chain and Sequence

每个组织 SHALL 有一条单调递增的审计链：`seq`、`prevHash`、`hash`。
`hash` MUST 由 canonical payload、`prevHash`、`seq` 与时间计算；同一实现只写一次。
并发写入 MUST NOT 产生重复 `seq` 或断链。

#### Scenario: 正常链

- **WHEN** 连续写入三条审计
- **THEN** 每条 `prevHash` SHALL 等于上一条 `hash`
- **AND** `seq` SHALL 连续递增

#### Scenario: 并发写入

- **WHEN** 同一组织并发写入多条审计
- **THEN** `seq` MUST 唯一且连续
- **AND** 链 MUST 可验证

### Requirement: Checkpoints and Verification

系统 SHALL 定期或手动生成审计检查点（含 `fromSeq/toSeq/lastHash/count/签名`），
并提供验证能力：从最近检查点或 genesis 重算链，返回是否完整及首个断点。
验证失败 MUST 告警。

#### Scenario: 验证通过

- **WHEN** 管理员验证一段审计链
- **THEN** 返回 `valid=true` 与检查范围
- **AND** 检查点签名 SHALL 校验通过

#### Scenario: 检测到断链

- **WHEN** 某条审计被篡改或缺失
- **THEN** 验证 SHALL 返回 `valid=false`
- **AND** SHALL 指明首个异常 `seq`

### Requirement: Single Writer and Event Coverage

审计 MUST 经统一写入器/事件目录写入；业务模块 MUST NOT 直接写 `audit_logs`。
事件目录 MUST 覆盖登录、权限变更、发布/复核、导入/导出、配置修改、AI 生成、
数据同步、服务令牌与安全事件。

#### Scenario: 权限变更被审计

- **WHEN** 管理员修改角色或权限绑定
- **THEN** 系统 SHALL 写入包含操作者、目标、前后值的审计
- **AND** 事件类型 SHALL 来自目录

#### Scenario: 未知事件

- **WHEN** 模块写入目录外事件
- **THEN** 系统 SHALL 拒绝或标记 `custom` 并告警
- **AND** MUST NOT 静默丢弃

### Requirement: Retention, Archival, and Legal Hold

审计 SHALL 按保留类别设置 `retentionUntil`，支持归档到对象存储（JSONL + manifest + checkpoint）
与恢复。`legalHold` 记录 MUST NOT 被清理；归档/清理 MUST 审计且幂等。

#### Scenario: 到期归档

- **WHEN** 审计记录超过在线保留期
- **THEN** 系统 SHALL 归档并记录 manifest
- **AND** 归档后可恢复并再次验证

#### Scenario: 法律保留

- **WHEN** 记录被标记 `legalHold`
- **THEN** 清理任务 MUST 跳过
- **AND** MUST NOT 物理删除

### Requirement: Query and Export

系统 SHALL 支持按 actor/action/resource/时间/来源/结果/correlationId 查询，
并支持 CSV/JSON/XLSX/PDF 导出；大导出 MUST 异步。
导出 MUST 受权限、字段脱敏与数据范围约束。

#### Scenario: 多维查询

- **WHEN** 管理员按用户、时间、模块筛选审计
- **THEN** 结果 SHALL 只含匹配记录
- **AND** 他租记录 MUST NOT 出现

#### Scenario: 台账导出

- **WHEN** 管理员导出大范围审计台账
- **THEN** 系统 SHALL 异步生成文件
- **AND** 导出行为 SHALL 被审计

### Requirement: Access Audit and Anomaly Alerts

审计查询/导出本身 MUST 被审计。系统 SHALL 对批量导出、权限变更、连续登录失败、
break-glass、验证失败等异常触发告警。

#### Scenario: 批量导出告警

- **WHEN** 单次导出超过阈值
- **THEN** 系统 SHALL 产生告警
- **AND** 记录操作者、筛选与行数

#### Scenario: 验证失败告警

- **WHEN** 定时验证发现断链
- **THEN** 系统 SHALL 告警
- **AND** 保留验证报告

### Requirement: Tenant Isolation

审计记录/检查点/归档 MUST 绑定组织并受 RLS 约束；跨租户查询、验证、恢复 MUST 被拒绝。
每组织的链 MUST 独立。

#### Scenario: 跨租户验证

- **WHEN** A 组织管理员验证 B 组织审计链
- **THEN** 请求 SHALL 被拒绝
- **AND** MUST NOT 返回链信息

### Requirement: Backward Compatibility

旧审计记录 MUST 保持可读；新链从迁移点开始，旧行标记 `legacy`，MUST NOT 被改写。
旧查询与 CSV/JSON 导出 MUST 继续可用。

#### Scenario: 旧记录可查

- **WHEN** 查询迁移前的审计
- **THEN** 记录 SHALL 正常返回
- **AND** 标记为 legacy/未链化

#### Scenario: 旧导出接口

- **WHEN** 调用旧 CSV/JSON 导出
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不强制使用新格式

