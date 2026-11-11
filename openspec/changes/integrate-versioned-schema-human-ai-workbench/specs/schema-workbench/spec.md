# 有效版本人机工作台集成规范

## ADDED Requirements

### Requirement: 工作台绑定可信有效版本页面快照

工作台 SHALL 复用既有Blueprint UI/compiled entities/permissions消费链，以规范化route、平台可信组织、安装修订和有效releaseDigest读取同一不可变页面快照，并使页面、查询、Command和turn使用同一ReleaseContext。Schema/查询缓存 MUST 以mode/org/installation/revision/digest/protocolSchemaDigest/canonicalId/route/locale/权限投影区分，禁止basename/latest作版本真源。平台 MUST 重验权限/安装/引用与Public/Config边界，不导出Protected/Kernel，不允许URL旧包、客户端摘要或public/specs旁路有效版本。退出/切身份、安装或权限 SHALL 清除旧投影/待确认展示；缓存不替代授权。候选预览 MUST 使用平台授权的candidateDigest与基线releaseDigest隔离上下文，不要求候选已published。

#### Scenario: 有效安装和同名页面不串内容
- **WHEN** 合法用户先后加载不同组织/安装或digest中的同名页面
- **THEN** 页面、数据和turn SHALL 使用各自平台解析的完整namespace及单摘要快照
- **AND** 系统 MUST 不复用其他身份/版本权限投影，新增已支持字段可由定义驱动呈现

#### Scenario: 旧包及非法引用被拒绝
- **WHEN** URL请求非当前有效包，或route/字段引用不存在、越权或跨制品
- **THEN** 系统 MUST 明确拒绝且不回读public/specs/mock/半份快照
- **AND** 旧页或旧确认 MUST 不因此取得写入权

#### Scenario: 未发布候选可以隔离预览
- **WHEN** 09获平台授权预览冻结候选C，基线为D且C未published
- **THEN** 同一消费者 SHALL 在隔离数据/缓存上下文读取C并记录C与D
- **AND** 生产有效指针与生产查询 MUST 保持不变

### Requirement: 工作台保真消费页面字段及记录信封

既有BlueprintAppRuntime/SchemaList/SchemaForm SHALL 按page.identifier/route/fields及支持的实体约束绑定实际列表、表单和详情，不新造第二份定义模型或要求包装Runtime全部重写。工作台 MUST 保留RecordEnvelope的entity/id/data/version/blueprintVersion/omittedFields，选中后按同namespace真实读取详情并遵守字段可见/只读约束。控件/查询/动作 SHALL 来自封闭catalog，未知pageId/字段/类型/绑定 MUST 明确不可用而非选首个页或回退text。permissions读取失败 MUST 区分平台明确缺层与403/500/超时，表单保存失败 MUST 可见，不伪成功；服务端permissions/ownership/dataScope仍为最终拒绝边界。

#### Scenario: 定义驱动真实详情与字段投影
- **WHEN** 有权限页面定义指定字段集合且用户选中真实记录
- **THEN** Runtime SHALL 保留id/version/字段省略信息，以授权getRecord呈现详情和编辑基线
- **AND** 已支持兼容字段变化 SHALL 无需增加字段专属JSX，隐藏/只读字段不得被适配器重新开放

#### Scenario: 无效页面或依赖失败不静默降级
- **WHEN** pageId无效、字段类型不支持或权限/保存请求返回403/500/超时
- **THEN** 工作台 MUST 显示真实拒绝/错误并停止受影响读写
- **AND** MUST 不改选首个页面、不将失败当无权限层、不填demo或声明保存成功

### Requirement: 工作台共用冻结协议完整拒绝判据

前后端 SHALL 从同一冻结JSON Schema修订及共享纯跨字段验证产物校验页面/字段/交互计划，并记录protocolSchemaDigest/validatorVersion。验证 MUST 覆盖nested、required/oneOf/additionalProperties、既有数组/文本上限、table行列匹配、actionId唯一、当次catalog/工具参数/edit字段、真实trace关联及needsConfirmation一致；未知块/动作或非法结构整份拒绝。旧edit无可信pendingAction/tool关联 MUST 仅只读回放，新增关联/上限必须先冻结兼容契约，不改旧值语义。服务端 MUST 重新验证原始请求并调用Registry/Command硬边界；AI只输出封闭提案，不输出HTML/SQL/可执行脚本或任意URL能力，金额与业务规则复用确定性内核。

#### Scenario: 两端同一协议接受合法计划
- **WHEN** 合法计划与可信pendingAction/catalog参数满足冻结结构和跨字段约束
- **THEN** 服务端与工作台 SHALL 按相同协议/验证器版本接受，显示实际待确认状态
- **AND** 客户端通过 MUST 不替代服务端授权和执行前参数验证

#### Scenario: 合法kind掩盖非法内容仍拒绝
- **WHEN** kind合法但nested非法、越界、行列不齐、重复actionId、参数越catalog、edit无关联或needsConfirmation冲突
- **THEN** 任一端 MUST 拒绝整份可执行计划/请求并指出原因
- **AND** MUST 不签发确认、不调用工具、不根据trace虚构成功

