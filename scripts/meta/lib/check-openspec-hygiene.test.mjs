import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { checkRepository } from '../check-openspec-hygiene.mjs'

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'openspec-hygiene-'))
  mkdirSync(join(root, 'openspec/changes'), { recursive: true })
  mkdirSync(join(root, 'openspec/specs'), { recursive: true })
  return root
}

function write(root, relative, content) {
  const full = join(root, relative)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

function change(root, id, { proposal = `# Change: ${id}\n`, tasks = '- [ ] task\n', specs = {} } = {}) {
  write(root, `openspec/changes/${id}/proposal.md`, proposal)
  write(root, `openspec/changes/${id}/tasks.md`, tasks)
  for (const [capability, spec] of Object.entries(specs)) {
    write(root, `openspec/changes/${id}/specs/${capability}/spec.md`, spec)
  }
}

test('reports stale old-monorepo paths', () => {
  const root = makeRoot()
  try {
    change(root, 'bad-path', {
      tasks: '- [ ] edit `backend/src/foo.ts`\n',
    })
    const { errors } = checkRepository(root)
    assert.equal(errors.filter((error) => error.code === 'stale-path').length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('reports ADDED requirement that already exists', () => {
  const root = makeRoot()
  try {
    write(root, 'openspec/specs/foo/spec.md', '### Requirement: Alpha\n')
    change(root, 'duplicate-added', {
      specs: {
        foo: '## ADDED Requirements\n\n### Requirement: Alpha\n',
      },
    })
    const { errors } = checkRepository(root)
    assert.equal(errors.filter((error) => error.code === 'duplicate-added').length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('reports superseded change with open tasks', () => {
  const root = makeRoot()
  try {
    change(root, 'superseded-open', {
      proposal:
        '> Status: SUPERSEDED by next on 2026-11-10. Do not apply.\n# Change: superseded-open\n',
      tasks: '- [ ] still open\n',
    })
    const { errors } = checkRepository(root)
    assert.equal(errors.filter((error) => error.code === 'superseded-open-task').length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('accepts a clean in-progress change', () => {
  const root = makeRoot()
  try {
    write(root, 'openspec/specs/foo/spec.md', '### Requirement: Beta\n')
    write(root, 'apps/api/src/app.module.ts', 'export {}\n')
    change(root, 'clean', {
      tasks: '- [ ] edit `apps/api/src/app.module.ts`\n',
      specs: {
        foo: '## ADDED Requirements\n\n### Requirement: Gamma\n',
      },
    })
    const { errors } = checkRepository(root)
    assert.deepEqual(errors, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
