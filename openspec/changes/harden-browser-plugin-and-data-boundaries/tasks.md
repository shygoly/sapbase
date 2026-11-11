# Tasks（仅批准后实施，当前全未完成）

本次仅重审与修订文档；未运行真实浏览器/PG/模型、未构建部署。不得以格式通过勾选任务。前置00；01/02/03并行，01/06/07/08接口可后置联合验收、缺失时默认拒绝。

## 1. 契约与迁移

- [ ] 1.1 冻结 PluginUiDescriptor 完整资源图/签名/平台来源/撤销及 host policy、plugin-ui-bridge/v1 封闭 Schema，复用插件 manifest 与05签名接口。
- [ ] 1.2 冻结两 app 共用 BFF 白名单、无秘密响应、cookie/CSRF/pre-session、显式 session validator token 与 expectedSessionRevision；保留受控非浏览器 legacy 原到期兼容，列重新登录清单。
- [ ] 1.3 冻结 BusinessDataEnvelope/DataProvenance、授权及 scopeVersion namespace、live/stale/demo/unavailable 错误语义；盘点真实航运读/写/导出及无后端功能，不把脚本表当 HTTP 提供者。

## 2. 真实入口实现

- [ ] 2.1 在 apps/api/plugins 实现平台 UI 资源图重算/完整签名/固定 origin/撤销描述；可信第一方必须平台核准，普通第三方签名有效仍隔离，保留后端 Node/all-of/data-scope 边界。
- [ ] 2.2 在 app-shared 替换第三方 import/主树渲染为独立站点 iframe，接双站 CSP/设备/referrer 策略；自由 CSS 不注主 DOM，只保留批准纯变量。
- [ ] 2.3 实现精确 origin/source/一次性 nonce 的 MessageChannel、未知字段/重放/超限拒绝与关闭后失效；limits 来源为批准 host policy，不硬抄旧数字。
- [ ] 2.4 桥经BFF/服务端适配/Registry，复用权限∩安装∩数据范围；只返回最小数据，主可信确认才真实 invoke，缺01/06/07/08能力拒绝对应动作。
- [ ] 2.5 实现撤销/停用/卸载及身份/org/app/release变化关闭旧通道、清展示缓存；逐请求核验权威修订，不靠通知放行，不伪称回滚已提交事务。
- [ ] 2.6 复用 AuthSessionsService，给 JwtStrategy 必需的显式 token/useExisting 绑定，校验 sid 主体/组织/状态/到期/修订；实际 login/SSO/switch/refresh/logout 入口统一持久会话，缺 provider 拒绝。
- [ ] 2.7 修实际 auth-context SwitchOrganizationService 与 refresh 的短事务/CAS轮换，传旧sid/预期修订并撤销旧绑定；组织未选只能受限pre-session，保留现有身份审计。
- [ ] 2.8 两 Next app 新增共享BFF handler与host-only HttpOnly cookie、CSRF/no-store/固定upstream；迁移ApiClient/AuthApi/SharedState与真实SSE/WS消费者，清浏览器token重登录，不向插件开放凭据CORS。
- [ ] 2.9 清点Kimi/PatchGateway实际消费者与公开环境入口；仅真实客户端provider迁服务端，新增合成canary工件/响应/日志/桥检查，禁止NEXT_PUBLIC模型秘密、不读取或打印真实secret。
- [ ] 2.10 迁移全部真实shipping读取包装和ui-shipping页面，生产错误/缺失API/格式错误诚实不可用，合法空列表保留；移除生产报表筛选直接mock身份。
- [ ] 2.11 增加受配置隔离demo adapter和持续来源标签、生产cookie/数据源/缓存分离，前后端禁真实REST/Registry写与导出；实现namespace/stale原时间/权限清理/写前live重取契约。

## 3. 实测证据与退出

- [ ] 3.1 在现有 `npm run test --workspace @sap/api -- --runInBand` 接入资源图/桥Schema/授权/来源正负测试；新增真实Nest装配用例，缺session provider不得静默跳过，mock直接new不替代DI验收。
- [ ] 3.2 **待新增**API `test:browser-session-e2e` 脚本后在隔离PG/HTTP执行登录/SSO/实际switch/refresh/logout、缺provider、双组织/双安装、主体不符、并发轮换/重启撤销、CSRF负例，初始化失败必须失败。
- [ ] 3.3 **待新增**两app `test:browser-boundaries` 与 `check:client-secrets` 后执行真实独立origin合法/恶意插件、CSP/redirect/资源漂移/撤销/origin/source/重放/主DOM凭据拒绝，生产各错误/demo零写/stale断言；执行两app既有build，不用main dist。
- [ ] 3.4 扩展既有test-evidence并交09，记录同sourceSha/artifactDigest/冻结candidateDigest、suiteVersion、实际版本/case/assertions/失败跳过与前置；missing/零断言/仅mock不可passed，缺真实模型评测不得自治、不要求先published。
- [ ] 3.5 实测后更新既有META索引指向的插件/身份/前端集成真源及兼容迁移说明，经安全业务运维批准安全回退；只停插件/关写/重新登录/明确不可用，不恢复同域import/token/mock；本次不执行docs修改、部署或归档。
