/**
 * 本文件在 2026-09-25 按**当前实现**重写过（change: restore-green-backend-tests）。
 * 旧断言对着另一套 API，写下来就没跑过（tsc 能看出来，以前没跑整仓）。改了什么见文件内注释与
 * change 的 tasks.md「被测行为已删除的用例」表。
 */
import { OrganizationSlug } from './organization-slug.vo'
import { DomainError } from '../errors'

describe('OrganizationSlug (Value Object)', () => {
  describe('create（会做归一化，不做校验）', () => {
    it('should create a valid slug', () => {
      expect(OrganizationSlug.create('test-org').toString()).toBe('test-org')
    })

    it('should normalize slug to lowercase', () => {
      expect(OrganizationSlug.create('TEST-ORG').toString()).toBe('test-org')
    })

    it('should replace spaces with hyphens', () => {
      expect(OrganizationSlug.create('test org').toString()).toBe('test-org')
    })

    it('should strip characters that cannot appear in a slug', () => {
      expect(OrganizationSlug.create('Test & Organization').toString()).toBe('test-organization')
    })
  })

  // 校验在 fromString（外部输入进来的 slug 才需要验）。create 是"由名字推导"，只有归一化。
  // 旧规格曾在 create 上断言 5 类校验，那些校验在 create 路径上**从来不存在** —— 已在
  // tasks.md 登记为"实现缺口：由名字推导出的 slug 可能是空的"。
  describe('fromString（会校验）', () => {
    it('should reject empty slug', () => {
      expect(() => OrganizationSlug.fromString('')).toThrow(DomainError)
    })

    it('should reject uppercase / underscore', () => {
      expect(() => OrganizationSlug.fromString('Test_Org')).toThrow(DomainError)
    })

    it('should accept a well-formed slug', () => {
      expect(OrganizationSlug.fromString('test-org').toString()).toBe('test-org')
    })
  })

  describe('equals', () => {
    it('should return true for equal slugs', () => {
      expect(OrganizationSlug.create('test-org').equals(OrganizationSlug.create('test-org'))).toBe(true)
    })

    it('should return false for different slugs', () => {
      expect(OrganizationSlug.create('test-org').equals(OrganizationSlug.create('other-org'))).toBe(false)
    })

    it('should be case-insensitive (both sides normalize)', () => {
      expect(OrganizationSlug.create('test-org').equals(OrganizationSlug.create('TEST-ORG'))).toBe(true)
    })
  })
})
