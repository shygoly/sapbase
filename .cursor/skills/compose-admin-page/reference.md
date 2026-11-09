# compose-admin-page · Reference

## Skill vs OpenSpec

| 主题 | Skill（本目录） | OpenSpec `enhance-ui-runtime-scenario-capabilities` |
|------|-----------------|------------------------------------------------------|
| 台面三分 + Org/App/Brand 复用 | SaaS 台面 §2（使用框架→Portal；治理→Console） | Surface Separation / 切组织失效 / 品牌·配额 MUST |
| PiAgent 入口 | §2f 选型与禁私挂 | Contextual Shell Entry MUST |
| 何时用 Dialog / Stack / 左右栏 | 选型表 §2b | Workbench 布局原语 MUST |
| 选中与 URL、切行未保存 | 默认做法 §2c | selection + dirty 平台能力 |
| 菜单挂载、locale 前缀 | 操作清单 §2d | `componentKey` / interaction 元数据 |
| 三态 / 通知 / 权限接线 | 接线惯例 §2e | Runtime 默认空错态、细粒度权限 |
| 虚拟化 / format / Error Boundary | 提到缺口 | 正式 Requirement + tasks |
| 主从表、自助设置入口接线 | Skill 选型 + 降级 | Master-Detail Lines / Tenant Self-Service MUST |
| 拼某一业务页 | **在这里执行** | 不写具体订单页 |

## 明确不在本 Skill 的范围

| 项 | 去哪 |
|----|------|
| AntD 双栈 / Standard*Page 品牌 / Marketing 壳 | 拒绝；见 OpenSpec 非目标 |
| 自定义域名 → 组织解析 | 暂缓；OpenSpec Open Questions |
| DOMAIN / 发布闸 / Agent 工具确认令牌 | `DOMAIN.md` / release / `AGENT-TOOLS.md` |
| agent-bridge 直接改 `libs/*` 生成页面 | 禁止；走蓝图提议 |

## SaaS building blocks（已有，勿重造）

| 积木 | 路径 |
|------|------|
| OrgSwitcher / AppSwitcher | `libs/ui-layout/src/components/` |
| organization store | `libs/shared-state/.../organization.store.ts` |
| BrandConfigProvider / Theme / Logo | `libs/app-shared/src/contexts/brand-config-context.tsx`、`components/brand/` |
| brand API | `libs/app-shared/src/lib/api/brand-config.ts` |
| 品牌配置页入口 | **目标** Portal 组织设置；现状 console `admin/organization/brand-config` 为迁移债 |
| Blueprint 租户装载 | `libs/platform-release` + portal `apps/[packageId]` |
| PiAgent 协议 | `docs/protocols/piagent.md` |
| PiAgent 联调整页（辅） | `apps/web-portal/.../dashboard/piagent` |

## Canonical locations

| 层 | 路径 | 放什么 |
|----|------|--------|
| Portal | `apps/web-portal/src/app/[locale]/dashboard/**` | 租户业务 + 使用框架（用户/角色/部门/菜单/品牌等） |
| Console | `apps/web-console/src/app/[locale]/admin/**` | 瘦平台治理（发布/插件/知识库/Agent·AI…） |
| Runtime | `libs/ui-runtime/src/runtime/**` |
| Blueprint UI | `libs/ui-runtime/src/blueprint/**` |
| ui-kit | `libs/ui-kit/src/**` |
| 再导出 | `libs/app-shared/src/components/**` |
| 布局壳 | `libs/ui-layout/**` |
| API | `libs/api-client/**` → `@sap/app-shared/lib/api` |
| OpenSpec | `openspec/changes/enhance-ui-runtime-scenario-capabilities/**` |

## Preferred imports

```ts
import { PageRuntime, CollectionRuntime, FormRuntime, type PageModel, type CollectionModel, type FormModel } from '@sap/app-shared/components/runtime'
import { PermissionGuard } from '@sap/app-shared/core/auth/permission-guard'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { useLocalePrefix } from '@sap/app-shared/hooks/use-locale'
import { Button } from '@sap/app-shared/components/ui/button'
import { ConfirmDialog } from '@sap/app-shared/components/ui/confirm-dialog'
import { TableSkeleton } from '@sap/app-shared/components/loading-skeleton'
```

分栏：优先 `@sap/ui-kit` / app-shared 的 `resizable`（`ResizablePanelGroup`）。

## Good reference pages

| 模式 | 参考 | 台面备注 |
|------|------|----------|
| CRUD + Dialog | 现状 `web-console/.../admin/users`（模式可抄） | **落点应迁 Portal**；新页勿再默认挂 Console |
| Form Runtime | `admin/settings` 等 | 组织设置类 → Portal；平台设置 → Console |
| Tabs（平台） | `admin/workflows`、`admin/plugins` | Console |
| Blueprint 动态页 | portal `dashboard/apps/[packageId]/[[...page]]` | Portal |
| Dashboard grid | portal `dashboard/overview` | Portal |
| Stack 工作台样板 | portal shipping voyages（试验） | **非产品面**；只学布局/Runtime |

## Content layout cheatsheet

- 租户使用框架 CRUD → Portal List + Dialog/Sheet  
- 平台治理 CRUD → Console List + Dialog/Sheet  
- 订单工作台 → **上下 Stack**  
- 重详情 → 左右栏或 `/[id]`  
- 多视角 → Tabs  

## Aesthetic tokens

- `p-6` `space-y-6`；`text-2xl font-semibold` + muted 说明  
- 一个 primary；Card 仅作交互容器  
