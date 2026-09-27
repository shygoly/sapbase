import { ForbiddenException } from '@nestjs/common'
import { canonicalizeJson } from '../blueprint/canonical-json'
import {
  CONFIRMATION_TOKEN_TTL_MS,
  ConfirmationTokenService,
  digestToolArgs,
} from './confirmation-token.service'

describe('digestToolArgs', () => {
  it('是 canonicalizeJson(args) 的 sha256 十六进制', () => {
    const { createHash } = require('node:crypto') as typeof import('node:crypto')
    const args = { b: 1, a: 2 }
    expect(digestToolArgs(args)).toBe(
      createHash('sha256').update(canonicalizeJson(args)).digest('hex'),
    )
    expect(digestToolArgs({ a: 2, b: 1 })).toBe(digestToolArgs({ b: 1, a: 2 }))
  })
})

describe('ConfirmationTokenService', () => {
  function createService(queryImpl?: jest.Mock) {
    const saved: Array<Record<string, unknown>> = []
    const query = queryImpl ?? jest.fn(async () => [[], 1])
    const repo = {
      create: (row: Record<string, unknown>) => row,
      save: jest.fn(async (row: Record<string, unknown>) => {
        const stored = { ...row, id: 'tok-1' }
        saved.push(stored)
        return stored
      }),
      query,
    }
    return {
      service: new ConfirmationTokenService(repo as never),
      repo,
      saved,
      query,
    }
  }

  it('签发 → 消费成功（影响行数 1）', async () => {
    const { service, query, saved } = createService(jest.fn(async () => [[], 1]))
    const issued = await service.issue({
      organizationId: 'org-1',
      tool: 'erp_module_export',
      args: { id: 'mod-1' },
      actor: 'user@example.com',
    })
    expect(issued.token).toBe('tok-1')
    expect(issued.tool).toBe('erp_module_export')
    expect(issued.argsDigest).toBe(digestToolArgs({ id: 'mod-1' }))
    expect(issued.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      CONFIRMATION_TOKEN_TTL_MS + 50,
    )
    expect(saved[0].consumedAt).toBeNull()

    await service.consume({
      token: issued.token,
      organizationId: 'org-1',
      tool: 'erp_module_export',
      argsDigest: issued.argsDigest,
    })
    expect(query).toHaveBeenCalledTimes(1)
    const sql = String(query.mock.calls[0][0])
    expect(sql).toContain('"consumedAt" IS NULL')
    expect(sql).toContain('"expiresAt" > now()')
    expect(query.mock.calls[0][1]).toEqual([
      'tok-1',
      'erp_module_export',
      issued.argsDigest,
      'org-1',
    ])
  })

  it('二次消费同一令牌 → 拒', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[], 1])
      .mockResolvedValueOnce([[], 0])
    const { service } = createService(query)
    const issued = await service.issue({
      organizationId: 'org-1',
      tool: 'erp_module_export',
      args: { id: 'mod-1' },
      actor: 'user@example.com',
    })
    await service.consume({
      token: issued.token,
      organizationId: 'org-1',
      tool: issued.tool,
      argsDigest: issued.argsDigest,
    })
    await expect(
      service.consume({
        token: issued.token,
        organizationId: 'org-1',
        tool: issued.tool,
        argsDigest: issued.argsDigest,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('过期令牌 → 拒；工具/摘要/组织不匹配 → 拒', async () => {
    const query = jest.fn(async () => [[], 0])
    const { service } = createService(query)
    const issued = await service.issue({
      organizationId: 'org-1',
      tool: 'erp_module_export',
      args: { id: 'mod-1' },
      actor: 'user@example.com',
    })

    await expect(
      service.consume({
        token: issued.token,
        organizationId: 'org-1',
        tool: issued.tool,
        argsDigest: issued.argsDigest,
      }),
    ).rejects.toThrow(/过期|已用|不匹配/)

    await expect(
      service.consume({
        token: issued.token,
        organizationId: 'org-other',
        tool: issued.tool,
        argsDigest: issued.argsDigest,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    await expect(
      service.consume({
        token: issued.token,
        organizationId: 'org-1',
        tool: 'erp_blueprint_list',
        argsDigest: issued.argsDigest,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    await expect(
      service.consume({
        token: issued.token,
        organizationId: 'org-1',
        tool: issued.tool,
        argsDigest: digestToolArgs({ id: 'changed' }),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
