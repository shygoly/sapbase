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

process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || '5432'
process.env.DB_USERNAME = process.env.DB_USERNAME || 'mac'
process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
process.env.DB_NAME = process.env.DB_NAME || 'carbon'

describe('ShippingCarbon fuel basis switching (e2e)', () => {
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
    const { AppModule } = await import('../src/app.module')

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: 'test-user', name: 'Basis User', permissions: ['*'] }
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
        name: 'Shipping Carbon Basis E2E',
        slug: `shipping-carbon-basis-${Date.now()}`,
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

  it('returns different fuel cost metrics when switching between system and tenant basis', async () => {
    const shipsResponse = await request(app.getHttpServer())
      .get('/api/shipping/ships')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(shipsResponse.status).toBe(200)
    const shipId = shipsResponse.body[0].id

    const systemResponse = await request(app.getHttpServer())
      .get('/api/shipping/reports/fuel-cost')
      .query({ shipId, year: 2025, fuelBasis: 'system' })
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    const tenantResponse = await request(app.getHttpServer())
      .get('/api/shipping/reports/fuel-cost')
      .query({ shipId, year: 2025, fuelBasis: 'tenant' })
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', organizationId)

    expect(systemResponse.status).toBe(200)
    expect(tenantResponse.status).toBe(200)

    const systemTotal = systemResponse.body.metrics.find((item: any) => item.label === 'Total Fuel Cost')?.value
    const tenantTotal = tenantResponse.body.metrics.find((item: any) => item.label === 'Total Fuel Cost')?.value
    const systemAverage = systemResponse.body.metrics.find((item: any) => item.label === 'Average Cost / t')?.value
    const tenantAverage = tenantResponse.body.metrics.find((item: any) => item.label === 'Average Cost / t')?.value

    expect(systemTotal).toBeDefined()
    expect(tenantTotal).toBeDefined()
    expect(systemTotal).not.toBe(tenantTotal)
    expect(systemAverage).not.toBe(tenantAverage)
  })
})
