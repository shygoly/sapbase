import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { PermissionsGuard } from '../src/auth/permissions.guard'
import { Organization, SubscriptionStatus } from '../src/organizations/organization.entity'
import { Ship } from '../src/shipping-carbon/infrastructure/persistence/entities/ship.entity'
import { Charter } from '../src/shipping-carbon/infrastructure/persistence/entities/charter.entity'
import { Voyage } from '../src/shipping-carbon/infrastructure/persistence/entities/voyage.entity'

describe('ShippingCarbon dashboard overview (e2e)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let organizationsRepo: Repository<Organization>
  let shipsRepo: Repository<Ship>
  let chartersRepo: Repository<Charter>
  let voyagesRepo: Repository<Voyage>
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
          req.user = { id: 'test-user', name: 'Dashboard User', permissions: ['*'] }
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

    const org = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Dashboard Overview E2E Org',
        slug: `dashboard-overview-e2e-${Date.now()}`,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    organizationId = org.id

    const ship = await shipsRepo.save(
      shipsRepo.create({
        organizationId,
        name: 'MV Overview Vessel',
        imoNumber: `IMO${Date.now()}`,
        type: 'bulk_carrier',
        dwt: 60000,
        gt: 35000,
      }),
    )
    shipId = ship.id

    const charter = await chartersRepo.save(
      chartersRepo.create({
        organizationId,
        shipId,
        chartererName: 'Overview Charterer',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      }),
    )

    await voyagesRepo.save(
      voyagesRepo.create({
        organizationId,
        shipId,
        charterId: charter.id,
        voyageNumber: 'OV-001',
        departurePort: 'CNSHA',
        arrivalPort: 'NLRTM',
        departureDate: new Date('2024-03-01'),
        arrivalDate: new Date('2024-03-20'),
        distanceNm: 11000,
        cargoTonnes: 45000,
        status: 'CLAIMED',
      }),
    )
  })

  afterAll(async () => {
    if (organizationId) {
      await voyagesRepo.delete({ organizationId })
      await chartersRepo.delete({ organizationId })
      await shipsRepo.delete({ organizationId })
      await organizationsRepo.delete({ id: organizationId })
    }
    await app.close()
  })

  describe('GET /api/shipping/reports/home-overview', () => {
    it('returns 200 with valid report structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/home-overview?shipId=${shipId}&year=2024`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toMatchObject({
        metrics: expect.any(Array),
        rows: expect.any(Array),
      })
    })

    it('metrics array contains objects with label and value fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/home-overview?shipId=${shipId}&year=2024`)
        .set('x-organization-id', organizationId)
        .expect(200)

      for (const metric of res.body.metrics) {
        expect(metric).toHaveProperty('label')
        expect(metric).toHaveProperty('value')
      }
    })

    it('returns report without shipId filter (fleet-level)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/reports/home-overview?year=2024')
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toHaveProperty('metrics')
      expect(res.body).toHaveProperty('rows')
    })

    it('returns report without year filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/home-overview?shipId=${shipId}`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toHaveProperty('metrics')
    })
  })

  describe('GET /api/shipping/reports/cii', () => {
    it('returns 200 with CII report structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/cii?shipId=${shipId}&year=2024`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toMatchObject({
        metrics: expect.any(Array),
        rows: expect.any(Array),
      })
    })
  })

  describe('GET /api/shipping/reports/fueleu', () => {
    it('returns 200 with FuelEU report structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/fueleu?shipId=${shipId}&year=2024`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toMatchObject({
        metrics: expect.any(Array),
        rows: expect.any(Array),
      })
    })
  })

  describe('GET /api/shipping/reports/eu-ets', () => {
    it('returns 200 with EU ETS report structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/shipping/reports/eu-ets?shipId=${shipId}&year=2024`)
        .set('x-organization-id', organizationId)
        .expect(200)

      expect(res.body).toMatchObject({
        metrics: expect.any(Array),
        rows: expect.any(Array),
      })
    })
  })
})
