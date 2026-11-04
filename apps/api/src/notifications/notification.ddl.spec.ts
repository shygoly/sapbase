import { NOTIFICATIONS_DDL } from './notification.ddl'

describe('Notifications DDL 常量', () => {
  it('表：UNIQUE(sourceEventId, userId) + 两索引 + TypeORM 外键哈希', () => {
    const joined = NOTIFICATIONS_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.notifications')
    expect(joined).toContain('PK_6a72c3c0f683f6462415e653c3a')
    expect(joined).toContain('UQ_479a637eaa18f30ade2757e6afa')
    expect(joined).toContain('FK_928914a0743f50e6f83a90cdda9')
    expect(joined).toContain('UNIQUE ("sourceEventId", "userId")')
    expect(joined).toContain('IDX_b055cfdba5009facbb972837dd')
    expect(joined).toContain('IDX_d4ab04c0b8e2d7435ec2357cce')
  })

  it('负例：DDL 不是第二份建表语句', () => {
    const creates = NOTIFICATIONS_DDL.filter((sql) =>
      /CREATE TABLE/i.test(sql),
    )
    expect(creates).toHaveLength(1)
    expect(creates[0]).not.toContain('pendingNotifications')
  })
})
