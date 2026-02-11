# Zustand 状态管理集成指南

## 概述

本指南介绍如何在 Speckit ERP 项目中使用 Zustand 进行状态管理。Zustand 是一个轻量级的状态管理库（仅 2KB），用于处理复杂的客户端状态。

## 架构

### 四个核心 Stores

```
┌─────────────────────────────────────┐
│   Zustand State Management          │
├─────────────────────────────────────┤
│ 1. Workflow Store                   │
│    ├─ 工作流实例                    │
│    ├─ 审批任务                      │
│    └─ 当前实例 ID                   │
│                                     │
│ 2. Form Store                       │
│    ├─ 表单值                        │
│    ├─ 表单错误                      │
│    ├─ 表单触碰状态                  │
│    └─ 提交状态                      │
│                                     │
│ 3. UI Store                         │
│    ├─ 模态框状态                    │
│    ├─ 侧边栏状态                    │
│    ├─ 加载状态                      │
│    ├─ 通知                          │
│    └─ 主题                          │
│                                     │
│ 4. Permission Store                 │
│    └─ 权限缓存（带 TTL）            │
└─────────────────────────────────────┘
```

## 使用示例

### 1. 工作流状态管理

```typescript
'use client'

import { useWorkflowState } from '@/core/store'

export function WorkflowComponent() {
  const {
    currentInstance,
    approvalTasks,
    loading,
    addInstance,
    updateInstance,
  } = useWorkflowState()

  return (
    <div>
      <h1>Current State: {currentInstance?.currentState}</h1>
      <p>Approval Tasks: {approvalTasks.length}</p>
      {loading && <p>Loading...</p>}
    </div>
  )
}
```

### 2. 表单状态管理

```typescript
'use client'

import { useFormState } from '@/core/store'

export function UserForm() {
  const formId = 'user-form'
  const {
    values,
    errors,
    isDirty,
    isSubmitting,
    setFieldValue,
    setFieldError,
    resetForm,
  } = useFormState(formId, {
    name: '',
    email: '',
  })

  const handleSubmit = async () => {
    try {
      // Validate
      if (!values.name) {
        setFieldError('name', 'Name is required')
        return
      }

      // Submit
      await submitForm(values)
      resetForm()
    } catch (error) {
      setFieldError('email', 'Failed to submit')
    }
  }

  return (
    <form>
      <input
        value={values.name}
        onChange={(e) => setFieldValue('name', e.target.value)}
      />
      {errors.name && <span>{errors.name}</span>}

      <input
        value={values.email}
        onChange={(e) => setFieldValue('email', e.target.value)}
      />
      {errors.email && <span>{errors.email}</span>}

      <button onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

### 3. UI 状态管理

```typescript
'use client'

import { useUIState } from '@/core/store'

export function Header() {
  const {
    openModal,
    closeModal,
    isModalOpen,
    toggleMainSidebar,
    isSidebarCollapsed,
    addNotification,
  } = useUIState()

  return (
    <header>
      <button onClick={() => toggleMainSidebar()}>
        {isSidebarCollapsed ? 'Open' : 'Close'} Sidebar
      </button>

      <button onClick={() => openModal('settings-modal')}>
        Settings
      </button>

      {isModalOpen('settings-modal') && (
        <div>
          <h2>Settings</h2>
          <button onClick={() => closeModal('settings-modal')}>Close</button>
        </div>
      )}

      <button
        onClick={() => addNotification('success', 'Settings saved!')}
      >
        Save
      </button>
    </header>
  )
}
```

### 4. 权限缓存

```typescript
'use client'

import { usePermissionCache } from '@/core/store'

export function PermissionCheck() {
  const { checkPermission, setPermission } = usePermissionCache()

  // Check cached permission
  const canEdit = checkPermission('user.edit')

  // Set permission with TTL
  const handlePermissionCheck = () => {
    setPermission('user.delete', true, 5 * 60 * 1000) // 5 minutes
  }

  return (
    <div>
      <p>Can Edit: {canEdit === null ? 'Unknown' : canEdit ? 'Yes' : 'No'}</p>
      <button onClick={handlePermissionCheck}>Check Permission</button>
    </div>
  )
}
```

## 与现有系统的集成

### 与 StateMachine 集成

```typescript
import { StateMachine } from '@/core/state-machine/engine'
import { useWorkflowState } from '@/core/store'

