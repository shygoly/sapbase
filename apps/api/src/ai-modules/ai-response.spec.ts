import { BadRequestException } from '@nestjs/common'
import { extractAiJsonObject } from './ai-response'

describe('AI response JSON extraction', () => {
  it('extracts Kimi/Moonshot content[0].text', () => {
    expect(
      extractAiJsonObject({ content: [{ text: '```json\n{"a":1}\n```' }] }),
    ).toEqual({ a: 1 })
  })

  it('extracts OpenAI choices[0].message.content', () => {
    expect(
      extractAiJsonObject({ choices: [{ message: { content: '{"a":1}' } }] }),
    ).toEqual({ a: 1 })
  })

  it('extracts nested data.content', () => {
    expect(extractAiJsonObject({ data: { content: [{ text: '{"a":1}' }] } })).toEqual({
      a: 1,
    })
  })

  it('throws when there is no text', () => {
    expect(() => extractAiJsonObject({})).toThrow(BadRequestException)
  })

  it('throws when there is no JSON object', () => {
    expect(() => extractAiJsonObject({ content: [{ text: 'sorry, no json' }] })).toThrow(
      BadRequestException,
    )
  })

  it('throws on invalid JSON instead of returning an empty patch', () => {
    expect(() => extractAiJsonObject({ content: [{ text: '{not json}' }] })).toThrow(
      BadRequestException,
    )
  })

  it('rejects a JSON array at the top level', () => {
    expect(() => extractAiJsonObject({ content: [{ text: '[1,2]' }] })).toThrow(
      BadRequestException,
    )
  })
})
