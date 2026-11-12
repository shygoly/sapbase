import {
  assertSafeOutboundUrl,
  IntegrationSecurityError,
  resolveSecret,
  verifyWebhookSignature,
  webhookSignature,
} from './integrations.security'

describe('integration security', () => {
  it('SSRF：元数据/私网拒绝，allowlist 放行', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      /元数据|私网|未授权/,
    )
    expect(() => assertSafeOutboundUrl('http://127.0.0.1:8080/x')).toThrow(/未授权|私网/)
    expect(
      assertSafeOutboundUrl('http://127.0.0.1:8080/x', ['127.0.0.1']).hostname,
    ).toBe('127.0.0.1')
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(/http/)
    expect(() => assertSafeOutboundUrl('http://user:pass@example.com')).toThrow(/用户名/)
  })

  it('secretRef 从 env 解析，缺失拒绝', () => {
    process.env.INTEGRATION_TEST_SECRET = 'abc'
    expect(resolveSecret('env:INTEGRATION_TEST_SECRET')).toBe('abc')
    expect(() => resolveSecret('env:NOT_EXISTS_XYZ')).toThrow(IntegrationSecurityError)
    delete process.env.INTEGRATION_TEST_SECRET
  })

  it('Webhook HMAC 正确/签名错/时间戳过期', () => {
    const secret = 's3cret'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const body = '{"a":1}'
    const signature = webhookSignature(secret, timestamp, body)
    expect(() => verifyWebhookSignature(secret, timestamp, body, signature)).not.toThrow()
    expect(() => verifyWebhookSignature(secret, timestamp, body, 'bad')).toThrow(/签名/)
    expect(() =>
      verifyWebhookSignature(secret, String(Number(timestamp) - 600), body, signature),
    ).toThrow(/时间戳/)
  })
})
