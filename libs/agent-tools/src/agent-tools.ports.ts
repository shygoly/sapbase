/**
 * agent-tools 与应用层之间的端口。
 *
 * 工具注册表要读取模块注册表与 Builder 反馈，但这两者属于应用层业务能力，
 * 不能反向进入 `libs/agent-tools`。应用层在 `agent-tools.module.ts` 用工厂
 * 把具体实现（ModuleRegistryService / AgentFeedbackService）注入进来。
 */
export interface AgentModuleRegistryPort {
  findAll(organizationId: string): Promise<unknown[]>
  exportBlueprint(
    moduleId: string,
    organizationId: string,
    options?: { dir?: string; out?: string },
  ): Promise<unknown>
}

export interface AgentFeedbackPort {
  list(organizationId: string, appKey?: string, status?: string): Promise<unknown[]>
}
