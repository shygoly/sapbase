/**
 * 身份联邦与会话治理 e2e：
 * - 本地 CAS / OIDC provider 协议级登录（JIT 默认角色）
 * - 两个组织隔离；强制下线后旧 token 401
 * - 身份源同步/高风险离职确认/会话与角色回收
 * - 服务令牌 scope + 代用户功能权限/数据范围二次校验
 * - 跨租户负例
 *
 * 需要 API：BLUEPRINT_ALLOW_UNSIGNED=true（教育包未签名）。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { createSign, generateKeyPairSync, randomUUID } = require('node:crypto')
const http = require('node:http')
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
  return body.data
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function signJwt(payload, privateKey) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'e2e' }))
  const body = base64url(JSON.stringify(payload))
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${body}`)
    .sign(privateKey)
    .toString('base64url')
  return `${header}.${body}.${signature}`
}

async function main() {
  const session = await login()
  const org1 = session.currentOrganizationId
  const suffix = Date.now()
  const org2 = randomUUID()
  const prefix = `id-e2e-${suffix}`
  const emails = {
    cas: `${prefix}-cas@example.com`,
    oidc: `${prefix}-oidc@example.com`,
    cas2: `${prefix}-cas2@example.com`,
    sync: `${prefix}-sync@example.com`,
    student: `${prefix}-student@example.com`,
  }
  const defaultRole1 = `${prefix}-Default`
  const defaultRole2 = `${prefix}-Default2`
  const providerKeys = {
    cas: `${prefix}-cas`,
    oidc: `${prefix}-oidc`,
    sync: `${prefix}-sync`,
    org2: `${prefix}-cas-org2`,
  }
  const createdUserIds = []
  const providerIds = []
  const serviceClientIds = []
  let packageFile = null
  let casServer
  let oidcServer

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': org1,
    'Content-Type': 'application/json',
  }
  const call = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => null)
    return { status: response.status, data: body?.data ?? body }
  }

  try {
    // ── 本地 CAS / OIDC provider ───────────────────────────────────────────
    casServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname === '/cas/serviceValidate') {
        const ticket = url.searchParams.get('ticket')
        if (ticket === 'ST-e2e-1') {
          res.writeHead(200, { 'Content-Type': 'text/xml' })
          res.end(`<cas:serviceResponse><cas:authenticationSuccess>
            <cas:user>${emails.cas}</cas:user>
            <cas:attributes><cas:email>${emails.cas}</cas:email><cas:name>CAS User</cas:name></cas:attributes>
          </cas:authenticationSuccess></cas:serviceResponse>`)
          return
        }
        if (ticket === 'ST-e2e-2') {
          res.writeHead(200, { 'Content-Type': 'text/xml' })
          res.end(`<cas:serviceResponse><cas:authenticationSuccess>
            <cas:user>${emails.cas2}</cas:user>
            <cas:attributes><cas:email>${emails.cas2}</cas:email><cas:name>CAS Org2</cas:name></cas:attributes>
          </cas:authenticationSuccess></cas:serviceResponse>`)
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/xml' })
        res.end('<cas:serviceResponse><cas:authenticationFailure code="INVALID_TICKET">bad</cas:authenticationFailure></cas:serviceResponse>')
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise((resolve) => casServer.listen(0, '127.0.0.1', resolve))
    const casBase = `http://127.0.0.1:${casServer.address().port}/cas`

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const jwk = publicKey.export({ format: 'jwk' })
    oidcServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const issuer = `http://127.0.0.1:${oidcServer.address().port}`
      if (url.pathname === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
          }),
        )
        return
      }
      if (url.pathname === '/jwks') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ keys: [{ ...jwk, kid: 'e2e', alg: 'RS256', use: 'sig' }] }))
        return
      }
      if (url.pathname === '/token') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          const params = new URLSearchParams(body)
          if (params.get('code') !== 'oidc-code-1') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid_grant' }))
            return
          }
          const idToken = signJwt(
            {
              iss: issuer,
              aud: 'e2e-client',
              sub: emails.oidc,
              email: emails.oidc,
              name: 'OIDC User',
              nonce: 'nonce-1',
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 300,
            },
            privateKey,
          )
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ access_token: 'at-e2e', id_token: idToken }))
        })
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise((resolve) => oidcServer.listen(0, '127.0.0.1', resolve))
    const oidcBase = `http://127.0.0.1:${oidcServer.address().port}`

    // ── 组织/角色/提供方 ───────────────────────────────────────────────────
    sql(`INSERT INTO organizations (id,name,slug,"subscriptionStatus") VALUES ('${org2}','Identity E2E Org 2','${prefix}-org2','active')`)
    sql(`INSERT INTO roles (id,name,description,permissions,status,"organizationId") VALUES (uuid_generate_v4(),'${defaultRole1}','e2e default','student:read','active','${org1}') ON CONFLICT ("organizationId",name) DO NOTHING`)
    sql(`INSERT INTO roles (id,name,description,permissions,status,"organizationId") VALUES (uuid_generate_v4(),'${defaultRole2}','e2e default 2','student:read','active','${org2}') ON CONFLICT ("organizationId",name) DO NOTHING`)
    sql(`INSERT INTO roles (id,name,description,permissions,status,"organizationId") VALUES (uuid_generate_v4(),'Student','e2e education student','','active','${org1}') ON CONFLICT ("organizationId",name) DO NOTHING`)

    const casProvider = await call('/api/identity/providers', {
      method: 'POST',
      body: JSON.stringify({
        key: providerKeys.cas,
        name: 'E2E CAS',
        type: 'cas',
        config: { baseUrl: casBase, serviceUrl: `${API}/api/auth/sso/${providerKeys.cas}/callback` },
        defaultRoleName: defaultRole1,
      }),
    })
    assert.equal(casProvider.status, 201, JSON.stringify(casProvider.data))
    providerIds.push(casProvider.data.id)

    const oidcProvider = await call('/api/identity/providers', {
      method: 'POST',
      body: JSON.stringify({
        key: providerKeys.oidc,
        name: 'E2E OIDC',
        type: 'oidc',
        config: {
          issuer: oidcBase,
          clientId: 'e2e-client',
          redirectUri: 'http://localhost:3050/login',
          authorizationEndpoint: `${oidcBase}/authorize`,
          tokenEndpoint: `${oidcBase}/token`,
          jwksUri: `${oidcBase}/jwks`,
        },
        defaultRoleName: defaultRole1,
      }),
    })
    assert.equal(oidcProvider.status, 201, JSON.stringify(oidcProvider.data))
    providerIds.push(oidcProvider.data.id)

    sql(`INSERT INTO identity_providers (id,"createdAt","updatedAt","organizationId",key,name,type,config,"defaultRoleName",status)
         VALUES (uuid_generate_v4(),now(),now(),'${org2}','${providerKeys.org2}','Org2 CAS','cas',
         '{"baseUrl":"${casBase}","serviceUrl":"${API}/api/auth/sso/${providerKeys.org2}/callback"}'::jsonb,'${defaultRole2}','active')`)

    const syncProvider = await call('/api/identity/providers', {
      method: 'POST',
      body: JSON.stringify({
        key: providerKeys.sync,
        name: 'E2E Sync',
        type: 'cas',
        config: {
          confirmDeactivations: true,
          users: [
            {
              externalId: 'sync-ext-1',
              email: emails.sync,
              name: 'Sync User',
              active: true,
            },
          ],
        },
        defaultRoleName: defaultRole1,
      }),
    })
    assert.equal(syncProvider.status, 201, JSON.stringify(syncProvider.data))
    providerIds.push(syncProvider.data.id)

    // ── CAS / OIDC 登录 + JIT 默认角色 ────────────────────────────────────
    const casLogin = await call('/api/auth/sso/' + providerKeys.cas + '/callback', {
      method: 'POST',
      body: JSON.stringify({ organizationId: org1, ticket: 'ST-e2e-1' }),
    })
    assert.equal(casLogin.status, 201, JSON.stringify(casLogin.data))
    assert.equal(casLogin.data.user.email, emails.cas)
    assert.equal(casLogin.data.user.role, defaultRole1)
    assert.deepEqual(casLogin.data.user.permissions, ['student:read'])
    assert.ok(casLogin.data.sessionId)
    createdUserIds.push(casLogin.data.user.id)

    const casProfile = await fetch(`${API}/api/auth/profile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${casLogin.data.access_token}` },
    })
    assert.ok([200, 201].includes(casProfile.status), `profile ${casProfile.status}`)

    const oidcLogin = await call('/api/auth/sso/' + providerKeys.oidc + '/callback', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: org1,
        code: 'oidc-code-1',
        nonce: 'nonce-1',
      }),
    })
    assert.equal(oidcLogin.status, 201, JSON.stringify(oidcLogin.data))
    assert.equal(oidcLogin.data.user.email, emails.oidc)
    assert.equal(oidcLogin.data.user.role, defaultRole1)
    createdUserIds.push(oidcLogin.data.user.id)

    const org2Login = await call('/api/auth/sso/' + providerKeys.org2 + '/callback', {
      method: 'POST',
      body: JSON.stringify({ organizationId: org2, ticket: 'ST-e2e-2' }),
    })
    assert.equal(org2Login.status, 201, JSON.stringify(org2Login.data))
    assert.equal(org2Login.data.user.email, emails.cas2)
    assert.equal(org2Login.data.currentOrganizationId, org2)
    createdUserIds.push(org2Login.data.user.id)

    const org1Providers = await call('/api/identity/sso/providers?organizationId=' + org1)
    assert.ok(org1Providers.data.providers.some((item) => item.key === providerKeys.cas))
    assert.ok(!org1Providers.data.providers.some((item) => item.key === providerKeys.org2))
    const org2Providers = await call('/api/identity/sso/providers?organizationId=' + org2)
    assert.ok(org2Providers.data.providers.some((item) => item.key === providerKeys.org2))

    // ── 强制下线：旧 token 立即 401 ───────────────────────────────────────
    const revoke = await call('/api/identity/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ sid: oidcLogin.data.sessionId, reason: 'e2e-force-offline' }),
    })
    assert.equal(revoke.status, 201, JSON.stringify(revoke.data))
    assert.equal(revoke.data.revoked, 1)
    const revokedProfile = await fetch(`${API}/api/auth/profile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${oidcLogin.data.access_token}` },
    })
    assert.equal(revokedProfile.status, 401)

    // ── 身份同步：新增 → 待确认离职 → 确认回收 ───────────────────────────
    const firstSync = await call(`/api/identity/sync/${providerKeys.sync}/run`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(firstSync.status, 201, JSON.stringify(firstSync.data))
    assert.equal(firstSync.data.stats.created, 1)
    const syncUserId = sql(`SELECT id FROM users WHERE email='${emails.sync}'`)
    assert.ok(syncUserId)
    createdUserIds.push(syncUserId)
    const syncSid = randomUUID()
    sql(`INSERT INTO auth_sessions (id,"createdAt","updatedAt","organizationId","userId",sid,status,"expiresAt")
         VALUES (uuid_generate_v4(),now(),now(),'${org1}','${syncUserId}','${syncSid}','active',now()+interval '1 day')`)

    const updatedProvider = await call(`/api/identity/providers/${syncProvider.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        config: {
          confirmDeactivations: true,
          users: [
            {
              externalId: 'sync-ext-1',
              email: emails.sync,
              name: 'Sync User',
              active: false,
            },
          ],
        },
      }),
    })
    assert.equal(updatedProvider.status, 200, JSON.stringify(updatedProvider.data))

    const pendingSync = await call(`/api/identity/sync/${providerKeys.sync}/run`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(pendingSync.status, 201, JSON.stringify(pendingSync.data))
    assert.equal(pendingSync.data.confirmationStatus, 'pending')
    assert.equal(pendingSync.data.stats.deactivated, 0)
    assert.equal(sql(`SELECT status FROM users WHERE id='${syncUserId}'`), 'active')

    const confirmed = await call(`/api/identity/sync/runs/${pendingSync.data.runId}/confirm`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.data))
    assert.equal(confirmed.data.confirmationStatus, 'confirmed')
    assert.equal(confirmed.data.stats.deactivated, 1)
    assert.equal(sql(`SELECT status FROM users WHERE id='${syncUserId}'`), 'inactive')
    assert.equal(
      sql(`SELECT status FROM auth_sessions WHERE sid='${syncSid}'`),
      'revoked',
    )
    assert.equal(
      Number(sql(`SELECT count(*) FROM organization_member_roles WHERE "userId"='${syncUserId}' AND status='active'`)),
      0,
    )

    // 幂等重跑：恢复 active 后重复同步不重复建号
    await call(`/api/identity/providers/${syncProvider.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        config: {
          confirmDeactivations: true,
          users: [
            {
              externalId: 'sync-ext-1',
              email: emails.sync,
              name: 'Sync User',
              active: true,
            },
          ],
        },
      }),
    })
    const rerun1 = await call(`/api/identity/sync/${providerKeys.sync}/run`, {
      method: 'POST',
      body: '{}',
    })
    const rerun2 = await call(`/api/identity/sync/${providerKeys.sync}/run`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(rerun1.data.stats.created, 0)
    assert.equal(rerun2.data.stats.created, 0)
    assert.equal(
      Number(sql(`SELECT count(*) FROM identity_links WHERE "externalId"='sync-ext-1'`)),
      1,
    )

    // ── 服务令牌：scope + 代用户权限/数据范围二次校验 ────────────────────
    const serviceClient = await call('/api/identity/service-clients', {
      method: 'POST',
      body: JSON.stringify({
        key: `${prefix}-svc`,
        name: 'Identity E2E Service',
        scopes: ['integrations.read'],
      }),
    })
    assert.equal(serviceClient.status, 201, JSON.stringify(serviceClient.data))
    serviceClientIds.push(serviceClient.data.client.id)

    const wrongScopeClient = await call('/api/identity/service-clients', {
      method: 'POST',
      body: JSON.stringify({
        key: `${prefix}-svc-bad`,
        name: 'Identity E2E Bad Scope',
        scopes: ['other.read'],
      }),
    })
    assert.equal(wrongScopeClient.status, 201, JSON.stringify(wrongScopeClient.data))
    serviceClientIds.push(wrongScopeClient.data.client.id)

    const scopeResolved = await call('/api/identity/delegation/scope', {
      method: 'POST',
      body: JSON.stringify({
        userId: casLogin.data.user.id,
        resourceKey: 'blueprint:education:Student',
        action: 'read',
      }),
    })
    assert.equal(scopeResolved.status, 201, JSON.stringify(scopeResolved.data))
    assert.equal(scopeResolved.data.userId, casLogin.data.user.id)
    assert.ok('scope' in scopeResolved.data)

    const studentRoleId = sql(`SELECT id FROM roles WHERE "organizationId"='${org1}' AND name='Student'`)
    const studentUserId = randomUUID()
    sql(`INSERT INTO users (id,name,email,"passwordHash",status,permissions,"roleId",role)
         VALUES ('${studentUserId}','Identity Student','${emails.student}',NULL,'active','','${studentRoleId}','Student')`)
    sql(`INSERT INTO organization_members (id,"organizationId","userId",role) VALUES (uuid_generate_v4(),'${org1}','${studentUserId}','member')`)
    createdUserIds.push(studentUserId)

    packageFile = join(process.cwd(), 'blueprints', 'education-1.0.0.erpkg')
    await call('/api/blueprints/package', {
      method: 'POST',
      body: JSON.stringify({
        dir: join(process.cwd(), 'templates/education'),
        out: packageFile,
      }),
    })
    const loaded = await call('/api/blueprints/education-1.0.0/load', {
      method: 'POST',
      body: '{}',
    })
    assert.equal(loaded.status, 200, JSON.stringify(loaded.data).slice(0, 300))

    const serviceHeaders = {
      'X-Organization-Id': org1,
      'X-Service-Key': `${prefix}-svc`,
      'X-Service-Secret': serviceClient.data.secret,
      'X-On-Behalf-Of': casLogin.data.user.id,
    }
    const denied = await fetch(
      `${API}/api/integrations/external/records/education-1.0.0/Student`,
      { headers: serviceHeaders },
    )
    assert.equal(denied.status, 403, await denied.text())

    const allowed = await fetch(
      `${API}/api/integrations/external/records/education-1.0.0/Student`,
      {
        headers: {
          ...serviceHeaders,
          'X-On-Behalf-Of': studentUserId,
        },
      },
    )
    const allowedText = await allowed.text()
    assert.equal(allowed.status, 200, allowedText)
    const allowedBody = JSON.parse(allowedText)
    assert.ok(Array.isArray(allowedBody.data ?? allowedBody))

    const wrongScope = await fetch(`${API}/api/integrations/external/whoami`, {
      headers: {
        'X-Organization-Id': org1,
        'X-Service-Key': `${prefix}-svc-bad`,
        'X-Service-Secret': wrongScopeClient.data.secret,
      },
    })
    assert.equal(wrongScope.status, 403)

    // ── 跨租户负例 ────────────────────────────────────────────────────────
    const crossTenant = await call(`/api/identity/sessions?userId=${casLogin.data.user.id}`, {
      headers: { 'X-Organization-Id': org2 },
    })
    assert.ok([400, 403, 404].includes(crossTenant.status), `cross status ${crossTenant.status}`)

    console.log('✓ 本地 CAS/OIDC 登录；JIT 默认角色；两组织隔离')
    console.log('✓ 强制下线旧 token 401；同步 pending/confirm/会话与角色回收；幂等重跑')
    console.log('✓ 服务令牌 scope + 代用户功能权限/数据范围二次校验；跨租户负例')
    console.log('identity federation e2e passed')
  } finally {
    if (packageFile) rmSync(packageFile, { force: true })
    if (casServer) await new Promise((resolve) => casServer.close(resolve))
    if (oidcServer) await new Promise((resolve) => oidcServer.close(resolve))
    if (serviceClientIds.length > 0) {
      sql(`DELETE FROM service_clients WHERE id IN (${serviceClientIds.map((id) => `'${id}'`).join(',')})`)
    }
    sql(`DELETE FROM identity_sync_runs WHERE "providerId" IN (SELECT id FROM identity_providers WHERE key LIKE '${prefix}%')`)
    sql(`DELETE FROM identity_links WHERE "providerId" IN (SELECT id FROM identity_providers WHERE key LIKE '${prefix}%')`)
    sql(`DELETE FROM auth_sessions WHERE "userId" IN (SELECT id FROM users WHERE email LIKE '${prefix}%')`)
    sql(`DELETE FROM organization_member_roles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE '${prefix}%')`)
    sql(`DELETE FROM organization_members WHERE "userId" IN (SELECT id FROM users WHERE email LIKE '${prefix}%')`)
    sql(`DELETE FROM users WHERE email LIKE '${prefix}%'`)
    sql(`DELETE FROM identity_providers WHERE key LIKE '${prefix}%' OR "organizationId"='${org2}'`)
    sql(`DELETE FROM roles WHERE "organizationId" IN ('${org1}','${org2}') AND name LIKE '${prefix}%'`)
    sql(`DELETE FROM auth_login_events WHERE "organizationId"='${org2}'`)
    sql(`DELETE FROM notifications WHERE "organizationId"='${org2}'`)
    sql(`DELETE FROM jobs WHERE "organizationId"='${org2}'`)
    sql(`SET app.audit_break_glass=on; DELETE FROM audit_logs WHERE "organizationId"='${org2}'`)
    sql(`DELETE FROM outbox_events WHERE "organizationId"='${org2}'`)
    sql(`DELETE FROM organizations WHERE id='${org2}'`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
