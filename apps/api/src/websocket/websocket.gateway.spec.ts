import { AppWebSocketGateway } from './websocket.gateway'

function gatewayWithBus() {
  const handlers: Array<(event: any) => void> = []
  const bus = {
    publish: jest.fn(),
    subscribe: jest.fn((handler: (event: any) => void) => {
      handlers.push(handler)
      return () => undefined
    }),
  }
  const notifications = {
    setServer: jest.fn(),
    setGetOrganizationUsers: jest.fn(),
    sendPendingNotifications: jest.fn(),
  }
  const gateway = new AppWebSocketGateway(
    {} as never,
    notifications as never,
    {} as never,
    bus as never,
  )
  gateway.afterInit({} as never)
  return { gateway, bus, handlers }
}

describe('AppWebSocketGateway session revocation', () => {
  it('订阅吊销事件；按 sid 断开并通知', () => {
    const { gateway, handlers } = gatewayWithBus()
    const socket = {
      sid: 'sid-1',
      userId: 'u1',
      emit: jest.fn(),
      disconnect: jest.fn(),
    }
    ;(gateway as any).connectedSessions.set('sid-1', socket)
    ;(gateway as any).connectedUsers.set('u1', socket)
    handlers[0]({ sid: 'sid-1', userId: 'u1', reason: 'forced-offline' })
    expect(socket.emit).toHaveBeenCalledWith('session:revoked', {
      reason: 'forced-offline',
    })
    expect(socket.disconnect).toHaveBeenCalledWith(true)
    expect((gateway as any).connectedSessions.has('sid-1')).toBe(false)
  })

  it('用户级吊销（无 sid）断开该用户当前连接', () => {
    const { gateway, handlers } = gatewayWithBus()
    const socket = {
      sid: 'sid-2',
      userId: 'u2',
      emit: jest.fn(),
      disconnect: jest.fn(),
    }
    ;(gateway as any).connectedUsers.set('u2', socket)
    handlers[0]({ userId: 'u2', reason: 'password-changed' })
    expect(socket.disconnect).toHaveBeenCalledWith(true)
  })
})
