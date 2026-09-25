// @speckit/wasm-modules —— 原子模块准入的**共享**判定逻辑。
//
// 之所以是独立包而不是各端各写一份：闸 1（静态白名单）与吊销判据必须
// 平台侧准入与 Runtime 侧执行**逐条一致**；两份实现漂移 = 准入闸形同虚设。
export * from "./wasm-binary";
export * from "./static-gate";
export * from "./source-gate";
export * from "./admission";
export * from "./revocation";
export * from "./test-fixtures";
