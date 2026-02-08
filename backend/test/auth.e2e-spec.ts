import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'

describe('Auth API (e2e)', () => {
  let app: INestApplication
  let authService: AuthService
  let usersService: UsersService

  const testUser = {
    id: '1',
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    role: 'user',
    dataScope: 'self',
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()

    authService = moduleFixture.get<AuthService>(AuthService)
    usersService = moduleFixture.get<UsersService>(UsersService)

    // Create test user
    await usersService.create(testUser)
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('access_token')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe(testUser.email)
    })

    it('should return 401 with invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })

      expect(response.status).toBe(401)
    })

    it('should return 404 with non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })

      expect(response.status).toBe(401)
    })

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/auth/logout', () => {
    let token: string

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })

      token = loginResponse.body.access_token
    })

    it('should logout authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
    })

    it('should return 401 without valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/auth/profile', () => {
    let token: string

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })

      token = loginResponse.body.access_token
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('id')
      expect(response.body.email).toBe(testUser.email)
    })

    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')

      expect(response.status).toBe(401)
    })

    it('should return 401 with expired token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid'

      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
    })
  })
})
