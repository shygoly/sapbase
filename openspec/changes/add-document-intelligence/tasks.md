## 1. 契约与元语

- [ ] 1.1 定义 parse-run/section/candidate/mapping 的持久化形状与 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记文档智能术语与不变量（INV-DI-01..05）
- [ ] 1.3 在 `DOMAIN.md` 新增文档解析小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记 untrusted 文档、来源锚点、人工确认、幂等转换
- [ ] 1.5 更新 `docs/protocols/piagent.md`（untrusted 内容边界，如需要）

## 2. 存储与 RLS

- [ ] 2.1 迁移：`document_parse_runs` / `document_sections` / `document_candidates`
- [ ] 2.2 索引/唯一约束：run+draft+key、status、assetId
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 解析器

- [ ] 3.1 `DocumentParser` 接口 + registry
- [ ] 3.2 PDF 文本层解析（页/段落/字符范围）
- [ ] 3.3 PPTX 文本/页解析
- [ ] 3.4 DOCX 文本/段落解析
- [ ] 3.5 TXT/MD 解析
- [ ] 3.6 OCR provider（可选）：扫描 PDF/图片
- [ ] 3.7 文件类型/大小/页数/zip bomb 限制
- [ ] 3.8 单测：各格式、损坏文件、超限、空文本

## 4. 结构提取

- [ ] 4.1 `StructureExtractor` 接口 + registry
- [ ] 4.2 规则章节/编号提取
- [ ] 4.3 LLM 知识点/概念/关联提取（走 ModelGateway）
- [ ] 4.4 输出 schema 校验；非法输出拒绝
- [ ] 4.5 来源锚点强制；置信度/低置信度标记
- [ ] 4.6 提示词注入防护：untrusted 包裹，不执行文档指令
- [ ] 4.7 单测：结构、锚点、注入、非法输出

## 5. 草案与人工编辑

- [ ] 5.1 草案/章节/候选查询
- [ ] 5.2 编辑/合并/拆分/排序/删除/恢复
- [ ] 5.3 合并保留来源锚点；拆分分配锚点
- [ ] 5.4 草案保存/丢弃/版本
- [ ] 5.5 单测：合并/拆分/排序、锚点不丢

## 6. 确认与转换

- [ ] 6.1 确认锁定 draftVersion
- [ ] 6.2 声明式映射到目标资源（课程/章节/知识点）
- [ ] 6.3 幂等键 `(runId, sourceKey, targetResourceKey)`
- [ ] 6.4 冲突可定位；不静默覆盖
- [ ] 6.5 转换记录 `runId → entityId`，可回溯
- [ ] 6.6 单测：重复转换、冲突、部分失败

## 7. 异步运行

- [ ] 7.1 上传/选择文档 → parse run + job
- [ ] 7.2 阶段/进度/取消/重试
- [ ] 7.3 大文档分页/分块
- [ ] 7.4 并发/配额限制
- [ ] 7.5 单测：取消、重试、超时

## 8. 安全与审计

- [ ] 8.1 解析沙箱/受限进程；不执行宏/脚本/外链
- [ ] 8.2 PII 最小化/脱敏
- [ ] 8.3 来源锚点不可伪造；确认后修改审计
- [ ] 8.4 模型/提示词/版本/操作者审计
- [ ] 8.5 负例：恶意文档、注入、跨租户、伪造锚点

## 9. 管理端与兼容

- [ ] 9.1 Portal 文档解析/结构确认页
- [ ] 9.2 低置信度高亮/批量确认
- [ ] 9.3 旧知识/课程/导入流程不变
- [ ] 9.4 API 文档与 `api-client`
- [ ] 9.5 e2e：PPT → 章节/知识点 → 确认 → 生成课程实体
- [ ] 9.6 `openspec validate add-document-intelligence --strict`
- [ ] 9.7 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
