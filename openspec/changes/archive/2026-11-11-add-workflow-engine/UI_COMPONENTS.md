# Workflow UI Components Specification

## Overview

工作流UI组件系统基于现有的 shadcn/ui 组件库，提供完整的工作流管理和可视化功能。

## 核心UI组件

### 1. WorkflowStateDiagram（工作流状态图）

**功能**: 可视化工作流的状态和转换关系

**技术选型**:
- **推荐**: `react-flow` (reactflow.dev)
  - 优点: 交互性强，支持拖拽、缩放、自定义节点样式
  - 适合: 复杂工作流的可视化编辑
- **备选**: `mermaid` (mermaid.js.org)
  - 优点: 轻量级，文本驱动，易于集成
  - 适合: 只读状态图展示

**组件结构**:
```typescript
<WorkflowStateDiagram
  workflow={workflowDefinition}
  currentState={instance?.currentState}
  onStateClick={(state) => showStateDetails(state)}
  onTransitionClick={(transition) => showTransitionRules(transition)}
  interactive={true}
/>
```

**视觉设计**:
- 初始状态: 绿色圆角矩形，带 "START" 标签
- 普通状态: 蓝色圆角矩形
- 最终状态: 双边框矩形，带 "END" 标签
- 当前状态: 高亮显示（黄色边框或背景）
- 转换箭头: 带标签显示转换名称
- 禁用转换: 灰色虚线箭头

### 2. WorkflowTransitionButtons（状态转换按钮组）

**功能**: 显示可用的状态转换操作

**组件结构**:
```typescript
<WorkflowTransitionButtons
  instance={workflowInstance}
  availableTransitions={transitions}
  onTransition={handleTransition}
  disabled={isTransitioning}
/>
```

**视觉设计**:
- 按钮组布局（水平或垂直）
- 每个按钮显示目标状态名称
- 禁用状态显示原因（如：guard条件不满足）
- Loading状态：按钮显示spinner
- 成功/失败：Toast通知

**示例**:
```
[Move to Qualified] [Reject] [Cancel]
```

### 3. WorkflowHistoryTimeline（工作流历史时间线）

**功能**: 以时间线形式展示工作流执行历史

**组件结构**:
```typescript
<WorkflowHistoryTimeline
  history={workflowHistory}
  compact={false}
  onEventClick={(event) => showEventDetails(event)}
/>
```

**视觉设计**:
- 垂直时间线布局
- 每个事件一个卡片
- 显示：时间戳、状态变化（from → to）、触发用户、结果
- 可展开查看详细信息（guard结果、action结果、metadata）

**时间线样式**:
```
● Started: draft
  └─ User: Admin User
  └─ Time: 2026-02-17 10:00:00

● Transition: draft → qualified
  └─ User: Sales User
  └─ Time: 2026-02-17 11:30:00
  └─ Guard: value >= 10000 ✓

● Transition: qualified → won
  └─ User: Manager User
  └─ Time: 2026-02-17 14:00:00
```

### 4. WorkflowInstanceViewer（工作流实例查看器）

**功能**: 显示工作流实例的详细信息

**组件结构**:
```typescript
<WorkflowInstanceViewer
  instance={workflowInstance}
  workflow={workflowDefinition}
  entity={opportunityEntity}
  onTransition={handleTransition}
/>
```

**显示内容**:
- 当前状态（Badge显示）
- 工作流状态（running/completed/failed）
- 可用转换列表
- 工作流上下文变量
- 关联实体信息
- 开始/完成时间

### 5. WorkflowDefinitionEditor（工作流定义编辑器）

**功能**: 创建和编辑工作流定义

**组件结构**:
```typescript
<WorkflowDefinitionEditor
  workflow={existingWorkflow}
  entityTypes={['Opportunity', 'Lead']}
  onSave={handleSave}
/>
```

**编辑功能**:
- 基本信息：名称、描述、实体类型
- 状态管理：添加/编辑/删除状态
- 转换管理：添加/编辑/删除转换
- Guard条件编辑器：代码编辑器或表单
- 实时预览：状态图实时更新

### 6. WorkflowInstanceList（工作流实例列表）

**功能**: 列表展示工作流实例

**组件结构**:
```typescript
<WorkflowInstanceList
  instances={workflowInstances}
  workflow={workflowDefinition}
  onInstanceClick={(instance) => navigateToInstance(instance)}
/>
```

