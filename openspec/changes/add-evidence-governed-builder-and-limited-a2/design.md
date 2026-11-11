# 设计：当前实例的可信进化准入

## 1. 上下文、目标与非目标

基线为 weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`。API 仍装配模块，核心实现已拆到 libs/platform-release 与 libs/agent-tools；反馈与聊天编排仍由 apps/api 实现。已有单实例宿主设计、MCP 投影、Registry、PG jobs、数据范围、持久身份及安装事务均保留。目标是把候选/身份/证据/效果串成可信链，收紧有限 A2 的实际资格，不替换主体技术栈或部署拓扑。

不新增生成器、工作流/任务引擎、MCP 清单或任意 SQL/shell 工具。不承接实例回流模板和平台升级冲突检测的整体实现；其已有 owner 是 `add-agent-host-and-instance-evolution`。不把业务 Kernel 放入模型控制，Registry 与平台授权仍唯一，Delta/Blueprint/金额与安装事务不旁路。源码交付仅冻结准入接口，不启动 CI、宿主、调度或部署。

## 2. 消费边界与拟冻结接口

下列名称为接口语义与待冻结契约，不声称是现有函数/API 名称。既有函数沿用原名的部分明确注明。

| 生产者/既有资产 | 本主题消费 | 失败与兼容 |
| --- | --- | --- |
| 01/07 的真实 Registry 事件、可信主体与 ContextEnvelope | verifiedActor、profileGrant、installation/ReleaseContext、trace/toolEventRef、预算与 AbortSignal | 不采信 body/profile/env 作为用户授权；未完成真实接线只允许只读/草稿隔离开发。 |
| 05 的 Delta/草稿/冻结/审批 | candidateRef 包含 candidateDigest、draftRevision、baselineReleaseDigest、scope、platformVersion/evolutionScope；approvalRef 绑定同摘要 | 不传独立 manifest；改 diff 生成新 revision 并废旧证据。 |
| 09 的真实执行器 | candidateTestEvalRefs、previewRef、requiredGates、最终 GateDecision | 先测试未公开候选；pending、missing、unavailable、skipped 不算 passed；notApplicable 由服务端推导。 |
| 06 的有效版本与安装恢复 | stableCohortRouteRevision、expectedInstallationRevision、activationResultRef、currentToTargetCompatibilityRef | 不直接 supersede activation 行；失败保留现行 active，回退不能只看 rollbackSafe。 |
| 08 的共享UI/协议与原有api-client | 10适配现自治治理页面展示verified/legacy、实际阶段与同摘要diff/批准/效果；05拥有审批Console，08不新增治理系统 | 缺证据显示不可用，不用硬编码“已启用”或旧summary代替资格。 |
| 现有 JobQueue/JobTypeRegistry/JobWorker | 注册本主题有版本 payload 的阶段 handler，JobContext.stage/signal/isCancelled，阶段 requestDigest/resultRef | 不增加 agent_evolution_jobs 第二套队列；需要的 lineage/window 为领域关联，不复制 jobs/attempt/event 表。 |
| 03 的 CI 工件/版本清单 | sourceDeliveryRef 固定 sourceSHA/lock/toolchain/build/test/artifact/approval/signature/target/recovery | 03 提供构建拓扑与工件真源，本主题只核验交付授权；标签说明与 queued 存根不算交付。 |

## 3. 反馈与 Builder 主体

`POST /agent/feedback` 保留内容/分类/页面与 trace 的提示字段。org/user 从已验证身份解析，安装须校验可访问及 active 状态，使用版本优先取实际 turn pin/有效 ReleaseContext。带旧版本的历史反馈只在真实历史事件可核验时绑定；没有 trace 的手工反馈仍可提交，但不补工具成功。核验失败的关联不进入可信证据；正文和 screen/context 都经过敏感字段白名单过滤，maskingStatus/maskVersion 持久保存，脱敏组件失败正文为空。

现有 mask 和 asUntrusted 函数是可复用资产，但 Registry 的 builder_feedback_list 当前直接返回 list 原行。将不可信标记贯穿该实际返回及模型输入；nonce 只是数据边界，不是“保证注入不可执行”的证明。已声明 untrustedResult 的工具输出只作为数据，后续 Registry 独立硬授权。去重键按组织/安装/screen/脱敏指纹与现有反馈窗口，短事务记录来源/计数；NULL 正文采用独立来源标识，不把所有空正文合并。topic 只引用本范围可核验行，不把调用方 count/严重度当事实。

10唯一负责平台Builder grant签发/撤销与候选收窄；07负责通用每次调用/turn的可信主体解析和grant核验，01只记录稳定主体事件，不重复签发。服务端 Builder 发起接口绑定授权人、profile、实例/安装、候选 namespace、工具清单版本/摘要与撤销 epoch。宿主工具列表仍只是收窄，不签发授权。Registry核验profileGrant与候选目标，非builder_*或未显式允许的工具拒绝；仅可信且明确的人类旧入口可由服务器绑定runtime，未知主体/profile不得缺省放行。

特别保留对 `erp_module_export` 的拒绝集：它未声明 allowedAgents，当前确认/普通权限满足后会进入模块导出端口，不能借合法导出能力获得 Builder 任意服务器路径能力。本提案不改人工模块导出业务，Builder 必须在网关前段拒绝这一工具。Builder 构建/预览只有脱敏样本和短时可撤销候选访问，无生产库/发布密钥/宿主目录，已有 builder_proposal_create 的 createdBy=null 改为保存可信发起人；作者/批准分离由 05 一次判定。

## 4. A1 关联与任务恢复

在既有反馈/topic/proposal/policy/run 上补不可变 lineageRef；可增轻量效果窗口/关联表，迁移需冻结 RLS/组织安装归属与索引，但不新建任务调度表。proposal 保留现有硬字段检查，证据进一步解析为同范围真实引用；platformVersion/evolutionScope 取已有实例进化实现，不使用客户端字符串作为兼容事实。

逻辑阶段为采集/归并/草稿/冻结/验证/待批准/签名制品/最终准入/发布/安装/观察/完成，可阻断、失败或取消。job handler 一次只承担可重入阶段，外部模型/构建不持长事务，等待批准不长期占 worker；领域阶段与实际 job/event 引用一起显示。每阶段以 lineageId+candidateDigest+stage 的持久请求摘要幂等，副作用调用复用 05/06 的请求记录。租约丢失或 cancel 在每个提交前 fencing；超时先查询真实结果，不盲重试发布。已提交变化保留事实，取消仅停后续动作，恢复用安装兼容接口。

真实效果窗口完成前不得标 topic/feedback resolved，复发/回退重新关联原链；只创建候选/验证 job 成功不等于业务闭环完成。PG worker 已有取消和 AbortSignal 基础，接线需验证逐阶段合作取消与 fencing，不能据现有队列实现宣称全链恢复已真库通过。

## 5. A2 分类、政策授权与门禁顺序

现有 policy 必填数组/enum/boolean 校验保留，仅补回归；默认 enabled=false 保留。policy 更新成为不可变修订，存人工批准引用、scope、分类目录版本、资格/指标合同与撤销 epoch；Builder 无改 policy 能力。紧急停只能收窄/撤销，扩大或恢复必须重新审查。

分类只读取 05 服务端已应用/冻结后的完整基线→候选 diff。封闭路径目录加引用图证明纯展示；未知或影响行为一律转 A1。首类拟议为普通页面帮助和字段展示提示，理由是范围最窄、可证明不改 Schema/权限/业务/模型行为；不以现有 copy/changelog/menu/form_layout/knowledge_instruction 宽常量作为允许依据。应用允许子集与平台目录取交集；空 diff、自报类别不符、夹 permissions/schema/flow/rules/tool/skill/knowledge/migration 均拒绝。业务术语/合同/发票/法定声明的文字变化不能仅因是 text 视为安全。

A2 仍须批准：真人先审 policy，不等于批准任意候选。可信审批服务在该 policy 有效修订下为一个候选实例化预授权，绑定 candidateDigest/classificationDigest/范围/有效期/人审引用，由 05 审批契约验证职责分离，09 将其作为 G7。若契约不支持委托、超出人审批范围或必需证据不全，候选回 A1；不能拿 actorAgent=NULL 或 enabled=true 当批准。

顺序固定为：**candidateDigest 冻结 → 同候选真实测试评测与隔离预览 → 人批准/可信委托实例 → 完整签名未公开工件 → 最终 GateDecision（含 G7/G8）→ published → activation**。生产自治在必需真实评测未完成时拒绝。05/06/09 的隔离联调不必先完成 A1 观测，A1 端到端完成后才申请 A2，避免循环。

策略执行身份为独立 service principal，run.actorId 可追责，actorAgent=NULL，附原提议人/Agent。不赋予 Runtime/Builder publish/activate 凭据。publish、activation、晋级/回退提交均复读/校验 epoch 并与禁用事务协调；签名但未公开/未安装工件不会自动生效。

## 6. 观察、复核和审计

指标窗口绑定实际 releaseDigest、安装修订、cohort 路由版本、源版本、数据水位与分子/分母/样本/基线，采用去重和 freshness 规则。任务完成率与错误率方向不同，不能统一 value>limit。缺字段、无源、零分母、非有限值、混版本/cohort和未满窗口返回 unavailable，停新增自动动作并转人，不能把无违规数组写 success。

具体窗口/最小样本/档位/自动上限/复核期限/资格次数必须在实施前由业务与安全负责人批准 policy。当前 `docs/protocols/agent-evolution.md:29–31,285` 和 pending A2 spec 提出 24h、默认 N=5、5/25/100 的设计，代码与 UI 也有默认值，但这些不证明某实例 policy 已获批准；本增量不引入新的通用数字，也不把这些数字直接迁为生效资格。若保留这些现有设计值，应提供该实例风险/样本基线理由并取得 policy 人审。全量仍独立人工批准。资格建立/恢复采用 policy 规定次数的完整人批等价运行，不先要求自动发布次数造成初次启用循环。

每次发布独立 reviewDueAt，与窗口/候选引用核验，不能刷新 policy.lastReviewedAt 规避历史逾期；扫描周期不得推迟提交时的过期拒绝。沿用 release.guardrail_check/release.review_due 名字作为扫描唤醒，真正阶段接 PG jobs，Cron 成功只是扫描事实。季度报告遍历本组织所有 policy 历史、run、实际分类和发布/安装，验证结构性自动发布；缺证据为 unavailable并停用，不能仅查看首条 policy 或 structural 标签输出伪零。

自动回退由实际违规及批准策略触发，先验证当前→目标迁移/定义/数据兼容后调用 06。兼容不足保留当前 active、阻断晋级告警转人；停用后自动副作用停止，已提交变化的必要恢复走既有受控人工流程。

## 7. 外围源码交付与兼容迁移

独立源码 Agent 仅在授权仓库/分支提 PR。临时构建器不含生产数据/发布密钥/宿主目录，依赖与 npm 生命周期审查，不能由实例 Builder 将源码 diff 标 copy 获 A2。交付清单固定仓库/sourceSHA/基线/锁/工具链/依赖差异、build/testRunRefs、实际断言和必需版本、工件（前后端/所需 Rust host/module）、独立代码审批、签名、目标审批和旧工件/数据恢复引用。此清单是外围部署来源记录，不发明新 Blueprint 格式。

同 SHA/完整签名/独立批准之后受控部署器才按 digest 交付并核验 readiness。缺必需真库/模型/浏览器证据或只是 queued存根一律 blocked/unavailable；不要求无关纯文案每次调用模型，但是否不适用由服务器门禁判断，生产自治整体真实评测资格仍不可省略。代码镜像回滚、安装回退和数据补偿各自记录，旧工件无兼容证据不能承诺安全恢复。

迁移采用增量列/关联表，保留历史只读并标 legacy_unverified；旧 enabled A2 全关闭待审，clean 次数与无法核验指标不迁为资格。旧独立 manifest 自动发布停止接受执行，返回冻结候选入口指引；建议字段保留显示。停止新功能撤销主体/epoch、停后续 worker 副作用且保留历史，不回退到旧 self-report/manifest路径。人工 ai_modules 继续同一草稿链，不绕审批/签名/安装。

## 8. 风险与待决策

分类误判用封闭目录/完整 diff/未知拒绝；稀疏或迟到指标用批准分母/水位；停用竞争用短事务 epoch/fencing；预授权接口未就绪继续 A1；版本绑定由已有实例进化 owner 提供。需批准的事项包括指标源与窗口合同、首类目录、委托审批角色、部署目标与兼容恢复责任。只完成文档/静态单测不足以关闭这些风险；真实 provider/PG/浏览器/隔离交付证据缺失持续禁止生产自治。本次没有执行这些验收。
