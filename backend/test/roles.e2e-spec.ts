import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'
import { RolesService } from './roles.service'
import { AuthService } from '../auth/auth.service'
import { UsersService } from '../users/users.service'

describe('Roles API Permissions (e2e)', () => {
  let app: INestApplication
  let rolesService: RolesService
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

    rolesService = moduleFixture.get<RolesService>(RolesService)
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

  describe('GET /api/roles', () => {
    it('should allow viewing with roles.view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should deny without permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/roles')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/roles', () => {
    it('should allow creation with roles.create permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Developer',
          permissions: ['users.view', 'departments.view'],
        })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('Developer')
    })

    it('should deny without permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Manager',
          permissions: ['users.view'],
        })

      expect(response.status).toBe(403)
    })

    it('should validate permission strings', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid',
          permissions: ['invalid.permission'],
        })

      expect(response.status).toBe(400)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(response.status).toBe(400)
    })
  })

  describe('PUT /api/roles/:id', () => {
    it('should allow editing with roles.edit permission', async () => {
      const roles = await rolesService.findAll()
      const roleId = roles[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Developer Updated',
        })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Developer Updated')
    })

    it('should deny without permission', async () => {
      const roles = await rolesService.findAll()
      const roleId = roles[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked',
        })

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/roles/:id', () => {
    it('should allow deletion with roles.delete permission', async () => {
      const newRole = await rolesService.create({
        name: 'To Delete',
        permissions: ['users.view'],
      })

      const response = await request(app.getHttpServer())
        .delete(`/api/roles/${newRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
    })

    it('should deny without permission', async () => {
      const roles = await rolesService.findAll()
      const roleId = roles[0].id

      const response = await request(app.getHttpServer())
        .delete(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should prevent deletion of system roles', async () => {
      const roles = await rolesService.findAll()
      const systemRole = roles.find(r => r.name === 'super_admin')

      if (systemRole) {
        const response = await request(app.getHttpServer())
          .delete(`/api/roles/${systemRole.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)

        expect(response.status).toBe(400)
      }
    })
  })
})
