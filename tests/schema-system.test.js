/**
 * Schema system tests: registry, validator, resolver, SchemaForm, SchemaList.
 *
 * Run: node --test tests/schema-system.test.js
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true, jsx: 'react-jsx' },
})
const tsconfig = require('../tsconfig.base.json')
require('tsconfig-paths').register({
  baseUrl: tsconfig.compilerOptions.baseUrl,
  paths: tsconfig.compilerOptions.paths,
})

const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const { SchemaRegistry } = require('../libs/ui-runtime/src/schema/registry')
const { SchemaValidator } = require('../libs/ui-runtime/src/schema/validator')
const { SchemaResolver } = require('../libs/ui-runtime/src/schema/resolver')
const { SchemaForm } = require('../libs/ui-runtime/src/components/schema-form')
const {
  SchemaList,
  sortRows,
  paginateRows,
} = require('../libs/ui-runtime/src/components/schema-list')

const objectSchema = {
  name: 'customer',
  label: 'Customer',
  version: '1',
  fields: [
    { name: 'id', label: 'ID', type: 'text' },
    { name: 'name', label: 'Name', type: 'text', validation: [{ type: 'required' }] },
    { name: 'age', label: 'Age', type: 'number', validation: [{ type: 'min', value: 18 }] },
    { name: 'secret', label: 'Secret', type: 'text', hidden: true },
  ],
  permissions: { view: ['sales'] },
}

const viewSchema = {
  name: 'customer-list',
  type: 'list',
  object: 'customer',
  version: '1',
  layout: { fields: ['name', 'age'] },
}

const pageSchema = {
  path: '/customers',
  view: 'customer-list',
  version: '1',
  metadata: { title: 'Customers' },
}

test('registry: register, read, query and clear', () => {
  const registry = new SchemaRegistry()
  registry.registerObject('customer', objectSchema)
  registry.registerView('customer-list', viewSchema)
  registry.registerPage('/customers', pageSchema)

  assert.equal(registry.has('object', 'customer'), true)
  assert.equal(registry.getObject('customer').label, 'Customer')
  assert.equal(registry.getPage('/customers').path, '/customers')
  assert.equal(registry.getAll('view').length, 1)
  assert.equal(registry.size(), 3)
  registry.clear()
  assert.equal(registry.size(), 0)
})

test('validator: schema and field values', () => {
  const validator = new SchemaValidator()
  assert.equal(validator.validateObjectSchema(objectSchema), true)
  assert.equal(validator.validateObjectSchema({ name: 'x', label: 'X', fields: [] }), true)
  assert.equal(validator.validateObjectSchema({ name: 'x' }), false)
  assert.equal(validator.validateViewSchema(viewSchema), true)
  assert.equal(validator.validateViewSchema({ ...viewSchema, type: 'bad' }), false)
  assert.equal(validator.validatePageSchema(pageSchema), true)
  assert.equal(validator.validatePageSchema({ path: '/x' }), false)

  assert.equal(validator.validateFieldValue('', objectSchema.fields[1]).valid, false)
  assert.equal(validator.validateFieldValue('Alice', objectSchema.fields[1]).valid, true)
  assert.equal(validator.validateFieldValue(16, objectSchema.fields[2]).valid, false)
  assert.equal(validator.validateFieldValue(20, objectSchema.fields[2]).valid, true)

  const form = validator.validateFormData({ name: 'Alice', age: 20 }, objectSchema)
  assert.equal(form.valid, true)
})

test('resolver: resolves page/view/object and applies layout + permissions', async () => {
  const originalFetch = global.fetch
  const urls = []
  global.fetch = async (url) => {
    urls.push(url)
    const data =
      url === '/specs/pages/customers.json'
        ? pageSchema
        : url === '/specs/views/customer-list.json'
          ? viewSchema
          : url === '/specs/objects/customer.json'
            ? objectSchema
            : null
    return data ? { ok: true, json: async () => data } : { ok: false, json: async () => ({}) }
  }

  try {
    const resolver = new SchemaResolver()
    const resolved = await resolver.resolvePage('customers')
    assert.equal(resolved.metadata.title, 'Customers')
    assert.deepEqual(resolved.fields.map((field) => field.name), ['name', 'age'])
    assert.ok(resolved.permissions.some((rule) => rule.permissions.includes('sales')))
    assert.deepEqual(urls, [
      '/specs/pages/customers.json',
      '/specs/views/customer-list.json',
      '/specs/objects/customer.json',
    ])
  } finally {
    global.fetch = originalFetch
  }
})

test('SchemaForm renders visible fields and skips hidden fields', () => {
  const html = renderToStaticMarkup(
    React.createElement(SchemaForm, {
      schema: objectSchema,
      initialData: { name: 'Alice', age: 20 },
      onSubmit: async () => {},
    }),
  )
  assert.match(html, /Name/)
  assert.match(html, /Age/)
  assert.doesNotMatch(html, /Secret/)
  assert.match(html, /Save/)
})


test('SchemaForm renders every supported field type', () => {
  const fields = [
    'text','number','email','password','select','multiselect','checkbox','date','datetime','textarea','relation','file',
  ].map((type) => ({ name: `${type}Field`, label: `${type} label`, type }))
  const html = renderToStaticMarkup(
    React.createElement(SchemaForm, {
      schema: { name: 'all-types', label: 'All types', version: '1', fields },
      onSubmit: async () => {},
    }),
  )
  for (const type of ['text','number','email','password','select','multiselect','checkbox','date','datetime','textarea','relation','file']) {
    assert.match(html, new RegExp(`${type} label`))
  }
})

test('SchemaList renders first page and pagination controls', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 1),
    name: `Customer ${index + 1}`,
    age: 20 + index,
  }))
  const html = renderToStaticMarkup(
    React.createElement(SchemaList, { schema: objectSchema, data: rows }),
  )
  assert.match(html, /Customer 10/)
  assert.doesNotMatch(html, /Customer 11/)
  assert.match(html, /2/)
})


test('SchemaList uses accessible icon action buttons', () => {
  const html = renderToStaticMarkup(
    React.createElement(SchemaList, {
      schema: objectSchema,
      data: [{ id: '1', name: 'Alice', age: 20 }],
      onEdit: () => {},
      onDelete: () => {},
    }),
  )
  assert.match(html, /aria-label="Edit"/)
  assert.match(html, /aria-label="Delete"/)
  assert.match(html, /<svg/)
})

test('SchemaList sort/paginate helpers', () => {
  const rows = [
    { name: 'B', age: 30 },
    { name: 'A', age: 20 },
    { name: 'C', age: 25 },
  ]
  assert.deepEqual(sortRows(rows, 'age', 'asc').map((row) => row.name), ['A', 'C', 'B'])
  assert.deepEqual(sortRows(rows, 'age', 'desc').map((row) => row.name), ['B', 'C', 'A'])
  assert.deepEqual(sortRows(rows, null, null).map((row) => row.name), ['B', 'A', 'C'])
  assert.deepEqual(paginateRows(rows, 2, 2).map((row) => row.name), ['C'])
})
