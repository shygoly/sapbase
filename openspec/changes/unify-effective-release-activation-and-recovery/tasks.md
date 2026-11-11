# 实施任务（全部待批准后执行）

## 1. 契约与安全兼容

- [ ] 1.1 与04/05冻结安装purpose制品读取、同EntityManager Outbox和确定性命令接口；与07/08/09冻结ReleaseContext/pin、候选兼容证据及最终GateDecision输入，候选验证不要求published。
- [ ] 1.2 以当前 `releaseDigest=IR摘要` 为历史语义扩展目录/包/IR独立摘要、修订/绑定/routingRevision及组合外键/RLS；保留已有安装锁、追加历史和回退重载摘要判据，禁止平行版本真源。
- [ ] 1.3 制定旧同步API到真实202任务、调用方expectedRevision/routingRevision、首次安装期望不存在的弃用方案；只读对账并追加可信历史关联，歧义拒绝认证，不改旧事实。

## 2. 唯一实际生效与消费者

- [ ] 2.1 在platform-release建立EffectiveReleaseService及ReleaseInstallationPort，由apps/api工厂注入既有安装聚合适配器；库不得反向import应用，只有协调器可写有效绑定。
- [ ] 2.2 将既有Release activate/rollback、安装install/upgrade/rollback及策略服务切换入口委托协调器；恢复暂停安装只复验原绑定，不接受换包，关闭release功能不得恢复旧旁路。
- [ ] 2.3 将语义/Blueprint业务定义及记录入口改为可信安装解析并核对URL包ID；release/whats-new核对appKey/安装/header，拒绝另一已授权但未生效包，保留已有路径id守卫/权限/data-scope/RLS回归。
- [ ] 2.4 为API、Registry适配器、Agent接口和审计输出统一ReleaseContext/pin及版本冲突契约；07负责turn完整持久传递，不在此实现模型或确认状态机。
- [ ] 2.5 向08提供现有BlueprintAppRuntime/api-client所需版本化定义/记录响应、失效事件及完整namespace契约；06只实现服务端有效版本适配并做契约测试，前端接线/查询缓存/旧页冲突由08唯一实施，保留现有list/form/detail和权限判据。
- [ ] 2.6 实现可信版本化稳定cohort/默认唯一路由、请求/turn pin与写前版本重验；证明双版本共存兼容，歧义路由及preview生产写拒绝，不定义A2晋级窗口。

## 3. 持久操作与原子恢复

- [ ] 3.1 复用PG JobQueue/JobTypeRegistry注册Release白名单handler，保存principal/安装/key/requestDigest和进行中状态；同key异参拒绝，submit/resume/结果命中均先授权，不新建任务队列。
- [ ] 3.2 扩展Release操作回执及同manager业务终态提交，检查attempt/lease/fencing CAS；worker提交后异常/取消必须读回执，不能覆盖已提交成功或重新切换。
- [ ] 3.3 复用安装短事务/行锁，最终重验expectedRevision/routingRevision、目标状态、实际ledgerHead和必需证据，原子提交修订/绑定/activation事实/投影/ReleaseEvent/Outbox/回执；HTTP和worker均设置可信RLS。
- [ ] 3.4 提交后经04可靠消费者做缓存/Next重验证/通知，按稳定eventId去重，投递待重试不重做激活；增加提交前后中断、租约接管、授权撤销和取消竞争恢复测试。

## 4. 迁移与回退证据

- [ ] 4.1 建安装范围迁移ledger及方向性兼容矩阵，绑定源/目标目录/包/IR、实际schema代际/水位、脚本/执行器摘要；隔离candidate purpose先生成实际证据供09 G3，不要求已published/G3；生产切换再消费已完成G3并重验当前水位，每批短事务/幂等/checkpoint，未知状态拒绝盲跑。
- [ ] 4.2 执行受控expand-migrate-contract/影子验证与必要写栅栏；回退先重载目标并验证当前数据，需要补偿则独立批准任务实际完成再切；无证据/部分迁移/unsafe拒退保留当前active。

## 5. 真实验收与交付登记

- [ ] 5.1 在授权隔离真实PG环境运行有效版本、双租户/双应用、HTTP/worker事务传播、同key并发/异参/重启、Outbox故障及迁移拒绝矩阵；待新增并核验API `test:release-activation-e2e`，前置失败/skip不得PASS。
- [ ] 5.2 待新增并实际运行 `test:release-context-browser`，对现有UI/API/Registry/Agent解析接口做同用户版本一致性、旧URL/旧pin与灰度重启验收；记录SHA/摘要/套件/角色/版本/case/断言/失败/skip，fixture不称真实模型评测。
- [ ] 5.3 批准实施后同步DOMAIN/META/release协议/Schema与API弃用说明及相关pending验收边界，执行实际质量入口；联合04/05/09必需真实证据与最终GateDecision才允许生产激活，真实模型评测缺失不得放行自治，A2保持关闭等待10独立批准。本次仅交付提案与静态校验，不apply/archive/迁移/部署。
