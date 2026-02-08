# Speckit ERP - 前后端集成指南

## 项目架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  - Schema系统 (types, resolver, validator, registry)        │
│  - 动态UI组件 (SchemaForm, SchemaList)                      │
│  - 示例页面 (/admin/users)                                  │
│  - API服务 (apiService)                                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST
                     │ (localhost:3001/api)
┌────────────────────▼────────────────────────────────────────┐
│                   Backend (NestJS)                           │
│  - Users模块 (entity, service, controller)                  │
│  - CRUD操作                                                 │
│  - PostgreSQL数据库                                         │
└─────────────────────────────────────────────────────────────┘
```

## 快速启动

### 1. 启动PostgreSQL数据库

```bash
# 创建数据库（如果不存在）
createdb -U mac sapbasic

# 或使用psql连接
psql -U mac -d sapbasic
```

### 2. 启动NestJS后端

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local

# 启动开发服务器
npm run start:dev
```

后端将在 `http://localhost:3001` 启动

### 3. 启动Next.js前端

```bash
cd speckit

# 安装依赖（如果未安装）
npm install --legacy-peer-deps

# 配置环境变量
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:3000` 启动

### 4. 访问应用

打开浏览器访问: `http://localhost:3000/admin/users`

## 数据流

### 创建用户流程

```
1. 用户在前端表单输入数据
   ↓
2. SchemaForm验证数据
   ↓
3. apiService.createUser() 发送POST请求
   ↓
4. NestJS后端接收请求
   ↓
5. UsersController处理请求
   ↓
6. UsersService保存到数据库
   ↓
7. 返回创建的用户对象
   ↓
8. 前端更新列表显示
```

### 获取用户列表流程

```
1. 页面加载时调用 apiService.getUsers()
   ↓
2. 发送GET请求到 /api/users
   ↓
3. NestJS后端查询数据库
   ↓
4. 返回用户列表
   ↓
5. SchemaList组件渲染列表
```

## API端点

### Users API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| POST | `/api/users` | 创建用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |

### 请求示例

**创建用户**
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "department": "IT",
    "status": "active"
  }'
```

**获取所有用户**
```bash
curl http://localhost:3001/api/users
```

**更新用户**
```bash
curl -X PUT http://localhost:3001/api/users/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "status": "inactive"
  }'
```

**删除用户**
```bash
curl -X DELETE http://localhost:3001/api/users/{id}
```

## 环境变量配置

### 前端 (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 后端 (.env.local)

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=mac
DB_PASSWORD=
DB_NAME=sapbasic
PORT=3001
NODE_ENV=development
```

## 常见问题

### Q: 前端无法连接到后端
**A**: 检查以下几点：
1. 后端是否在运行 (`npm run start:dev`)
2. 后端端口是否为3001
3. 前端的 `NEXT_PUBLIC_API_URL` 是否正确
4. 检查浏览器控制台的错误信息

### Q: 数据库连接失败
**A**: 检查以下几点：
1. PostgreSQL是否运行
2. 数据库是否存在 (`createdb -U mac sapbasic`)
3. 后端的 `.env.local` 配置是否正确
4. 用户名和密码是否正确

### Q: 表格未显示
**A**: 检查以下几点：
1. Schema文件是否存在 (`public/specs/objects/user.json`)
2. SchemaResolver是否能加载Schema
3. 后端是否返回了数据

## 扩展指南

### 添加新的API端点

1. 创建新的Entity (例如: `src/departments/department.entity.ts`)
2. 创建Service和Controller
3. 创建Module并导入到AppModule
4. 在前端创建对应的API服务方法

### 添加新的Schema

1. 在 `public/specs/objects/` 创建ObjectSchema JSON
2. 在 `public/specs/views/` 创建ViewSchema JSON
3. 在 `public/specs/pages/` 创建PageSchema JSON
4. 在前端页面中使用 `schemaResolver.resolvePage()`

## 性能优化

### 后端优化
- 使用数据库索引
- 实现分页查询
- 添加缓存层

### 前端优化
- Schema缓存
- 列表虚拟化
- 代码分割

## 安全建议

1. **认证**: 添加JWT认证
2. **授权**: 实现权限检查
3. **验证**: 服务端验证所有输入
4. **CORS**: 配置正确的CORS策略
5. **环境变量**: 不要提交 `.env.local` 到版本控制

## 故障排查

### 查看后端日志
```bash
cd backend
npm run start:dev
```

### 查看前端日志
```bash
# 浏览器开发者工具 (F12)
# 查看 Console 和 Network 标签
```

### 测试API连接
```bash
# 测试后端是否运行
curl http://localhost:3001/api/users

# 查看响应
```

## 下一步

- [ ] 实现认证系统
- [ ] 添加权限检查
- [ ] 实现更多模块 (Departments, Roles等)
- [ ] 添加单元测试
- [ ] 部署到生产环境
