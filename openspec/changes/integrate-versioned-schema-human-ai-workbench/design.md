# Design: 在既有 Blueprint 消费者上接通可信工作台

## Context / Goals

基线为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。现有动态路由 → BlueprintAppRuntime → blueprintsApi → 平台 BlueprintController → loadBlueprint 的链是真实实现；`apps/api/src/blueprint/*`、`libs/app-shared/src/core/schema/*`、`lib/api/*` 多为再导出壳。现有 SchemaResolver 的 public/specs 静态三层解析没有找到正式消费者，不以修复它替代修复动态 Blueprint 链。

目标是同一安装/版本上的定义、数据、选中对象和可编辑 AI 提案协作，以及服务端草稿批量提交。非目标是重造通用 UI/布局/壳原语、模型 provider、业务算法、版本激活/签名或评测 runner；单金额库、Registry 唯一工具入口、Kernel 确定性和既有 PG identity/jobs/dataScope 不变。

## 1. 权威读取端口，而非第二份定义模型

现有 `GET /api/blueprints/:id/{ui,entities,permissions}` 和 records API 保留为平台/历史兼容接口，正式业务入口不得由任意 URL packageId 决定有效版本。06 提供平台解析的 ReleaseContext：组织、installationId、installationRevision、releaseId、releaseDigest、Blueprint 摘要/包映射、稳定 cohort。客户端只提供安装提示、规范化 route/pageId 和观测版本；服务器重验身份/安装/权限，输出只读页面闭包。

建议 **待新增并冻结** `GET /api/business-apps/installations/:id/schema-page?route=...`，也可由同等 BFF 适配现有 API，但必须一次返回同摘要快照，不能三次独立“latest”读取。响应是现有 blueprint-ui/v1 的 page + compiled entity 字段 + 允许的 permissions 投影 + Record/Command binding，不强制引入旧 PageSchema→ViewSchema→ObjectSchema 作为第二权威模型。Public/Config 允许投影，Protected/Kernel 不导出。未知 route/pageId、字段引用、权限加载异常必须类型化拒绝；缺 permissions.json 仅由服务器明确判定的 missing-layer 状态触发既有兼容语义，403/500/超时绝不被 catch 成 null。

生产 namespace 为 `mode/org/installation/revision/releaseDigest/protocolSchemaDigest/canonicalPageOrEntityId/normalizedRoute/locale/permissionProjectionDigest`，查询再含 objectId/筛选/分页/排序。授权候选由 09 提供 candidateDigest + baselineReleaseDigest 的独立预览 namespace 和隔离数据/身份；未 published 候选可评测，不覆盖生产指针。不同同名页面/安装/权限不可共享投影，退出/切上下文清除待确认和数据；缓存命中不代替服务端鉴权。

## 2. 保真适配已存在的 UI 元数据

保留 BlueprintAppRuntime、SchemaList、SchemaForm 和四类包装 Runtime。适配器须消费 page.identifier/route/fields，未知 pageId 不能无提示改成首个页面；菜单 path 使用平台确认的内部 route，不作为任意 URL。实体→控件封闭 catalog保留 required/readonly/hidden、enum、reference、精度/标度/默认值等已支持约束；未知/不支持类型明确拒绝，不像当前 `fieldDefinitionOf` 默认 text。decimal 只消费 04 十进制文本契约，不在 UI 重新计算金额。

列表必须保留 `RecordEnvelope{id,entity,blueprintVersion,data,version,omittedFields,...}`，不能像当前 `listRecords().items.map(item=>item.data)` 丢上下文。选中持久的是 entity+recordId+objectVersion，在同 namespace 用 getRecord 重验读取；Detail 不依赖 form/list page 偶然残留的 data 对象。URL selection 只作定位提示，按已有 selection 约定处理，未知/越权 id 明确拒绝；切 release 不把旧 data 带到新定义。

表单错误必须可见，当前 SchemaForm 的 onSubmit catch 空返回不得冒充成功；真实命令结果返回版本/事件，前端不得从 reset/notification 推断保存事实。已有三态、selection/dirty guard、分栏和按钮/字段权限由 `enhance-ui-runtime-scenario-capabilities` 提供，本项只接结果/版本事件，不重复开发这些原语。服务端 `SemanticRuntimeService.list/read` 的 permissions/ownership/dataScope 保留为硬边界，UI 可解释权限但不能放大。

