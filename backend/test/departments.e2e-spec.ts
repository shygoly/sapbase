import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'
import { DepartmentsService } from './departments.service'
import { AuthService } from '../auth/auth.service'
import { UsersService } from '../users/users.service'

describe('Departments API Permissions (e2e)', () => {
  let app: INestApplication
  let departmentsService: DepartmentsService
  let authService: AuthService
  let usersService: UsersService

  let superAdminToken: string
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()

    departmentsService = moduleFixture.get<DepartmentsService>(DepartmentsService)
    authService = moduleFixture.get<AuthService>(AuthService)
    usersService = moduleFixture.get<UsersService>(UsersService)

    // Create test users
    const superAdmin = await usersService.create({
      email: 'super@test.com',
      password: 'password123',
      name: 'Super Admin',
      role: 'super_admin',
      dataScope: 'all',
    })

    const admin = await usersService.create({
      email: 'admin@test.com',
      password: 'password123',
      name: 'Admin',
      role: 'admin',
      dataScope: 'organization',
    })

    const user = await usersService.create({
      email: 'user@test.com',
      password: 'password123',
      name: 'User',
      role: 'user',
      dataScope: 'self',
    })

    // Get tokens
    superAdminToken = (await authService.login(superAdmin)).access_token
    adminToken = (await authService.login(admin)).access_token
    userToken = (await authService.login(user)).access_token
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/departments', () => {
    it('should allow viewing with departments.view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should deny without permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/departments')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/departments', () => {
    it('should allow creation with departments.create permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Engineering',
          description: 'Engineering Department',
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('Engineering')
    })

    it('should deny without permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'HR',
          description: 'HR Department',
        })

      expect(response.status).toBe(403)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(response.status).toBe(400)
    })
  })

  describe('PUT /api/departments/:id', () => {
    it('should allow editing with departments.edit permission', async () => {
      const departments = await departmentsService.findAll()
      const deptId = departments[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Engineering Updated',
        })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Engineering Updated')
    })

    it('should deny without permission', async () => {
      const departments = await departmentsService.findAll()
      const deptId = departments[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked',
        })

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/departments/:id', () => {
    it('should allow deletion with departments.delete permission', async () => {
      const newDept = await departmentsService.create({
        name: 'To Delete',
        description: 'Department to delete',
      })

      const response = await request(app.getHttpServer())
        .delete(`/api/departments/${newDept.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
    })

    it('should deny without permission', async () => {
      const departments = await departmentsService.findAll()
      const deptId = departments[0].id

      const response = await request(app.getHttpServer())
        .delete(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })
  })
})
