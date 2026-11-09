## ADDED Requirements

### Requirement: Dual Intent Assistant On Current Page

壳层 PiAgent 面板 MUST 支持用户在当前业务/治理页完成两类意图，且 MUST 共用同一面板
会话表面（可由固定按钮或悬浮球打开）：

1. **用法答疑（只读）**：解释当前页如何使用、控件为何不可用、相关配置入口等。
2. **协助操作**：经平台工具面查询或起草写操作；写操作 MUST 经用户确认与平台确认令牌后才执行。

面板打开时 MUST 携带并展示当前组织、应用、路由与选中实体等上下文（以芯片等形式），
用户 MUST 能移除不需要的上下文项。业务页面 MUST NOT 再实现第二套聊天浮层。

#### Scenario: 问用法不触发写

- **WHEN** 用户在面板选择或表达「这页怎么用」类只读意图
- **THEN** 系统 MUST 基于已发布知识或帮助检索作答（或明确无依据）
- **AND** MUST NOT 签发或消费写确认令牌

#### Scenario: 代操写操作必须确认

- **WHEN** 用户请求创建/更新业务数据且工具为写工具
- **THEN** 面板 MUST 展示确认卡（含后果说明与参数摘要）
- **AND** 用户取消 MUST NOT 写入
- **AND** 用户确认后 MUST 仅通过平台确认令牌路径执行

### Requirement: Floating Ball Is Optional Trigger

壳层 MUST 提供固定控件作为打开上述面板的主触发器（顶栏或侧栏等）。
产品若启用悬浮球，悬浮球 MUST 仅作为打开同一面板的附加触发器，MUST NOT 成为唯一入口；
关闭或隐藏悬浮球后用户 MUST 仍能打开同一面板。
悬浮球若启用，MUST NOT 遮挡主 CTA 或分栏拖拽把手到无法使用（可拖移或可关）。

#### Scenario: 无悬浮球仍可打开助手

- **WHEN** 产品关闭悬浮球或当前视口隐藏悬浮球
- **THEN** 用户 MUST 仍能通过壳层固定入口打开同一 PiAgent 面板
- **AND** 面板上下文注入行为 MUST 与经悬浮球打开时一致

#### Scenario: 悬浮球不另起一套会话 UI

- **WHEN** 用户先点固定按钮打开面板，再关闭后点悬浮球打开
- **THEN** 系统 MUST 打开同一面板组件（同一产品表面）
- **AND** MUST NOT 叠出第二套互不相关的聊天窗

### Requirement: Grounded Help And Tool Visibility

用法答疑 MUST 优先使用已发布知识 / 平台帮助检索结果；MUST NOT 把未发布草稿知识
当作正式回答依据。工具调用进行中 MUST 有可取消或可停止的进行中状态；失败 MUST
给出可行动错误，MUST NOT 仅展示原始堆栈。

#### Scenario: 无知识时诚实降级

- **WHEN** 帮助检索无覆盖用户问题时
- **THEN** 助手 MUST 明确说明无法从已发布帮助得出答案
- **AND** MUST NOT 伪造具体操作步骤冒充文档

#### Scenario: 工具调用状态可见

- **WHEN** 助手正在调用平台工具
- **THEN** UI MUST 展示进行中状态
- **AND** 完成后 MUST 展示成功摘要或可行动失败信息