## 3. 一份协议验证与兼容矩阵

现有 schemas/blueprint-ui.schema.json、blueprint-semantic.schema.json 和 interaction-plan.schema.json 是冻结输入；UI 内部 ObjectSchema 只作已验证编译产物适配。共享纯验证模块/构建产物从同一 JSON Schema 生成，前后端分别记录 protocolSchemaDigest/validatorVersion。现 jsonschema 1.5.0 支持范围及浏览器 bundling 需在实施时验证；不要直接把 Nest/文件系统 schema-loader 打进客户端，亦不先安装另一套验证依赖。

保留已有封闭块/动作和服务器 needsConfirmation/trace 检查，补完整 nested/required/additionalProperties/oneOf/limits、行列匹配、actionId 唯一、当次 catalog/参数/edit字段、trace 与真实证据关联。同名 kind 不保证结构合法。当前限额沿用冻结协议：blocks 32、actions 8、facts 50、lines/table rows 200、table columns 12；编辑字段等新增上限由协议负责人批准，不从提示词假定。未知结构整份拒绝，不生成 HTML/SQL/脚本。

旧 v1 edit 只有 fields，没有 tool。不得给既有必需字段偷偷换语义；07 可提供可信 pendingAction sidecar 关联或协商新修订。旧计划能只读回放，但缺可信 action/turn/tool关联不能编辑执行。前端验证不是授权，服务器再次验证和 Registry/Command 硬拒仍必需。

## 4. 单一当前页 conversation 消费者

复用 `libs/app-shared/src/features/chat/components/chat-page.tsx` 和 PlanRenderer 的展示能力，建立一份共享会话组件，由 ui-layout 壳固定入口/抽屉调用。`dashboard/chat`、`dashboard/piagent` 复用同组件或仅提供历史/Builder/联调，不能成为默认业务主路径，不能继续两套确认逻辑。02 提供一份 Cookie/BFF/CSRF 请求适配，REST 与 stream fetch 共用，停止本地读取主 token。

现有接口是 `POST /api/agent/chat`、`GET /api/agent/conversations/:id`、`POST /api/agent/conversations/:id/cancel`，Registry `/api/agent-tools/:name/confirm`、`/invoke`；旧单轮 `/api/chat/message` 只兼容。body 当前可带 message/conversationId/screenContext/appKey/appInstallationId，X-App-Id 是安装提示，不是 conversationId。07 冻结统一 header/body 一致性和可信上下文解析；页面只送 route/entity/recordId/selectedIds/observedVersion，不自述组织、权限或有效版本真相。

消费 07 的真实 SSE turn.start/text.delta/plan/tool.start/tool.result/turn.end/error 及持久游标恢复。解码支持 UTF-8拆分、CRLF、多行data、事件id/跨chunk，不用当前只按 \n\n+第一条data的简化解析；未知事件不执行能力，非法已知 plan 整份拒绝。断线显示结果未知，通过服务端持久 history/游标恢复同turn，不能重发写。取消是服务端请求中→真实状态，Abort只停止浏览器读取；已提交事务不会因取消撤销，显示真实结果。服务端实时输出、预算、取消CAS、审计事实由01/07负责，本项只消费和做联合负例。

## 5. edit 修订与人工协作

07 **待新增** `PATCH /api/agent/conversations/:id/turns/:turnId/actions/:actionId`，输入 `{expectedRevision,argsPatch}`，返回 pendingActionId/revision/digest/expiry/status 及对象/安装版本关联。此为消费契约，命名须与07最终定义一致；本项不另建 pending-actions 生命周期。edit 显示原值/建议值/expectedVersion，只允许服务端授权 args 字段；user/org/installation/tool/release/权限和审批不可编辑。

本地输入是未提交建议。平台重验对象、权限、工具参数和有效版本，以CAS生成修订并重算digest、撤销旧确认；用户看见新差异后再显式确认，经 Registry invoke 到04共享Command。不能沿用当前 confirmThenInvoke 对旧任意 args 自动执行。冲突/过期/变参/权限撤销返回明确原因并保留建议，不自动换工具/重试写。