**表格列**:
- 实例ID
- 关联实体（类型+ID）
- 当前状态
- 工作流状态
- 开始时间
- 操作（查看详情、执行转换）

## 页面结构

### `/admin/workflows` - 工作流管理页面

**布局**:
```
┌─────────────────────────────────────────┐
│ Workflows Management                    │
├─────────────────────────────────────────┤
│ [New Workflow] [Import] [Export]       │
├─────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────┐│
│ │ Workflow    │ │ Workflow Details    ││
│ │ List        │ │                     ││
│ │             │ │ - State Diagram     ││
│ │ - WF1       │ │ - Transitions       ││
│ │ - WF2       │ │ - Guard Conditions  ││
│ │ - WF3       │ │                     ││
│ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────┘
```

### `/admin/workflows/:id` - 工作流详情页

**Tabs**:
1. **Definition** - 工作流定义编辑器 + 状态图
2. **Instances** - 实例列表
3. **History** - 全局历史（所有实例）
4. **Settings** - 工作流配置

### Entity Detail Pages - 集成工作流UI

**布局**:
```
┌─────────────────────────────────────────┐
│ Opportunity #123                        │
├─────────────────────────────────────────┤
│ [Basic Info]                            │
│                                          │
│ [Workflow Status]                        │
│ Current State: [qualified]             │
│ Available Actions:                      │
│ [Move to Won] [Move to Lost]            │
│                                          │
│ [Workflow History]                      │
│ ● draft → qualified (2 hours ago)      │
│ ● qualified → ...                       │
└─────────────────────────────────────────┘
```

## 技术依赖

### 需要安装的新依赖

```json
{
  "dependencies": {
    "reactflow": "^11.10.0",  // 状态图可视化（推荐）
    // 或
    "mermaid": "^10.6.0",      // 备选方案
    "@mermaid-js/mermaid": "^10.6.0"
  }
}
```

### 现有依赖（已安装）

- `shadcn/ui` - 基础UI组件
- `recharts` - 图表（用于工作流分析）
- `lucide-react` - 图标
- `zustand` - 状态管理
- `react-hook-form` - 表单处理

## UI组件文件结构

```
speckit/src/
├── components/
│   └── workflows/
│       ├── workflow-state-diagram.tsx      # 状态图组件
│       ├── workflow-transition-buttons.tsx # 转换按钮组
│       ├── workflow-history-timeline.tsx    # 历史时间线
│       ├── workflow-instance-viewer.tsx    # 实例查看器
│       ├── workflow-definition-editor.tsx  # 定义编辑器
│       ├── workflow-instance-list.tsx      # 实例列表
│       └── workflow-state-badge.tsx       # 状态徽章
├── app/
│   └── admin/
│       └── workflows/
│           ├── page.tsx                   # 工作流列表页
│           ├── [id]/
│           │   ├── page.tsx               # 工作流详情页
│           │   └── instances/
│           │       └── page.tsx           # 实例列表页
│           └── new/
│               └── page.tsx               # 创建工作流页
└── lib/
    └── api/
        └── workflows.api.ts               # API客户端
```

## 设计原则

1. **一致性**: 使用 shadcn/ui 设计系统，保持UI风格统一
2. **响应式**: 支持桌面和移动端
3. **可访问性**: 遵循 WCAG 标准，支持键盘导航
4. **性能**: 大型状态图使用虚拟滚动，懒加载历史记录
5. **交互性**: 状态图支持拖拽、缩放、选择

## 示例截图描述

### 状态图示例
```
        [START]
           │
           ▼
      ┌─────────┐
      │  draft  │
      └─────────┘
           │
           ├──────────────┐
           ▼              ▼
    ┌──────────┐    ┌─────────┐
    │qualified │    │rejected │
    └──────────┘    └─────────┘
           │
           ├──────────┐
           ▼          ▼
      ┌────────┐  ┌──────┐
      │  won   │  │ lost │
      └────────┘  └──────┘
           │          │
           └──────┬───┘
                  ▼
              [END]
```

### 转换按钮示例
```
Current State: qualified

Available Actions:
┌─────────────────┐  ┌──────────────┐  ┌──────────┐
│ Move to Won     │  │ Move to Lost │  │ Cancel   │
│ (value >= 10k)  │  │              │  │          │
└─────────────────┘  └──────────────┘  └──────────┘
```
