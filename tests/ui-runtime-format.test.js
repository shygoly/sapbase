const assert = require('node:assert')
const { test } = require('node:test')

const {
  formatDate,
  formatCurrency,
  formatUnit,
  formatNumber,
  formatFieldValue,
} = require('../libs/ui-runtime/src/format')

test('formatDate：日期串按本地日期显示，非法值回退 -', () => {
  assert.equal(formatDate('2026-01-02'), '2026/01/02')
  assert.equal(formatDate('not-a-date'), '-')
  assert.equal(formatDate(null), '-')
})

test('formatCurrency / formatUnit / formatNumber', () => {
  assert.equal(formatCurrency(1234.5), '¥1,234.50')
  assert.equal(formatUnit(2, 'kg'), '2 kg')
  assert.equal(formatUnit(2, 'unknown-unit'), '2 unknown-unit')
  assert.equal(formatNumber('3.14159'), '3.14')
})

test('formatFieldValue 按字段类型选择管道', () => {
  assert.equal(formatFieldValue('2026-01-02', 'date'), '2026/01/02')
  assert.equal(formatFieldValue(1234.5, 'currency'), '¥1,234.50')
  assert.equal(formatFieldValue(2, 'unit', { unit: 'kg' }), '2 kg')
  assert.equal(formatFieldValue('x', 'text'), 'x')
})
