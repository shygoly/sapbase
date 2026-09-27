/**
 * 工作流上下文端口（接缝保留）。W3 适配器已删，GeneratePatchService 以 @Optional 注入；
 * 缺实现时没有流程状态上下文。
 */
export interface IWorkflowService {
  getWorkflowContext(
    entityType: string,
    entityId: string,
    organizationId: string,
  ): Promise<string | null>
}
