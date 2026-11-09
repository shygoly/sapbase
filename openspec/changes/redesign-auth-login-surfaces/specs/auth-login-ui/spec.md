## ADDED Requirements

### Requirement: Shared Login Surface With Surface Variant

Portal 与 Console 的登录页 MUST 复用同一套登录表面组件（或等价共享模块），通过
`surface`（如 `portal` | `console`）区分产品名、副文案与默认登录成功落点。
MUST NOT 长期维护两份互不相同的登录 JSX 副本导致样式再次漂移。

登录业务语义（凭证提交、多组织选择、权限与组织上下文灌入、`returnUrl`）MUST 保持兼容；
本能力只约束观感与结构，MUST NOT 借机更换鉴权协议。

#### Scenario: 两台面共用表面

- **WHEN** 用户打开 Portal 登录页与 Console 登录页
- **THEN** 两者 MUST 基于同一共享登录表面实现
- **AND** 标题或副文案 MUST 能区分租户工作台与平台治理台

#### Scenario: returnUrl 仍生效

- **WHEN** 带合法 `returnUrl` 查询参数登录成功
- **THEN** 系统 MUST 仍导航到该地址（在既有安全约束内）
- **AND** MUST NOT 因改版忽略该参数

### Requirement: Restrained Tokenized Auth Aesthetics

登录表面 MUST 使用设计系统 token（背景、前景、边框、主色）呈现，MUST NOT 使用
硬编码高饱和蓝紫渐变或其它营销风大底图作为默认外观。
默认布局 MUST 以单栏表单为主（窄屏 MUST 单栏）；若提供第二栏，MUST 仅用于品牌/产品说明，
MUST NOT 堆叠促销卡片或玻璃拟态装饰层。

#### Scenario: 无营销渐变底

- **WHEN** 用户打开任一台面登录页
- **THEN** 页面背景与表单 MUST 由 token 类名或主题变量驱动
- **AND** MUST NOT 依赖 `from-blue-50 to-indigo-100` 一类硬编码装饰渐变作为默认主题

#### Scenario: 窄屏可完成登录

- **WHEN** 视口宽度低于约定移动断点
- **THEN** 表单与主按钮 MUST 仍完整可见可操作
- **AND** 第二栏品牌区若存在 MUST 堆叠或收起，MUST NOT 水平挤出表单

### Requirement: Dev Fixtures Do Not Dominate Production Login

测试账号一键填充或账号下拉 MAY 存在于非生产环境，MUST 在生产构建中默认隐藏
（或仅在显式环境开关打开时显示）。正式邮箱/密码主路径 MUST 在视觉层级上高于任何
开发快捷区。

#### Scenario: 生产无测试账号条

- **WHEN** 生产环境构建下打开登录页且未开启显式 fixtures 开关
- **THEN** UI MUST NOT 展示测试账号下拉或明文测试密码列表
- **AND** 用户仍 MUST 能用正常邮箱密码登录

#### Scenario: 非生产保留快捷填充

- **WHEN** 非生产环境打开登录页
- **THEN** 系统 MAY 提供测试账号快捷填充
- **AND** 该区域 MUST NOT 替换或隐藏主登录表单字段
