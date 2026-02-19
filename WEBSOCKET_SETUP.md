# WebSocket 实时协作功能安装指南

## 概述

已实现完整的 WebSocket 实时协作功能，包括：
- ✅ 实时通知
- ✅ 协作编辑
- ✅ 用户在线状态
- ✅ JWT 认证

## 后端安装步骤

### 1. 安装依赖

```bash
cd backend
npm install @nestjs/websockets socket.io
npm install --save-dev @types/socket.io
```

### 2. 验证安装

后端代码已经完成，包括：
- `src/websocket/websocket.module.ts` - WebSocket 模块
- `src/websocket/websocket.gateway.ts` - WebSocket Gateway
- `src/websocket/services/notification.service.ts` - 通知服务
- `src/websocket/services/collaboration.service.ts` - 协作服务

### 3. 启动服务器

```bash
npm run dev
```

WebSocket 将在同一端口上可用（默认 3051）。

## 前端安装步骤

### 1. 安装依赖

```bash
cd speckit
npm install socket.io-client
```

### 2. 配置环境变量

在 `.env.local` 中添加：

```env
NEXT_PUBLIC_WS_URL=http://localhost:3051
```

### 3. 使用组件

#### 实时通知

```tsx
import { NotificationCenter } from '@/components/notifications/notification-center'

function Layout() {
  return (
    <header>
      <NotificationCenter />
    </header>
  )
}
```

#### 协作编辑

```tsx
import { CollaborativeEditor } from '@/components/collaboration/collaborative-editor'

function WorkflowEditor({ workflowId }: { workflowId: string }) {
  const [content, setContent] = useState('')

  return (
    <CollaborativeEditor
      resourceType="workflow"
      resourceId={workflowId}
      value={content}
      onChange={setContent}
    />
  )
}
```

## 功能说明

### 实时通知

- 自动连接和重连
- 未读通知计数
- 标记已读功能
- 离线通知存储

### 协作编辑

- 多用户同时编辑
- 实时同步更改
- 光标位置显示
- 在线用户列表

## API 使用示例

### 后端发送通知

```typescript
import { NotificationService } from './websocket/services/notification.service'

// 发送给用户
await notificationService.sendToUser(userId, {
  type: 'info',
  title: '新消息',
  message: '您有一条新消息',
  organizationId: 'org-123',
})

// 发送给组织
await notificationService.sendToOrganization(organizationId, {
  type: 'success',
  title: '任务完成',
  message: '任务已完成',
})
```

### 前端使用 Hook

```tsx
import { useNotifications } from '@/hooks/use-notifications'
import { useCollaboration } from '@/hooks/use-collaboration'

// 通知
const { notifications, unreadCount, markAsRead } = useNotifications()

// 协作
const { collaborators, sendUpdate } = useCollaboration({
  resourceType: 'workflow',
  resourceId: workflowId,
  onUpdate: (update) => {
    // 处理远程更新
  },
})
```

## 测试

1. 启动后端和前端
2. 打开两个浏览器窗口
3. 在一个窗口中编辑内容
4. 观察另一个窗口的实时更新

## 故障排除

### 连接失败

1. 检查 WebSocket URL 配置
2. 验证 JWT token 是否有效
3. 检查 CORS 设置
4. 查看浏览器控制台错误

### 通知未收到

1. 检查用户是否已订阅
2. 验证通知服务是否正确发送
3. 检查用户 ID 是否匹配

### 协作不同步

1. 确认两个用户在同一房间
2. 检查资源类型和 ID 是否匹配
3. 验证事件处理器是否正确设置

## 文档

- 后端文档：`backend/WEBSOCKET.md`
- 前端文档：`speckit/WEBSOCKET.md`

## 下一步

1. 集成到现有页面
2. 添加更多协作功能（如评论、标注）
3. 实现操作转换（OT）或 CRDT 以处理冲突
4. 添加权限控制
5. 实现消息持久化
