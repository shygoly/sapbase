## ADDED Requirements

### Requirement: Search Index and Documents

平台 SHALL 提供统一搜索索引，文档 MUST 包含组织/应用、资源键/ID、标题/正文/标签/元数据，
并可带 scope/owner 过滤字段。索引 MUST 按组织隔离，MUST NOT 索引敏感/无权限字段。
同一资源 MUST 只有一条索引记录。

#### Scenario: 索引素材

- **WHEN** 上传并解析一份素材
- **THEN** 系统 SHALL 生成/更新对应搜索文档
- **AND** 标题/正文/标签 SHALL 可检索

#### Scenario: 跨租户隔离

- **WHEN** 查询包含其他组织文档
- **THEN** 结果 MUST NOT 返回他租文档
- **AND** RLS 作为最后边界

### Requirement: Indexing and Reindex

索引 MUST 通过事件/任务增量更新，支持 upsert/delete、全量重建、进度/取消/重试。
索引失败 MUST NOT 影响业务写入；MUST 可重试/告警。重建 MUST 幂等。

#### Scenario: 增量更新

- **WHEN** 课程标题更新
- **THEN** 索引 SHALL 在任务完成后更新
- **AND** 旧标题 MUST NOT 长期残留

#### Scenario: 全量重建

- **WHEN** 管理员触发全量重建
- **THEN** 系统 SHALL 异步执行并显示进度
- **AND** 重复重建结果一致

### Requirement: Query and Ranking

搜索 SHALL 支持关键词、资源类型、标签、时间与分页；MUST 支持全文 + 模糊兜底，
并按相关度/时间排序。MUST 返回标题、片段/高亮与资源引用。

#### Scenario: 关键词搜索

- **WHEN** 用户搜索“三角函数”
- **THEN** 结果 SHALL 包含标题/正文匹配的课程/知识点/素材
- **AND** 高亮 SHALL 标出关键词

#### Scenario: 模糊/中文

- **WHEN** 用户输入部分词或中文短语
- **THEN** 系统 SHALL 使用 trigram/分词兜底
- **AND** 无结果时 SHALL 返回空而非错误

### Requirement: Filters and Highlight

搜索 SHALL 支持按资源类型、标签、时间、组织节点等过滤；高亮片段 MUST 转义，
MUST NOT 引入 XSS；敏感字段 MUST 脱敏或省略。

#### Scenario: 标签过滤

- **WHEN** 用户按“视频”标签过滤
- **THEN** 结果 SHALL 只含该标签资源
- **AND** 其他标签 MUST NOT 混入

#### Scenario: 高亮安全

- **WHEN** 正文包含 HTML/脚本片段
- **THEN** 高亮输出 SHALL 转义
- **AND** MUST NOT 执行脚本

### Requirement: Permissions and Data Scope

搜索 MUST 在查询前/后应用功能权限、数据范围与租户隔离；
MUST NOT 通过片段/高亮/计数泄露无权限内容。
资源被删除/归档后 MUST 从搜索结果移除或标记。

#### Scenario: 越权资源

- **WHEN** 用户搜索到无权访问的课程
- **THEN** 结果 MUST NOT 返回该课程
- **AND** 片段 MUST NOT 泄露其内容

#### Scenario: 删除/归档

- **WHEN** 资源被删除/归档
- **THEN** 搜索 SHALL 移除或标记
- **AND** MUST NOT 返回失效链接

### Requirement: Optional Semantic Search

平台 MAY 提供向量/语义检索，但 MUST 作为关键词搜索的补充并受权限/数据范围约束。
启用时 MUST 受权限/数据范围约束；MUST NOT 替代关键词兜底；provider 可替换。

#### Scenario: 语义检索

- **WHEN** 启用 embedding 且用户查询语义相近内容
- **THEN** 结果 SHALL 包含语义匹配项
- **AND** 仍 MUST 过滤无权限资源

#### Scenario: 关闭语义检索

- **WHEN** 未启用向量能力
- **THEN** 关键词/模糊搜索 SHALL 正常工作
- **AND** MUST NOT 报错

### Requirement: Tenant Isolation

搜索索引/查询/重建 MUST 绑定组织并受 RLS 约束；MUST NOT 跨租户搜索/重建/缓存。
缓存键 MUST 含组织与权限版本。

#### Scenario: 跨租户重建

- **WHEN** A 组织管理员触发重建
- **THEN** 只能重建 A 组织索引
- **AND** MUST NOT 影响 B 组织

### Requirement: Backward Compatibility

本能力 MUST NOT 改变现有 Agent 知识检索、数据库查询与页面路由。
搜索为新增 API；旧查询 MUST 继续可用。

#### Scenario: 旧知识检索

- **WHEN** Agent 使用现有知识检索
- **THEN** 行为 SHALL 与升级前一致
- **AND** 不强制走新搜索

#### Scenario: 旧页面

- **WHEN** 用户访问现有列表/查询页
- **THEN** 行为 SHALL 不变
- **AND** 搜索为增量入口
