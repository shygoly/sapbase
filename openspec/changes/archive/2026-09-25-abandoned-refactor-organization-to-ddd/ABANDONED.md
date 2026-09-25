# 已废弃：Refactor Organization to DDD

**状态**：废弃（未实施，0% 完成）
**关闭日期**：2026-09-24

与 `2026-09-25-abandoned-refactor-ai-module-to-ddd` 同因同批：任务 0/77、自 2026-02-18 无进展、
缺少 `specs/` 目录导致 `openspec validate --strict` 不通过（无 delta，无法验收）。

补充说明：多租户与组织隔离当前由 `TenantAwareEntity` + `DataIsolationInterceptor` 承担，
且 `migrate-to-saas-architecture` 仍在进行（45/75）—— 组织域的重构应与之合并考虑，
不要单独立项。

重启方式见同批目录中的完整说明。
