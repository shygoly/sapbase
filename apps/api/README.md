# Speckit ERP Backend - NestJS + PostgreSQL

完整的企业ERP后端运行时，使用NestJS和PostgreSQL。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

```bash
cp .env.example .env.local
```

编辑 `.env.local` 配置数据库连接：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=mac
DB_PASSWORD=
DB_NAME=sapbasic
PORT=3001
```

### 3. 启动开发服务器

```bash
npm run start:dev
```

服务器将在 `http://localhost:3001` 启动

## 项目结构

```
backend/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 应用模块
│   └── users/
│       ├── user.entity.ts      # User数据库实体
│       ├── users.service.ts    # Users业务逻辑
│       ├── users.controller.ts # Users API端点
│       ├── users.module.ts     # Users模块
│       └── dto/
│           ├── create-user.dto.ts
│           └── update-user.dto.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## API端点

### Users API

#### 获取所有用户
```
GET /api/users
```

响应:
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "department": "IT",
    "status": "active",
    "createdAt": "2026-02-07T00:00:00Z",
    "updatedAt": "2026-02-07T00:00:00Z"
  }
]
```

#### 获取单个用户
```
GET /api/users/:id
```

#### 创建用户
```
POST /api/users
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "user",
  "department": "HR",
  "status": "active"
}
```

#### 更新用户
```
PUT /api/users/:id
Content-Type: application/json

{
  "name": "Jane Smith",
  "status": "inactive"
}
```

#### 删除用户
```
DELETE /api/users/:id
```

## 数据库

### 连接信息

- **Host**: localhost
- **Port**: 5432
- **Username**: mac
- **Database**: sapbasic

### 创建数据库

```bash
createdb -U mac sapbasic
```

### 表结构

Users表会自动创建，包含以下字段：

- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR, Unique)
- `role` (VARCHAR)
- `department` (VARCHAR)
- `status` (VARCHAR)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

## 开发命令

```bash
# 开发模式（热重载）
npm run start:dev

# 调试模式
npm run start:debug

# 生产构建
npm run build

# 生产运行
npm run start:prod

# 代码格式化
npm run format

# 代码检查
npm run lint

# 运行测试
npm run test

# 测试覆盖率
npm run test:cov
```

## 技术栈

- **Framework**: NestJS 10.3.0
- **Database**: PostgreSQL 14+
- **ORM**: TypeORM 0.3.19
- **Validation**: class-validator 0.14.0
- **Language**: TypeScript 5.3.3

## 许可证

MIT
