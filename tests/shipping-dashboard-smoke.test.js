const fs = require('fs')
const path = require('path')
const assert = require('assert')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
    process.exitCode = 1
  }
}

const shippingPages = [
  'apps/web-portal/src/app/[locale]/dashboard/shipping/ships/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/charters/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/voyages/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/cii/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/fueleu/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/eu-ets/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/fuel-cost/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/home-overview/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/reports/scenario-analysis/page.tsx',
  'apps/web-portal/src/app/[locale]/dashboard/shipping/report-center/page.tsx',
]

const shippingComponents = [
  'speckit/src/components/shipping/import-dialog.tsx',
]

test('login page mirrors demo brand copy', () => {
  const loginPage = read('speckit/src/app/login/page.tsx')
  assert(loginPage.includes('Data Ocean'), 'expected Data Ocean brand copy')
  assert(loginPage.includes('Tenant Code'), 'expected Tenant Code field')
  assert(loginPage.includes('Sign in'), 'expected Sign in CTA copy')
})

test('shipping dashboard routes exist', () => {
  const missingPages = shippingPages.filter((file) => !exists(file))
  assert.deepStrictEqual(missingPages, [], `missing route files: ${missingPages.join(', ')}`)
})

test('shipping import components exist', () => {
  const missingComponents = shippingComponents.filter((file) => !exists(file))
  assert.deepStrictEqual(missingComponents, [], `missing component files: ${missingComponents.join(', ')}`)
})

test('default menu includes shipping section', () => {
  const menuConfig = read('speckit/src/config/default-menu-items.ts')
  assert(menuConfig.includes('船舶碳管理') || menuConfig.includes('Shipping Carbon'), 'expected shipping group in default menu')
  assert(menuConfig.includes('/dashboard/shipping/reports/home-overview'), 'expected shipping overview route')
  assert(menuConfig.includes('/dashboard/shipping/report-center'), 'expected report center route')
})

test('voyage import UI is wired', () => {
  const voyagesPage = read('speckit/src/components/shipping/voyages-page-client.tsx')
  assert(
    voyagesPage.includes('Import Voyage') || voyagesPage.includes('ImportDialog'),
    'expected voyage import action on voyages page',
  )
})

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('Shipping dashboard smoke checks passed.')
