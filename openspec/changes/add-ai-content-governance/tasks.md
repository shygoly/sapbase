## 1. 契约与元语

- [ ] 1.1 定义 provenance/label/score/safety 的持久化形状与 Schema
- [ ] 1.2 在 `docs/META_LANGUAGE.md` 登记 AI 内容治理术语与不变量（INV-AIG-01..06）
- [ ] 1.3 在 `DOMAIN.md` 新增 AI 内容治理小节，运行 `node scripts/meta/check-domain-doc.mjs`
- [ ] 1.4 在 `DECISIONS.md` 登记标识/水印 fail-closed、AI 分状态机、终审四眼原则
- [ ] 1.5 更新 `docs/protocols/piagent.md` / `blueprint-delivery.md` 的相关边界

## 2. 存储与 RLS

- [ ] 2.1 迁移：`ai_content_provenance` / `ai_content_labels` / `ai_score_records`
- [ ] 2.2 索引/唯一约束：contentId+labelType+version、subject、contentHash
- [ ] 2.3 新表加入 `TENANT_RLS_DDL`；跨租户负例
- [ ] 2.4 TypeORM 实体与模块注册

## 3. 溯源

- [ ] 3.1 生成任务写入 provenance（agent/model/promptHash/taskId/contentHash）
- [ ] 3.2 编辑/新版本父链
- [ ] 3.3 按内容/资产查询来源链
- [ ] 3.4 prompt 只存 hash/模板引用；脱敏
- [ ] 3.5 单测：链完整、父子、跨租户

## 4. 标识与水印

- [ ] 4.1 `ai_content_labels`：显式/隐式、版本、状态
- [ ] 4.2 `ContentLabelProvider` 接口（文本/图片/音频/视频）
- [ ] 4.3 资产 ready/转码/导出/离线钩子：应用 + 校验
- [ ] 4.4 未应用/校验失败阻断发布/导出
- [ ] 4.5 显式标识 UI（页面/播放器/导出文件）
- [ ] 4.6 单测：转码后保留、导出保留、离线 manifest、缺失阻断

## 5. 内容安全

- [ ] 5.1 实现复核平台 `CheckProvider` 的 content-safety provider（不新建第二 registry）
- [ ] 5.2 输入/输出检测；pass/warn/fail；异常 fail-closed
- [ ] 5.3 与复核平台 `check` 步骤集成
- [ ] 5.4 证据/版本/审计
- [ ] 5.5 单测：pass/warn/fail、超时、provider 异常

## 6. 人工终审

- [ ] 6.1 复核流程：check → human → final
- [ ] 6.2 未终审禁止发布/归档为正式内容
- [ ] 6.3 四眼原则/作者不能自我终审（可配置）
- [ ] 6.4 驳回/重提沿用复核平台
- [ ] 6.5 单测：越权终审、跳过检测、未终审发布

## 7. AI 评分治理

- [ ] 7.1 `ai_score_records` 状态机：ai_only/teacher_confirmed/appealed/final
- [ ] 7.2 学生端双值显示（AI 参考分/教师评分）
- [ ] 7.3 规则确认：首次/版本变更记录
- [ ] 7.4 申诉：学生发起 → 强制人工复核 → final
- [ ] 7.5 未终审不得作为正式成绩/归档
- [ ] 7.6 单测：状态转换、越权、规则确认、申诉

## 8. 审计、通知与集成

- [ ] 8.1 生成/标识/检测/终审/评分/申诉审计
- [ ] 8.2 通知：待终审/检测失败/申诉/规则更新
- [ ] 8.3 与资产/复核/通知/审计 change 的接口对齐
- [ ] 8.4 单测：审计字段、通知触发

## 9. 兼容与验收

- [ ] 9.1 非 AI 内容/旧数据不强制标识；legacy 标记
- [ ] 9.2 未配置 provider 时的策略可配置
- [ ] 9.3 e2e：生成→检测→终审→标识→发布→导出保留
- [ ] 9.4 e2e：AI 评分→教师确认→归档；申诉
- [ ] 9.5 `openspec validate add-ai-content-governance --strict`
- [ ] 9.6 运行 `check-domain-doc.mjs` / `check-meta-docs.mjs`
