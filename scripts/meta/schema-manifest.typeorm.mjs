#!/usr/bin/env node
/**
 * schema-manifest.typeorm.mjs — 从 TypeORM 实体生成 DOMAIN checker 用的 manifest。
 * 零依赖。用法：
 *   node scripts/schema-manifest.typeorm.mjs --root backend/src --out contracts/schema-manifest.json
 *
 * 说明：
 *   - TypeORM 默认命名策略下，列名 = 属性名（camelCase），不是 snake_case。
 *   - 只解析显式 @Column / @PrimaryGeneratedColumn / @CreateDateColumn / @UpdateDateColumn /
 *     @DeleteDateColumn / @VersionColumn 与 @JoinColumn。
 *   - 关系未写 @JoinColumn 时，按 TypeORM 默认推断 `<prop>Id`（ManyToOne/OneToOne 拥有端）。
 *   - BaseEntity 的 id/createdAt/updatedAt 与 TenantAwareEntity 的 organizationId 自动补齐。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs, walkFiles } from './lib/common.mjs'

const args = parseArgs()
if (args.help) {
  console.log('用法：node scripts/schema-manifest.typeorm.mjs [--root backend/src] [--out contracts/schema-manifest.json]')
  process.exit(0)
}

const root = resolve(args.root ?? 'backend/src')
const out = resolve(args.out ?? 'contracts/schema-manifest.json')
const files = walkFiles(root, {
  extensions: ['.ts'],
  ignoreDirs: ['node_modules', '.next', 'dist', 'coverage', '.nx', '.git'],
}).filter((file) => file.endsWith('.entity.ts'))

if (files.length === 0) {
  console.error(`没有找到 *.entity.ts：${root}`)
  process.exit(2)
}

const tables = {}

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const entity = text.match(
    /@Entity\(\s*(?:['"]([^'"]+)['"]|\{[\s\S]*?name\s*:\s*['"]([^'"]+)['"][\s\S]*?\})\s*\)/,
  )
  if (!entity) continue
  const table = entity[1] ?? entity[2]
  const classMatch = text.match(/export\s+class\s+(\w+)\s+extends\s+(\w+)/)
  const base = classMatch?.[2] ?? 'BaseEntity'
  const classIndex = classMatch ? text.indexOf(classMatch[0]) : 0
  const body = text.slice(classIndex)

  const columns = new Set(['id', 'createdAt', 'updatedAt'])
  if (base === 'TenantAwareEntity' || /extends\s+TenantAwareEntity/.test(text)) {
    columns.add('organizationId')
  }

  const lines = body.split(/\r?\n/)
  let pending = []
  let buffer = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (buffer) {
      buffer += ' ' + line
      if (balanced(buffer)) {
        pending.push(buffer)
        buffer = ''
      }
      continue
    }

    if (line.startsWith('@')) {
      if (balanced(line)) pending.push(line)
      else buffer = line
      continue
    }

    const prop = line.match(/^(\w+)[?!]?\s*:/)
    if (!prop) {
      if (!line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*')) pending = []
      continue
    }

    const name = prop[1]
    const decorators = pending
    pending = []
    if (decorators.length === 0) continue

    const columnDecorator = decorators.find((d) =>
      /^@(Column|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn|VersionColumn)\b/.test(d),
    )
    const joinColumn = decorators.find((d) => /^@JoinColumn\b/.test(d))
    const relation = decorators.find((d) => /^@(ManyToOne|OneToOne|ManyToMany|OneToMany)\b/.test(d))

    if (columnDecorator) {
      columns.add(nameOf(columnDecorator, name))
      continue
    }
    if (joinColumn) {
      columns.add(nameOf(joinColumn, `${name}Id`))
      continue
    }
    if (relation) {
      if (/^@(ManyToOne|OneToOne)\b/.test(relation)) {
        columns.add(`${name}Id`)
      }
      continue
    }
  }

  tables[table] = { columns: [...columns] }
}

mkdirSync(dirname(out), { recursive: true })
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'typeorm',
  root,
  tables,
}
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n')
console.log(`已生成 ${out}：${Object.keys(tables).length} 张表`)

function balanced(value) {
  let depth = 0
  let quote = null
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') depth--
  }
  return depth <= 0 && quote === null
}

function nameOf(decorator, fallback) {
  const name = decorator.match(/\bname\s*:\s*['"]([^'"]+)['"]/)
  return name ? name[1] : fallback
}
