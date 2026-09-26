/**
 * 本文件在 2026-09-25 按**当前实现**重写过（change: restore-green-backend-tests）。
 * 旧断言对着另一套 API，写下来就没跑过（tsc 能看出来，以前没跑整仓）。改了什么见文件内注释与
 * change 的 tasks.md「被测行为已删除的用例」表。
 */
import { SlugGenerator } from './slug-generator.service'
import { OrganizationSlug } from '../value-objects/organization-slug.vo'

describe('SlugGenerator (Domain Service)', () => {
  it.each([
    ['Test Organization', 'test-organization'],
    ['Test & Organization', 'test-organization'],
    ['Test   Organization', 'test-organization'],
    ['TEST ORGANIZATION', 'test-organization'],
  ])('generate(%s) → %s', (name, expected) => {
    const slug = SlugGenerator.generate(name)

    expect(slug).toBeInstanceOf(OrganizationSlug)
    expect(slug.toString()).toBe(expected)
  })
})
