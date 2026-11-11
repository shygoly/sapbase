## ADDED Requirements

### Requirement: Source Evolution Requires Independent Evidence and Deployment Authority

源码演进 SHALL 仅在授权独立仓库/分支通过 PR 提议；Runtime/Builder MUST 无热改生产 Nest/Next、宿主 shell、生产数据/密钥或部署管理权限，源码 MUST 不享受元数据 A2 预授权。外围交付 MUST 复用现有 CI 工件基础，绑定 sourceSHA、基线、npm 锁摘要、工具链/依赖 diff、隔离构建与实际必需测试引用/断言、完整工件摘要、独立真人代码/依赖批准及目标部署批准；签名服务 MUST 签名不可变完整清单，受控部署器按摘要部署并核验 readiness。缺必需模型/真库/浏览器证据、混 SHA、空断言、缺批准/签名 MUST blocked/unavailable。queued 存根、标签说明或 Agent 自报 MUST 不算部署成功。旧工件 MUST 保留；代码回滚、安装回退与数据补偿 MUST 分别验证，缺兼容证据不得承诺安全恢复。

#### Scenario: Authorized source PR reaches controlled delivery
- **GIVEN** PR 固定同一 sourceSHA/锁与工具链，临时隔离环境无生产资源，真实必需测试与独立批准/签名/部署目标齐全
- **WHEN** 受控平台交付该不可变工件
- **THEN** 平台 MUST 核验完整清单、同 SHA 证据和实际 readiness，记录真实部署结果、旧工件及各类恢复兼容证明
- **AND** 源码作者/Agent MUST 不能自批或借 Builder/A2 获得部署身份

#### Scenario: Stub mixed evidence and hot patches cannot pass delivery
- **GIVEN** deploy 仅返回 queued，或 SHA B 工件配 SHA A 测试，必需依赖/断言/批准缺失，或 Agent 请求热改宿主/以 copy 发布源码
- **WHEN** 请求交付准入或恢复旧镜像
- **THEN** 平台 MUST 拒绝并报告实际 blocked/unavailable，无部署/热改副作用，不以标签或存根输出宣布成功
- **AND** 缺当前数据/定义到旧工件兼容证据 MUST 阻断安全回滚声明，转授权恢复而不是恢复旧不安全旁路
