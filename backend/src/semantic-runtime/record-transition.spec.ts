import { assertRecordStateDeclared, assertTransitionLegal } from './record-transition'
import type { DocumentEntity } from './document-writer'

const ORDER: DocumentEntity = {
  name: 'SalesOrder',
  fields: [],
  states: [
    { name: 'draft', initial: true },
    { name: 'confirmed' },
    { name: 'shipped', final: true },
  ],
  transitions: [
    { from: 'draft', to: 'confirmed' },
    { from: 'confirmed', to: 'shipped' },
  ],
}

describe('assertTransitionLegal', () => {
  it('合法：draft → confirmed；NULL 状态回落到初始态', () => {
    expect(assertTransitionLegal(ORDER, 'draft', 'confirmed')).toEqual({ from: 'draft' })
    expect(assertTransitionLegal(ORDER, null, 'confirmed')).toEqual({ from: 'draft' })
  })

  it('负例：draft → shipped 拒，并写出允许的目标', () => {
    expect(() => assertTransitionLegal(ORDER, 'draft', 'shipped')).toThrow(
      /当前状态 draft → shipped/,
    )
    expect(() => assertTransitionLegal(ORDER, 'draft', 'shipped')).toThrow(/允许的目标：confirmed/)
  })

  it('负例：当前状态是旧模板未声明状态 → 显式拒', () => {
    expect(() => assertRecordStateDeclared(ORDER, 'legacy-hold')).toThrow(
      /该行处于旧模板状态 legacy-hold，当前模板未声明/,
    )
    expect(() => assertRecordStateDeclared(ORDER, 'draft')).not.toThrow()
    expect(() => assertRecordStateDeclared(ORDER, null)).not.toThrow()
  })

  it('负例：目标状态未声明 / 实体无 states', () => {
    expect(() => assertTransitionLegal(ORDER, 'draft', 'ghost')).toThrow(/未被实体 SalesOrder 声明/)
    expect(() =>
      assertTransitionLegal({ name: 'Bare', fields: [] }, 'draft', 'confirmed'),
    ).toThrow(/未声明状态/)
  })
})