### Requirement: 工作台统一当前页会话与真实恢复消费

系统 SHALL 复用既有壳入口和PlanRenderer为一个正式conversation组件，业务默认在当前页打开，独立chat/piagent页仅复用或历史/Builder/联调，不另造业务浮层。请求 MUST 正确带安装X-App-Id提示与协商body的appKey/appInstallationId、conversationId、message及选中对象/观测版本screenContext；平台重新核对身份/安装/header-body一致性。工作台 SHALL 共用02安全请求适配并消费07真实SSE、conversation/turn标识、持久history/游标和取消状态，支持UTF-8/CRLF/多行data/跨chunk完整事件。断线/Abort MUST 不等于业务取消、事务撤销或自动重发写。

#### Scenario: 当前页指代与同turn恢复
- **WHEN** 用户选中合法对象并发送“这艘船”，随后重连
- **THEN** 共享壳组件 SHALL 传对象/版本提示，消费服务端重验上下文及结构化计划
- **AND** SHALL 用持久history/游标恢复同conversation/turn，不创建重复业务写

#### Scenario: 安装或会话归属冲突拒绝
- **WHEN** header/body安装冲突或conversation不属于当前用户/组织/安装
- **THEN** 平台 MUST 拒绝，工作台 SHALL 显示真实原因并停止旧确认
- **AND** MUST 不猜测安装或用旧本地会话继续执行

#### Scenario: 断线取消不伪造终态
- **WHEN** 运行中断线、Abort或点击取消
- **THEN** 工作台 SHALL 显示结果未知/取消请求中，仅按平台真实持久结果更新终态
- **AND** MUST 不盲重放写、不将本地关面板视为取消成功，已提交命令必须显示实际后果

### Requirement: 工作台编辑参数生成新修订并显式重确认

edit SHALL 提供真实授权args编辑及原值/建议值/expectedVersion对比。变参 MUST 提交07的expectedRevision/argsPatch修订端口，由平台重验对象/有效版本/权限、CAS产生新pendingAction修订和权威digest并撤销旧确认；本地摘要不是权威。用户 MUST 看到新差异后显式再次确认，Registry才能invoke到04共享Command。组织/用户/安装/tool/release/权限/审批字段 MUST 不可编辑，未被平台接受的建议不能启用确认；冲突不自动换工具或重试写。

#### Scenario: 编辑后新修订才可执行
- **WHEN** 用户修改船舶name建议且平台接受新pendingAction修订，用户再显式确认
- **THEN** UI SHALL 展示平台新revision/digest/对象版本，Registry SHALL 仅接受对应新确认
- **AND** 旧修订确认 MUST 已失效，真实结果才能触发成功展示

#### Scenario: 越界编辑或旧确认被拒绝
- **WHEN** 编辑非授权字段、并发revision变化，或变参/对象/release变化后复用旧令牌
- **THEN** 平台 MUST 拒绝且不产生业务写入
- **AND** 工作台 SHALL 保留建议并要求新上下文/修订/重确认，不自算digest冒充已保存

### Requirement: 工作台共享命令同步与真实船舶样板

人工适配与AI注册工具 SHALL 调用04同一确定性Command，携带可信上下文、expectedVersion和持久请求标识；工作台 MUST 只以真实结果/对象事件为成功来源，按完整namespace失效查询并重取。对象或有效release变化时，dirty输入 MUST 保留并显示基线/服务端差异，禁旧提交/确认并要求明确合并，不覆盖人工内容或盲重试。首样板 SHALL 仅真实隔离组织/安装的船舶查询及经业务批准的name修改，先批准真实owner/数据映射、权限/dataScope/RLS/version和工具，禁止mock/另造示例事实冒充航运数据。真实浏览器/HTTP/SSE/模型/Registry/Command/PG证据 MUST 绑定同candidateDigest及基线releaseDigest、代码/协议/suiteVersion和实际用例/断言/失败/usage；空套件/skip/unavailable不得PASS。交易验收只消费04；生产新发布和自治放行 MUST 等待09及必需真实证据，不以提案或文档生成关闭。

#### Scenario: 真实共享命令同步且并发不覆盖
- **WHEN** 已批准真实船舶样板经人工或AI共享Command成功写name并返回新版本/事件
- **THEN** 工作台 SHALL 在同namespace重取列表/详情，竞争旧expectedVersion写被拒CONFLICT
- **AND** dirty表单 SHALL 保留输入并要求人工合并，同候选逐例浏览器/网络/工具/PG/模型证据可交09评判

#### Scenario: 缺真实事实或版本冲突只能阻塞
- **WHEN** 仅有前端URL/mock/契约桩、缺真实后端/模型/PG，或对象/有效release变化与dirty输入冲突
- **THEN** 样板验收 MUST 标未验收/阻塞，工作台 MUST 保留输入并禁旧写/确认
- **AND** MUST 不伪造执行/同步成功、不填demo、不回装旧定义或放行自治
