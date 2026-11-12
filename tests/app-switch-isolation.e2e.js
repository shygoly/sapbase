/**
 * ERP/CRM 应用切换与私有记录隔离 e2e（3.8）。
 *
 * 覆盖：
 * - 同一用户/组织安装 ERP + CRM
 * - 各自导航来自自己的 Blueprint UI
 * - 各自记录只在本应用 package 下可见
 * - 带 CRM X-App-Id 直接访问 ERP package → 403
 * - CRM 通过 ERP published customer.lookup 读取投影
 *
 * 需要 API：BLUEPRINT_ALLOW_UNSIGNED=true。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { rmSync } = require('node:fs')
const { join } = require('node:path')

const API = process.env.API_BASE || 'http://localhost:3051'
const DB = process.env.DB_NAME || 'sapbasic'

function sql(statement) {
  return execFileSync('psql', ['-d', DB, '-tAc', statement], { encoding: 'utf8' }).trim()
}

async function login(email = 'admin@example.com', password = '123456') {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  if (!body?.data) throw new Error(`login failed: ${response.status}`)
  return body.data
}

async function main() {
  const session = await login()
  const org = session.currentOrganizationId
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org,
    'Content-Type': 'application/json',
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const type = response.headers.get('content-type') ?? ''
    const body = type.includes('application/json')
      ? await response.json().catch(() => null)
      : null
    return { status: response.status, data: body?.data ?? body }
  }

  const packages = []
  const installations = []
  const recordIds = []
  let capabilityId = null

  try {
    for (const app of ['erp', 'crm']) {
      const packagePath = join(process.cwd(), 'blueprints', `${app}-1.0.0.erpkg`)
      packages.push(packagePath)
      const packaged = await call('/api/blueprints/package', {
        method: 'POST',
        body: JSON.stringify({
          dir: join(process.cwd(), 'templates', app),
          out: packagePath,
        }),
      })
      assert.ok([200, 201].includes(packaged.status), JSON.stringify(packaged.data))
    }

    const erpInstall = await call('/api/apps/install', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'erp-1.0.0' }),
    })
    assert.equal(erpInstall.status, 201, JSON.stringify(erpInstall.data))
    installations.push(erpInstall.data.id)

    const crmInstall = await call('/api/apps/install', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'crm-1.0.0' }),
    })
    assert.equal(crmInstall.status, 201, JSON.stringify(crmInstall.data))
    installations.push(crmInstall.data.id)

    const erpHeaders = { 'X-App-Id': erpInstall.data.id }
    const crmHeaders = { 'X-App-Id': crmInstall.data.id }

    // 各自写入私有 Customer 记录
    const erpCreated = await call('/api/blueprints/erp-1.0.0/records/Customer', {
      method: 'POST',
      headers: erpHeaders,
      body: JSON.stringify({
        name: 'ERP Private Customer',
        industry: 'auto',
        level: 'A',
        creditLimit: 100000,
        ownerId: session.user.id,
        internalNote: 'erp-internal-only',
      }),
    })
    assert.equal(erpCreated.status, 201, JSON.stringify(erpCreated.data))
    recordIds.push(erpCreated.data.id)

    const crmCreated = await call('/api/blueprints/crm-1.0.0/records/Customer', {
      method: 'POST',
      headers: crmHeaders,
      body: JSON.stringify({
        name: 'CRM Private Customer',
        industry: 'software',
        level: 'B',
        creditLimit: 50000,
        ownerId: session.user.id,
      }),
    })
    assert.equal(crmCreated.status, 201, JSON.stringify(crmCreated.data))
    recordIds.push(crmCreated.data.id)

    // 同一用户切换应用：各自只看到自己的记录
    const erpRecords = await call('/api/blueprints/erp-1.0.0/records/Customer', {
      headers: erpHeaders,
    })
    assert.equal(erpRecords.status, 200, JSON.stringify(erpRecords.data))
    const erpNames = (erpRecords.data ?? []).map((row) => row.data?.name)
    assert.ok(erpNames.includes('ERP Private Customer'))
    assert.ok(!erpNames.includes('CRM Private Customer'))

    const crmRecords = await call('/api/blueprints/crm-1.0.0/records/Customer', {
      headers: crmHeaders,
    })
    assert.equal(crmRecords.status, 200, JSON.stringify(crmRecords.data))
    const crmNames = (crmRecords.data ?? []).map((row) => row.data?.name)
    assert.ok(crmNames.includes('CRM Private Customer'))
    assert.ok(!crmNames.includes('ERP Private Customer'))

    // 直接跨应用 package 读取 → 403
    const crossRead = await call('/api/blueprints/erp-1.0.0/records/Customer', {
      headers: crmHeaders,
    })
    assert.equal(crossRead.status, 403, JSON.stringify(crossRead.data))

    // 导航按应用解析
    const erpNav = await call(`/api/apps/${erpInstall.data.id}/navigation`)
    const crmNav = await call(`/api/apps/${crmInstall.data.id}/navigation`)
    assert.equal(erpNav.status, 200)
    assert.equal(crmNav.status, 200)
    assert.ok(
      erpNav.data.navigation.some((item) => item.path === '/dashboard/erp/customers'),
    )
    assert.ok(
      crmNav.data.navigation.some((item) => item.path === '/dashboard/crm/customers'),
    )
    assert.ok(
      !crmNav.data.navigation.some((item) => item.path.startsWith('/dashboard/erp/')),
    )

    // 发布 ERP customer.lookup，CRM 显式消费
    const published = await call('/api/app-capabilities', {
      method: 'POST',
      body: JSON.stringify({
        publisherAppKey: 'erp',
        name: 'customer.lookup',
        entity: 'Customer',
        fields: ['name', 'industry', 'level'],
        permission: 'customer.read',
        ownerField: 'ownerId',
        readAllPermission: 'customer.read.all',
      }),
    })
    assert.equal(published.status, 201, JSON.stringify(published.data))
    capabilityId = published.data.id

    const invoked = await call('/api/app-capabilities/customer.lookup/invoke', {
      method: 'POST',
      headers: crmHeaders,
      body: JSON.stringify({ publisherAppKey: 'erp' }),
    })
    assert.equal(invoked.status, 200, JSON.stringify(invoked.data))
    assert.equal(invoked.data.consumer.appKey, 'crm')
    assert.equal(invoked.data.publisher.appKey, 'erp')
    const projectedNames = invoked.data.records.map((row) => row.name)
    assert.ok(projectedNames.includes('ERP Private Customer'))
    assert.ok(!projectedNames.includes('CRM Private Customer'))
    assert.ok(!('internalNote' in (invoked.data.records[0] ?? {})))

    console.log('✓ ERP/CRM 安装与按应用导航解析')
    console.log('✓ 私有 Customer 记录按应用隔离；CRM 直接读 ERP package → 403')
    console.log('✓ CRM 通过 ERP customer.lookup 只读取声明投影')
    console.log('app switch isolation e2e passed')
  } finally {
    if (capabilityId) {
      sql(`DELETE FROM app_capabilities WHERE id='${capabilityId}'`)
    }
    if (recordIds.length > 0) {
      sql(
        `DELETE FROM blueprint_records WHERE id IN (${recordIds.map((id) => `'${id}'`).join(',')})`,
      )
    }
    for (const id of installations) {
      sql(`DELETE FROM app_installation_revisions WHERE "appInstallationId"='${id}'`)
      sql(`DELETE FROM app_installations WHERE id='${id}'`)
    }
    for (const file of packages) rmSync(file, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
