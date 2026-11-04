/**
 * Full lifecycle E2E test: create → submit-review → approve → publish → generate-system → deploy → unpublish.
 * Requires an authenticated user with system:manage and system:generate (e.g. admin).
 * Run after DB seed so permissions exist, or test creates a user with required permissions.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { AppModule } from '../src/app.module'
import { AuthService } from '../src/auth/auth.service'
import { User } from '../src/users/user.entity'
import { UserStatus } from '@speckit/shared-schemas'
import { AIModuleStatus } from '../src/ai-modules/ai-module.entity'

describe('AI Module full lifecycle (e2e)', () => {
  let app: INestApplication
  let authService: AuthService
  let userRepo: Repository<User>
  let token: string
  let moduleId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe())
    await app.init()

    authService = moduleFixture.get<AuthService>(AuthService)
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User))

    // Create user with permissions for full lifecycle (system:manage, system:generate)
    const passwordHash = await bcrypt.hash('password123', 10)
    const adminUser = userRepo.create({
      name: 'Lifecycle Test Admin',
      email: `lifecycle-admin-${Date.now()}@e2e.test`,
      passwordHash,
      role: 'admin',
      status: UserStatus.ACTIVE,
      permissions: ['system:manage', 'system:generate'],
    })
    await userRepo.save(adminUser)
    const loginResult = await authService.login(adminUser)
    token = loginResult.access_token
  })

  afterAll(async () => {
    await app.close()
  })

  it('runs full lifecycle: create → submit-review → approve → publish → generate-system → deploy → unpublish', async () => {
    const server = request(app.getHttpServer())
    const auth = { Authorization: `Bearer ${token}` }

    // 1. Create module
    const createRes = await server
      .post('/api/ai-modules')
      .set(auth)
      .send({ name: 'E2E Lifecycle Module', description: 'Created by lifecycle e2e test', patchContent: {} })
    expect(createRes.status).toBe(201)
    const created = createRes.body?.data ?? createRes.body
    expect(created).toHaveProperty('id')
    moduleId = created.id
    expect(created.status).toBe(AIModuleStatus.DRAFT)

    // 2. Run tests so submit-review can pass (service requires testResults.failed === 0)
    const testRes = await server.post(`/api/ai-modules/${moduleId}/test`).set(auth)
    expect(testRes.status).toBe(201)
    expect(Array.isArray(testRes.body)).toBe(true)

    // 3. Submit for review
    const submitRes = await server.post(`/api/ai-modules/${moduleId}/submit-review`).set(auth)
    expect([200, 201]).toContain(submitRes.status)
    const submitted = submitRes.body?.data ?? submitRes.body
    expect(submitted.status).toBe(AIModuleStatus.PENDING_REVIEW)

    // 4. Approve
    const reviewRes = await server
      .post(`/api/ai-modules/${moduleId}/review`)
      .set(auth)
      .send({ decision: 'approved', comments: 'E2E approved' })
    expect(reviewRes.status).toBe(201)

    const moduleAfterReview = await server.get(`/api/ai-modules/${moduleId}`).set(auth)
    const moduleApproved = moduleAfterReview.body?.data ?? moduleAfterReview.body
    expect(moduleApproved.status).toBe(AIModuleStatus.APPROVED)

    // 5. Publish (required before unpublish)
    const publishRes = await server.post(`/api/ai-modules/${moduleId}/publish`).set(auth)
    expect([200, 201]).toContain(publishRes.status)
    const published = publishRes.body?.data ?? publishRes.body
    expect(published.status).toBe(AIModuleStatus.PUBLISHED)
    expect(published.publishedAt).toBeDefined()

    // 6. Generate system (stub returns jobId and status)
    const genRes = await server.post(`/api/ai-modules/${moduleId}/generate-system`).set(auth)
    expect([200, 201]).toContain(genRes.status)
    const genResult = genRes.body?.data ?? genRes.body
    expect(genResult).toHaveProperty('jobId')
    expect(genResult).toHaveProperty('status')
    expect(genResult.jobId).toBeTruthy()

    // 7. Deploy (stub returns deployId and status)
    const deployRes = await server
      .post('/api/system/deploy')
      .set(auth)
      .send({ moduleId, jobId: (genRes.body?.data ?? genRes.body).jobId })
    expect([200, 201]).toContain(deployRes.status)
    const deployResult = deployRes.body?.data ?? deployRes.body
    expect(deployResult).toHaveProperty('deployId')
    expect(deployResult).toHaveProperty('status')
    expect(deployResult.deployId).toBeTruthy()

    // 8. Unpublish (uninstall)
    const unpublishRes = await server.post(`/api/ai-modules/${moduleId}/unpublish`).set(auth)
    expect([200, 201]).toContain(unpublishRes.status)
    const unpublished = unpublishRes.body?.data ?? unpublishRes.body
    expect(unpublished.status).toBe(AIModuleStatus.UNPUBLISHED)
    expect(unpublished.unpublishedAt).toBeDefined()
  })
})
