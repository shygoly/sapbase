import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'
import { UsersService } from './users.service'
import { AuthService } from '../auth/auth.service'

describe('Users API Permissions (e2e)', () => {
  let app: INestApplication
  let usersService: UsersService
  let authService: AuthService

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

    usersService = moduleFixture.get<UsersService>(UsersService)
    authService = moduleFixture.get<AuthService>(AuthService)

    // Create test users with different roles
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

  describe('GET /api/users', () => {
    it('should allow super_admin to view all users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should allow admin with users.view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should deny user without users.view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/users', () => {
    it('should allow user with users.create permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
        })

      expect(response.status).toBe(201)
      expect(response.body.email).toBe('newuser@test.com')
    })

    it('should deny user without users.create permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'another@test.com',
          password: 'password123',
          name: 'Another User',
        })

      expect(response.status).toBe(403)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(response.status).toBe(400)
    })
  })

  describe('PUT /api/users/:id', () => {
    it('should allow editing with users.edit permission', async () => {
      const users = await usersService.findAll()
      const userId = users[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
        })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Updated Name')
    })

    it('should deny editing without permission', async () => {
      const users = await usersService.findAll()
      const userId = users[0].id

      const response = await request(app.getHttpServer())
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Name',
        })

      expect(response.status).toBe(403)
    })

    it('should allow self-edit for own profile', async () => {
      const users = await usersService.findAll()
      const currentUser = users.find(u => u.email === 'user@test.com')

      const response = await request(app.getHttpServer())
        .put(`/api/users/${currentUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Self Updated',
        })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Self Updated')
    })
  })

  describe('DELETE /api/users/:id', () => {
    it('should allow deletion with users.delete permission', async () => {
      const newUser = await usersService.create({
        email: 'todelete@test.com',
        password: 'password123',
        name: 'To Delete',
      })

      const response = await request(app.getHttpServer())
        .delete(`/api/users/${newUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
    })

    it('should deny deletion without permission', async () => {
      const users = await usersService.findAll()
      const userId = users[0].id

      const response = await request(app.getHttpServer())
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should deny self-deletion', async () => {
      const users = await usersService.findAll()
      const currentUser = users.find(u => u.email === 'admin@test.com')

      const response = await request(app.getHttpServer())
        .delete(`/api/users/${currentUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(400)
    })
  })
})
