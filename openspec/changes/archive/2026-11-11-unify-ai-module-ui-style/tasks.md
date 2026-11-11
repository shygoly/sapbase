# Implementation Tasks

## 1. Analyze Current UI Patterns

- [x] 1.1 标准列表模式已记录（`docs/ui-style-guide.md`）
- [x] 1.2 SchemaList 现状已记录（容器/分页/排序/操作按钮）
- [x] 1.3 不一致项已收敛：圆角/边框/token/分页/图标按钮
- [x] 1.4 `docs/ui-style-guide.md`

## 2. Update SchemaList Component

- [x] 2.1 容器改为 `rounded-lg border border-border bg-card`（token，不再用 gray）
- [x] 2.2 改为标准 Previous/页码/Next + Showing 文案
- [x] 2.3 改用 ghost icon 按钮（Edit2/Trash2，含 aria-label/title）
- [x] 2.4 空态改为卡片内 `p-8 text-center text-muted-foreground`
- [x] 2.5 间距/内边距与标准列表一致（border-t px-6 py-4）

## 4. Create UI Style Guidelines

- [x] 4.1 表格用法已写入 style guide
- [x] 4.2 分页模式已写入 style guide
- [x] 4.3 操作按钮模式已写入 style guide
- [x] 4.4 Badge/状态色已写入 style guide
- [x] 4.5 生成规范已加入 style guide 与 `docs/module-dsl.md`

## 5. Validation

- [x] 5.1 schema-example 截图对比通过
- [x] 5.2 SSR 测试覆盖行点击/编辑/删除按钮渲染；事件处理未改语义
- [x] 5.3 分页 helper + 渲染测试通过
- [x] 5.4 图标按钮 aria-label/点击处理测试通过
- [x] 5.5 表格 `overflow-x-auto`，容器无固定宽度
