import { ModulesContainer } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { PLATFORM_CORE_ENTITIES } from './platform-core.entities'
import { PlatformEntityRegistrationCheck } from './platform-entity-registration.check'

function modulesWith(tokens: unknown[]): ModulesContainer {
  const providers = new Map(tokens.map((token, index) => [index, { token }]))
  return {
    values: () => [{ providers }],
  } as unknown as ModulesContainer
}

function dataSourceWith(missing?: new (...args: never[]) => unknown): DataSource {
  return {
    hasMetadata: (entity: unknown) => entity !== missing,
  } as unknown as DataSource
}

function allRepositoryTokens(): unknown[] {
  return PLATFORM_CORE_ENTITIES.map((entity) => getRepositoryToken(entity))
}

describe('PlatformEntityRegistrationCheck', () => {
  it('passes when every entity has metadata and a forFeature repository', () => {
    const check = new PlatformEntityRegistrationCheck(dataSourceWith(), modulesWith(allRepositoryTokens()))
    expect(() => check.onApplicationBootstrap()).not.toThrow()
  })

  it('fails when an entity is missing from the DataSource', () => {
    const missing = PLATFORM_CORE_ENTITIES[0]
    const check = new PlatformEntityRegistrationCheck(dataSourceWith(missing), modulesWith(allRepositoryTokens()))
    expect(() => check.onApplicationBootstrap()).toThrow(
      new RegExp(`${missing.name} 未注册到 TypeORM DataSource`),
    )
  })

  it('fails when an entity is not covered by any forFeature registration', () => {
    const tokens = allRepositoryTokens()
    const missing = PLATFORM_CORE_ENTITIES[PLATFORM_CORE_ENTITIES.length - 1]
    const check = new PlatformEntityRegistrationCheck(
      dataSourceWith(),
      modulesWith(tokens.filter((token) => token !== getRepositoryToken(missing))),
    )
    expect(() => check.onApplicationBootstrap()).toThrow(
      new RegExp(`${missing.name} 未被任何 TypeOrmModule\\.forFeature 覆盖`),
    )
  })

  it('reports every failure in one startup error', () => {
    const check = new PlatformEntityRegistrationCheck(dataSourceWith(), modulesWith([]))
    try {
      check.onApplicationBootstrap()
      throw new Error('expected check to fail')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain(`实体注册自检失败（${PLATFORM_CORE_ENTITIES.length} 项）`)
      for (const entity of PLATFORM_CORE_ENTITIES) {
        expect(message).toContain(entity.name)
      }
    }
  })
})
