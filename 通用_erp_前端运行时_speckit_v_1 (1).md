# 通用 ERP 前端运行时 Speckit v1.0

> 定位：**Business-Agnostic 的企业级 ERP 前端运行时（Frontend Runtime）**\
> 目标：在不绑定任何行业、不绑定具体后端（SAP / 自研 / API）的前提下，承载绝大多数企业管理系统的前端交互需求，并支持 Schema / DSL / AI 驱动的持续演化。

---

## 1. 设计目标与边界

### 1.1 明确要做的

- 提供 **稳定、可扩展、可替代 SAP 前端体验** 的基础前端运行时
- 抽象企业系统的通用交互能力（而非 UI 组件堆砌）
- 支持中大型 ERP / 管理系统长期演进
- 允许 AI 基于 Schema 自动生成页面、表单、视图

### 1.2 明确不做的

- 不内置任何行业业务逻辑（采购 / 医疗 / 制造等）
- 不实现后端引擎（BPM / 财务 / 物料）
- 不定位为低代码平台（但可被低代码/AI 使用）

---

## 2. 核心设计原则

```md
- Business-Agnostic：不包含任何业务假设
- Runtime-First：这是前端运行时，而非项目模板
- Schema-Driven：页面、表单、列表均可由 Schema 描述
- State-Aware：UI 必须感知业务状态
- Permission-First：所有可见性与操作先过权限
- Evolution-Friendly：允许被真实项目不断“污染”和修正
```

---

## 3. 技术基础（确定性约束）

```md
Framework: Next.js (App Router)
Language: TypeScript（强类型、类型即契约）
Styling: Tailwind CSS（实用优先）
UI System: shadcn/ui 风格（Headless + Design System）
Icons: lucide-react
State: React Context（仅系统级状态）
Forms: React Hook Form（可选、可替换）
Data: API Adapter + Mock Store（无数据库假设）
Auth: JWT / Session（前端抽象层）
Permission: RBAC + Scope（前端校验 + UI 控制）
```

> 约束：
>
> - React Context **禁止**用于业务数据状态
> - 不引入重量级全局状态库（Redux / MobX）作为默认

---

## 4. 企业级通用能力模型（核心）

### 4.1 交互原语（Interaction Primitives）

```md
- Object（业务对象）
- Collection（对象集合）
- State（状态机）
- Process（流程）
- View（视图）
- Action（动作）
- Insight（分析/洞察）
```

> 所有页面与组件，必须能映射回这些原语之一

---

## 5. 核心能力域划分

### 5.1 身份、组织与权限

#### Identity（身份）

- 登录 / 登出
- 会话管理
- 多身份支持

#### Organization（组织）

- 部门 / 组织树
- 多级组织
- 用户-组织归属
- 组织上下文切换

#### Authorization（权限）

- RBAC（角色）
- Permission（权限点）
- Action 级控制（按钮 / 操作）
- 数据范围（Scope）
- 状态感知权限（State × Role × Action）

---

### 5.2 导航与页面模型

#### Navigation

- 动态菜单（权限驱动）
- 多级菜单
- 菜单与路由解耦
- 收藏 / 常用入口

#### Page Model

- 页面类型：List / Form / Detail / Dashboard
- 页面元数据（标题、权限、面包屑）
- 页面生命周期钩子

---

### 5.3 数据操作能力

#### Collection（列表/集合）

- 查询 / 排序 / 分页
- 批量操作
- 列配置（显示/顺序）
- 导出

#### Object Editing（表单）

- 新增 / 编辑 / 只读
- 校验 / 默认值
- 条件显隐
- 草稿态（Draft）

#### Search & Filter

- 快速搜索
- 高级筛选
- 条件组合
- 筛选条件保存（Variant）

---

### 5.4 状态与流程

#### State Machine

- 状态定义
- 状态流转
- 状态驱动 UI（字段 / 操作）

#### Workflow（轻量）

- 提交 / 审批 / 驳回
- 审批记录
- 时间线视图

---

### 5.5 系统级通用能力

- 操作日志 / 审计日志
- 系统消息 / 通知
- 全局错误处理
- 空状态 / Loading / Skeleton
- 国际化（i18n）
- 主题 / 企业品牌定制

---

## 6. 核心目录结构（运行时骨架）

```txt
src/
 ├─ app/                 # Next.js 路由
 ├─ core/                # 前端运行时核心（禁止业务代码）
 │   ├─ auth/            # 身份 & 权限
 │   ├─ organization/    # 组织模型
 │   ├─ navigation/      # 菜单 & 路由
 │   ├─ page-model/      # 页面模型
 │   ├─ state-machine/   # 状态机
 │   ├─ workflow/        # 审批流程
 │   └─ audit/           # 日志 & 审计
 ├─ components/          # 通用 UI 组件
 ├─ features/            # 业务模块（可插拔）
 ├─ layouts/             # 布局系统
 ├─ lib/                 # 工具 / 适配器
 ├─ specs/               # Schema / OpenSpec
```

---

## 7. 内置基础模块（参考实现）

> 这些模块用于验证运行时完整性，而非框架依赖

- 用户管理
- 角色 & 权限管理
- 部门管理
- 菜单管理
- 操作日志查看
- 系统设置

---

## 8. Schema / DSL / AI 扩展预留

### 8.1 Schema 能描述的内容

- Object 字段
- 表单布局
- 列表列定义
- 状态与动作
- 权限规则

### 8.2 AI 介入点

- Prompt → Object Schema
- Schema → 页面 / 表单 / 列表
- 行为数据 → 交互优化建议

---

## 9. 演化策略（非技术，但必须写清）

```md
- 允许 Spec 被真实项目不断修正
- 禁止为单一项目破坏通用性
- 所有新增能力必须能抽象回原语
- 核心运行时稳定，边缘能力可变
```

---

## 10. 成功判定标准

- 新业务模块不修改 core
- 同一套运行时可承载多个 ERP 场景
- 可被 AI 自动生成部分前端
- 能逐步替代 SAP/Fiori 的前端体验

---

> 结论： 这是一个 **可长期演进的企业级前端运行时基础设施**，而不是一次性项目模板。

