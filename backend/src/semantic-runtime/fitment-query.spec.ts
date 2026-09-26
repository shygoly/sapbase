import { RecordWriteError } from './record-write-error'
import {
  assembleFitmentCandidates,
  fitmentMatches,
  parseFitmentQuery,
  type FitmentRow,
} from './fitment-query'

const POSITIONS = ['front', 'rear', 'left', 'right'] as const

const COROLLA: FitmentRow = {
  id: 'f-1',
  make: 'Toyota',
  model: 'Corolla',
  yearFrom: 2008,
  yearTo: 2013,
  position: 'front',
  part: 'p-1',
}

describe('parseFitmentQuery', () => {
  it('正例：make/model 必填，year 是整数，position 可选', () => {
    expect(
      parseFitmentQuery(
        { make: 'Toyota', model: 'Corolla', year: '2008', position: 'front' },
        POSITIONS,
      ),
    ).toEqual({ make: 'Toyota', model: 'Corolla', year: 2008, position: 'front' })
    expect(parseFitmentQuery({ make: 'Toyota', model: 'Corolla', year: '2008' }, POSITIONS)).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      year: 2008,
    })
  })

  it('负例：缺 make/model、year 非整数、position 不在枚举 → 400 并指明', () => {
    expect(() => parseFitmentQuery({ model: 'Corolla', year: '2008' }, POSITIONS)).toThrow(
      /make/,
    )
    expect(() => parseFitmentQuery({ make: 'Toyota', year: '2008' }, POSITIONS)).toThrow(/model/)
    expect(() =>
      parseFitmentQuery({ make: 'Toyota', model: 'Corolla', year: '2008.5' }, POSITIONS),
    ).toThrow(/year/)
    try {
      parseFitmentQuery({ make: 'Toyota', model: 'Corolla', year: '2008', position: 'roof' }, POSITIONS)
    } catch (error) {
      expect(error).toBeInstanceOf(RecordWriteError)
      expect(error).toMatchObject({ reason: 'type-mismatch', field: 'position' })
      expect((error as Error).message).toMatch(/front/)
    }
  })
})

describe('fitmentMatches / assembleFitmentCandidates', () => {
  it('make/model 大小写不敏感；year 落在闭区间；position 精确', () => {
    const query = { make: 'toyota', model: 'COROLLA', year: 2008, position: 'front' }
    expect(fitmentMatches(COROLLA, query)).toBe(true)
    expect(fitmentMatches(COROLLA, { ...query, year: 2007 })).toBe(false)
    expect(fitmentMatches(COROLLA, { ...query, year: 2014 })).toBe(false)
    expect(fitmentMatches(COROLLA, { ...query, position: 'rear' })).toBe(false)
    expect(fitmentMatches(COROLLA, { make: 'toyota', model: 'corolla', year: 2010 })).toBe(true)
  })

  it('倒置区间 yearFrom > yearTo 自然不命中（谓词不可满足）', () => {
    expect(
      fitmentMatches(
        { ...COROLLA, yearFrom: 2013, yearTo: 2008 },
        { make: 'toyota', model: 'corolla', year: 2010 },
      ),
    ).toBe(false)
  })

  it('零件候选去重，按 partNo 排序，并带命中依据', () => {
    const rows: FitmentRow[] = [
      { ...COROLLA, id: 'f-b', part: 'p-b', position: 'front' },
      { ...COROLLA, id: 'f-a', part: 'p-a', position: 'front' },
      { ...COROLLA, id: 'f-b2', part: 'p-b', position: 'front' },
    ]
    const parts = new Map([
      ['p-b', { partNo: 'BRK-REAR', name: '后片' }],
      ['p-a', { partNo: 'BRK-FRONT', name: '前片' }],
    ])
    const assembled = assembleFitmentCandidates(
      rows,
      { make: 'toyota', model: 'corolla', year: 2010, position: 'front' },
      parts,
    )
    expect(assembled.map((item) => item.partNo)).toEqual(['BRK-FRONT', 'BRK-REAR'])
    expect(assembled[1]?.evidence).toEqual([
      { fitmentId: 'f-b', yearFrom: 2008, yearTo: 2013, position: 'front' },
      { fitmentId: 'f-b2', yearFrom: 2008, yearTo: 2013, position: 'front' },
    ])
  })
})
