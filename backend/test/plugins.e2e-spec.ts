import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin as PluginOrm } from '../src/plugins/infrastructure/persistence/plugin.entity'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as AdmZip from 'adm-zip'

describe('Plugins (e2e)', () => {
  let app: INestApplication
  let pluginRepository: Repository<PluginOrm>
  let authToken: string
  let testOrgId: string
  let testZipPath: string
  let testPluginsDir: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    pluginRepository = moduleFixture.get<Repository<PluginOrm>>(
      getRepositoryToken(PluginOrm),
    )

    // Create test plugin ZIP
    testPluginsDir = path.join(process.cwd(), 'test-plugins')
    await fs.mkdir(testPluginsDir, { recursive: true })
    testZipPath = path.join(testPluginsDir, 'test-plugin.zip')

    const manifest = {
      name: 'e2e-test-plugin',
      version: '1.0.0',
      type: 'integration',
      description: 'E2E test plugin',
      permissions: {
        api: {
          endpoints: ['/api/test'],
          methods: ['GET'],
        },
      },
      entry: {
        backend: 'index.js',
      },
    }

    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('index.js', Buffer.from('module.exports = class TestPlugin {}'))
    zip.writeZip(testZipPath)

    // Setup auth (simplified - adjust based on your auth setup)
    // This is a placeholder - you'll need to implement actual auth
    authToken = 'test-token'
    testOrgId = 'test-org-1'
  })

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testPluginsDir, { recursive: true, force: true })
    } catch {}
    await app.close()
  })

  beforeEach(async () => {
    // Clean database before each test
    await pluginRepository.delete({})
  })

  describe('/api/plugins (POST)', () => {
    it('should install plugin from ZIP file', async () => {
      const zipBuffer = await fs.readFile(testZipPath)

      const response = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe('e2e-test-plugin')
      expect(response.body.version).toBe('1.0.0')
    })

    it('should reject invalid ZIP file', async () => {
      const invalidBuffer = Buffer.from('not a zip file')

      await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', invalidBuffer, 'invalid.zip')
        .expect(400)
    })
  })

  describe('/api/plugins (GET)', () => {
    it('should list installed plugins', async () => {
      // First install a plugin
      const zipBuffer = await fs.readFile(testZipPath)
      const installResponse = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')

      const pluginId = installResponse.body.id

      // Then list plugins
      const response = await request(app.getHttpServer())
        .get('/api/plugins')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body.some((p: any) => p.id === pluginId)).toBe(true)
    })
  })

  describe('/api/plugins/:id (GET)', () => {
    it('should get plugin metadata', async () => {
      // Install plugin first
      const zipBuffer = await fs.readFile(testZipPath)
      const installResponse = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')

      const pluginId = installResponse.body.id

      // Get plugin details
      const response = await request(app.getHttpServer())
        .get(`/api/plugins/${pluginId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.id).toBe(pluginId)
      expect(response.body.name).toBe('e2e-test-plugin')
    })
  })

  describe('/api/plugins/:id/activate (POST)', () => {
    it('should activate plugin', async () => {
      // Install plugin first
      const zipBuffer = await fs.readFile(testZipPath)
      const installResponse = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')

      const pluginId = installResponse.body.id

      // Activate plugin
      const response = await request(app.getHttpServer())
        .post(`/api/plugins/${pluginId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('active')
    })
  })

  describe('/api/plugins/:id/deactivate (POST)', () => {
    it('should deactivate plugin', async () => {
      // Install and activate plugin first
      const zipBuffer = await fs.readFile(testZipPath)
      const installResponse = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')

      const pluginId = installResponse.body.id

      await request(app.getHttpServer())
        .post(`/api/plugins/${pluginId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)

      // Deactivate plugin
      const response = await request(app.getHttpServer())
        .post(`/api/plugins/${pluginId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('inactive')
    })
  })

  describe('/api/plugins/:id (DELETE)', () => {
    it('should uninstall plugin', async () => {
      // Install plugin first
      const zipBuffer = await fs.readFile(testZipPath)
      const installResponse = await request(app.getHttpServer())
        .post('/api/plugins/install')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBuffer, 'test-plugin.zip')

      const pluginId = installResponse.body.id

      // Uninstall plugin
      await request(app.getHttpServer())
        .delete(`/api/plugins/${pluginId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      // Verify plugin is removed
      await request(app.getHttpServer())
        .get(`/api/plugins/${pluginId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
    })
  })

  describe('/api/plugins/registry (GET)', () => {
    it('should list available plugins in registry', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/plugins/registry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('plugins')
      expect(Array.isArray(response.body.plugins)).toBe(true)
    })
  })
})
