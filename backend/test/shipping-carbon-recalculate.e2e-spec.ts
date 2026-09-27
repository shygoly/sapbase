import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { PermissionsGuard } from '../src/auth/permissions.guard'
import { Organization, SubscriptionStatus } from '../src/organizations/organization.entity'
import { ReportSnapshot } from '../src/shipping-carbon/report-snapshot.entity'
import { Ship } from '../src/shipping-carbon/ship.entity'
import { Charter } from '../src/shipping-carbon/charter.entity'
import { Voyage } from '../src/shipping-carbon/voyage.entity'
import { ReportCenterRecord } from '../src/shipping-carbon/report-center-record.entity'

process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || '5432'
process.env.DB_USERNAME = process.env.DB_USERNAME || 'mac'
process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
process.env.DB_NAME = process.env.DB_NAME || 'carbon'

describe('ShippingCarbon recalculate snapshots (e2e)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let organizationsRepo: Repository<Organization>
  let snapshotsRepo: Repository<ReportSnapshot>
  let shipsRepo: Repository<Ship>
  let chartersRepo: Repository<Charter>
  let voyagesRepo: Repository<Voyage>
  let reportCenterRepo: Repository<ReportCenterRecord>

  const organizationSlug = `shipping-carbon-e2e-${Date.now()}`
  let organizationId: string

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module')

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: 'test-user', name: 'E2E User', permissions: ['*'] }
          return true
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    app.setGlobalPrefix('api')
    await app.init()

    organizationsRepo = moduleRef.get(getRepositoryToken(Organization))
    snapshotsRepo = moduleRef.get(getRepositoryToken(ReportSnapshot))
    shipsRepo = moduleRef.get(getRepositoryToken(Ship))
    chartersRepo = moduleRef.get(getRepositoryToken(Charter))
    voyagesRepo = moduleRef.get(getRepositoryToken(Voyage))
    reportCenterRepo = moduleRef.get(getRepositoryToken(ReportCenterRecord))

    const savedOrganization = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Shipping Carbon E2E',
        slug: organizationSlug,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    organizationId = savedOrganization.id
  })

  afterAll(async () => {
    if (organizationId) {
      await reportCenterRepo.delete({ organizationId })
      await snapshotsRepo.delete({ organizationId })
      await voyagesRepo.delete({ organizationId })
      await chartersRepo.delete({ organizationId })
      await shipsRepo.delete({ organizationId })
      await organizationsRepo.delete({ id: organizationId })
    }
    await app.close()
  })

  it('creates a cached snapshot on report fetch and appends a new one on recalculation', async () => {
    const shipsResponse = await request(app.getHttpServer())
      .get('/api/shipping/ships')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(shipsResponse.status).toBe(200)
    expect(Array.isArray(shipsResponse.body)).toBe(true)
    expect(shipsResponse.body.length).toBeGreaterThan(0)

    const shipId = shipsResponse.body[0].id

    const firstReportResponse = await request(app.getHttpServer())
      .get('/api/shipping/reports/cii')
      .query({ shipId, year: 2025 })
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(firstReportResponse.status).toBe(200)
    expect(firstReportResponse.body.metrics.length).toBeGreaterThan(0)

    const initialSnapshots = await snapshotsRepo.find({
      where: { organizationId, reportType: 'cii', shipId, year: 2025 },
      order: { createdAt: 'ASC' },
    })
    expect(initialSnapshots).toHaveLength(1)

    const secondReportResponse = await request(app.getHttpServer())
      .get('/api/shipping/reports/cii')
      .query({ shipId, year: 2025 })
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(secondReportResponse.status).toBe(200)
    expect(secondReportResponse.body).toEqual(firstReportResponse.body)

    const snapshotsAfterCacheHit = await snapshotsRepo.find({
      where: { organizationId, reportType: 'cii', shipId, year: 2025 },
    })
    expect(snapshotsAfterCacheHit).toHaveLength(1)

    const recalculateResponse = await request(app.getHttpServer())
      .post('/api/shipping/recalculate')
      .send({ framework: 'cii', shipId, year: 2025 })
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(recalculateResponse.status).toBe(201)
    expect(recalculateResponse.body.success).toBe(true)
    expect(recalculateResponse.body.snapshotId).toBeDefined()

    const snapshotsAfterRecalculate = await snapshotsRepo.find({
      where: { organizationId, reportType: 'cii', shipId, year: 2025 },
      order: { createdAt: 'ASC' },
    })
    expect(snapshotsAfterRecalculate).toHaveLength(2)
    expect(snapshotsAfterRecalculate[1].parameterVersion).toMatchObject({ source: 'manual', requestedBy: 'E2E User' })
  })
})
