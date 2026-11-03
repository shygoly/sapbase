#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = resolve(process.cwd())
const files = []
for (const dir of ['docs', 'docs/protocols', 'openspec']) {
  const abs = join(root, dir)
  if (!existsSync(abs)) continue
  for (const entry of readdirSync(abs)) {
    if (!entry.endsWith('.md')) continue
    const full = join(abs, entry)
    if (statSync(full).isFile()) files.push(full)
  }
}

const errors = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    const target = match[1]
    if (/^(https?:|mailto:)/.test(target)) continue
    if (target.startsWith('/') || target.startsWith('<')) continue
    const abs = resolve(dirname(file), target)
    if (!existsSync(abs)) errors.push(`${file.replace(root + '\\', '')}: 死链 ${target}`)
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[ERR] ${error}`)
  console.error(`check-doc-links: ${errors.length} error(s)`)
  process.exit(1)
}
console.log(`check-doc-links: 0 error(s), ${files.length} files`)
