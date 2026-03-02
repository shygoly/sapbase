# 数据库设置指南 / Database Setup Guide

## 快速开始 / Quick Start

### 1. 创建数据库 / Create Database

```bash
# PostgreSQL
createdb sapbasic

# 或使用 psql
psql -U postgres
CREATE DATABASE sapbasic;
\q
```

### 2. 配置环境变量 / Configure Environment

复制 `.env.example` 到 `.env` 并配置数据库连接：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=sapbasic

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. 运行数据库迁移和种子数据 / Run Migrations and Seed Data

```bash
cd backend

# 安装依赖
npm install

# 运行迁移（如果有）
npm run migration:run

# 运行种子脚本
npm run seed
```

### 4. 验证数据 / Verify Data

种子脚本会创建以下数据：

#### 用户账号 / User Accounts

| 邮箱 / Email | 角色 / Role | 密码 / Password |
|-------------|------------|----------------|
| admin@example.com | Admin | password123 |
| john.doe@example.com | Manager | (无密码) |
| jane.smith@example.com | Manager | (无密码) |
| alice.chen@example.com | User | (无密码) |

**登录账号 / Login Credentials:**
- 邮箱: `admin@example.com`
- 密码: `password123`

#### 数据统计 / Data Summary

- **角色 / Roles**: 5 (Admin, Manager, User, Viewer, Editor)
- **部门 / Departments**: 3 (Engineering, Sales, HR)
- **用户 / Users**: 11
- **权限 / Permissions**: 20
- **菜单项 / Menu Items**: 8

#### 菜单结构 / Menu Structure

```
Dashboard
System Management
├── User Management (/admin/users)
├── Role Management (/admin/roles)
├── Department Management (/admin/departments)
├── Menu Management (/admin/menu)
├── Settings (/admin/settings)
└── Audit Logs (/admin/audit-logs)
```

## 启动应用 / Start Application

### 开发模式 / Development Mode

```bash
# 在项目根目录
npm run dev

# 或分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:3001
```

### 访问应用 / Access Application

1. 打开浏览器访问: http://localhost:3000/login
2. 使用以下账号登录:
   - 邮箱: `admin@example.com`
   - 密码: `password123`
3. 登录后可以看到左侧菜单和用户管理页面

## API 文档 / API Documentation

启动后端服务后，可以访问 Swagger API 文档：

http://localhost:3001/api/docs

## 故障排除 / Troubleshooting

### 问题 1: 数据库连接失败

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案:**
1. 确保 PostgreSQL 服务正在运行
2. 检查 `.env` 文件中的数据库配置
3. 确认数据库用户有正确的权限

### 问题 2: 种子脚本失败

```
Error: relation "users" does not exist
```

**解决方案:**
1. 确保数据库表已创建（运行迁移或使用 synchronize）
2. 删除数据库并重新创建：
   ```bash
   dropdb sapbasic
   createdb sapbasic
   npm run seed
   ```

### 问题 3: 菜单不显示

**解决方案:**
1. 确认种子脚本已成功运行
2. 检查用户权限是否正确
3. 检查浏览器控制台是否有错误

## 重置数据库 / Reset Database

如果需要重置所有数据：

```bash
cd backend

# 方法 1: 使用 psql
psql -U postgres
DROP DATABASE sapbasic;
CREATE DATABASE sapbasic;
\q

# 方法 2: 使用命令行
dropdb sapbasic
createdb sapbasic

# 重新运行种子脚本
npm run seed
```

## 生产环境部署 / Production Deployment

生产环境请注意：

1. **修改 JWT 密钥**: 在 `.env` 中设置强密码
2. **修改默认密码**: 首次登录后修改 admin@example.com 的密码
3. **配置 HTTPS**: 使用反向代理（如 Nginx）
4. **数据库备份**: 设置定期备份计划
5. **环境变量**: 不要将 `.env` 文件提交到版本控制

## 技术栈 / Tech Stack

- **数据库**: PostgreSQL 12+
- **后端**: NestJS + TypeORM
- **前端**: Next.js 15 + React 18
- **认证**: JWT + bcrypt
- **API 文档**: Swagger/OpenAPI

## 相关文档 / Related Documentation

- [README.md](./README.md) - 项目总览
- [Backend README](./backend/README.md) - 后端文档
- [Frontend README](./speckit/README.md) - 前端文档
