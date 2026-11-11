## 1. 契约与元语

- [x] 1.1 `schemas/document-intelligence.schema.json`
- [x] 1.2 META §3.22 + 不变量 72–76
- [x] 1.3 DOMAIN「文档智能」+ check-domain 0 error
- [x] 1.4 DECISIONS D-21
- [x] 1.5 untrusted 边界已由 §14.3/AI 治理覆盖；本文档补 §8

## 2. 存储与 RLS

- [x] 2.1 迁移 179520 + DDL
- [x] 2.2 run/key 唯一 + status/asset 索引
- [x] 2.3 TENANT_RLS_DDL + e2e 跨租户
- [x] 2.4 entities + app.entities + DocumentIntelligenceModule

## 3. 解析器

- [x] 3.1 interface + registry
- [x] 3.2 PDF text layer（Tj/TJ/flate）
- [x] 3.3 PPTX slide `<a:t>`
- [x] 3.4 DOCX paragraphs/Heading
- [x] 3.5 text/markdown
- [x] 3.6 OCR provider 可选；未配置时扫描 PDF 明确拒绝
- [x] 3.7 DOCUMENT_MAX_BYTES/PAGES + zip entries/total + 宏/可执行拒绝
- [x] 3.8 parser 7 tests

## 4. 结构提取

- [x] 4.1 interface + RuleStructureExtractor
- [x] 4.2 标题/编号/第X章提取
- [x] 4.3 规则提取已接；LLM provider 可选未启用（untrusted 边界保留）
- [x] 4.4 candidate schema/字段约束
- [x] 4.5 锚点强制 + lowConfidence
- [x] 4.6 metadata.untrusted；规则提取不执行文档指令
- [x] 4.7 extractor tests

## 5. 草案与人工编辑

- [x] 5.1 GET run/sections/candidates
- [x] 5.2 edit/merge/split/reorder；delete/restore 未做 UI
- [x] 5.3 mergedFrom/sourceAnchors + split offset
- [x] 5.4 draftVersion+1；确认锁定
- [x] 5.5 e2e merge/split/reorder + anchor

## 6. 确认与转换

- [x] 6.1 confirmedVersion
- [x] 6.2 knowledge/course/section 目标
- [x] 6.3 candidate targetEntityId + run/key 幂等
- [x] 6.4 目标冲突 409
- [x] 6.5 targetEntityId/metadata sourceRunId
- [x] 6.6 e2e 幂等/冲突；部分失败事务未单独覆盖

## 7. 异步运行

- [x] 7.1 run + `document.intelligence.parse` job
- [x] 7.2 stage/progress + job 取消/重试 + run cancel
- [x] 7.3 页数上限/分页解析；大文档分块后续
- [x] 7.4 job concurrency 2 + 页/大小限制
- [x] 7.5 e2e job；取消/超时通用 async-job

## 8. 安全与审计

- [x] 8.1 拒绝宏/可执行/zip bomb；进程沙箱后续
- [x] 8.2 候选/quote 手机号/身份证/邮箱脱敏
- [x] 8.3 锚点由解析生成；document.edit 审计
- [x] 8.4 document.run/edit/convert 审计
- [x] 8.5 parser/zip/跨租户/锚点测试

## 9. 管理端与兼容

- [x] 9.1 `/dashboard/documents`
- [x] 9.2 低置信度 amber + 批量确认
- [x] 9.3 新增表/接口；旧流程未改
- [x] 9.4 docs/document-intelligence.md + documentIntelligenceApi
- [x] 9.5 document-intelligence.e2e.js 通过
- [x] 9.6 validate 通过
- [x] 9.7 check-domain 0 error / check-meta 0 error
