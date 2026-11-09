import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { IdentitySsoController } from '../src/identity/identity-sso.controller'
import { IdentitySsoService } from '../src/identity/identity-sso.service'

describe('Identity SSO HTTP routes', () => {
  let app: INestApplication
  const sso = {
    authorizationUrl: jest.fn(async () => 'https://idp.example.com/login?state=s1'),
    authenticate: jest.fn(async () => ({
      provider: { key: 'cas', name: 'CAS' },
      link: { externalId: 'ext-1' },
      user: { id: 'u1', email: 'a@example.com', name: 'A' },
      created: false,
    })),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IdentitySsoController],
      providers: [{ provide: IdentitySsoService, useValue: sso }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET authorize → 返回 URL，不返回 secret', async () => {
    const response = await request(app.getHttpServer())
      .get('/identity/sso/cas/authorize')
      .query({ organizationId: 'org-1', state: 's1' })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ url: 'https://idp.example.com/login?state=s1' })
    expect(sso.authorizationUrl).toHaveBeenCalledWith('org-1', 'cas', {
      state: 's1',
      nonce: undefined,
      codeChallenge: undefined,
    })
  })

  it('POST callback → 返回用户/link/created', async () => {
    const response = await request(app.getHttpServer())
      .post('/identity/sso/cas/callback')
      .send({ organizationId: 'org-1', ticket: 'ST-1' })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      user: { id: 'u1' },
      created: false,
    })
    expect(sso.authenticate).toHaveBeenCalledWith('org-1', 'cas', {
      ticket: 'ST-1',
      code: undefined,
      codeVerifier: undefined,
      state: undefined,
      nonce: undefined,
    })
  })
})
