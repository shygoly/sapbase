/**
 * Patch DSL unit/integration tests.
 *
 * Run: npm run test:patch-dsl
 * Uses ts-node + tsconfig paths so the TypeScript libs can be imported directly.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true },
})
const tsconfig = require('../tsconfig.base.json')
require('tsconfig-paths').register({
  baseUrl: tsconfig.compilerOptions.baseUrl,
  paths: tsconfig.compilerOptions.paths,
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { SchemaRegistry } = require('../libs/app-shared/src/core/schema/registry')
const { SchemaResolver } = require('../libs/app-shared/src/core/schema/resolver')
const { PatchValidator } = require('../libs/app-shared/src/core/patch/validator')
const { PatchExecutor } = require('../libs/app-shared/src/core/patch/executor')
const { VersionControl } = require('../libs/app-shared/src/core/patch/version-control')
const { AuditLogger } = require('../libs/app-shared/src/core/patch/audit-logger')
const { HotReloader } = require('../libs/app-shared/src/core/patch/hot-reload')
const { PatchManager } = require('../libs/app-shared/src/core/patch/patch-manager')
const { PatchRateLimiter } = require('../libs/app-shared/src/core/patch/rate-limiter')
const {
  PatchHelpers,
  PATCH_GENERATION_TOOL_DEFINITION,
} = require('../libs/app-shared/src/core/patch/gateway')

let seq = 0
function uuid() {
  seq += 1
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
}

function objectSchema(overrides = {}) {
  return {
    name: 'Customer',
    label: 'Customer',
    version: '1',
    fields: [
      { name: 'id', label: 'ID', type: 'text' },
      { name: 'name', label: 'Name', type: 'text' },
    ],
    ...overrides,
  }
}

function pageSchema() {
  return {
    path: 'customers',
    view: 'customer-list',
    version: '1',
    metadata: { title: 'Customers' },
  }
}

function viewSchema() {
  return {
    name: 'customer-list',
    type: 'list',
    object: 'Customer',
    version: '1',
  }
}

function patch(overrides = {}) {
  return {
    version: '1.0',
    patchId: uuid(),
    timestamp: new Date().toISOString(),
    actor: 'ai',
    scope: 'object',
    operation: 'add',
    target: { type: 'field', identifier: 'Customer' },
    payload: { field: { name: 'email', label: 'Email', type: 'email' } },
    ...overrides,
  }
}

function registryWithSchemas() {
  const registry = new SchemaRegistry()
  registry.registerObject('Customer', objectSchema())
  registry.registerPage('customers', pageSchema())
  registry.registerView('customer-list', viewSchema())
  return registry
}

test('JSON schema exists and declares the Patch DSL contract', () => {
  const schemaPath = path.join(__dirname, '..', 'schemas', 'patch-dsl.schema.json')
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#')
  assert.deepEqual(schema.required, [
    'version',
    'patchId',
    'timestamp',
    'actor',
    'scope',
    'operation',
    'target',
    'payload',
  ])
  assert.deepEqual(schema.properties.scope.enum, [
    'page',
    'object',
    'permission',
    'state',
    'menu',
  ])
})

test('validator: valid patch and L1/L2/L3 classification', () => {
  const validator = new PatchValidator(registryWithSchemas())

  const addField = validator.validate(patch())
  assert.equal(addField.valid, true)
  assert.equal(addField.securityLevel, 'L1')

  const updateField = validator.validate(
    patch({
      operation: 'update',
      payload: { field: { name: 'name', label: 'Full name' } },
    }),
  )
  assert.equal(updateField.valid, true)
  assert.equal(updateField.securityLevel, 'L2')

  const permissionUpdate = validator.validate(
    patch({
      scope: 'permission',
      operation: 'update',
      target: { type: 'role', identifier: 'sales' },
      payload: { rights: [] },
    }),
  )
  assert.equal(permissionUpdate.securityLevel, 'L3')
})

test('validator: structure, core fields, component, type and escalation guards', () => {
  const validator = new PatchValidator(registryWithSchemas())

  assert.match(
    validator.validate(patch({ version: '2.0' })).errors.join(' '),
    /version/,
  )
  assert.match(
    validator.validate(patch({ patchId: 'not-a-uuid' })).errors.join(' '),
    /UUID/,
  )
  assert.match(
    validator.validate(
      patch({
        operation: 'remove',
        payload: { field: { name: 'id', label: 'ID' } },
      }),
    ).errors.join(' '),
    /system core field/,
  )
  assert.match(
    validator.validate(
      patch({ payload: { field: { name: 'x', label: 'X', component: 'Unknown' } } }),
    ).errors.join(' '),
    /Invalid component/,
  )
  assert.match(
    validator.validate(
      patch({ payload: { field: { name: 'x', label: 'X', type: 'bad-type' } } }),
    ).errors.join(' '),
    /Invalid field type/,
  )
  assert.match(
    validator.validate(
      patch({
        scope: 'permission',
        operation: 'add',
        target: { type: 'role', identifier: 'sales' },
        payload: { allow: ['users:delete'] },
      }),
      ['users:read'],
    ).errors.join(' '),
    /exceeding actor/,
  )
  assert.match(
    validator.validate(
      patch({
        scope: 'page',
        operation: 'update',
        target: { type: 'page', identifier: 'missing-page' },
        payload: { metadata: { title: 'X' } },
      }),
    ).errors.join(' '),
    /does not exist/,
  )
})

test('executor: add/update/remove object fields and page metadata', async () => {
  const registry = registryWithSchemas()
  const executor = new PatchExecutor(registry)

  const added = await executor.execute(patch())
  assert.equal(added.success, true)
  assert.ok(added.changes.after.fields.some((field) => field.name === 'email'))

  const updated = await executor.execute(
    patch({
      operation: 'update',
      payload: { field: { name: 'email', label: 'Work email' } },
    }),
    added.changes.after,
  )
  assert.equal(updated.success, true)
  assert.equal(
    updated.changes.after.fields.find((field) => field.name === 'email').label,
    'Work email',
  )

  const removed = await executor.execute(
    patch({
      operation: 'remove',
      payload: { field: { name: 'email', label: 'Email' } },
    }),
    updated.changes.after,
  )
  assert.equal(removed.success, true)
  assert.ok(!removed.changes.after.fields.some((field) => field.name === 'email'))

  const page = await executor.execute(
    patch({
      scope: 'page',
      operation: 'update',
      target: { type: 'page', identifier: 'customers' },
      payload: { metadata: { title: 'Customer list', description: 'All customers' } },
    }),
  )
  assert.equal(page.success, true)
  assert.equal(page.changes.after.metadata.title, 'Customer list')
  assert.equal(page.changes.after.metadata.description, 'All customers')
})

test('executor: permission/state/menu scopes', async () => {
  const registry = registryWithSchemas()
  const executor = new PatchExecutor(registry)

  const permission = await executor.execute(
    patch({
      scope: 'permission',
      operation: 'replace',
      target: { type: 'object', identifier: 'Customer' },
      payload: { permissions: { view: ['sales'], edit: ['admin'] } },
    }),
  )
  assert.equal(permission.success, true)
  assert.deepEqual(permission.changes.after.permissions.view, ['sales'])

  const state = await executor.execute(
    patch({
      scope: 'state',
      operation: 'add',
      target: { type: 'object', identifier: 'Customer' },
      payload: { state: { name: 'active', transitions: ['suspended'] } },
    }),
  )
  assert.equal(state.success, true)
  assert.match(state.changes.after.stateMachine, /active/)

  const menu = await executor.execute(
    patch({
      scope: 'menu',
      operation: 'add',
      target: { type: 'menu', identifier: 'customers' },
      payload: { item: { label: 'Customers', path: '/customers' } },
    }),
  )
  assert.equal(menu.success, true)
  assert.match(menu.warnings.join(' '), /handled separately/)
})

test('version control: create, history, compare and rollback', () => {
  const versionControl = new VersionControl()
  const first = versionControl.createVersion(
    'Customer',
    'object',
    objectSchema(),
    patch(),
  )
  const second = versionControl.createVersion(
    'Customer',
    'object',
    objectSchema({ fields: [...objectSchema().fields, { name: 'email', label: 'Email', type: 'email' }] }),
    patch(),
  )

  assert.equal(first.version, 1)
  assert.equal(second.version, 2)
  assert.equal(second.previousVersion, 1)
  assert.equal(versionControl.getLatestVersion('Customer').version, 2)

  const diff = versionControl.compareVersions('Customer', 1, 2)
  assert.equal(diff.added.length, 1)
  assert.equal(diff.added[0].name, 'email')
  assert.equal(diff.removed.length, 0)

  const rolledBack = versionControl.rollbackToVersion('Customer', 1)
  assert.equal(rolledBack.version, 1)
  assert.equal(versionControl.getHistory('Customer').length, 1)
  assert.equal(versionControl.rollbackToVersion('Customer', 99), null)
})

test('audit: success, failure, rejection, filters and patch lookup', () => {
  const logger = new AuditLogger()
  const successPatch = patch()
  const failurePatch = patch()
  const rejectedPatch = patch()

  logger.log(successPatch, { success: true, patchId: successPatch.patchId }, 3)
  logger.log(failurePatch, { success: false, patchId: failurePatch.patchId, errors: ['boom'] })
  logger.logRejection(rejectedPatch, 'blocked')

  assert.equal(logger.query({ result: 'success' }).length, 1)
  assert.equal(logger.query({ result: 'failure' })[0].errors[0], 'boom')
  assert.equal(logger.query({ result: 'rejected' })[0].errors[0], 'blocked')
  assert.equal(logger.getLogsForPatch(rejectedPatch.patchId).length, 1)
  assert.equal(logger.query({ actor: 'human' }).length, 0)
  assert.equal(logger.getLog('missing'), null)
})

test('hot reload: invalidates resolver cache and refreshes subscribers', () => {
  const calls = { clearFor: 0, clearAll: 0, registryClear: 0 }
  const resolver = {
    clearCacheFor: () => { calls.clearFor += 1 },
    clearCache: () => { calls.clearAll += 1 },
  }
  const registry = { clear: () => { calls.registryClear += 1 } }
  const reloader = new HotReloader(resolver, registry)
  let reloads = 0
  const unsubscribe = reloader.onReload(() => { reloads += 1 })

  reloader.invalidateSchema('object', 'Customer')
  reloader.forceReload()
  assert.equal(calls.clearFor, 1)
  assert.equal(reloads, 1)

  reloader.invalidateAll()
  reloader.forceReload()
  assert.equal(calls.clearAll, 1)
  assert.equal(calls.registryClear, 1)
  assert.equal(reloads, 2)

  unsubscribe()
  reloader.forceReload()
  assert.equal(reloads, 2)
})

test('manager: apply, dry-run, version history and rollback', async () => {
  const registry = registryWithSchemas()
  const manager = new PatchManager(new SchemaResolver(), registry)

  const dry = await manager.dryRun(patch())
  assert.equal(dry.valid, true)
  assert.ok(dry.changes.after.fields.some((field) => field.name === 'email'))
  assert.ok(!registry.getObject('Customer').fields.some((field) => field.name === 'email'))

  const applied = await manager.applyPatch(patch())
  assert.equal(applied.success, true)
  assert.equal(applied.schemaVersion, 1)
  assert.ok(registry.getObject('Customer').fields.some((field) => field.name === 'email'))

  const history = manager.getVersionHistory('Customer')
  assert.equal(history.length, 1)
  assert.equal(manager.getAuditLogs({ result: 'success' }).length, 1)

  const rolledBack = manager.rollback('Customer', 1)
  assert.equal(rolledBack.success, true)
  assert.equal(rolledBack.version.fields.length, 3)
})

test('manager: L3 block, L2 confirmation reject/accept and rate limit', async () => {
  const registry = registryWithSchemas()
  const limiter = new PatchRateLimiter({ max: 3, windowMs: 60_000 })
  const manager = new PatchManager(new SchemaResolver(), registry, limiter)

  const l3 = patch({
    scope: 'permission',
    operation: 'update',
    target: { type: 'role', identifier: 'sales' },
    payload: { permissions: { view: ['sales'] } },
  })
  const blocked = await manager.applyPatch(l3)
  assert.equal(blocked.success, false)
  assert.match(blocked.errors.join(' '), /L3/)

  const l2 = patch({
    operation: 'update',
    payload: { field: { name: 'name', label: 'Display name' } },
  })
  const rejected = await manager.applyPatch(l2, [], async () => false)
  assert.equal(rejected.success, false)
  assert.match(rejected.errors.join(' '), /rejected/)

  const accepted = await manager.applyPatch(l2, [], async () => true)
  assert.equal(accepted.success, true)

  const overLimit = await manager.applyPatch(patch())
  assert.equal(overLimit.success, false)
  assert.match(overLimit.errors.join(' '), /rate limit/)
})

test('manager: batch runs in dependency order and detects cycles', async () => {
  const registry = registryWithSchemas()
  const manager = new PatchManager(new SchemaResolver(), registry)

  const first = patch({ payload: { field: { name: 'first', label: 'First' } } })
  const second = patch({
    payload: { field: { name: 'second', label: 'Second' } },
    dependsOn: [first.patchId],
  })

  const batch = await manager.applyBatchPatches([second, first])
  assert.equal(batch.success, true)
  assert.deepEqual(
    batch.results.map((result) => result.patchId),
    [first.patchId, second.patchId],
  )

  const a = patch({ payload: { field: { name: 'a', label: 'A' } } })
  const b = patch({ payload: { field: { name: 'b', label: 'B' } }, dependsOn: [a.patchId] })
  a.dependsOn = [b.patchId]
  const cycle = await manager.applyBatchPatches([a, b])
  assert.equal(cycle.success, false)
  assert.match(cycle.errors.join(' '), /Circular/)
})

test('gateway: exposes an AI tool definition with no write confirmation', () => {
  assert.equal(PATCH_GENERATION_TOOL_DEFINITION.name, 'erp_patch_generate')
  assert.equal(PATCH_GENERATION_TOOL_DEFINITION.write, false)
  assert.equal(PATCH_GENERATION_TOOL_DEFINITION.confirmation, 'none')
  assert.equal(PATCH_GENERATION_TOOL_DEFINITION.parameters.required[0], 'intent')
  assert.equal(PATCH_GENERATION_TOOL_DEFINITION.permission, 'tool:patch:generate')

  const helper = PatchHelpers.createAddFieldPatch('Customer', 'phone', 'text')
  assert.equal(helper.scope, 'object')
  assert.equal(helper.payload.field.name, 'phone')
})

test('rate limiter: window, remaining and reset', () => {
  const limiter = new PatchRateLimiter({ max: 2, windowMs: 1000 })
  assert.equal(limiter.check('ai', 1000).allowed, true)
  assert.equal(limiter.check('ai', 1100).allowed, true)
  assert.equal(limiter.check('ai', 1200).allowed, false)
  assert.equal(limiter.check('ai', 2100).allowed, true)
  limiter.reset('ai')
  assert.equal(limiter.check('ai', 2200).allowed, true)
})

test('schema resolver: loads versioned object schema from /specs/versions', async () => {
  const resolver = new SchemaResolver()
  const originalFetch = global.fetch
  const fetched = []
  global.fetch = async (url) => {
    fetched.push(url)
    if (url === '/specs/versions/Customer/v2.json') {
      return {
        ok: true,
        json: async () => objectSchema({ version: '2', fields: [{ name: 'id', label: 'ID', type: 'text' }] }),
      }
    }
    return { ok: false, json: async () => ({}) }
  }

  try {
    const schema = await resolver.loadObjectSchema('Customer', 2)
    assert.equal(schema.version, '2')
    assert.deepEqual(fetched, ['/specs/versions/Customer/v2.json'])
    await resolver.loadObjectSchema('Customer', 2)
    assert.equal(fetched.length, 1)
  } finally {
    global.fetch = originalFetch
  }
})
