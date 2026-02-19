# API 文档生成说明

## 前置要求

在生成 API 文档之前，请确保已安装所有依赖：

```bash
npm install
```

特别是以下依赖（如果缺失会导致生成失败）：
- `@nestjs/websockets` - WebSocket 支持
- `socket.io` - Socket.io 库
- `yaml` (可选) - 用于生成 YAML 格式的 OpenAPI 规范

## 安装缺失依赖

如果遇到依赖错误，请安装：

```bash
npm install @nestjs/websockets socket.io
npm install --save-dev @types/socket.io yaml
```

## 生成文档

### 方法 1: 完整生成（推荐）

```bash
npm run generate:docs
```

这将生成：
- `openapi.json` - OpenAPI 3.0 规范（JSON）
- `openapi.yaml` - OpenAPI 3.0 规范（YAML，如果安装了 yaml 包）
- `postman-collection.json` - Postman 集合

### 方法 2: 单独生成

```bash
# 只生成 OpenAPI 规范
npm run generate:openapi

# 只生成 Postman 集合
npm run generate:postman
```

## 故障排除

### 错误: Cannot find module '@nestjs/websockets'

**解决方案**:
```bash
npm install @nestjs/websockets socket.io
npm install --save-dev @types/socket.io
```

### 错误: Dependency resolution failed

**解决方案**:
1. 确保所有模块的依赖都已正确安装
2. 检查 `package.json` 中的依赖版本
3. 运行 `npm install` 重新安装依赖

### 错误: TypeScript compilation errors

**解决方案**:
脚本已配置为使用 `--transpile-only` 模式，跳过类型检查。
如果仍有问题，可以手动运行：

```bash
TS_NODE_TRANSPILE_ONLY=true npm run generate:openapi
```

### 生成部分文档

如果某些模块无法加载，脚本会生成部分文档。
检查输出中的警告信息，然后：
1. 安装缺失的依赖
2. 修复模块依赖问题
3. 重新生成文档

## 使用生成的文档

### Swagger UI

文档已集成到应用中，访问：
```
http://localhost:3051/api/docs
```

### OpenAPI 规范

生成的 `openapi.json` 可以用于：
- 导入到 API 测试工具（如 Postman、Insomnia）
- 生成客户端 SDK
- 集成到 API 网关
- 生成 HTML 文档（使用 Redoc）

### Postman 集合

1. 打开 Postman
2. 点击 "Import"
3. 选择 `postman-collection.json`
4. 设置环境变量：
   - `base_url`: `http://localhost:3051/api`
   - `access_token`: 你的 JWT token

## 自动化

### CI/CD 集成

在 CI/CD  pipeline 中添加：

```yaml
- name: Generate API Docs
  run: |
    npm install
    npm run generate:docs
    
- name: Upload artifacts
  uses: actions/upload-artifact@v2
  with:
    name: api-docs
    path: |
      openapi.json
      openapi.yaml
      postman-collection.json
```

## 注意事项

1. **依赖完整性**: 确保所有模块的依赖都已安装
2. **数据库连接**: 文档生成不需要数据库连接
3. **环境变量**: 某些配置可能需要环境变量，但文档生成会使用默认值
4. **版本控制**: 建议将生成的文档文件加入 `.gitignore`，在 CI/CD 中生成

## 下一步

生成文档后，你可以：
1. 导入 Postman 集合进行 API 测试
2. 使用 OpenAPI 规范生成客户端 SDK
3. 使用 Redoc 生成漂亮的 HTML 文档
4. 集成到 API 网关进行 API 管理
