/**
 * SaaS 组织/团队 e2e：组织创建、成员/邀请、活动日志、租户隔离、多组织切换。
 */

const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const bcrypt = require('bcrypt')

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
  if (!body?.data) {
    throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`)
  }
  return body.data
}

async function main() {
  const admin = await login()
  const orgA = admin.currentOrganizationId
  const suffix = Date.now()
  const prefix = `saas-e2e-${suffix}`
  const createdOrgIds = []
  const createdUserIds = []
  const invitationIds = []
  const headers = {
    Authorization: `Bearer ${admin.access_token}`,
    'X-Organization-Id': orgA,
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
    const org = await call('/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: `${prefix} Org B` }),
    })
    assert.equal(org.status, 201, JSON.stringify(org.data))
    const orgB = org.data.id
    createdOrgIds.push(orgB)
    // 新组织默认没有业务角色；为 owner 复制 Admin 角色后再切换。
    sql(`INSERT INTO roles (id,name,description,permissions,status,"organizationId")
         SELECT uuid_generate_v4(),'Admin',description,permissions,'active','${orgB}'
           FROM roles WHERE "organizationId"='${orgA}' AND name='Admin'`)
    sql(`INSERT INTO organization_member_roles (id,"createdAt","updatedAt","organizationId","userId","roleId","roleName",source,status)
         SELECT uuid_generate_v4(),now(),now(),'${orgB}','${admin.user.id}',r.id,'Admin','manual','active'
           FROM roles r WHERE r."organizationId"='${orgB}' AND r.name='Admin'`)
    const switchB = await call('/api/auth/switch-organization', {
      method: 'POST',
      body: JSON.stringify({ organizationId: orgB }),
    })
    assert.equal(switchB.status, 201, JSON.stringify(switchB.data))
    const adminBHeaders = {
      Authorization: `Bearer ${switchB.data.access_token}`,
      'X-Organization-Id': orgB,
      'Content-Type': 'application/json',
    }

    const userA = await call('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'SaaS A',
        email: `${prefix}-a@example.com`,
        password: '12345678',
      }),
    })
    assert.equal(userA.status, 201, JSON.stringify(userA.data))
    createdUserIds.push(userA.data.id)

    const userB = await call('/api/users', {
      method: 'POST',
      headers: adminBHeaders,
      body: JSON.stringify({
        name: 'SaaS B',
        email: `${prefix}-b@example.com`,
        password: '12345678',
      }),
    })
    assert.equal(userB.status, 201, JSON.stringify(userB.data))
    createdUserIds.push(userB.data.id)

    // 租户隔离：orgA 看不到 orgB 用户，反之亦然
    const usersA = await call('/api/users?pageSize=100')
    assert.equal(usersA.status, 200, JSON.stringify(usersA.data))
    const idsA = (usersA.data.data ?? usersA.data).map((user) => user.id)
    assert.ok(idsA.includes(userA.data.id))
    assert.ok(!idsA.includes(userB.data.id))

    const usersB = await call('/api/users?pageSize=100', {
      headers: adminBHeaders,
    })
    assert.equal(usersB.status, 200, JSON.stringify(usersB.data))
    const idsB = (usersB.data.data ?? usersB.data).map((user) => user.id)
    assert.ok(idsB.includes(userB.data.id))
    assert.ok(!idsB.includes(userA.data.id))

    const crossRead = await call(`/api/users/${userB.data.id}`)
    assert.equal(crossRead.status, 404, JSON.stringify(crossRead.data))

    // 邀请 → 接受 → 成为成员
    const inviteeEmail = `${prefix}-invitee@example.com`
    const invitation = await call(`/api/organizations/${orgA}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email: inviteeEmail, role: 'member' }),
    })
    assert.equal(invitation.status, 201, JSON.stringify(invitation.data))
    invitationIds.push(invitation.data.id)
    const inviteeId = randomUUID()
    const inviteeHash = bcrypt.hashSync('12345678', 10)
    sql(`INSERT INTO users (id,name,email,"passwordHash",status,permissions,role,"roleId")
         VALUES ('${inviteeId}','SaaS Invitee','${inviteeEmail}','${inviteeHash}','active','','user',NULL)`)
    createdUserIds.push(inviteeId)
    const invitee = await login(inviteeEmail, '12345678')
    const accepted = await fetch(
      `${API}/api/organizations/${orgA}/invitations/accept/${invitation.data.token}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${invitee.access_token}` },
      },
    )
    const acceptedText = await accepted.text()
    assert.equal(accepted.status, 201, acceptedText)
    const inviteeOrgs = await fetch(`${API}/api/organizations`, {
      headers: { Authorization: `Bearer ${invitee.access_token}` },
    })
    const inviteeOrgBody = await inviteeOrgs.json()
    const inviteeOrgList = inviteeOrgBody.data ?? inviteeOrgBody
    assert.ok(inviteeOrgList.some((item) => item.id === orgA))

    // 活动日志：创建组织/成员/邀请/接受
    let activities = []
    for (let index = 0; index < 30; index += 1) {
      const result = await call(`/api/organizations/${orgA}/activities?limit=100`)
      activities = result.data ?? []
      if (activities.some((item) => item.action === 'ACCEPT_INVITATION')) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const actions = activities.map((item) => item.action)
    assert.ok(actions.includes('INVITE_MEMBER'), JSON.stringify(actions))
    assert.ok(actions.includes('ACCEPT_INVITATION'), JSON.stringify(actions))
    const orgBActivities = await call(`/api/organizations/${orgB}/activities?limit=100`, {
      headers: adminBHeaders,
    })
    assert.ok(
      (orgBActivities.data ?? []).some((item) => item.action === 'CREATE_ORGANIZATION'),
      JSON.stringify(orgBActivities.data),
    )

    // 多组织切换：admin 同时属于 orgA/orgB
    const orgList = await call('/api/organizations')
    assert.ok((orgList.data ?? []).some((item) => item.id === orgA))
    assert.ok((orgList.data ?? []).some((item) => item.id === orgB))
    const switched = await call('/api/auth/switch-organization', {
      method: 'POST',
      body: JSON.stringify({ organizationId: orgB }),
    })
    assert.equal(switched.status, 201, JSON.stringify(switched.data))
    assert.ok(switched.data.access_token)
    const switchedUsers = await fetch(`${API}/api/users?pageSize=100`, {
      headers: {
        Authorization: `Bearer ${switched.data.access_token}`,
        'X-Organization-Id': orgB,
      },
    })
    assert.equal(switchedUsers.status, 200)
    const switchedBody = await switchedUsers.json()
    const switchedIds = (switchedBody.data?.data ?? switchedBody.data ?? []).map((user) => user.id)
    assert.ok(switchedIds.includes(userB.data.id))
    assert.ok(!switchedIds.includes(userA.data.id))

    const subscriptionStatus = await call(`/api/organizations/${orgA}/subscriptions/status`)
    assert.equal(subscriptionStatus.status, 200, JSON.stringify(subscriptionStatus.data))
    assert.equal(subscriptionStatus.data.organization.id, orgA)
    if (!subscriptionStatus.data.configured) {
      const checkout = await call(`/api/organizations/${orgA}/subscriptions/checkout`, {
        method: 'POST',
        body: JSON.stringify({ priceId: 'price_e2e' }),
      })
      assert.equal(checkout.status, 400, JSON.stringify(checkout.data))
    }

    console.log('✓ 组织创建/成员/邀请接受/活动日志')
    console.log('✓ 租户隔离：跨组织用户列表与详情拒绝；多组织切换')
    console.log('saas organization e2e passed')
  } finally {
    if (invitationIds.length > 0) {
      sql(`DELETE FROM invitations WHERE id IN (${invitationIds.map((id) => `'${id}'`).join(',')})`)
    }
    if (createdUserIds.length > 0) {
      const ids = createdUserIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM auth_sessions WHERE "userId" IN (${ids})`)
      sql(`DELETE FROM organization_activities WHERE "userId" IN (${ids})`)
      sql(`DELETE FROM organization_member_roles WHERE "userId" IN (${ids})`)
      sql(`DELETE FROM organization_members WHERE "userId" IN (${ids})`)
      sql(`DELETE FROM users WHERE id IN (${ids})`)
    }
    for (const orgId of createdOrgIds) {
      sql(`DELETE FROM organization_member_roles WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM roles WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM organization_activities WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM auth_login_events WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM notifications WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM jobs WHERE "organizationId"='${orgId}'`)
      sql(`SET app.audit_break_glass=on; DELETE FROM audit_logs WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM outbox_events WHERE "organizationId"='${orgId}'`)
      sql(`DELETE FROM organizations WHERE id='${orgId}'`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
