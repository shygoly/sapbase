# Phase 5 Legacy Feature Evaluation

评估 `speckit-legacy` 的 Phase 5 能力是否还需要迁入当前 Nx 工作区。结论：**不迁移**。

| 能力 | Legacy | 当前实现 | 结论 |
|---|---|---|---|
| i18n | `src/i18n` + URL locale 段 | `libs/app-shared/src/i18n` + `libs/ui-layout/src/i18n`：7 语言、`NEXT_LOCALE` cookie、`Accept-Language`、`?lang`、无 URL 前缀 | 当前实现更新，不迁移 |
| Theme | CSS 变量 + 主题切换 | `libs/ui-theme`：token、多主题、brand theme applier、light/dark | 当前实现更完整，不迁移 |
| Error handling | 页面级 ErrorBoundary | `global-error.tsx`、`components/error-boundary`、API `AllExceptionsFilter` | 已覆盖，不迁移 |
| Notifications | 简单 toast/列表 | `apps/api/src/notifications` + Portal/Console 消息中心、偏好、公告、WebSocket | 已覆盖，不迁移 |
| Custom hooks | `src/hooks` | `libs/app-shared/src/hooks`、`libs/ui-layout/src/hooks`、`libs/ui-runtime/src/runtime` | 已覆盖，不迁移 |
| Utilities | `src/lib/utils` | `libs/shared-core`、`libs/shared-state`、`libs/app-shared/src/lib` | 已覆盖，不迁移 |

## 判断依据

1. 当前实现已经按 app/libs 拆分，并接入 RLS、权限、审计；legacy 版本没有这些约束。
2. Legacy 的 URL locale 方案已被 `remove-locale-prefix-from-app-routes` 取代。
3. Legacy 的 i18n/theme/notification 代码与当前 token、消息中心、品牌体系重复，迁入会形成第二真源。
4. 没有发现 legacy 独有的、当前缺失且值得迁移的能力。

## 结论

- 不创建迁移 proposal。
- 后续若发现具体缺口，按单点能力另开 change，不做整包迁移。
