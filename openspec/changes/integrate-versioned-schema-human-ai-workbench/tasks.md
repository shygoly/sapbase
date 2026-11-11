# Tasks: 有效版本 Schema 与人机工作台

仅规划，基线 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`；以下全部未实施。已存在动态蓝图消费者、字段生成和五scope服务端Patch不列为重造任务。隔离契约桩开发不等于真实验收，09后置联合验收不阻断前段开发。

## 1. 冻结接口与样板事实

- [ ] 1.1 与02/04/05/06/07冻结有效页面快照/ReleaseContext、RecordEnvelope/Command、pendingAction编辑/恢复及草稿批量端口；形成缺依赖拒绝和provider/consumer兼容矩阵。
- [ ] 1.2 与协议负责人冻结现有Blueprint UI/语义字段到控件的保真映射、同JSON Schema/跨字段验证器产物与旧edit只读矩阵；保留既有上限/未知值拒绝，不新造三层定义协议。
- [ ] 1.3 由业务负责人和实际owner批准真实船舶查询/name修改的数据映射、version、归属/权限/dataScope/RLS及Registry工具白名单；核对不存在于当前组合根的航运CRUD，不以URL/mock冒充后端，复用semantic Ship亦须批准真实事实映射。

## 2. 现有消费者接线

- [ ] 2.1 实现待新增有效安装页面快照读取适配（design端口或等价经评审BFF）；复用Blueprint装载链，单摘要返回page/entity/permissions/bindings，拒绝旧包旁路、未知route/field及Protected/Kernel导出。
- [ ] 2.2 在BlueprintAppRuntime及api-client建立完整mode/org/installation/revision/digest/protocol/id/route/locale/权限namespace；切身份/权限/安装清理旧投影，候选预览与production完全隔离。
- [ ] 2.3 保真消费page.fields/route与已支持字段约束、控件catalog，保留记录id/version/omittedFields并以授权getRecord装配详情；无效pageId、未知类型和权限403/500不静默降级，保留已有SchemaList/Form资产。
- [ ] 2.4 接入同冻结Schema和共享纯跨字段验证产物到api-client/Renderer/Form及服务端；补nested/limits/行列/actionId/catalog/edit/confirmation一致性，服务器再次验证，表单保存错误明确可见。
- [ ] 2.5 将现chat/PlanRenderer展示接到已有pending壳入口的一份conversation组件，独立chat/piagent页复用或仅历史/Builder/联调；REST/SSE共用02请求适配，正确携带安装header/body、conversation与选中对象提示。
- [ ] 2.6 消费07真实流/持久history/游标/取消，实现UTF-8/CRLF/多行data/跨chunk解析与服务端conversation/turn保存；断线结果未知、不自动重发写、Abort不伪造业务取消。
- [ ] 2.7 将edit接成授权args实际编辑并消费07待新增expectedRevision/argsPatch修订端口；展示平台新revision/digest/对象版本，撤旧确认并要求用户显式重确认，禁止自动confirmThenInvoke旧参数。
- [ ] 2.8 将已批准船舶人工/AI适配接到04同一Command，传expectedVersion/可信上下文/请求标识；真实结果或对象事件才同步查询，复用既有dirty/selection原语保留输入并处理CONFLICT/RELEASE_CHANGED。
- [ ] 2.9 将浏览器Patch限定提议/预览，实现orderedPatches请求/返回适配并委托05唯一AppDraft原子apply/CAS/freeze核心；08只消费和验证有序累计、一次revision、持久幂等/审计及临时预览结果，不另建草稿事务/定义真源，保留reorder/replace拒绝。

## 3. 拒绝集与真实联合验收

- [ ] 3.1 批准并登记待新增test:workbench:contract/browser（Portal或共享UI测试配置）和test:workbench:e2e（API），由03接入实际GitHub/ci入口；现有workspace build/typecheck/Jest不改名冒充browser覆盖。
- [ ] 3.2 执行两端协议与路由正负集：同名跨namespace、旧包、非法page/field、权限服务失败、未知控件、嵌套非法/越界、重复actionId、行列不齐、catalog越界和确认关联不一致；保留已实现动态UI/五scopePatch回归。
- [ ] 3.3 真实PG非绕过RLS角色下测试船舶对象/安装归属、expectedVersion人工AI竞争、批量Patch中间失败全回滚、连续累计、旧revision和同key同/不同digest重启重放；记录实际DB数据/版本/断言，缺DB不PASS。
- [ ] 3.4 真实隔离安装+浏览器+模型经HTTP/SSE/Registry/Command完成“这艘船”、编辑新修订重确认、旧令牌拒绝、dirty冲突与查询同步、安装变化、取消/重连；记录真实工具调用/业务写入而非trace推测，403/500不填mock。
- [ ] 3.5 与09联合绑定未published冻结candidateDigest、基线releaseDigest、安装修订及代码/协议/suiteVersion提交逐例截图/网络/工具/PG/模型usage证据；空套件/skip/unavailable拒PASS，消费04汽配证据不重写算法。

## 4. 审批与后续真源

- [ ] 4.1 实施后由负责人更新既有schema/Patch/chat/piagent/蓝图UI真源与相关旧pending说明，记录五scope已实现和工作台剩余状态；不把本提案当实现完成、不擅改其它change勾选。
- [ ] 4.2 经业务/协议/安全负责人审查和09真实门禁后申请授权发布/激活验收，演练关闭新工作台编辑/确认/草稿提交并保留稳定active；不恢复本地主token/mock/旧URL包/旧令牌/本地生产Patch，自治缺真实评测仍不放行。
