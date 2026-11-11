## ADDED Requirements

### Requirement: Current Workspace Build Input and Output Closure

当前工作区 SHALL 保留已拆分的 apps/api、web-portal、web-console 与现有平台/领域/共享 libs，显式声明实际消费者的直接 npm 包依赖，并以同一依赖图构建生产者及消费者。build MUST 声明完整 outputs、项目及依赖源码、根 package-lock/package/npm 配置、实际编译配置、锁定工具链与非秘密环境输入；源码型前端库 MUST 纳入其 Next 消费目标的输入闭包。JavaScript MUST 仅使用根 npm 锁，Cargo.lock MUST 保留；模板清理 MUST 基于实际消费者清单且不得捆绑主体框架主版本升级。冷构建 MUST 不依赖旧产物或缓存，MUST NOT 提交普通 dist/.next/target 凑绿；既有入册 WASM 字节/manifest 的复现准入判据 MUST 保留。

#### Scenario: 现有拓扑干净构建和缓存恢复
- **WHEN** 同 sourceSha/inputDigest 的干净隔离副本在根 npm ci 后运行拓扑 build，并验证可信缓存恢复
- **THEN** 实际生产者 MUST 先于其消费者，API和两个完整Next目标 MUST 生成全部声明输出
- **AND** 原dev/子包build及合法兼容re-export MUST 保持可用，缓存命中 MUST 标原运行来源

#### Scenario: 漏依赖或输入漂移不能由旧产物掩盖
- **WHEN** API实际直接导入agent-kernel却未声明它，或依赖源码/根锁/编译输入发生变化，或存在冲突JavaScript锁
- **THEN** 缺依赖/冲突锁 MUST 非零失败，受影响消费者 MUST 失效重建而非复用旧输出
- **AND** PG/Redis/browser/故障测试 MUST 实际重新执行，不得以缓存结果声明本次通过

### Requirement: Resolved Import Path and Graph Completeness Enforcement

工作区 SHALL 在现有error级Nx边界及B0–B5判据之外验证图结构、必需项目/源码范围与同项目解析后import/export边，覆盖相对路径、别名、package exports和re-export。纯领域/共享业务Kernel MUST 不接模型或IO/基础设施，domain MUST 不引用同项目infra，browser MUST 不接Node-only实现；领域项目内已明确的迁移/导入适配器 MUST 按真实目录和导出归类，不得把整个项目误认成纯Kernel。Agent Host服务端模型适配不被禁止，但工具 MUST 只经Registry；Agent Kernel MUST 经批准端口。检查 MUST 非自动修复并实际参与required CI，MUST NOT 通过空图、旧图、空glob或宽泛豁免形成通过。

#### Scenario: 实际图与合法适配路径通过
- **WHEN** required检查读取同SHA的完整Nx图及生产源码，合法纯函数/受控端口与明确Node迁移适配被解析
- **THEN** 检查 MUST 使用既有error及互补判据且覆盖API、全部相关libs和双前端ts/tsx
- **AND** 合法导入 MUST 通过，不要求重新物理拆分或给组合根错误增加layer约束

#### Scenario: 内部跨界和不完整图拒绝
- **WHEN** 注入domain到同项目infra、browser到Node、经alias/re-export隐藏的同样跨界，或图错误/零节点/遗漏必需项目/源码
- **THEN** required检查 MUST 非零失败并指出真实源目标或缺失范围
- **AND** 不能因Nx只看项目边、未知workspace目标被忽略、规则跳过或--no-error-on-unmatched-pattern而放行
