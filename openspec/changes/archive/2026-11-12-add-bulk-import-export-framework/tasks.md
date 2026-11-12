## 1. 契约与元语

- [x] 1.1 定义 `import-run` / `export-run` / `import-mapping` / `adapter` 的持久化形状与 Schema
- [x] 1.2 在 `docs/META_LANGUAGE.md` 登记批量导入/导出术语与不变量（INV-IE-01..05）
- [x] 1.3 在 `DOMAIN.md` 新增导入/导出小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [x] 1.4 在 `DECISIONS.md` 登记适配器、partial/atomic、公式注入防护、异步大导出
- [x] 1.5 更新 `docs/protocols/blueprint-delivery.md` 的导入/导出边界（如涉及）

## 2. 存储与 RLS

- [x] 2.1 迁移：`import_runs` / `export_runs` / `import_mappings`
- [x] 2.2 索引：组织+资源+时间、状态、幂等键
- [x] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [x] 2.4 TypeORM 实体与模块注册

## 3. 适配器

- [x] 3.1 `ImportAdapter` / `ExportAdapter` 接口与 registry
- [x] 3.2 Blueprint 适配器：包装现有 `writeDocumentOrRecord` / `validateRecord`
- [x] 3.3 平台表适配器：users / departments / customers 等
- [x] 3.4 资源键命名空间与未知资源拒绝
- [x] 3.5 字段定义：必填、类型、枚举、引用、权限、示例
- [x] 3.6 单测：注册、未知资源、字段映射

## 4. 文件解析

- [x] 4.1 CSV 解析复用 + 公式注入防护
- [x] 4.2 JSON 对象数组解析
- [x] 4.3 XLSX 解析（exceljs 或等价库）：sheet/行/列/解压限制
- [x] 4.4 模板生成（xlsx/csv）与示例/说明
- [x] 4.5 列映射/别名/未知列策略/保存映射
- [x] 4.6 负例：超大文件、zip bomb、宏、非法列、空表头

## 5. 校验与写入

- [x] 5.1 行级校验：必填/类型/枚举/引用/唯一/业务规则
- [x] 5.2 atomic / partial 两种模式
- [x] 5.3 dry-run
- [x] 5.4 字段权限/数据范围/租户校验
- [x] 5.5 错误结构（行/列/字段/原因）与错误报告导出
- [x] 5.6 幂等：`import_runs` + idempotency key
- [x] 5.7 单测：部分成功、整批回滚、重复提交、越权写入

## 6. 导入运行

- [x] 6.1 `POST /imports`（multipart/assetId）+ 权限/配额
- [x] 6.2 小文件同步/大文件异步（阈值）
- [x] 6.3 job 进度/取消/重试/结果
- [x] 6.4 运行历史/详情/错误下载
- [x] 6.5 旧 `importMaster` 接口保留并转适配器
- [x] 6.6 e2e：知识点 100 行部分成功、学生 500 行导入

## 7. 导出

- [x] 7.1 `POST /exports`：资源/筛选/排序/字段/格式
- [x] 7.2 分页/流式查询，每页应用数据范围
- [x] 7.3 CSV/XLSX/MD 生成
- [x] 7.4 PDF 生成（provider 接口）
- [x] 7.5 字段权限裁剪/拒绝
- [x] 7.6 结果资产 + 签名下载 + 过期
- [x] 7.7 运行历史/进度/取消
- [x] 7.8 e2e：1 万行异步导出、权限/范围负例

## 8. 安全

- [x] 8.1 公式注入转义（CSV/XLSX）
- [x] 8.2 xlsx zip bomb/宏/外部链接限制
- [x] 8.3 文件大小/行数/并发配额
- [x] 8.4 PII 脱敏/禁止导出（可配置）
- [x] 8.5 导入/导出审计（谁、资源、筛选、字段、行数、下载）
- [x] 8.6 负例：越权字段、跨租户、超大文件、恶意公式

## 9. 管理端与兼容

- [x] 9.1 Portal 导入向导（模板/上传/映射/预览/错误）
- [x] 9.2 导出面板（筛选/字段/格式/历史）
- [x] 9.3 审计导出保留原路径；通用导出已可用，按兼容策略暂不切换（可选项）
- [x] 9.4 API 文档与 `api-client`
- [x] 9.5 旧接口/旧数据兼容测试
- [x] 9.6 `openspec validate add-bulk-import-export-framework --strict`
- [x] 9.7 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
