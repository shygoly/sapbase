/**
 * W3：旧工作流路由墓碑。断言 410 + migratedTo，不是 404。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { LegacyWorkflowGoneModule } from '../src/legacy-workflow-gone/legacy-workflow-gone.module'
import { LEGACY_WORKFLOW_GONE_BODY } from '../src/legacy-workflow-gone/legacy-workflow-gone.controller'

describe('旧工作流路由墓碑（410）', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LegacyWorkflowGoneModule],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const cases: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; path: string }> = [
    { method: 'get', path: '/api/workflows' },
    { method: 'post', path: '/api/workflows' },
    { method: 'get', path: '/api/workflows/some-id' },
    { method: 'get', path: '/api/workflow-instances' },
    { method: 'post', path: '/api/workflow-instances/some-id/transition' },
    { method: 'get', path: '/api/workflow-instances/some-id/history' },
  ]

  it.each(cases)('$method $path 返回 410 且含 migratedTo', async ({ method, path }) => {
    const res = await request(app.getHttpServer())[method](path)
    expect(res.status).toBe(410)
    expect(res.body.message).toBe(LEGACY_WORKFLOW_GONE_BODY.message)
    expect(res.body.migratedTo).toEqual(LEGACY_WORKFLOW_GONE_BODY.migratedTo)
  })
})
