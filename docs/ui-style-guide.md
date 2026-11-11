# UI Style Guide

适用于 Portal / Console 的标准列表、SchemaList、表单与状态展示。设计真源是 `sapbase` 主题 token，不是 Tailwind 调色板或旧模板。

## 列表容器

```tsx
<div className="space-y-4 rounded-lg border border-border bg-card">
  <div className="overflow-x-auto">
    <Table>...</Table>
  </div>
  {/* pagination */}
</div>
```

- 容器：`rounded-lg border border-border bg-card`，不用阴影。
- 表格外层：`overflow-x-auto`；窄屏横向滚动，不挤压列。
- 空态：`p-8 text-center text-muted-foreground`，文案说明“没有数据”，不显示空白表头。
- 加载态：同一容器内居中 loading，不改变布局高度。

## 分页

- 容器：`flex items-center justify-between border-t border-border px-6 py-4`。
- 左侧显示 `Showing X to Y of Z`。
- 右侧 `Previous / page numbers / Next`，按钮 `outline`，当前页 `default`。
- 页码过多时只渲染首尾与当前附近页；不要用一长串数字。
- 统一使用 `Button size="sm"`，不混用 Pagination 组件与自定义按钮。

## 排序

- 可排序列头：`cursor-pointer hover:bg-muted/50`。
- 当前排序列显示 `ChevronUp` / `ChevronDown`。
- 排序只改本地副本；不修改传入的 `data` 数组。

## 操作按钮

- 行内操作使用 `Button variant="ghost" size="sm"` + Lucide 图标（`Edit2`、`Trash2`、`KeyRound`）。
- 必须提供 `aria-label` 与 `title`；不要只放图标没有可访问名称。
- 删除使用 `text-destructive hover:text-destructive`，不用大面积红色填充。
- 破坏性操作仍需确认；图标按钮不等于免确认。

## Badge / 状态

- 默认 `variant="outline"`，圆角 3px，不用胶囊。
- 状态色只用语义 token：`text-success` / `text-warning` / `text-destructive`，或 `Badge` + 1px 边框。
- 不要用 `bg-green-100 text-green-800` 这类硬编码 Tailwind 颜色；主题切换会失效。
- 状态必须同时有文字，不能只靠颜色。

## 表单

- 标签 12px muted，字段 40px 高，8px 间距。
- 错误：字段下方 12px `text-destructive`，输入框 1px destructive 边框；不用 toast 代替字段错误。
- 只读/禁用：`disabled:opacity-50`，不改变布局。
- 长表单分组，组间 24–32px；组内 8–12px。

## 间距与圆角

- 4px 网格。常用：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48。
- 控件 6px、容器 8px、Badge 3px；不要出现 12px 大圆角卡片 + 6px 按钮 + 胶囊 Badge 混用。
- 容器默认只有 1px 边框；阴影只用于 popover/dialog。

## SchemaList 专属

- 直接复用本指南的容器、分页、排序、操作按钮规则。
- 字段 `hidden` 不渲染；`layout.fields` 只决定顺序与可见字段。
- 行点击与行内按钮必须 `stopPropagation`，避免点编辑触发详情。
- 生成型模块与标准模块使用同一套规则；不要再为 CRM/生成页面单独写样式。
