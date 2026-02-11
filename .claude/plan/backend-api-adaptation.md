# Backend 改进计划 - 前端API适配

## 📊 执行概览

| 优先级 | 任务 | 工作量 | 预期收益 |
|--------|------|--------|---------|
| 🔴 CRITICAL | Audit Log 增强 | 2-3h | 完整的审计功能 |
| 🔴 CRITICAL | Settings API 完整实现 | 1-2h | 系统设置功能 |
| 🟠 HIGH | 认证保护加强 | 1h | 安全性提升 |
| 🟠 HIGH | API 响应格式统一 | 1h | 前后端一致性 |
| 🟡 MEDIUM | 分页/排序支持 | 2-3h | 性能优化 |

---

## 🔴 PHASE 1: CRITICAL FIXES

### 1.1 Audit Log 实体增强

**文件:** `backend/src/audit-logs/audit-log.entity.ts`

**需要添加的字段：**
```typescript
- resourceId: string (UUID) - 被操作的资源ID
- changes: Record<string, any> - 变更详情 (JSON)
- metadata?: Record<string, any> - 额外元数据
```

**修改内容：**
- 添加 `@Column('jsonb', { nullable: true })` 用于 changes 字段
- 添加索引以提高查询性能
- 更新 DTO 以支持新字段

---

### 1.2 Audit Log 过滤功能

**文件:** `backend/src/audit-logs/audit-logs.controller.ts`

**需要实现的查询参数：**
```typescript
@Query('actor') actor?: string
@Query('action') action?: string
@Query('resource') resource?: string
@Query('resourceId') resourceId?: string
@Query('startDate') startDate?: string
@Query('endDate') endDate?: string
@Query('page') page: number = 1
@Query('pageSize') pageSize: number = 10
```

**修改内容：**
- 更新 `findAll()` 方法支持查询参数
- 在 Service 中实现过滤逻辑
- 返回分页结果

---

### 1.3 Audit Log 导出功能

**文件:** `backend/src/audit-logs/audit-logs.controller.ts`

**新增端点：**
```typescript
@Post('export')
@UseGuards(JwtAuthGuard)
async exportLogs(
  @Body() filter: AuditLogFilterDto,
  @Query('format') format: 'csv' | 'json' = 'csv'
): Promise<StreamableFile>
```

**需要安装的依赖：**
- `papaparse` - CSV 导出
- `@types/papaparse`

---

### 1.4 Settings API 完整实现

**文件:** `backend/src/settings/setting.entity.ts`

**需要的字段：**
```typescript
- id: string (UUID)
- userId: string (UUID) - 用户特定设置
- theme: 'light' | 'dark'
- language: string
- timezone: string
- dateFormat: string
- timeFormat: string
- pageSize: number
- fontSize: number
- enableNotifications: boolean
- createdAt: Date
- updatedAt: Date
```

**修改内容：**
- 添加用户关联（ManyToOne）
- 实现 GET /settings 获取当前用户设置
- 实现 PUT /settings 更新设置
- 添加默认值

---

## 🟠 PHASE 2: HIGH PRIORITY FIXES

### 2.1 认证保护加强

**需要保护的端点：**

| 端点 | 当前状态 | 需要修改 |
|------|---------|---------|
| POST /users | 无保护 | 添加 @UseGuards(JwtAuthGuard, RolesGuard) |
| DELETE /users/:id | 无保护 | 添加 @UseGuards(JwtAuthGuard, RolesGuard) |
| DELETE /departments/:id | 无保护 | 添加 @UseGuards(JwtAuthGuard, RolesGuard) |
| GET /audit-logs | 无保护 | 添加 @UseGuards(JwtAuthGuard) |
| POST /audit-logs | 无保护 | 添加 @UseGuards(JwtAuthGuard) |

---

### 2.2 API 响应格式统一

**当前问题：** 后端返回原始实体，前端期望 ApiResponse 包装

**解决方案：** 使用 ResponseInterceptor（已在 Phase 1 创建）

