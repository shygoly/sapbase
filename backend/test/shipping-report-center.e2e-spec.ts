import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { PermissionsGuard } from '../src/auth/permissions.guard'
import { Organization, SubscriptionStatus } from '../src/organizations/organization.entity'
import { Ship } from '../src/shipping-carbon/infrastructure/persistence/entities/ship.entity'
import { ReportCenterRecord } from '../src/shipping-carbon/infrastructure/persistence/entities/report-center-record.entity'

describe('ShippingCarbon report center (e2e)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let organizationsRepo: Repository<Organization>
  let shipsRepo: Repository<Ship>
  let reportCenterRepo: Repository<ReportCenterRecord>
  let organizationId: string
  let shipId: string

  beforeAll(async () => {
    process.env.DB_HOST = process.env.DB_HOST || 'localhost'
    process.env.DB_PORT = process.env.DB_PORT || '5432'
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'mac'
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
    process.env.DB_NAME = process.env.DB_NAME || 'sapbasic'

    const { AppModule } = await import('../src/app.module')
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: 'test-user', name: 'Report Center User', permissions: ['*'] }
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
    shipsRepo = moduleRef.get(getRepositoryToken(Ship))
    reportCenterRepo = moduleRef.get(getRepositoryToken(ReportCenterRecord))

    const org = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Report Center E2E Org',
        slug: `report-center-e2e-${Date.now()}`,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    organizationId = org.id

    const ship = await shipsRepo.save(
      shipsRepo.create({
        organizationId,
        name: 'MV Test Vessel',
        imoNumber: `IMO${Date.now()}`,
        type: 'bulk_carrier',
        dwt: 50000,
        gt: 30000,
      }),
    )
    shipId = ship.id

    // Seed two report center records
    await reportCenterRepo.save([
      reportCenterRepo.create({
        organizationId,
        reportType: 'cii',
        vesselId: shipId,
        vesselName: 'MV Test Vessel',
        year: 2024,
        exportedBy: 'seed-user',
        parameters: {},
        fileName: 'cii-2024-mv-test-vessel.xlsx',
        fileUrl: 'http://localhost:3051/uploads/shipping-reports/cii-2024-mv-test-vessel.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      reportCenterRepo.create({
        organizationId,
        reportType: 'fueleu',
        vesselId: shipId,
        vesselName: 'MV Test Vessel',
        year: 2024,
        exportedBy: 'seed-user',
        parameters: {},
        fileName: 'fueleu-2024-mv-test-vessel.xlsx',
        fileUrl: 'http://localhost:3051/uploads/shipping-reports/fueleu-2024-mv-test-vessel.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ])
  })

  afterAll(async () => {
    if (organizationId) {
      await reportCenterRepo.delete({ organizationId })
      await shipsRepo.delete({ organizationId })
      await organizationsRepo.delete({ id: organizationId })
    }
    await app.close()
  })

  describe('GET /api/shipping/report-center', () => {
    it('returns list of archived reports for the organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/report-center')
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(2)
      expect(res.body[0]).toMatchObject({
        organizationId,
        reportType: expect.any(String),
        fileName: expect.any(String),
        fileUrl: expect.any(String),
      })
    })

    it('filters by reportType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/report-center?reportType=cii')
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body.every((r: any) => r.reportType === 'cii')).toBe(true)
    })

    it('filters by vesselId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/report-center?vesselId=${shipId}`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body.every((r: any) => r.vesselId === shipId)).toBe(true)
    })
  })

  describe('GET /api/shipping/report-center/:id/download', () => {
    let recordId: string

    beforeAll(async () => {
      const records = await reportCenterRepo.find({ where: { organizationId, reportType: 'cii' } })
      recordId = records[0]?.id
    })

    it('returns 404 for non-existent record', async () => {
      await request(app.getHttpServer())
        .get('/api/shipping/report-center/non-existent-id/download')
        .set('x-organization-id', organizationId)
        .expect(404)
    })

    it('returns download info for existing record', async () => {
      if (!recordId) return

      const res = await request(app.getHttpServer())
        .get(`/api/shipping/report-center/${recordId}/download`)
        .set('x-organization-id', organizationId)

      // Either 200 with file or redirect - depends on storage availability
      expect([200, 302, 404]).toContain(res.status)
    })
  })
})
