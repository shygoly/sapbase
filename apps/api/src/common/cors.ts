/**
 * 开发态允许的前端来源。生产通过 CORS_ORIGIN 显式覆盖（逗号分隔）。
 */
export const corsOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:3050,http://localhost:3060'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