**需要验证：**
- 所有控制器都使用了 ResponseInterceptor
- 错误响应也被正确包装
- 分页响应使用 PaginatedResponseDto

---

## 🟡 PHASE 3: MEDIUM PRIORITY OPTIMIZATIONS

### 3.1 分页支持

**需要添加到所有列表端点：**
```typescript
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
@Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number
```

**受影响的端点：**
- GET /users
- GET /roles
- GET /departments
- GET /audit-logs
- GET /permissions
- GET /menu

---

### 3.2 排序支持

**需要添加到所有列表端点：**
```typescript
@Query('sortBy') sortBy?: string
@Query('sortOrder') sortOrder?: 'ASC' | 'DESC'
```

**示例：**
```
GET /users?sortBy=createdAt&sortOrder=DESC
```

---

## 📝 数据库迁移计划

### 迁移 1: Audit Log 表增强

```sql
ALTER TABLE audit_log ADD COLUMN resource_id UUID;
ALTER TABLE audit_log ADD COLUMN changes JSONB;
ALTER TABLE audit_log ADD COLUMN metadata JSONB;

CREATE INDEX idx_audit_log_resource_id ON audit_log(resource_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
```

### 迁移 2: Settings 表创建

```sql
CREATE TABLE setting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  time_format VARCHAR(20) DEFAULT 'HH:mm:ss',
  page_size INT DEFAULT 10,
  font_size INT DEFAULT 14,
  enable_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_setting_user_id ON setting(user_id);
```

---

## 🌱 模拟数据填充计划

### 数据集规模：
- 用户: 50 条
- 角色: 5 条
- 部门: 10 条
- 审计日志: 500 条
- 菜单项: 30 条
- 权限: 50 条

### 数据关系：
```
Users (50)
├── Roles (5) - 多对一
├── Departments (10) - 多对一
├── Permissions (50) - 多对多
└── AuditLogs (500) - 一对多

Departments (10)
├── Manager (User) - 多对一
└── Users (50) - 一对多

Roles (5)
└── Permissions (50) - 多对多

Menu (30)
└── Roles (5) - 多对多 (权限控制)
```

---

## 📋 实施步骤

### Step 1: 数据库迁移
- [ ] 创建迁移文件
- [ ] 执行迁移
- [ ] 验证表结构

### Step 2: 实体和 DTO 更新
- [ ] 更新 AuditLog 实体
- [ ] 更新 Setting 实体
- [ ] 创建/更新 DTO

### Step 3: 控制器和服务更新
- [ ] 实现 Audit Log 过滤
- [ ] 实现 Audit Log 导出
- [ ] 实现 Settings API
- [ ] 添加认证保护

### Step 4: 模拟数据填充
- [ ] 创建 seed 脚本
- [ ] 生成模拟数据
- [ ] 验证数据完整性

### Step 5: 测试和验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 前端集成测试

---

## 📦 需要安装的依赖

```json
{
  "papaparse": "^5.4.1",
  "@types/papaparse": "^5.3.14"
}
```

---

## ✅ 验证清单

- [ ] 所有 CRITICAL 问题已修复
- [ ] 所有端点都有适当的认证保护
- [ ] API 响应格式统一
- [ ] 分页功能正常工作
- [ ] 模拟数据已填充
- [ ] 前端可以成功调用所有 API
- [ ] 没有 TypeScript 编译错误
- [ ] 所有测试通过

---

## 📅 预计时间表

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| Phase 1 | CRITICAL Fixes | 6-8 小时 |
| Phase 2 | HIGH Priority | 2-3 小时 |
| Phase 3 | MEDIUM Priority | 3-4 小时 |
| 测试 | 单元/集成测试 | 2-3 小时 |
| **总计** | | **13-18 小时** |

---

## 🎯 下一步

1. **确认优先级** - 是否按照 CRITICAL → HIGH → MEDIUM 的顺序进行？
2. **选择起点** - 从哪个具体任务开始实施？
3. **模拟数据** - 需要什么样的模拟数据？

