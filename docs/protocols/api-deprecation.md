# API 弃用与兼容策略（1.4）

> 状态：冻结（v1）。本文件定义 tenant-only API 与旧 `/chat` 入口的弃用行为；
> 想改窗口或 header，先改本文件再改代码。

## 1. 适用范围

| 入口 | 状态 | 替代 | 行为 |
| --- | --- | --- | --- |
| `/api/blueprints/:id/...`（无 `X-App-Id`） | 兼容期 | 带 `X-App-Id` 的应用上下文调用 | 继续工作，但响应带弃用 header |
| `/api/chat/message` | 兼容期 | `/api/agent/chat`、`/api/agent/runs` | 继续工作，但响应带弃用 header |
| `/api/blueprint-releases`（无组织上下文） | 不支持 | 带组织/应用上下文 | 直接拒绝 |
| 无应用上下文的写工具调用 | 不允许 | 确认令牌 + 应用上下文 | fail-closed |

兼容期不是无限期。tenant-only API 在 **2027-06-30** 之后可以移除；
移除前至少保留两个 minor release 的弃用 header。

## 2. Header 契约

无 `X-App-Id` 的兼容调用返回：

```http
Deprecation: true
Sunset: Wed, 30 Jun 2027 00:00:00 GMT
Link: </docs/protocols/api-deprecation.md>; rel="deprecation"
Warning: 299 - "tenant-only API; send X-App-Id to opt in to app-scoped semantics"
```

- `Deprecation` 是布尔信号，不表示请求失败。
- `Sunset` 是 RFC 7231 HTTP-date。
- `Link` 指向本文件；客户端可据此提示升级。
- `Warning` 只用于可读提示，不参与鉴权。

## 3. 安全边界

- 弃用 header **不改变**权限、RLS、数据范围或确认令牌语义。
- 不允许为了兼容旧入口而放宽跨应用/跨租户检查。
- 新功能只对应用上下文入口开放；旧入口不获得新能力。
- 旧 `/chat` 仍可拒绝写工具；写操作必须走确认令牌和 Agent Runtime。

## 4. 迁移顺序

1. 客户端持久化 active installation，并在请求头发送 `X-App-Id`。
2. 服务端按 `X-App-Id` 解析应用上下文；缺失时走兼容路径并写 header。
3. 监控兼容路径调用量；连续两个 minor release 为零后可移除。
4. 移除前发布 OpenSpec change 并更新本文件与 API 文档。
