## 1. 契约与元语

- [x] 1.1 `schemas/ai-governance.schema.json`
- [x] 1.2 META §3.19 + 不变量 55–60
- [x] 1.3 DOMAIN「AI 内容治理」+ check-domain-doc 0 error
- [x] 1.4 DECISIONS D-18
- [x] 1.5 piagent §14.3 + blueprint-delivery §10.3b

## 2. 存储与 RLS

- [x] 2.1 迁移 179480 + DDL
- [x] 2.2 label 唯一 + org/content/subject 索引
- [x] 2.3 TENANT_RLS_DDL + e2e 跨租户 403
- [x] 2.4 entities + app.entities + AiGovernanceModule

## 3. 溯源

- [x] 3.1 provenance API/字段完整
- [x] 3.2 version+1 + parentContentId
- [x] 3.3 GET provenance/:contentId
- [x] 3.4 promptHash only；单测断言无明文
- [x] 3.5 provenance 单测 + e2e 跨租户

## 4. 标识与水印

- [x] 4.1 显式/隐式版本化 + status
- [x] 4.2 `content-label.provider.ts` + default provider
- [x] 4.3 label provider + publish gate；资产/离线钩子由下游 change 调用同一 gate
- [x] 4.4 gate 缺失显式/隐式 → 403；AI 模块 publish 前调用
- [x] 4.5 `AiContentBadge` + search 消费 + Console 治理页
- [x] 4.6 label 缺失/校验单测；转码/离线下游复用 verify

## 5. 内容安全

- [x] 5.1 `content-safety` 注册到 ReviewCheckRegistry
- [x] 5.2 input/output 共用；pass/warn/fail；异常由 ReviewCheckService fail-closed
- [x] 5.3 submitForReview 建 check 步骤
- [x] 5.4 checkResult/evidence + audit
- [x] 5.5 provider 三态单测 + review check fail-closed

## 6. 人工终审

- [x] 6.1 check→content-reviewer→content-final-reviewer
- [x] 6.2 gate review-pending + AI module publish 闸
- [x] 6.3 finalStep+subjectAuthor；e2e 作者 403
- [x] 6.4 复用 review act/resubmit
- [x] 6.5 作者终审 403 + pending gate 单测/e2e

## 7. AI 评分治理

- [x] 7.1 状态机四态
- [x] 7.2 `AiScoreValue` 双值 + 未终审标记
- [x] 7.3 rule-confirm + hasConfirmedRule
- [x] 7.4 appeal → appealed → finalize
- [x] 7.5 finalize 前状态校验
- [x] 7.6 ai-governance 单测 + e2e

## 8. 审计、通知与集成

- [x] 8.1 ai.* 审计动作
- [x] 8.2 待终审通知 content-reviewer；检测失败 error
- [x] 8.3 review/notification/audit/asset 复用
- [x] 8.4 单测 audit mock + e2e

## 9. 兼容与验收

- [x] 9.1 无 provenance → allowed=true
- [x] 9.2 `AI_CONTENT_SAFETY_MODE=strict|warn|off`
- [x] 9.3 e2e 生成→标识→检测→终审→gate
- [x] 9.4 e2e ai_only→confirm→appeal→final
- [x] 9.5 validate 通过
- [x] 9.6 check-domain 0 error / check-meta 0 error
