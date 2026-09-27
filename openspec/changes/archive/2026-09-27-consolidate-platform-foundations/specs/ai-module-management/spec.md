# ai-module-management Specification (delta)

## ADDED Requirements

### Requirement: AI Definition Converts to Blueprint Layers

AI 生成的模块定义（`mergedDefinition`）MUST 能通过一个**纯函数**转换成蓝图分层
（`semantic` / `flows`，以及源中确实存在的 `rules` / `experience`），
且转换结果 MUST 通过既有蓝图协议（实体与字段命名、状态机完整性、流程为 DAG、动作齐全）；
不满足时 MUST 显式报错，MUST NOT 产出一个连编译都过不了的包。

#### Scenario: 完整定义可转换

**Given** 一份含对象模型与状态流的 `mergedDefinition`
**When** 执行转换
**Then** SHALL 产出可被既有编译器接受的 `semantic` 与 `flows` 层
**And** 转换 MUST 是纯函数（同样的输入必得同样的输出）

#### Scenario: 不合法的定义显式报错

**Given** 一份含非法实体名（不符合协议命名）的 `mergedDefinition`
**When** 执行转换
**Then** 转换 SHALL 失败并指明不合法的位置
**And** MUST NOT 通过改名或填充的方式把非法输入"修正"成合法

### Requirement: Missing Layers Stay Missing

转换器 MUST NOT 为 AI 未产出的部分编造层内容。
源中没有规则或经验策略时，产物 MUST NOT 包含 `rules.json` / `experience.json`，
MUST NOT 生成占位规则或占位策略。
（编造出来的规则会被下游当作真的执行，比缺层更危险。）

#### Scenario: 源里没有规则

**Given** 一份不含规则层的 `mergedDefinition`
**When** 转换并打包
**Then** 包内文件清单 SHALL NOT 含 `rules.json`
**And** MUST NOT 出现任何占位规则

#### Scenario: 源里确实有规则

**Given** 一份显式含蓝图规则层声明的 `mergedDefinition`
**When** 转换并打包
**Then** 产物 SHALL 含 `rules.json`
**And** 该层 SHALL 通过既有规则协议校验

### Requirement: AI Artifacts Use the Existing Delivery Chain

AI 产物落成蓝图包时 MUST 复用既有的打包与交付实现
（打包 → 编译出 IR → 写入编译记录 → 签名），MUST NOT 为 AI 另建一条打包或交付路径；
交付出的包 MUST 能被既有装载链装载（授权与验签通过）。

#### Scenario: AI 产物进既有链

**Given** 一份可转换的 `mergedDefinition`
**When** 执行交付
**Then** 清单 SHALL 记录 `compiled.irDigest` 与 `signature`
**And** 该包 SHALL 能通过既有装载链被装载

#### Scenario: 不为 AI 另建交付路径

**Given** AI 产物的交付过程
**When** 检查实现
**Then** 打包、编译、盖章、签名 SHALL 全部调用既有函数
**And** MUST NOT 存在第二条交付入口
