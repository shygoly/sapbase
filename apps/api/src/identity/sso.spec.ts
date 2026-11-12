import { CasSsoAdapter } from '@sap/platform-core/identity/sso/cas-sso.adapter'
import {
  createPkcePair,
  OidcSsoAdapter,
} from '@sap/platform-core/identity/sso/oidc-sso.adapter'
import { SsoError } from '@sap/platform-core/identity/sso/sso-adapter'
import { Oauth2SsoAdapter } from '@sap/platform-core/identity/sso/oauth2-sso.adapter'
import { SamlSsoAdapter } from '@sap/platform-core/identity/sso/saml-sso.adapter'

describe('CasSsoAdapter', () => {
  const config = { baseUrl: 'https://cas.example.com/cas', serviceUrl: 'https://app.example.com/sso/cas' }

  it('生成登录 URL', () => {
    const adapter = new CasSsoAdapter(config)
    expect(adapter.authorizationUrl()).toBe(
      'https://cas.example.com/cas/login?service=https%3A%2F%2Fapp.example.com%2Fsso%2Fcas',
    )
    expect(decodeURIComponent(adapter.authorizationUrl({ state: 's1' }))).toContain('state=s1')
  })

  it('校验 ticket 成功：解析 user 与 attributes', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `<cas:serviceResponse><cas:authenticationSuccess>
        <cas:user>zhangsan</cas:user>
        <cas:attributes><cas:name>张三</cas:name><cas:role>teacher</cas:role></cas:attributes>
      </cas:authenticationSuccess></cas:serviceResponse>`,
    })) as unknown as typeof fetch
    const adapter = new CasSsoAdapter(config, { fetcher })
    await expect(adapter.authenticate({ ticket: 'ST-1' })).resolves.toEqual({
      externalId: 'zhangsan',
      attributes: { name: '张三', role: 'teacher' },
    })
  })

  it('CAS 认证失败 → SsoError', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<cas:serviceResponse><cas:authenticationFailure code="INVALID_TICKET">bad</cas:authenticationFailure></cas:serviceResponse>',
    })) as unknown as typeof fetch
    const adapter = new CasSsoAdapter(config, { fetcher })
    await expect(adapter.authenticate({ ticket: 'bad' })).rejects.toBeInstanceOf(SsoError)
  })
})


describe('SamlSsoAdapter', () => {
  const config = {
    entryPoint: 'https://idp.example.com/saml/login',
    issuer: 'https://app.example.com/saml',
    certificate: 'CERT',
  }

  function response(extra = '') {
    return Buffer.from(
      `<saml2:Assertion><saml2:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>${extra}<saml2:Subject><saml2:NameID>ext-1</saml2:NameID></saml2:Subject><saml2:AttributeStatement><saml2:Attribute Name="email"><saml2:AttributeValue>a@example.com</saml2:AttributeValue></saml2:Attribute></saml2:AttributeStatement></saml2:Assertion>`,
    ).toString('base64')
  }

  it('生成 IdP URL 带 RelayState', () => {
    const adapter = new SamlSsoAdapter(config)
    expect(adapter.authorizationUrl({ state: 's1' })).toContain('RelayState=s1')
  })

  it('验签通过 + 时间窗内 → 返回 NameID/attributes', async () => {
    const adapter = new SamlSsoAdapter(config, { verifier: () => true })
    await expect(adapter.authenticate({ samlResponse: response() })).resolves.toEqual({
      externalId: 'ext-1',
      attributes: { email: 'a@example.com' },
    })
  })

  it('签名失败 → SsoError', async () => {
    const adapter = new SamlSsoAdapter(config, { verifier: () => false })
    await expect(adapter.authenticate({ samlResponse: response() })).rejects.toBeInstanceOf(SsoError)
  })

  it('未配置证书 → fail-closed', async () => {
    const adapter = new SamlSsoAdapter({ ...config, certificate: undefined }, { verifier: () => true })
    await expect(adapter.authenticate({ samlResponse: response() })).rejects.toBeInstanceOf(SsoError)
  })

  it('断言过期 → SsoError', async () => {
    const xml = Buffer.from(
      '<saml2:Assertion><saml2:Conditions NotOnOrAfter="2020-01-01T00:00:00Z"/><saml2:NameID>ext-1</saml2:NameID></saml2:Assertion>',
    ).toString('base64')
    const adapter = new SamlSsoAdapter(config, { verifier: () => true })
    await expect(adapter.authenticate({ samlResponse: xml })).rejects.toBeInstanceOf(SsoError)
  })
})

