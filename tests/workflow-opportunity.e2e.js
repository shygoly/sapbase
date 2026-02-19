/**
 * E2E test: Create Opportunity workflow (draft → formal) and run transition.
 * Run: node tests/workflow-opportunity.e2e.js
 * Requires: backend on http://localhost:3051, DB seeded (admin@example.com / 123456).
 */

const axios = require('axios')

const API = 'http://localhost:3051/api'

async function main() {
  let token
  let organizationId

  console.log('1. Login as admin...')
  const loginRes = await axios.post(`${API}/auth/login`, {
    email: 'admin@example.com',
    password: '123456',
  })
  const loginData = loginRes.data?.data || loginRes.data
  token = loginData.access_token
  organizationId = loginData.currentOrganizationId || (loginData.organizations && loginData.organizations[0]?.id)
  if (!token) {
    throw new Error('Login failed: no access_token')
  }
  console.log('   OK, organizationId:', organizationId)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(organizationId && { 'X-Organization-Id': organizationId }),
  }

  console.log('2. Create workflow "Opportunity" (entityType: opportunity, draft → formal)...')
  const createRes = await axios.post(
    `${API}/workflows`,
    {
      name: 'Opportunity',
      description: 'Opportunity workflow from draft to formal',
      entityType: 'opportunity',
      states: [
        { name: 'draft', initial: true, final: false },
        { name: 'formal', initial: false, final: true },
      ],
      transitions: [{ from: 'draft', to: 'formal' }],
    },
    { headers }
  )
  const workflow = createRes.data?.data || createRes.data
  if (!workflow?.id) throw new Error('Create workflow failed')
  console.log('   OK, workflow id:', workflow.id)

  console.log('3. Activate workflow...')
  await axios.patch(
    `${API}/workflows/${workflow.id}`,
    { status: 'active' },
    { headers }
  )
  console.log('   OK')

  console.log('4. Start workflow instance (entityId: opp-1)...')
  const startRes = await axios.post(
    `${API}/workflows/${workflow.id}/start`,
    { entityType: 'opportunity', entityId: 'opp-1' },
    { headers }
  )
  const instance = startRes.data?.data || startRes.data
  if (!instance?.id) throw new Error('Start instance failed')
  console.log('   OK, instance id:', instance.id, 'currentState:', instance.currentState)

  console.log('5. Execute transition draft → formal...')
  const transitionRes = await axios.post(
    `${API}/workflow-instances/${instance.id}/transition`,
    { toState: 'formal' },
    { headers }
  )
  const updated = transitionRes.data?.data || transitionRes.data
  console.log('   OK, currentState:', updated?.currentState ?? updated?.currentState)

  if (updated?.currentState === 'formal') {
    console.log('\n✅ Success: opportunity workflow draft → formal transition works.')
  } else {
    console.log('\n⚠️ Transition response:', JSON.stringify(updated, null, 2))
  }
}

main().catch((err) => {
  console.error('Error:', err.response?.data || err.message)
  process.exit(1)
})
