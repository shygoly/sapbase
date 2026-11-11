## ADDED Requirements

### Requirement: Platform-Admitted Isolated Browser Plugin Resources

平台 SHALL 为第三方 UI 提供独立站点 origin 的 sandbox iframe，不得把其 JS/自由 CSS 导入主 React/DOM 权限域。平台 MUST 重算并验证完整入口、脚本chunk、样式与依赖资源图摘要、可信签名、批准引用、固定 origin 与撤销状态，并执行双站 CSP/referrer/设备能力策略。第三方即使签名有效也 MUST 隔离；可信第一方例外 MUST 来自平台源码管线批准的固定摘要/签名记录，不得由插件自报。缺准入证据、跨界重定向或策略不可用 MUST 拒绝且不得同域回退。正式依赖管理/发现与既有后端 Node 子进程判据 SHALL 保留；Node 出网限制不得被浏览器安全证据替代。

#### Scenario: 合法第三方与批准纯主题
- **WHEN** 完整签名资源图及固定独立 origin 已被平台批准且未撤销
- **THEN** 第三方 UI SHALL 仅在受限 iframe 内运行，不能获得主 DOM/cookie/token/设备权限
- **AND** 主站只应用平台验证的纯主题变量，不执行第三方自由样式或脚本

#### Scenario: 自报第一方或资源漂移
- **WHEN** 插件自报 trusted、子资源不在签名图内、摘要变化、来源回到主站或准入/CSP缺失
- **THEN** 系统 MUST 拒绝挂载并显示插件不可用
- **AND** MUST NOT 动态 import 或 style 注入主站作为兼容回退

### Requirement: Instance-Bound Narrow Browser Plugin Bridge

浏览器桥 SHALL 使用版本化封闭 Schema、精确 origin/source、一次性随机 nonce/实例/摘要绑定后建立 MessageChannel，MUST NOT 使用通配 targetOrigin。消息与并发/深度/时限 MUST 受批准版本化 host policy 约束。平台 MUST 拒绝未知字段、重放和任意 URL/SQL/HTML/代码代理。每次数据请求或动作提议 MUST 从可信 session 与安装/版本解析身份，复用清单能力∩用户功能权限∩安装允许能力及既有数据范围；工具只经 Registry。写 SHALL 只产生提议，在主可信面确认后真实 invoke 才显示成功，缺提供者 MUST 拒绝。

#### Scenario: 合法最小查询及主站确认
- **WHEN** 已绑定实例请求已登记数据能力或提交合法动作提议
- **THEN** 平台 SHALL 重新核验权限与数据范围，仅返回最小字段及可信来源
- **AND** 写请求 SHALL 在主站确认并经 Registry 真实执行后才显示业务成功

#### Scenario: 错源重放或任意代理
- **WHEN** 消息 origin/source/nonce/摘要不匹配、已重放、超限、请求任意URL/SQL/HTML或未获主站确认
- **THEN** 系统 MUST 拒绝并记录原因
- **AND** MUST NOT 执行查询越权、真实写或合成成功；缺Registry/授权/确认提供者同样拒绝

### Requirement: Revocation and Context Changes Invalidate Browser Plugin Instances

插件撤销/停用/卸载、资源摘要变化以及 session/权限/组织/安装/有效版本变化 SHALL 关闭旧port，清除展示数据及旧namespace缓存并取消未提交请求。服务端 MUST 在每次能力调用核验权威准入修订与可信上下文，通知不可作为唯一拒绝边界。已提交事务 MUST 保留真实审计，不得把关闭界面宣称为业务回滚。旧插件可保留发现元数据，但不符合新准入 MUST 不挂载。

#### Scenario: 有效实例随上下文轮换清理
- **WHEN** 合法用户从一个安装或组织切换到另一个可信上下文
- **THEN** 系统 SHALL 关闭旧桥并清旧数据，成功解析新上下文后才建立新实例
- **AND** 历史已提交事务 SHALL 照实保留结果与审计

#### Scenario: 撤销通知丢失仍拒绝旧实例
- **WHEN** 资源已撤销或权限失效但旧iframe/缓存/port仍尝试调用，且即时通知未收到
- **THEN** 服务端 MUST 按权威修订拒绝且无新副作用
- **AND** 宿主 MUST NOT 恢复旧摘要、同域组件或旧通道继续执行
