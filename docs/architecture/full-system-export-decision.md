# 全系统源码导出决策（7.4 对账）

## 结论

默认交付路径是 **签名 Blueprint Release + Runtime 执行**，不是“从模块定义生成整套前后端源码”。

源码导出是**可选、受许可约束**的路径：

1. 只有持有有效 source-export license 的客户/项目可触发。
2. 导出必须绑定 release digest、版本与目标租户，产物不可静默重新分发。
3. 导出不改变运行时的授权/审计事实；部署仍须经过 release publish/activate 语义。
4. 未实现真实生成器前，`generate-system` 只能返回明确的 not-configured/禁止状态，
   不得用 stub 冒充可交付源码。

## 与历史 change 的关系

`add-full-system-generation-and-deploy`（已归档）只建立了高权限 API/存根与权限点；
它被 `add-dsl-management-and-display` 取代后，本决策将其重新定位为：

- 不是 Blueprint → 运行的主路径；
- 仅作为可选 licensed export 的权限/审计边界参考；
- 真实代码生成与部署流水线仍需独立 change 与授权。

## 运行时边界

| 路径 | 默认 | 许可 | 产物 |
|---|---|---|---|
| Blueprint Release | 是 | 标准 License | 签名 `.erpkg` + IR |
| Shared / Dedicated SaaS | 是 | 组织/安装 entitlement | 同一 Runtime artifact |
| Standalone | 是 | 离线/lease entitlement | 客户托管 Runtime |
| Source Export | 否 | source-export license | 源码包/仓库 + 审计记录 |

参考：`docs/protocols/blueprint-delivery.md`、`docs/protocols/release.md`。


## 实现落点（6.3）

- `POST /api/blueprint-releases/:id/source-export` 校验
  `SOURCE_EXPORT_LICENSE_ID` / `SOURCE_EXPORT_LICENSE_EXPIRES_AT`；
  未许可或过期返回 403 并写拒绝审计。
- `SOURCE_EXPORT_GENERATOR_URL` 未配置时只返回导出计划，
  `generator.deliverable=false`，明确不会产出源码。
- 生成器配置后仍需独立授权流水线；本端点不伪装已可交付源码。