export function OrderWorkflow() {
  const { currentInstance, updateInstance } = useWorkflowState()

  const handleTransition = (event: string) => {
    if (!currentInstance) return

    const machine = new StateMachine(
      orderStateMachineDefinition,
      currentInstance.context
    )

    if (machine.can(event)) {
      machine.send(event)
      updateInstance(currentInstance.id, {
        currentState: machine.getState().value,
        context: machine.getContext(),
      })
    }
  }

  return (
    <div>
      <p>Current State: {currentInstance?.currentState}</p>
      <button onClick={() => handleTransition('submit')}>Submit</button>
      <button onClick={() => handleTransition('approve')}>Approve</button>
    </div>
  )
}
```

### 与权限系统集成

```typescript
import { usePermission } from '@/core/auth/hooks'
import { usePermissionCache } from '@/core/store'

export function ProtectedAction() {
  const { hasPermission } = usePermission()
  const { checkPermission, setPermission } = usePermissionCache()

  const handleAction = async () => {
    // Check cache first
    let allowed = checkPermission('action.execute')

    // If not cached, check with permission system
    if (allowed === null) {
      allowed = hasPermission('action.execute')
      // Cache the result for 5 minutes
      setPermission('action.execute', allowed, 5 * 60 * 1000)
    }

    if (allowed) {
      // Execute action
    }
  }

  return <button onClick={handleAction}>Execute</button>
}
```

## 最佳实践

### 1. 使用 Store 的正确方式

```typescript
// ✓ 正确：直接使用 hook
const { values, setFieldValue } = useFormState('form-id', {})

// ✗ 错误：在组件外部调用 hook
const store = useFormStore() // 不要这样做
```

### 2. 避免过度使用 Store

```typescript
// ✓ 正确：简单状态用 useState
const [count, setCount] = useState(0)

// ✗ 错误：所有状态都放在 Store
const { count, setCount } = useUIStore() // 不必要
```

### 3. 清理 Store 状态

```typescript
// ✓ 正确：组件卸载时清理
useEffect(() => {
  return () => {
    removeForm(formId)
  }
}, [formId, removeForm])
```

### 4. 使用 TTL 缓存权限

```typescript
// ✓ 正确：设置合理的 TTL
setPermission('user.edit', true, 5 * 60 * 1000) // 5 minutes

// ✗ 错误：无限期缓存
setPermission('user.edit', true, Infinity)
```

## 性能优化

### 1. 选择性订阅

Zustand 支持选择性订阅，只在需要的状态改变时重新渲染：

```typescript
// 只订阅 values 和 errors
const values = useFormStore((state) => state.forms[formId]?.values)
const errors = useFormStore((state) => state.forms[formId]?.errors)
```

### 2. 批量更新

```typescript
// ✓ 正确：批量更新
setFormValues(formId, {
  name: 'John',
  email: 'john@example.com',
  age: 30,
})

// ✗ 错误：多次单独更新
setFieldValue(formId, 'name', 'John')
setFieldValue(formId, 'email', 'john@example.com')
setFieldValue(formId, 'age', 30)
```

### 3. 清理过期缓存

```typescript
// 定期清理过期的权限缓存
useEffect(() => {
  const interval = setInterval(() => {
    clearExpiredCache()
  }, 60 * 1000) // 每分钟清理一次

  return () => clearInterval(interval)
}, [clearExpiredCache])
```

## 故障排除

### 问题 1：Store 状态未更新

**原因**：可能是因为直接修改了状态对象

**解决**：始终使用 action 方法更新状态

```typescript
// ✗ 错误
const form = forms[formId]
form.values.name = 'John' // 直接修改

// ✓ 正确
setFieldValue(formId, 'name', 'John')
```

### 问题 2：性能下降

**原因**：可能是因为过度订阅或频繁更新

**解决**：使用选择性订阅和批量更新

```typescript
// ✓ 正确：选择性订阅
const values = useFormStore((state) => state.forms[formId]?.values)
```

### 问题 3：内存泄漏

**原因**：可能是因为未清理 Store 状态

**解决**：在组件卸载时清理状态

```typescript
useEffect(() => {
  return () => {
    removeForm(formId)
  }
}, [formId])
```

## 文件结构

```
src/core/store/
├─ workflow.store.ts      # 工作流 store
├─ form.store.ts          # 表单 store
├─ ui.store.ts            # UI store
├─ permission.store.ts    # 权限 store
├─ hooks.ts               # 集成 hooks
└─ index.ts               # 导出索引
```

## 下一步

1. 在现有组件中集成 Zustand stores
2. 迁移现有的 useState 到 Zustand
3. 添加更多 stores 根据需要
4. 性能监控和优化