describe('OidcSsoAdapter', () => {
  const config = {
    issuer: 'https://idp.example.com',
    authorizationEndpoint: 'https://idp.example.com/auth',
    tokenEndpoint: 'https://idp.example.com/token',
    jwksUri: 'https://idp.example.com/jwks',
    clientId: 'client-1',
    redirectUri: 'https://app.example.com/sso/oidc',
  }

  it('授权 URL 含 state/nonce/PKCE S256', async () => {
    const adapter = new OidcSsoAdapter(config)
    const { challenge } = createPkcePair()
    const url = new URL(
      await adapter.authorizationUrl({ state: 's1', nonce: 'n1', codeChallenge: challenge }),
    )
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('s1')
    expect(url.searchParams.get('nonce')).toBe('n1')
    expect(url.searchParams.get('code_challenge')).toBe(challenge)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('token exchange + 验签后返回 externalId', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id_token: 'id-token' }),
    })) as unknown as typeof fetch
    const verifier = jest.fn(async () => ({
      iss: 'https://idp.example.com',
      aud: 'client-1',
      sub: 'external-1',
      nonce: 'n1',
      email: 'a@example.com',
    }))
    const adapter = new OidcSsoAdapter(config, { fetcher, verifier })
    await expect(
      adapter.authenticate({ code: 'code-1', nonce: 'n1', codeVerifier: 'v1' }),
    ).resolves.toMatchObject({
      externalId: 'external-1',
      attributes: expect.objectContaining({ email: 'a@example.com' }),
    })
  })

  it('nonce 不匹配 → SsoError', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id_token: 'id-token' }),
    })) as unknown as typeof fetch
    const verifier = jest.fn(async () => ({
      iss: 'https://idp.example.com',
      aud: 'client-1',
      sub: 'external-1',
      nonce: 'other',
    }))
    const adapter = new OidcSsoAdapter(config, { fetcher, verifier })
    await expect(
      adapter.authenticate({ code: 'code-1', nonce: 'n1' }),
    ).rejects.toBeInstanceOf(SsoError)
  })
})

describe('Oauth2SsoAdapter', () => {
  const config = {
    authorizationEndpoint: 'https://idp.example.com/oauth/authorize',
    tokenEndpoint: 'https://idp.example.com/oauth/token',
    userinfoEndpoint: 'https://idp.example.com/oauth/userinfo',
    clientId: 'client-1',
    redirectUri: 'https://app.example.com/sso/oauth2',
  }

  it('生成授权 URL（code + state）', () => {
    const adapter = new Oauth2SsoAdapter(config)
    const url = adapter.authorizationUrl({ state: 's1' })
    expect(url).toContain('response_type=code')
    expect(url).toContain('client_id=client-1')
    expect(url).toContain('state=s1')
  })

  it('token exchange + userinfo → externalId/attributes', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'at-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sub: 'ext-1', email: 'a@example.com', name: 'A' }),
      }) as unknown as typeof fetch
    const adapter = new Oauth2SsoAdapter(config, { fetcher })
    await expect(adapter.authenticate({ code: 'c1' })).resolves.toEqual({
      externalId: 'ext-1',
      attributes: { sub: 'ext-1', email: 'a@example.com', name: 'A' },
    })
  })

  it('缺少 access_token / userinfo 无 subject → SsoError', async () => {
    const noToken = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    })) as unknown as typeof fetch
    await expect(
      new Oauth2SsoAdapter(config, { fetcher: noToken }).authenticate({ code: 'bad' }),
    ).rejects.toBeInstanceOf(SsoError)

    const noSubject = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'at-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'no-subject' }),
      }) as unknown as typeof fetch
    await expect(
      new Oauth2SsoAdapter(config, { fetcher: noSubject }).authenticate({ code: 'c1' }),
    ).rejects.toBeInstanceOf(SsoError)
  })
})
