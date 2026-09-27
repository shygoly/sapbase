// HTTP 面：空消息 / 缺组织上下文按既有语义拒；权限只从 req.user 来。
import { HttpException } from '@nestjs/common'
import { ChatController } from './chat.controller'

describe('ChatController', () => {
  it('message 为空或空白 → 400，说清原因', async () => {
    const orchestrator = { handleMessage: jest.fn() }
    const controller = new ChatController(orchestrator as never)
    const user = { organizationId: 'org-1', email: 'a@b.c', permissions: [] }

    for (const body of [{}, { message: '' }, { message: '   ' }, { message: 1 }]) {
      try {
        await controller.message(body as never, { user })
        throw new Error('本应被拒')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect((error as HttpException).getStatus()).toBe(400)
        expect(JSON.stringify((error as HttpException).getResponse())).toContain('message 不能为空')
      }
    }
    expect(orchestrator.handleMessage).not.toHaveBeenCalled()
  })

  it('缺 organizationId → 400 且说明无法记录审计', async () => {
    const orchestrator = { handleMessage: jest.fn() }
    const controller = new ChatController(orchestrator as never)
    try {
      await controller.message({ message: '列出已登记的蓝图包' }, { user: { email: 'a@b.c' } })
      throw new Error('本应被拒')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      expect((error as HttpException).getStatus()).toBe(400)
      const payload = (error as HttpException).getResponse() as { code?: string; message?: string }
      expect(payload.code).toBe('INVALID_INPUT')
      expect(payload.message).toContain('organizationId')
      expect(payload.message).toContain('无法记录审计')
    }
    expect(orchestrator.handleMessage).not.toHaveBeenCalled()
  })

  it('身份与权限只从 req.user 取，不从 body 信任', async () => {
    const orchestrator = {
      handleMessage: jest.fn(async () => ({ kind: 'refusal', message: '没有这个能力' })),
    }
    const controller = new ChatController(orchestrator as never)
    await controller.message(
      { message: '列出已登记的蓝图包', permissions: ['tool:god'] } as never,
      {
        user: {
          organizationId: 'org-1',
          email: 'a@b.c',
          permissions: ['tool:blueprint:read'],
        },
      },
    )
    expect(orchestrator.handleMessage).toHaveBeenCalledWith('列出已登记的蓝图包', {
      organizationId: 'org-1',
      actor: 'a@b.c',
      grantedPermissions: ['tool:blueprint:read'],
    })
  })
})
