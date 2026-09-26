import type { SemanticEntity } from './record-validator'
import { RecordWriteError } from './record-write-error'
import { normalizeImportInput, parseCsv } from './import-rows'

const PART: SemanticEntity = {
  name: 'Part',
  fields: [
    { name: 'partNo', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text' },
    { name: 'unitCost', type: 'decimal' },
    { name: 'packSize', type: 'i32' },
    { name: 'unit', type: 'enum', values: ['piece', 'set', 'box'] },
  ],
}

describe('parseCsv', () => {
  it('首行是表头；行号 = 文件行号；空行跳过', () => {
    const parsed = parseCsv('partNo,name\nP-1,垫片\n\nP-2,刹车片\n')
    expect(parsed.headers).toEqual(['partNo', 'name'])
    expect(parsed.records.map((row) => ({ line: row.line, cells: row.cells }))).toEqual([
      { line: 2, cells: ['P-1', '垫片'] },
      { line: 4, cells: ['P-2', '刹车片'] },
    ])
  })

  it('支持双引号包裹、字段内逗号、"" 转义、CRLF', () => {
    const parsed = parseCsv('partNo,name\r\n"P-1","垫片,前","x""y"\r\n')
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0]).toEqual({
      line: 2,
      cells: ['P-1', '垫片,前', 'x"y'],
    })
  })
})

describe('normalizeImportInput：csv | rows 二选一 + 表头闸', () => {
  it('csv 与 rows 都给或都不给 → type-mismatch', () => {
    expect(() => normalizeImportInput({}, PART)).toThrow(RecordWriteError)
    expect(() => normalizeImportInput({ csv: 'a', rows: [] }, PART)).toThrow(RecordWriteError)
    try {
      normalizeImportInput({}, PART)
    } catch (error) {
      expect(error).toMatchObject({ reason: 'type-mismatch' })
      expect((error as Error).message).toMatch(/csv 与 rows 必须二选一/)
    }
  })

  it('表头为空 / 重复列名 → 整份拒', () => {
    expect(() => normalizeImportInput({ csv: ',name\nP-1,a\n' }, PART)).toThrow(/表头/)
    expect(() => normalizeImportInput({ csv: 'partNo,partNo\nP-1,P-2\n' }, PART)).toThrow(/重复/)
    try {
      normalizeImportInput({ csv: 'partNo,partNo\nP-1,P-2\n' }, PART)
    } catch (error) {
      expect(error).toMatchObject({ reason: 'type-mismatch' })
    }
  })

  it('表头含未声明列 → unknown-field 并列出列名', () => {
    try {
      normalizeImportInput({ csv: 'partNo,ghost,shadow\nP-1,1,2\n' }, PART)
      throw new Error('应当拒绝')
    } catch (error) {
      expect(error).toMatchObject({ reason: 'unknown-field' })
      expect((error as Error).message).toMatch(/ghost/)
      expect((error as Error).message).toMatch(/shadow/)
    }
  })

  it('CSV 把 i32 / decimal 从字符串归一；第 7 行缺必填仍保留行号', () => {
    const csv = [
      'partNo,name,unitCost,packSize',
      'P-1,a,1.5,12',
      'P-2,b,2,12',
      'P-3,c,3,12',
      'P-4,d,4,12',
      'P-5,e,5,12',
      ',缺号,6,12',
      'P-7,g,7,12',
    ].join('\n')
    const normalized = normalizeImportInput({ csv }, PART)
    expect(normalized.source).toBe('csv')
    expect(normalized.rows[0]?.data).toEqual({
      partNo: 'P-1',
      name: 'a',
      unitCost: '1.5',
      packSize: 12,
    })
    expect(normalized.rows[5]).toMatchObject({
      line: 7,
      data: { name: '缺号', unitCost: '6', packSize: 12 },
    })
    expect(normalized.rows[5]?.data.partNo).toBeUndefined()
  })

  it('JSON rows 原样保留类型；非法行对象被拒为结构错误', () => {
    const normalized = normalizeImportInput(
      { rows: [{ partNo: 'P-1', packSize: 12 }] },
      PART,
    )
    expect(normalized).toEqual({
      source: 'json',
      rows: [{ line: 1, data: { partNo: 'P-1', packSize: 12 } }],
    })
    expect(() => normalizeImportInput({ rows: ['x'] }, PART)).toThrow(RecordWriteError)
  })
})
