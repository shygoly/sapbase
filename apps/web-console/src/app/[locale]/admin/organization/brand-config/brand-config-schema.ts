import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须是 #RRGGBB')

export const brandConfigSchema = z.object({
  appName: z.string().max(100, '应用名最多 100 字符').nullable().optional(),
  logoUrl: z.union([z.string().url('Logo URL 非法'), z.literal(''), z.null()]).optional(),
  faviconUrl: z.union([z.string().url('Favicon URL 非法'), z.literal(''), z.null()]).optional(),
  supportEmail: z.union([z.string().email('邮箱格式非法'), z.literal(''), z.null()]).optional(),
  supportUrl: z.union([z.string().url('支持链接非法'), z.literal(''), z.null()]).optional(),
  customCss: z.string().max(20000, '自定义 CSS 过长').nullable().optional(),
  theme: z
    .object({
      primary: hexColor,
      secondary: hexColor,
      accent: hexColor,
      background: hexColor,
      foreground: hexColor,
    })
    .partial(),
})
