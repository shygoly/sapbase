import { QueryFailedError } from 'typeorm'
import { NotificationRecord } from '../../notifications/notification.entity'
import { NotificationService } from './notification.service'

function uniqueViolation(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'))
  Object.assign(error, { code: '23505' })
  return error
}

type Stored = {
  id: string
  userId: string
  organizationId: string
  type: string
  title: string
  body: string | null
  read: boolean
  sourceEventId: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

function fakeDataSource(store: Stored[]) {
  return {
    getRepository: (entity: unknown) => {
      expect(entity).toBe(NotificationRecord)
      return {
        create: (row: Stored) => row,
        save: async (row: Stored) => {
          if (
            row.sourceEventId &&
            store.some((item) => item.sourceEventId === row.sourceEventId && item.userId === row.userId)
          ) {
            throw uniqueViolation()
          }
          store.push({ ...row, read: row.read ?? false })
          return row
        },
        find: async (opts: { where: Partial<Stored> }) => {
          return store.filter((item) => {
            if (opts.where.userId && item.userId !== opts.where.userId) return false
            if (opts.where.organizationId && item.organizationId !== opts.where.organizationId) {
              return false
            }
            if (opts.where.read === false && item.read !== false) return false
            return true
          })
        },
        update: async (where: Partial<Stored>, patch: Partial<Stored>) => {
          let affected = 0
          for (const item of store) {
            if (item.id !== where.id || item.userId !== where.userId) continue
            if (where.organizationId && item.organizationId !== where.organizationId) continue
            Object.assign(item, patch)
            affected += 1
          }
          return { affected }
        },
      }
    },
  }
}

describe('NotificationService 持久化', () => {
  it('重启不丢：新实例读同一份表仍见未读', async () => {
    const store: Stored[] = []
    const first = new NotificationService(fakeDataSource(store) as never)
    await first.sendToUser('11111111-1111-4111-8111-111111111111', {
      organizationId: '99999999-9999-4999-8999-999999999999',
      type: 'info',
      title: '待审',
      message: '有一张单等你批',
    })
    expect(store).toHaveLength(1)
    expect(store[0].read).toBe(false)

    const restarted = new NotificationService(fakeDataSource(store) as never)
    const unread = await restarted.listForUser(
      '11111111-1111-4111-8111-111111111111',
      '99999999-9999-4999-8999-999999999999',
      false,
    )
    expect(unread).toHaveLength(1)
    expect(unread[0].title).toBe('待审')
    expect(unread[0].read).toBe(false)
  })

  it('同一 sourceEventId + userId 不写第二行', async () => {
    const store: Stored[] = []
    const service = new NotificationService(fakeDataSource(store) as never)
    const input = {
      organizationId: '99999999-9999-4999-8999-999999999999',
      type: 'info' as const,
      title: '待审',
      message: '有一张单等你批',
    }
    await service.sendToUser('11111111-1111-4111-8111-111111111111', input, 'evt-1')
    await service.sendToUser('11111111-1111-4111-8111-111111111111', input, 'evt-1')
    expect(store).toHaveLength(1)
  })

  it('已读持久；越权 id 不改别人的行', async () => {
    const store: Stored[] = []
    const service = new NotificationService(fakeDataSource(store) as never)
    await service.sendToUser('11111111-1111-4111-8111-111111111111', {
      organizationId: '99999999-9999-4999-8999-999999999999',
      type: 'info',
      title: 'A',
      message: 'A',
    })
    const id = store[0].id
    const other = await service.markAsRead('22222222-2222-4222-8222-222222222222', id)
    expect(other).toBe(false)
    expect(store[0].read).toBe(false)
    const mine = await service.markAsRead(
      '11111111-1111-4111-8111-111111111111',
      id,
      '99999999-9999-4999-8999-999999999999',
    )
    expect(mine).toBe(true)
    expect(store[0].read).toBe(true)
  })

  it('负例：缺 organizationId 不写表', async () => {
    const store: Stored[] = []
    const service = new NotificationService(fakeDataSource(store) as never)
    await service.sendToUser('11111111-1111-4111-8111-111111111111', {
      type: 'info',
      title: '无租户',
      message: '不应落库',
    })
    expect(store).toHaveLength(0)
  })
})
