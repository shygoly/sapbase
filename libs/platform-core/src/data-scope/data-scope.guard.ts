import { ForbiddenException, Injectable } from '@nestjs/common'
import { DataScopeService, type ResolveScopeInput } from './data-scope.service'

/**
 * 数据范围准入闸：解析结果 none 即拒。
 * Agent 工具面 / 插件宿主 / 外部 API 统一调用这里，避免各入口各写一份。
 */
@Injectable()
export class DataScopeGuard {
  constructor(private readonly dataScope: DataScopeService) {}

  async assertAllowed(input: ResolveScopeInput): Promise<void> {
    const { expr } = await this.dataScope.resolve(input)
    if (expr.op === 'none') {
      throw new ForbiddenException(
        `数据范围拒绝：${input.resourceKey}:${input.action}`,
      )
    }
  }
}
