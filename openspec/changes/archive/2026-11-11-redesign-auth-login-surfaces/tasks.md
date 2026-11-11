# Tasks

## 1. 契约与结构

- [x] 1.1 定稿 `auth-login-ui` delta（单栏优先、token、台面辨识、测试账号门闸）
- [x] 1.2 选定共享组件落点（`app-shared` 或 `ui-layout`）与 `surface: portal | console`

## 2. 实现

- [x] 2.1 实现共享 `LoginSurface`：邮箱/密码、加载、错误、组织选择、returnUrl
- [x] 2.2 Token 化样式：去除蓝紫渐变硬编码；克制背景与表单层级
- [x] 2.3 Portal / Console 页改为薄包装并传入台面文案/默认跳转
- [x] 2.4 测试账号快捷区仅非生产（或显式 env）可见

## 3. 验收

- [x] 3.1 两台面登录成功路径与选组织路径回归
- [x] 3.2 窄屏单栏可用；无明显营销风装饰
- [x] 3.3 肉眼可区分 Portal vs Console 登录标题/副文案
- [x] 3.4 `openspec validate redesign-auth-login-surfaces --strict`
