## ADDED Requirements

### Requirement: Installation Effective Release Context Consumption

所有应用业务入口 SHALL 消费平台从可信身份、安装和唯一有效绑定解析的只读ReleaseContext，包含releaseId或明确legacy来源、目录/包/IR独立摘要、安装修订、routingRevision、activation/cohort及数据代际。API定义/记录、既有Blueprint UI、Registry适配器、Agent接口与审计 MUST 以相同有效定义引用执行，保持既有功能权限、安装私有数据、data-scope和RLS检查。业务URL包ID SHALL 仅作兼容定位与一致性核验，不得选择另一已授权但未生效包；设计时/候选装载 MUST 使用隔离purpose和权限。缓存 MUST 按org/安装/路由修订/不可变定义摘要定位，不以latest或basename作有效版本真源。

#### Scenario: Resolve one effective definition across consumers

- **WHEN** 同一安装同一可信用户在某Release生效后请求定义、记录、既有UI、工具计划或Agent上下文
- **THEN** 各消费者 SHALL 返回或记录同一有效Release及目录/包/IR/安装修订引用
- **AND** 既有UI的list/form/detail及权限判据 SHALL 保持适用，不重建页面框架或接受浏览器自报权限

#### Scenario: Reject a mismatched route or package

- **WHEN** URL包ID、路径appKey/id、X-App-Id或目标安装与可信有效上下文不一致，或调用者自报org/cohort/Release
- **THEN** 平台 MUST 在读取应用私有数据或写入之前拒绝
- **AND** 已授权旧包、发布目录latest、预览token及旧缓存 MUST NOT 成为业务有效版本旁路

#### Scenario: Reject a stale write pin

- **WHEN** 页面或turn已固定的安装/路由修订或数据代际与写前重新解析的当前有效上下文不同
- **THEN** 写命令 MUST 返回明确RELEASE_CONTEXT_STALE或等价版本冲突且不产生副作用
- **AND** 客户端/Agent SHALL 重新解析并走既有确认契约，不静默更换定义后继续旧计划

### Requirement: Stable Cohort Routing and Request Pins

平台 SHALL 按已批准、版本化cohort政策从可信org/安装/稳定主体身份确定唯一目标，百分比分桶MUST跨实例与重启稳定，规则MUST显式互斥或具可判优先级。无命中 SHALL 使用唯一默认绑定，歧义或缺默认绑定 MUST 拒绝。请求和Agent turn SHALL 固定解析结果，不随latest漂移；固定只读步骤仍 MUST 检查吊销、许可和数据兼容窗口，写步骤 MUST 重验当前权限和有效版本。生产cohort共用数据 MUST 具备双方读写/工具契约兼容证据；缺证据的候选 SHALL 只在隔离candidateDigest namespace内预览，不规定未经批准的A2观察窗口。

#### Scenario: Keep a user on a stable route and pin

- **WHEN** 相同用户在政策版本不变时经不同实例或重启访问安装，并在turn开始后发生新激活
- **THEN** 分桶 SHALL 保持一致，已固定turn SHALL 保留原版本引用而非读取新latest
- **AND** 灰度用户投影/反馈 SHALL 标识实际cohort与Release，旧pin读取只有授权/许可/兼容仍有效时才允许

#### Scenario: Reject ambiguous or incompatible production cohorts

- **WHEN** cohort目标重叠无法唯一判定、成员来源不可信、默认缺失，或新旧定义缺当前数据读写共存证据
- **THEN** 生产路由建立或执行 MUST 被拒绝，不以少数用户试写替代证据
- **AND** 隔离候选预览 MUST NOT 写生产数据或修改生产有效绑定，preview失败不得回退latest

### Requirement: Safe Legacy Version Entry Adaptation

既有install/upgrade/rollback和Release activate/rollback入口 SHALL 统一委托平台切换协调器，版本变更 MUST 提交Idempotency-Key及调用方expectedRevisionId，涉及路由 MUST 提交expectedRoutingRevision；首次安装 MUST 表达期望不存在。`POST /apps/:id/activate` SHALL 仅恢复原已验证暂停安装，复验许可/吊销/Runtime，不接收版本替换。关闭Release功能 SHALL 停止新发布并保持已验证稳定绑定可确定性运行，旧入口 MUST NOT 恢复无证据变更。历史安装对账 SHALL 保持IR摘要语义及追加历史，不把缺目录审批的包自动认证为新Release。

#### Scenario: Preserve a verified stable legacy installation

- **WHEN** 历史稳定安装的包/IR、修订、签名、许可和授权仍可验证，或暂停安装请求恢复原有效绑定
- **THEN** 系统 SHALL 保留受控确定性运行并明确legacy来源，恢复 SHALL 不改变版本
- **AND** 历史修订 SHALL 不被改写，后续版本变更仍 MUST 经过统一协调器及必需证据

#### Scenario: Reject legacy bypass or ambiguous mapping

- **WHEN** 旧版本变更请求缺预期基线/key/必需证据、包到可信Release映射歧义，或试图在功能关闭时直换包
- **THEN** 平台 MUST 明确拒绝且保持当前有效绑定，不以兼容模式或自报digest兜底
- **AND** 未能验证现有安全条件的安装 SHALL 限制为可证明安全的只读或拒绝，不能伪造审批/签名来完成回填
