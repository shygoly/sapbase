# API 文档生成脚本

## 概述

这些脚本用于自动生成 API 文档：
- `generate-openapi.ts` - 生成 OpenAPI 3.0 规范
- `generate-postman.ts` - 生成 Postman 集合

## 使用前准备

### 1. 安装依赖

确保已安装所有必要的依赖：

```bash
npm install
```

如果遇到 WebSocket 相关错误，安装：

```bash
npm install @nestjs/websockets socket.io
npm install --save-dev @types/socket.io
```

### 2. 可选依赖

为了生成 YAML 格式的 OpenAPI 规范：

```bash
npm install --save-dev yaml
```

## 运行脚本

### 生成所有文档

```bash
npm run generate:docs
```

### 单独生成

```bash
# OpenAPI 规范
npm run generate:openapi

# Postman 集合
npm run generate:postman
```

## 输出文件

生成的文件位于项目根目录：

- `openapi.json` - OpenAPI 3.0 规范（JSON 格式）
- `openapi.yaml` - OpenAPI 3.0 规范（YAML 格式，需要 yaml 包）
- `postman-collection.json` - Postman Collection v2.1

## 常见问题

### 依赖错误

如果遇到依赖解析错误：
1. 检查 `package.json` 中的依赖
2. 运行 `npm install` 重新安装
3. 确保所有模块的依赖都已正确安装

### 类型错误

脚本使用 `--transpile-only` 模式，跳过类型检查。
如果仍有问题，检查 TypeScript 配置。

### 部分文档

如果某些模块无法加载，脚本会生成部分文档。
检查控制台输出中的警告信息。

## 集成到开发流程

### 预提交钩子

在 `.husky/pre-commit` 中添加：

```bash
npm run generate:docs
git add openapi.json postman-collection.json
```

### CI/CD

在 CI pipeline 中：

```yaml
- run: npm install
- run: npm run generate:docs
- uses: actions/upload-artifact@v2
  with:
    name: api-docs
    path: |
      openapi.json
      postman-collection.json
```

## 自定义

### 修改 Swagger 配置

编辑 `src/common/swagger/swagger.config.ts` 来自定义：
- API 标题和描述
- 服务器 URL
- 认证配置
- 标签和分组

### 添加示例

在控制器中使用装饰器添加示例：

```typescript
import { ApiExampleResponse } from '@/common/swagger'

@ApiExampleResponse({
  status: 200,
  example: { id: '123', name: 'Example' }
})
@Get(':id')
async getOne(@Param('id') id: string) {
  // ...
}
```

## 支持

如有问题，请查看：
- `API_DOCUMENTATION.md` - 完整文档指南
- `GENERATE_DOCS.md` - 生成说明
- `API_DOCS_SUMMARY.md` - 功能总结
