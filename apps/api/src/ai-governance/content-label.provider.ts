import type { ContentLabelType } from './ai-governance.entities'

export interface ContentLabelInput {
  organizationId: string
  contentId: string
  labelType: ContentLabelType
  text: string
  metadata?: Record<string, unknown> | null
}

export interface ContentLabelProvider {
  readonly name: string
  supports(contentType: string): boolean
  apply(input: ContentLabelInput): Promise<{ applied: boolean; metadata?: Record<string, unknown> }>
  verify(input: { contentId: string; labelType: ContentLabelType }): Promise<boolean>
}

/** 默认 provider：写版本化标识元数据；真实水印/文件元数据由资产处理器扩展。 */
export const defaultContentLabelProvider: ContentLabelProvider = {
  name: 'default',
  supports: () => true,
  async apply(input) {
    return {
      applied: Boolean(input.text.trim()),
      metadata: { provider: 'default', contentId: input.contentId, labelType: input.labelType },
    }
  },
  async verify() {
    return true
  },
}