实际 Command 结果/object事件携带 objectVersion 和可信 request/event引用后，按完整 namespace 失效详情/列表/选项并重取。无dirty表单可同步；有dirty保留本地输入和旧基线，展示新服务端版本，禁旧提交并要求明确合并/重确认。安装有效版本变化同样禁旧页/令牌，不能回装旧URL包。事件重复/延迟不等于重新执行，断线后的持久结果及授权查询才是事实。

## 6. Patch 草稿批量适配，不重建已实现能力

`apps/api/src/ai-modules/definition-patch.service.ts` 的五scope纯函数和单patch持久/编译已有；pending add-ai-patch-recompile 的 object/state 限制及源码注释已旧，不据此新增扩scope整改。协议仍有五operations，但现reorder/replace不支持，明确拒绝，未经批准不扩能力。

建议 **待新增** `POST /api/business-apps/installations/:id/schema-draft-patches`：`{draftId,expectedRevision,requestId,orderedPatches}`。08适配器调用05标准草稿/Delta服务，平台重解析 actor/org/installation/risk，客户端 actor/securityLevel/confirmed 不能授予审批权。浏览器PatchManager只做预览/提议，不调用旧本地applyBatch后宣称平台成功。

服务器先验证全部目标/依赖/权限，基于同一baseline副本有序累计每patch的结果；同一草稿锁/CAS+事务一次写新revision、父revision、完整快照/digest、patchIds和审计，失败全批不落。编译预览工件在隔离临时空间生成，经成功提交绑定revision；故障清理不覆盖已公开包，不在事务中直接改生产文件。requestId/摘要复用平台持久幂等，重放前授权，同key不同digest拒绝。草稿回退追加revision不覆写历史；冻结/真实评测/批准/签名/published/activation分别由05/09/06提供，草稿提交不触发它们。

## 7. 船舶样板与实施顺序

现航运静态页经 ui-shipping → api-client → /api/shipping/ships，AppModule未注册对应CRUD，domain-shipping仅迁移/脚本；未连接服务，不能声明部署无此API。先与业务负责人及04冻结真实船舶资料owner/data映射、权限/dataScope/RLS/version和工具白名单。首个业务范围只有查询和name修改，排除IMO/状态/评级/财务/库存。可批准现有 semantic runtime 上的 Ship Blueprint 映射，或由actual owner补航运适配；二者不得各自复制事实，未批准真实数据绑定只能做标注的契约桩，不能算船舶样板PASS。

契约冻结→隔离消费者/草稿适配并行开发→真实PG/CAS/RLS+浏览器HTTP/SSE/模型/Registry/Command→09同candidateDigest逐例评测/预览→批准→签名未公开工件→最终GateDecision→published→activation。09后置联合验收不阻止08前段隔离开发，也不能因08格式通过提前放行生产自治。04汽配完整交易窄切片仅消费证据。

## 验证、兼容与安全回退

现有命令核对：`npm run build --workspace @sap/web-portal`、`npm run typecheck --workspace @sap/ui-runtime`、`npm run test --workspace @sap/api -- --runInBand`、`npm run test:e2e --workspace @sap/api -- --runInBand`。Portal无当前test/browser script；拟新增 `test:workbench:contract`、`test:workbench:browser`、`test:workbench:e2e` 必须批准并登记对应workspace后才能运行。根ci脚本是pipeline.sh，GitHub ci.yml还有实际独立jobs，不能只改warn-only脚本就称门禁成立；本项测试由03接入真实入口，不改CI主题。

实际验收保存候选/基线摘要、安装修订、代码SHA、协议/验证器/suiteVersion、真实PG/模型provider/model可用版本与usage、浏览器/构建环境、逐例用例/断言/失败/skip/unavailable及网络/工具/DB/截图引用。本次未跑这些命令或真实业务服务，不给通过率/利用声明。

兼容保留既有签名载入、旧无权限层明确兼容和稳定人工路径；版本化接口逐步接动态页，旧package页可只读历史/平台检查，不授予生产写。回退关闭新AI编辑/确认及草稿提交，保留现稳定有效安装/审计/输入；不能恢复本地主token、silent mock、旧令牌、任意URL包或本地生产Patch。数据兼容未证实拒绝回退，不能把浏览器回退当安装/数据恢复。协议/业务/安全负责人审批并更新既有真源是未来tasks，本次不写权威docs。
