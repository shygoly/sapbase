import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { PermissionsGuard } from '../src/auth/permissions.guard'
import { Organization, SubscriptionStatus } from '../src/organizations/organization.entity'
import { Ship } from '../src/shipping-carbon/ship.entity'
import { Charter } from '../src/shipping-carbon/charter.entity'
import { Voyage } from '../src/shipping-carbon/voyage.entity'
import { ReportCenterRecord } from '../src/shipping-carbon/report-center-record.entity'
import { ReportSnapshot } from '../src/shipping-carbon/report-snapshot.entity'
import { FueleuComplianceHistory } from '../src/shipping-carbon/fueleu-compliance-history.entity'

describe('ShippingCarbon penalty history (e2e)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let organizationsRepo: Repository<Organization>
  let shipsRepo: Repository<Ship>
  let chartersRepo: Repository<Charter>
  let voyagesRepo: Repository<Voyage>
  let reportCenterRepo: Repository<ReportCenterRecord>
  let snapshotsRepo: Repository<ReportSnapshot>
  let complianceHistoryRepo: Repository<FueleuComplianceHistory>
  let organizationId: string

  beforeAll(async () => {
    process.env.DB_HOST = process.env.DB_HOST || 'localhost'
    process.env.DB_PORT = process.env.DB_PORT || '5432'
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'mac'
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
    process.env.DB_NAME = process.env.DB_NAME || 'carbon'

    const { AppModule } = await import('../src/app.module')
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: 'test-user', name: 'Penalty Admin', permissions: ['*'] }
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
    chartersRepo = moduleRef.get(getRepositoryToken(Charter))
    voyagesRepo = moduleRef.get(getRepositoryToken(Voyage))
    reportCenterRepo = moduleRef.get(getRepositoryToken(ReportCenterRecord))
    snapshotsRepo = moduleRef.get(getRepositoryToken(ReportSnapshot))
    complianceHistoryRepo = moduleRef.get(getRepositoryToken(FueleuComplianceHistory))

    const organization = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Shipping Carbon Penalty E2E',
        slug: `shipping-carbon-penalty-${Date.now()}`,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    organizationId = organization.id
  })

  afterAll(async () => {
    if (organizationId) {
      await reportCenterRepo.delete({ organizationId })
      await snapshotsRepo.delete({ organizationId })
      await complianceHistoryRepo.delete({ organizationId })
      await voyagesRepo.delete({ organizationId })
      await chartersRepo.delete({ organizationId })
      await shipsRepo.delete({ organizationId })
      await organizationsRepo.delete({ id: organizationId })
    }
    if (app) await app.close()
  })

  it('creates and lists FuelEU penalty history records', async () => {
    const shipsResponse = await request(app.getHttpServer())
      .get('/api/shipping/ships')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    const shipId = shipsResponse.body[0].id

    const createResponse = await request(app.getHttpServer())
      .post('/api/shipping/penalty-history')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)
      .send({
        shipId,
        year: 2025,
        isNonCompliant: true,
        penaltyMultiplier: 1.35,
        note: 'manual override',
      })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.shipId).toBe(shipId)
    expect(createResponse.body.penaltyMultiplier).toBe(1.35)

    const listResponse = await request(app.getHttpServer())
      .get('/api/shipping/penalty-history')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(listResponse.status).toBe(200)
    expect(listResponse.body).toHaveLength(1)
    expect(listResponse.body[0]).toMatchObject({ shipId, year: 2025, isNonCompliant: true })
  })
})
