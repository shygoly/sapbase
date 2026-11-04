/**
 * Script to check CRM entities and their state machine status
 */
import * as fs from 'fs'
import * as path from 'path'

const specsDir = path.join(__dirname, '../../speckit/public/specs')
const entitiesDir = path.join(__dirname, '../src/entities')
const stateMachinesDir = path.join(specsDir, 'state-machines')
const pagesDir = path.join(specsDir, 'pages')

interface EntityStatus {
  name: string
  hasObjectSchema: boolean
  hasStateMachine: boolean
  hasStateMachineFile: boolean
  hasBackendEntity: boolean
  hasFrontendPages: boolean
  stateMachineRef?: string
  statusField?: string
}

function checkCRMEntities(): EntityStatus[] {
  const results: EntityStatus[] = []

  // Find all CRM-related pages
  const crmPages = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf-8'))
      return content.path
    })
    .filter(p => p.startsWith('/crm/'))
    .map(p => {
      // Extract entity name from path: /crm/customers -> Customer
      const parts = p.split('/').filter(Boolean)
      const entityPlural = parts[1] || ''
      // Simple singularization
      const entitySingular = entityPlural.endsWith('ies')
        ? entityPlural.slice(0, -3) + 'y'
        : entityPlural.endsWith('s')
        ? entityPlural.slice(0, -1)
        : entityPlural
      return entitySingular.charAt(0).toUpperCase() + entitySingular.slice(1)
    })

  const uniqueEntities = [...new Set(crmPages)]

  // Also check objects directory for all entities
  const allObjects = fs.readdirSync(path.join(specsDir, 'objects'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))

  // Check each entity
  for (const entityName of uniqueEntities) {
    const status: EntityStatus = {
      name: entityName,
      hasObjectSchema: false,
      hasStateMachine: false,
      hasStateMachineFile: false,
      hasBackendEntity: false,
      hasFrontendPages: false,
    }

    // Check object schema
    const objectPath = path.join(specsDir, 'objects', `${entityName}.json`)
    if (fs.existsSync(objectPath)) {
      status.hasObjectSchema = true
      const objectSchema = JSON.parse(fs.readFileSync(objectPath, 'utf-8'))
      
      // Check state machine reference
      if (objectSchema.stateMachine) {
        status.hasStateMachine = true
        status.stateMachineRef = objectSchema.stateMachine
        // Check if state machine file exists
        const smPath = path.join(stateMachinesDir, `${objectSchema.stateMachine}.json`)
        if (fs.existsSync(smPath)) {
          status.hasStateMachineFile = true
        }
      }

      // Check for stage/status field
      const stageField = objectSchema.fields?.find((f: any) => f.name === 'stage' || f.name === 'status')
      if (stageField) {
        status.statusField = stageField.name
      }
    }

    // Check backend entity
    const entityLower = entityName.toLowerCase()
    const backendEntityPath = path.join(entitiesDir, `${entityLower}.entity.ts`)
    if (fs.existsSync(backendEntityPath)) {
      status.hasBackendEntity = true
    }

    // Check frontend pages
    const entityPlural = entityName.toLowerCase() + 's'
    const listPagePath = path.join(pagesDir, `${entityPlural}.json`)
    const createPagePath = path.join(pagesDir, `${entityPlural}-create.json`)
    if (fs.existsSync(listPagePath) || fs.existsSync(createPagePath)) {
      status.hasFrontendPages = true
    }

    results.push(status)
  }

  // Also check for entities in objects that might not have pages
  for (const objName of allObjects) {
    if (!results.find(r => r.name.toLowerCase() === objName.toLowerCase())) {
      const status: EntityStatus = {
        name: objName,
        hasObjectSchema: true,
        hasStateMachine: false,
        hasStateMachineFile: false,
        hasBackendEntity: false,
        hasFrontendPages: false,
      }

      const objectPath = path.join(specsDir, 'objects', `${objName}.json`)
      if (fs.existsSync(objectPath)) {
        const objectSchema = JSON.parse(fs.readFileSync(objectPath, 'utf-8'))
        if (objectSchema.stateMachine) {
          status.hasStateMachine = true
          status.stateMachineRef = objectSchema.stateMachine
          const smPath = path.join(stateMachinesDir, `${objectSchema.stateMachine}.json`)
          if (fs.existsSync(smPath)) {
            status.hasStateMachineFile = true
          }
        }
      }

      const entityLower = objName.toLowerCase()
      const backendEntityPath = path.join(entitiesDir, `${entityLower}.entity.ts`)
      if (fs.existsSync(backendEntityPath)) {
        status.hasBackendEntity = true
      }

      results.push(status)
    }
  }

  return results
}

// Run check
const results = checkCRMEntities()

console.log('\n=== CRM Entities Status Report ===\n')
console.log('Entity'.padEnd(25) + 'Schema'.padEnd(10) + 'StateMachine'.padEnd(15) + 'SM File'.padEnd(10) + 'Backend'.padEnd(10) + 'Frontend'.padEnd(10) + 'Status Field')
console.log('-'.repeat(100))

for (const r of results.sort((a, b) => a.name.localeCompare(b.name))) {
  const schema = r.hasObjectSchema ? '✓' : '✗'
  const sm = r.hasStateMachine ? '✓' : '✗'
  const smFile = r.hasStateMachineFile ? '✓' : '✗'
  const backend = r.hasBackendEntity ? '✓' : '✗'
  const frontend = r.hasFrontendPages ? '✓' : '✗'
  const statusField = r.statusField || '-'
  
  console.log(
    r.name.padEnd(25) +
    schema.padEnd(10) +
    sm.padEnd(15) +
    smFile.padEnd(10) +
    backend.padEnd(10) +
    frontend.padEnd(10) +
    statusField
  )
}

console.log('\n=== Summary ===')
const total = results.length
const withSchema = results.filter(r => r.hasObjectSchema).length
const withSM = results.filter(r => r.hasStateMachine).length
const withSMFile = results.filter(r => r.hasStateMachineFile).length
const withBackend = results.filter(r => r.hasBackendEntity).length
const withFrontend = results.filter(r => r.hasFrontendPages).length

console.log(`Total entities: ${total}`)
console.log(`With object schema: ${withSchema}`)
console.log(`With state machine reference: ${withSM}`)
console.log(`With state machine file: ${withSMFile}`)
console.log(`With backend entity: ${withBackend}`)
console.log(`With frontend pages: ${withFrontend}`)

console.log('\n=== Missing Components ===')
const missingBackend = results.filter(r => r.hasObjectSchema && !r.hasBackendEntity)
const missingSM = results.filter(r => r.hasObjectSchema && !r.hasStateMachine)
const missingSMFile = results.filter(r => r.hasStateMachine && !r.hasStateMachineFile)

if (missingBackend.length > 0) {
  console.log(`\nEntities missing backend files:`)
  missingBackend.forEach(r => console.log(`  - ${r.name}`))
}

if (missingSM.length > 0) {
  console.log(`\nEntities missing state machine:`)
  missingSM.forEach(r => console.log(`  - ${r.name}`))
}

if (missingSMFile.length > 0) {
  console.log(`\nEntities with state machine reference but no file:`)
  missingSMFile.forEach(r => console.log(`  - ${r.name} (ref: ${r.stateMachineRef})`))
}
