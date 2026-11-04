import { Client } from 'pg'
import { RELEASE_LIFECYCLE_DDL } from '../src/releases/release-lifecycle.ddl'

async function expectError(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch {
    console.log(`PASS ${label}`)
    return
  }
  throw new Error(`FAIL ${label}: expected error`)
}

async function main() {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:55432/postgres',
  })
  await client.connect()
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  for (const table of ['app_user_release_views','app_release_events','app_release_approvals','app_release_activations','app_release_items','app_releases','app_change_proposals','app_drafts']) {
    await client.query(`DROP TABLE IF EXISTS public.${table} CASCADE`)
  }
  for (const statement of RELEASE_LIFECYCLE_DDL) await client.query(statement)

  const release = await client.query(
    `INSERT INTO public.app_releases ("appKey", version, channel, status, manifest, changelog, digest, signature)
     VALUES ('erp-purchase', '1.0.0', 'stable', 'published', '{}'::jsonb, '{"zh-CN":[{"type":"added","title":"x"}]}'::jsonb, 'sha256:test', 'sig')
     RETURNING id`,
  )
  const releaseId = release.rows[0].id as string

  await expectError('published release manifest update is rejected', () =>
    client.query(`UPDATE public.app_releases SET manifest = '{"x":1}'::jsonb WHERE id = $1`, [releaseId]),
  )
  await expectError('published release delete is rejected', () =>
    client.query(`DELETE FROM public.app_releases WHERE id = $1`, [releaseId]),
  )

  const installationId = '00000000-0000-4000-8000-000000000001'
  await client.query(
    `INSERT INTO public.app_release_activations ("organizationId", "appInstallationId", "releaseId", action, status, cohort)
     VALUES ('00000000-0000-4000-8000-000000000002', $1, $2, 'activate', 'active', NULL)`,
    [installationId, releaseId],
  )
  await expectError('second non-cohort active activation is rejected', () =>
    client.query(
      `INSERT INTO public.app_release_activations ("organizationId", "appInstallationId", "releaseId", action, status, cohort)
       VALUES ('00000000-0000-4000-8000-000000000002', $1, $2, 'activate', 'active', NULL)`,
      [installationId, releaseId],
    ),
  )

  const rollback = await client.query(
    `INSERT INTO public.app_release_activations ("organizationId", "appInstallationId", "releaseId", action, status, cohort, "fromReleaseId")
     VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', $1, 'rollback', 'active', NULL, $1)
     RETURNING id`,
    [releaseId],
  )
  if (!rollback.rows[0]?.id) throw new Error('FAIL rollback activation was not appended')
  const unchanged = await client.query(`SELECT manifest, digest FROM public.app_releases WHERE id = $1`, [releaseId])
  if (unchanged.rows[0].digest !== 'sha256:test') throw new Error('FAIL old release changed after rollback')
  console.log('PASS rollback appends new activation and leaves old release unchanged')

  await client.end()
  console.log('release DDL verification ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
