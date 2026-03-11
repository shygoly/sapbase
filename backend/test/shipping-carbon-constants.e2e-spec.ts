import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { PermissionsGuard } from '../src/auth/permissions.guard'
import { Organization, SubscriptionStatus } from '../src/organizations/organization.entity'
import { YearParameter } from '../src/shipping-carbon/infrastructure/persistence/entities/year-parameter.entity'
import { SystemFuelType } from '../src/shipping-carbon/infrastructure/persistence/entities/system-fuel-type.entity'
import { TenantFuelType } from '../src/shipping-carbon/infrastructure/persistence/entities/tenant-fuel-type.entity'
import { CiiShipTypeParameter } from '../src/shipping-carbon/infrastructure/persistence/entities/cii-ship-type-parameter.entity'

process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || '5432'
process.env.DB_USERNAME = process.env.DB_USERNAME || 'mac'
process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
process.env.DB_NAME = process.env.DB_NAME || 'sapbasic'

function authHeaders(organizationId: string) {
  return {
    Authorization: 'Bearer test-token',
    'X-Organization-Id': organizationId,
  }
}

describe('ShippingCarbon constants CRUD (e2e)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let organizationsRepo: Repository<Organization>
  let yearParamsRepo: Repository<YearParameter>
  let systemFuelRepo: Repository<SystemFuelType>
  let tenantFuelRepo: Repository<TenantFuelType>
  let ciiShipTypeRepo: Repository<CiiShipTypeParameter>
  let organizationId: string
  let otherOrgId: string

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module')

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: 'test-user', name: 'Constants Admin', permissions: ['*'] }
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
    yearParamsRepo = moduleRef.get(getRepositoryToken(YearParameter))
    systemFuelRepo = moduleRef.get(getRepositoryToken(SystemFuelType))
    tenantFuelRepo = moduleRef.get(getRepositoryToken(TenantFuelType))
    ciiShipTypeRepo = moduleRef.get(getRepositoryToken(CiiShipTypeParameter))

    const org1 = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Constants E2E Org',
        slug: `constants-e2e-${Date.now()}`,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    organizationId = org1.id

    const org2 = await organizationsRepo.save(
      organizationsRepo.create({
        name: 'Constants E2E Other Org',
        slug: `constants-e2e-other-${Date.now()}`,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    )
    otherOrgId = org2.id
  })

  afterAll(async () => {
    try {
      if (organizationId && tenantFuelRepo) {
        await tenantFuelRepo.delete({ organizationId })
        await yearParamsRepo?.delete({ year: 2099 })
        await yearParamsRepo?.delete({ year: 2098 })
        await organizationsRepo.delete({ id: organizationId })
      }
      if (otherOrgId && tenantFuelRepo) {
        await tenantFuelRepo.delete({ organizationId: otherOrgId })
        await organizationsRepo.delete({ id: otherOrgId })
      }
      if (ciiShipTypeRepo) {
        const createdCii = await ciiShipTypeRepo.find({ where: { shipType: 'E2E-Test-Type' } })
        for (const c of createdCii) {
          await ciiShipTypeRepo.delete({ id: c.id })
        }
      }
    } finally {
      if (app) await app.close()
    }
  })

  // Prerequisite: run `npm run migration:run --workspace backend` so shipping_* tables exist
  describe('GET/POST/PATCH/DELETE /api/shipping/constants/years', () => {
    it('lists year parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/constants/years')
        .set(authHeaders(organizationId))

      expect(res.status).toBe(200)
      const list = Array.isArray(res.body) ? res.body : res.body?.data ?? res.body?.items ?? []
      expect(list.length).toBeGreaterThanOrEqual(0)
      const first = list[0]
      expect(first).toHaveProperty('year')
      expect(first).toHaveProperty('fuelEuTarget')
      expect(first).toHaveProperty('etsCoverageRatio')
      expect(first).toHaveProperty('euaPrice')
    })

    it('creates a new year parameter', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/shipping/constants/years')
        .set(authHeaders(organizationId))
        .send({
          year: 2099,
          fuelEuTarget: 85,
          etsCoverageRatio: 1,
          euaPrice: 0.1,
        })

      expect(createRes.status).toBe(201)
      expect(createRes.body.year).toBe(2099)
      expect(createRes.body.fuelEuTarget).toBe(85)
      expect(createRes.body.euaPrice).toBe(0.1)
    })

    it('rejects duplicate year creation', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/shipping/constants/years')
        .set(authHeaders(organizationId))
        .send({
          year: 2099,
          fuelEuTarget: 86,
          etsCoverageRatio: 1,
          euaPrice: 0.11,
        })

      expect(createRes.status).toBe(400)
    })

    it('updates a year parameter', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/years')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const year2099 = list.find((r: any) => r.year === 2099)
      expect(year2099).toBeDefined()

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/shipping/constants/years/${year2099.id}`)
        .set(authHeaders(organizationId))
        .send({ fuelEuTarget: 84, euaPrice: 0.105 })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.fuelEuTarget).toBe(84)
      expect(patchRes.body.euaPrice).toBe(0.105)
    })

    it('deletes a year parameter', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/years')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const year2099 = list.find((r: any) => r.year === 2099)
      expect(year2099).toBeDefined()

      const delRes = await request(app.getHttpServer())
        .delete(`/api/shipping/constants/years/${year2099.id}`)
        .set(authHeaders(organizationId))

      expect(delRes.status).toBe(200)
    })

    it('rejects invalid payload for create', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shipping/constants/years')
        .set(authHeaders(organizationId))
        .send({ year: 1800, fuelEuTarget: 50 })
      expect(res.status).toBe(400)
    })
  })

  describe('GET/POST/PATCH/DELETE /api/shipping/constants/fuels/system', () => {
    it('lists system and tenant fuel types for current org', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))

      expect(res.status).toBe(200)
      const list = Array.isArray(res.body) ? res.body : res.body.data ?? res.body.items ?? []
      expect(list.length).toBeGreaterThanOrEqual(1)
      const first = list[0]
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('code')
      expect(first).toHaveProperty('co2Factor')
    })

    it('creates tenant-private fuel type', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))
        .send({
          name: 'E2E-Tenant-Fuel',
          code: 'E2ETF',
          lcv: 41,
          wellToTankFactor: 14,
          tankToWakeFactor: 74,
          co2eqWtw: 0,
          co2Factor: 3.1,
          gwpCo2: 1,
          gwpCh4: 28,
          gwpN2o: 265,
          slipFactor: 0,
          defaultPrice: 600,
          scope: 'tenant',
        })

      expect(createRes.status).toBe(201)
      expect(createRes.body.name).toBe('E2E-Tenant-Fuel')
      expect(createRes.body.code).toBe('E2ETF')
    })

    it('tenant fuel is visible only to its org', async () => {
      const resOrg1 = await request(app.getHttpServer())
        .get('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))
      const resOrg2 = await request(app.getHttpServer())
        .get('/api/shipping/constants/fuels/system')
        .set(authHeaders(otherOrgId))

      const list1 = Array.isArray(resOrg1.body) ? resOrg1.body : resOrg1.body.data ?? resOrg1.body.items ?? []
      const list2 = Array.isArray(resOrg2.body) ? resOrg2.body : resOrg2.body.data ?? resOrg2.body.items ?? []
      const e2eFuel1 = list1.find((f: any) => f.name === 'E2E-Tenant-Fuel')
      const e2eFuel2 = list2.find((f: any) => f.name === 'E2E-Tenant-Fuel')
      expect(e2eFuel1).toBeDefined()
      expect(e2eFuel2).toBeUndefined()
    })

    it('updates tenant fuel type', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const fuel = list.find((f: any) => f.name === 'E2E-Tenant-Fuel')
      expect(fuel).toBeDefined()

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/shipping/constants/fuels/system/${fuel.id}`)
        .set(authHeaders(organizationId))
        .send({ defaultPrice: 620, co2Factor: 3.12 })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.defaultPrice).toBe(620)
    })

    it('deletes tenant fuel type', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const fuel = list.find((f: any) => f.name === 'E2E-Tenant-Fuel')
      expect(fuel).toBeDefined()

      const delRes = await request(app.getHttpServer())
        .delete(`/api/shipping/constants/fuels/system/${fuel.id}`)
        .set(authHeaders(organizationId))

      expect(delRes.status).toBe(200)
    })

    it('rejects invalid fuel payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shipping/constants/fuels/system')
        .set(authHeaders(organizationId))
        .send({ name: '', co2Factor: -1 })
      expect(res.status).toBe(400)
    })
  })

  describe('GET/POST/PATCH/DELETE /api/shipping/constants/cii-ship-types', () => {
    it('lists CII ship type parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shipping/constants/cii-ship-types')
        .set(authHeaders(organizationId))

      expect(res.status).toBe(200)
      const list = Array.isArray(res.body) ? res.body : res.body.data ?? res.body.items ?? []
      expect(list.length).toBeGreaterThanOrEqual(1)
      const first = list[0]
      expect(first).toHaveProperty('shipType')
      expect(first).toHaveProperty('applicableStandard')
      expect(first).toHaveProperty('rangeMin')
      expect(first).toHaveProperty('referenceCii')
    })

    it('creates a new CII ship type parameter', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/shipping/constants/cii-ship-types')
        .set(authHeaders(organizationId))
        .send({
          shipType: 'E2E-Test-Type',
          applicableStandard: 'DWT',
          rangeMin: 0,
          rangeMax: 100000,
          referenceCii: 4.8,
          requiredCii: 4.5,
          d1: 0.82,
          d2: 0.93,
          d3: 1.08,
          d4: 1.28,
          correctionFactor: 1,
          useMax: false,
        })

      expect(createRes.status).toBe(201)
      expect(createRes.body.shipType).toBe('E2E-Test-Type')
      expect(createRes.body.rangeMin).toBe(0)
      expect(createRes.body.rangeMax).toBe(100000)
    })

    it('updates CII ship type parameter', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/cii-ship-types')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const param = list.find((r: any) => r.shipType === 'E2E-Test-Type')
      expect(param).toBeDefined()

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/shipping/constants/cii-ship-types/${param.id}`)
        .set(authHeaders(organizationId))
        .send({ referenceCii: 4.7, requiredCii: 4.4 })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.referenceCii).toBe(4.7)
    })

    it('deletes CII ship type parameter', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/shipping/constants/cii-ship-types')
        .set(authHeaders(organizationId))
      const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data ?? listRes.body.items ?? []
      const param = list.find((r: any) => r.shipType === 'E2E-Test-Type')
      expect(param).toBeDefined()

      const delRes = await request(app.getHttpServer())
        .delete(`/api/shipping/constants/cii-ship-types/${param.id}`)
        .set(authHeaders(organizationId))

      expect(delRes.status).toBe(200)
    })

    it('rejects invalid CII payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shipping/constants/cii-ship-types')
        .set(authHeaders(organizationId))
        .send({ shipType: '', rangeMin: -1 })
      expect(res.status).toBe(400)
    })
  })
})
