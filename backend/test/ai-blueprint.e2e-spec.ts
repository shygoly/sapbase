/**
 * A2：AI mergedDefinition → 既有打包/编译/授权/签名链。
 * 复用 packBlueprint + deliver，不新开交付路径。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { unpackBlueprint } from '../src/blueprint/packager'
import {
  definitionToBlueprint,
  writeBlueprintDir,
} from '../src/ai-modules/definition-to-blueprint'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { OUTBOX_DDL } from '../src/outbox/outbox.ddl'
import { NOTIFICATIONS_DDL } from '../src/notifications/notification.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '66666666-6666-6666-6666-666666666666'
const PACKAGE_ID = 'ai-ticket-1.0.0'

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

/** 六步真实键；无 rules / 无 transition.action ⇒ 缺层、flows 为空，不编占位规则。 */
function mergedWithoutRules(): Record<string, unknown> {
  return {
    objectModel: {
      entities: [
        {
          identifier: 'Ticket',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'priority', type: 'number' },
          ],
        },
      ],
    },
    relationships: { relationships: [] },
    stateFlow: {
      states: [
        { name: 'draft', initial: true },
        { name: 'open' },
        { name: 'closed', final: true },
      ],
      transitions: [
        { from: 'draft', to: 'open' },
        { from: 'open', to: 'closed' },
      ],
    },
    pages: { pages: [] },
    permissions: { rules: [{ role: 'agent', scope: 'own', resources: ['Ticket'] }] },
    reports: { reports: [] },
  }
}

describe('AI 产物进既有蓝图链（A1/A2 e2e）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let templatesDir: string
  let keys: { publicPem: string; privatePem: string }
  let savedPublicKeys: string | undefined
  let savedPrivateKey: string | undefined
  let savedUnsigned: string | undefined
  let savedTemplates: string | undefined

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-ai-pkgs-'))
    templatesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-ai-tpl-'))
    const layers = definitionToBlueprint(mergedWithoutRules())
    expect(layers.rules).toBeUndefined()
    writeBlueprintDir(join(templatesDir, 'ai-ticket'), layers, {
      blueprint: 'ai-ticket',
      version: '1.0.0',
      runtime: '>=1.0.0 <2.0.0',
    })

    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    savedTemplates = process.env.BLUEPRINT_TEMPLATES_DIR
    process.env.BLUEPRINT_TEMPLATES_DIR = templatesDir
    savedUnsigned = process.env.BLUEPRINT_ALLOW_UNSIGNED
    delete process.env.BLUEPRINT_ALLOW_UNSIGNED

    keys = generatePemPair()
    savedPublicKeys = process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    savedPrivateKey = process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = JSON.stringify([keys.publicPem])
    process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = keys.privatePem

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'mac',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'sapbasic',
          entities: [join(__dirname, '../src/**/*.entity.ts')],
          synchronize: false,
        }),
        AtomicRegistryModule,
        AtomicRuntimeModule,
        BlueprintModule,
        SemanticRuntimeModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: Record<string, unknown> }
          }
        }) => {
          context.switchToHttp().getRequest().user = {
            id: 'e2e-ai-user',
            userId: 'e2e-ai-user',
            email: 'ai-blueprint@test.local',
            organizationId: ORGANIZATION_ID,
            permissions: [],
          }
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)

    try {
      await dataSource.query('SELECT 1 FROM atomic_contracts LIMIT 1')
      for (const statement of BLUEPRINT_RECORDS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_DOC_COUNTERS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_APPROVALS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_JOURNAL_ENTRIES_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of OUTBOX_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of NOTIFICATIONS_DDL) {
        await dataSource.query(statement)
      }
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
    }

    if (available) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-ai', 'e2e-ai', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
    }
  })

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID]).catch(() => undefined)
    }
    await app?.close()
    delete process.env.BLUEPRINT_PACKAGES_DIR
    if (savedTemplates === undefined) delete process.env.BLUEPRINT_TEMPLATES_DIR
    else process.env.BLUEPRINT_TEMPLATES_DIR = savedTemplates
    if (savedPublicKeys === undefined) delete process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    else process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = savedPublicKeys
    if (savedPrivateKey === undefined) delete process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    else process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = savedPrivateKey
    if (savedUnsigned === undefined) delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    else process.env.BLUEPRINT_ALLOW_UNSIGNED = savedUnsigned
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true })
    if (templatesDir) rmSync(templatesDir, { recursive: true, force: true })
  })

  it('转换 → deliver（pack/compile/stamp/sign）→ 装载；包内无 rules.json', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表或无法建表')
      return
    }

    const delivered = await request(app.getHttpServer())
      .post('/blueprints/ai-ticket/deliver')
      .send({
        grantedTo: [ORGANIZATION_ID],
        resell: false,
        expiresAt: '2027-09-25T00:00:00Z',
        issuer: 'sapbase-platform',
      })
      .expect(200)

    expect(delivered.body.id).toBe(PACKAGE_ID)
    expect(delivered.body.manifest.compiled.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(delivered.body.manifest.signature).toBeDefined()
    expect(delivered.body.manifest.files['rules.json']).toBeUndefined()
    expect(delivered.body.manifest.files['experience.json']).toBeUndefined()
    expect(delivered.body.manifest.files['semantic.json']).toBeDefined()
    expect(delivered.body.manifest.files['flows.json']).toBeDefined()

    await request(app.getHttpServer()).post(`/blueprints/${PACKAGE_ID}/load`).expect(200)

    const pkg = join(packagesDir, `${PACKAGE_ID}.erpkg`)
    const unpacked = unpackBlueprint(pkg)
    expect(unpacked.manifest.compiled?.irDigest).toBe(delivered.body.manifest.compiled.irDigest)
    expect(unpacked.manifest.signature).toBeDefined()
    expect(Object.keys(unpacked.manifest.files)).not.toContain('rules.json')
  })
})
