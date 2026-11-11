# Tasks

> 依赖：`docs/protocols/piagent.md`；壳入口几何可与
> `enhance-ui-runtime-scenario-capabilities` §5.9 合并交付。

## 1. 契约

- [x] 1.1 delta 定稿（`piagent-contextual-assistant` 三 requirement）
- [x] 1.2 与 `.cursor/skills/compose-admin-page` §2f 对齐：壳入口为主、禁业务页私挂

## 2. 壳入口与面板

- [x] 2.1 `PiAgentShell` 挂进共享 Header（Portal dashboard + Console LayoutRuntimeAdapter）
- [x] 2.2 右下悬浮球（可关、localStorage 记忆）；隐藏后固定按钮仍可打开
- [x] 2.3 上下文芯片 org/app/release?/route/entity，可逐个移除并注入消息

## 3. 帮助意图（用法答疑）

- [x] 3.1 帮助空态快捷：这页怎么用/为什么灰显/去哪配置
- [x] 3.2 走 `chatApi` 帮助检索；refusal 时明确「未找到已发布依据」并只读降级
- [x] 3.3 Stop 可取消等待并忽略迟到响应；后端未提供流式/引用，已按现状降级

## 4. 代操意图（协助操作）

- [x] 4.1 协助空态快捷：查数/创建（先确认卡）/可用操作
- [x] 4.2 复用 `PlanRenderer`：facts/table 卡片；写操作出确认卡
- [x] 4.3 `agentToolsApi.confirmThenInvoke`；取消只 dismiss surface；无令牌不 invoke

## 5. 验收

- [x] 5.1 e2e：隐藏悬浮球后 header 按钮打开同一 `[data-piagent-panel]`
- [x] 5.2 唯一面板在壳组件；业务页未新增聊天浮层（grep 校验）
- [x] 5.3 validate 通过
