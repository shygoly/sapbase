# Nx 边界接入初始违规清单

> 记录时间：2026-10-30
> 运行命令（PowerShell，禁用 Nx daemon）：

```bash
$env:NX_DAEMON='false'
node node_modules/eslint/bin/eslint.js "backend/src/**/*.ts" "libs/**/*.ts" --no-error-on-unmatched-pattern
```

## 结果

- `@nx/enforce-module-boundaries`：**0 条违规**（规则已接入，级别 `warn`）
- 其他 ESLint 问题：4 条，均与模块边界无关

| 文件 | 行 | 规则 | 说明 |
|---|---|---|---|
| `backend/src/ai-modules/ai-modules.service.ts` | 392 | `no-useless-catch` | 既有代码；不在本变更修复 |
| `backend/src/ai-modules/ai-modules.service.ts` | 456 | `no-control-regex` | 既有代码；不在本变更修复 |
| `backend/src/migrations/data-source.ts` | 7 | `@typescript-eslint/no-var-requires` | 内联 disable 引用了未安装的规则；后续清理 |
| `backend/src/plugins/application/services/plugin-lifecycle.service.integration.spec.ts` | 100 | `no-empty` | 既有测试代码 |

## 结论

Nx 边界规则已可运行，当前没有需要迁移的越界依赖。
上述 4 条属于既有 lint 债务，登记为后续清理项，不阻塞本变更。
