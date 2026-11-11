## ADDED Requirements

### Requirement: Production Reads Preserve Real Outcomes

生产业务读取 SHALL 使用可验证的live/unavailable结果与来源契约，MUST NOT 将401/403/500/超时/网络/无效格式/缺失API替换为mock或伪成功空列表。合法成功空集合 SHALL 保留为live空状态。实际航运API-client包装及ui-shipping页面/报表筛选/导出 SHALL 消费同一BusinessDataEnvelope；仅有迁移表/导入脚本或前端URL不得视为HTTP提供者已存在。错误 SHALL 保留可公开errorCode/correlationId且不暴露敏感堆栈。上下文/版本事实 MUST 由可信服务端重新查询，不得从浏览器标签扩权。

#### Scenario: 真实查询与合法空集合
- **WHEN** 已装配受权数据提供者返回合法有效数据或成功空集合
- **THEN** 系统 SHALL 展示live及原实际来源/采集时间，空集合展示真实空状态
- **AND** 生产筛选对象与导出参数 SHALL 来自受权live数据而非静态mock身份

#### Scenario: 拒绝或不存在的后端
- **WHEN** 发生权限/服务/网络/格式错误或对应HTTP提供者未装配
- **THEN** 页面与导出 SHALL 明确unavailable/拒绝并保留错误相关标识
- **AND** MUST NOT 显示演示数据如生产成功、把缺失结果强制空数组或宣称真库验收通过

### Requirement: Explicit Isolated Demo Presentation

演示 SHALL 只由受配置隔离profile/env启用，不得由读取失败或客户端demo参数自动启用。demo adapter/数据源/cookie/缓存/幂等namespace MUST 与生产分离，页面/表格/筛选/导出及上下文 MUST 持续标识演示。demo MUST 在前后端拒绝真实REST/Registry业务写及真实导出；本地模拟结果仅能标演示结果。demo/unavailable MUST NOT 作为生产ContextEnvelope事实、授权或写版本依据。

#### Scenario: 独立演示只呈现演示结果
- **WHEN** 用户进入明确配置的隔离演示环境
- **THEN** 所有业务内容 SHALL 持续标识demo并使用独立adapter/namespace
- **AND** 本地交互 SHALL 标演示结果，真实业务写与真实导出调用数量为零

#### Scenario: 故障或演示对象触发真实写
- **WHEN** 生产GET失败、客户端伪造demo模式，或demo对象尝试真实保存/删除/导出/工具写
- **THEN** 系统 MUST 不自动切换模式并拒绝真实副作用
- **AND** MUST NOT 携生产cookie连接演示adapter、共享生产缓存/幂等键或把demo送入生产事实上下文

### Requirement: Namespace-Bound Stale Provenance and Live Revalidation

业务来源 SHALL 包含status、sourceRef、原fetchedAt/expiresAt、可信namespace、可选recordVersions/errorCode/correlationId。namespace MUST 区分mode、用户授权修订（含scopeVersion）、组织、安装、有效releaseDigest及查询；非安装资源必须明确类别，不得制造伪digest。受授权同namespace缓存按批准策略才能显示stale，MUST 标原时间/过期与刷新失败原因，权限错误或身份/org/app/release/scope变化 MUST 清理。stale MUST NOT 重标live或作为当前事实/expectedVersion；写前 MUST 重新取得受权live记录与版本。未接实际路由的缓存模块启用前 SHALL 通过同契约回归，不能把其静态缺陷宣称为已发生生产跨界。

#### Scenario: 同namespace历史缓存透明展示
- **WHEN** 受权用户在同namespace查询刷新失败且策略允许展示既有缓存
- **THEN** 系统 SHALL 展示stale、原sourceRef/fetchedAt和过期/失败原因，不改采集时间
- **AND** 写操作 SHALL 在live受权重取成功并获得版本后才能继续，AI仅可将stale作为明确历史提示

#### Scenario: 权限变化或重取失败
- **WHEN** 权限/组织/安装/release/scope版本变化，或stale写前live查询失败/来源未经验证
- **THEN** 系统 MUST 清旧缓存或拒绝复用，并禁用相应写与当前事实引用
- **AND** MUST NOT 跨namespace命中、重标live、以渲染时间伪采集时间或用旧版本提交生产命令
