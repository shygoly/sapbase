import AdmZip from 'adm-zip'
import {
  assertXlsxArchive,
  buildColumnMapping,
  buildTemplate,
  detectImportFormat,
  escapeFormulaValue,
  parseImportFile,
  prepareImportRows,
  renderExport,
} from './bulk-formats'
import type { ResourceDescriptor } from './bulk.types'

const descriptor: ResourceDescriptor = {
  resourceKey: 'platform:departments',
  label: '部门',
  canImport: true,
  canExport: true,
  importFormats: ['csv', 'json', 'xlsx'],
  exportFormats: ['csv', 'json', 'xlsx', 'md', 'pdf'],
  fields: [
    { key: 'name', label: '名称', type: 'string', required: true, example: '教学部' },
    { key: 'code', label: '编码', type: 'string', aliases: ['部门编码'] },
    { key: 'capacity', label: '容量', type: 'integer', example: '10' },
    { key: 'status', label: '状态', type: 'enum', enumValues: ['active', 'inactive'], default: 'active' },
    { key: 'id', label: 'id', type: 'string', importable: false },
  ],
}

function xlsxBuffer(rows: string[][]): Buffer {
  const zip = new AdmZip()
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    ),
  )
  zip.addFile(
    'xl/workbook.xml',
    Buffer.from('<workbook><sheets><sheet name="知识点" sheetId="1"/></sheets></workbook>'),
  )
  const sheet = rows
    .map(
      (cells, rowIndex) =>
        `<row r="${rowIndex + 1}">${cells
          .map((cell, cellIndex) => {
            const ref = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`
            return `<c r="${ref}" t="inlineStr"><is><t>${cell}</t></is></c>`
          })
          .join('')}</row>`,
    )
    .join('')
  zip.addFile(
    'xl/worksheets/sheet1.xml',
    Buffer.from(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  )
  return zip.toBuffer()
}

describe('bulk formats', () => {
  it('CSV 表头/别名/类型/默认值', () => {
    const parsed = parseImportFile(
      Buffer.from('名称*,部门编码,容量\n教学部,D01,12\n, ,x\n'),
      'csv',
    )
    expect(parsed.headers).toEqual(['名称*', '部门编码', '容量'])
    const mapping = buildColumnMapping(descriptor, parsed.headers)
    expect([...mapping.fieldByHeader.values()]).toEqual(['name', 'code', 'capacity'])
    const rows = prepareImportRows(descriptor, parsed, {}, 'reject')
    expect(rows[0]!.errors).toEqual([])
    expect(rows[0]!.data).toEqual({ name: '教学部', code: 'D01', capacity: 12, status: 'active' })
    expect(rows[1]!.errors.map((error) => error.reason)).toEqual([
      'required',
      'type-mismatch',
    ])
  })

  it('未知列默认拒绝，可配置忽略', () => {
    const parsed = parseImportFile(Buffer.from('name,unknown\nA,x\n'), 'csv')
    const rejected = buildColumnMapping(descriptor, parsed.headers)
    expect(rejected.errors[0]).toMatchObject({ reason: 'unknown-column', column: 'unknown' })
    const ignored = buildColumnMapping(descriptor, parsed.headers, {}, 'ignore')
    expect(ignored.errors).toEqual([])
  })

  it('JSON 对象数组与类型转换', () => {
    const parsed = parseImportFile(
      Buffer.from(JSON.stringify([{ name: 'A', capacity: 3, status: 'inactive' }])),
      'json',
    )
    const rows = prepareImportRows(descriptor, parsed)
    expect(rows[0]!.data).toEqual({ name: 'A', capacity: 3, status: 'inactive' })
  })

  it('XLSX 解析保留 sheet/行号', () => {
    const parsed = parseImportFile(xlsxBuffer([['name*', 'capacity'], ['教学部', '5']]), 'xlsx')
    expect(parsed.sheet).toBe('知识点')
    expect(parsed.rows[0]).toMatchObject({ row: 2, sheet: '知识点' })
    expect(prepareImportRows(descriptor, parsed)[0]!.data).toMatchObject({
      name: '教学部',
      capacity: 5,
    })
  })

  it('XLSX 宏/外链/超限解压拒绝', () => {
    expect(() =>
      assertXlsxArchive([
        { entryName: '[Content_Types].xml', size: 10, compressedSize: 5 },
        { entryName: 'xl/vbaProject.bin', size: 10, compressedSize: 5 },
      ]),
    ).toThrow(/宏/)
    expect(() =>
      assertXlsxArchive([
        { entryName: '[Content_Types].xml', size: 10, compressedSize: 5 },
        { entryName: 'xl/externalLinks/externalLink1.xml', size: 10, compressedSize: 5 },
      ]),
    ).toThrow(/外部链接/)
    expect(() =>
      assertXlsxArchive([
        { entryName: '[Content_Types].xml', size: 10, compressedSize: 5 },
        { entryName: 'xl/worksheets/sheet1.xml', size: 20 * 1024 * 1024, compressedSize: 100 },
      ]),
    ).toThrow(/解压|压缩比/)
  })

  it('恶意公式导出转义', () => {
    expect(escapeFormulaValue('=HYPERLINK("http://evil")')).toBe("'=HYPERLINK(\"http://evil\")")
    expect(escapeFormulaValue('-1')).toBe("'-1")
    expect(escapeFormulaValue(3)).toBe(3)
    const csv = renderExport(
      'csv',
      [{ name: '=cmd|calc', capacity: 2 }],
      [
        { key: 'name', label: '名称' },
        { key: 'capacity', label: '容量' },
      ],
    ).toString('utf8')
    expect(csv).toContain("'=cmd|calc")
  })

  it('模板含必填标记和示例；可被自身解析', () => {
    const csv = buildTemplate(descriptor, 'csv')
    expect(csv.buffer.toString('utf8')).toContain('name*')
    const parsed = parseImportFile(csv.buffer, 'csv')
    expect(parsed.headers).toEqual(['name*', 'code', 'capacity', 'status'])
    const xlsx = buildTemplate(descriptor, 'xlsx')
    expect(parseImportFile(xlsx.buffer, 'xlsx').headers).toEqual([
      'name*',
      'code',
      'capacity',
      'status',
    ])
  })

  it('空表头/重复表头拒绝', () => {
    expect(() => parseImportFile(Buffer.from(' , \nA,B\n'), 'csv')).toThrow(/表头为空/)
    expect(
      buildColumnMapping(descriptor, ['name', 'name']).errors.some(
        (error) => error.reason === 'duplicate-header',
      ),
    ).toBe(true)
  })

  it('识别格式并拒绝旧 xls', () => {
    expect(detectImportFormat('a.csv')).toBe('csv')
    expect(() => detectImportFormat('a.xls')).toThrow(/另存为/)
  })
})
