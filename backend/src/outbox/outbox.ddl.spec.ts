import { OUTBOX_DDL } from './outbox.ddl'

describe('Outbox DDL 常量', () => {
  it('事件表：幂等键 UNIQUE + 投递扫描索引 + TypeORM 外键哈希', () => {
    const joined = OUTBOX_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.outbox_events')
    expect(joined).toContain('PK_6689a16c00d09b8089f6237f1d2')
    expect(joined).toContain('UQ_2664623806d6e3483057865b8b6')
    expect(joined).toContain('FK_7ef528beecf23e5e0134ef8884f')
    expect(joined).toContain('UNIQUE ("idempotencyKey")')
    expect(joined).toContain('IDX_d2869b821d7b201618c9858ab6')
    expect(joined).toContain('IDX_d2d9822da80020878a360eaf40')
    expect(joined).toContain('IDX_34d5a8c6d3ddf4e6375e11131c')
  })

  it('去重表：UNIQUE(eventId, subscriber) + ON DELETE CASCADE', () => {
    const joined = OUTBOX_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.outbox_deliveries')
    expect(joined).toContain('PK_553a2a80e9203a20e34f9771f34')
    expect(joined).toContain('UQ_613903349ab26e7092581449581')
    expect(joined).toContain('FK_b24a7e1b4c667e72d9f7b5fc204')
    expect(joined).toContain('UNIQUE ("eventId", subscriber)')
    expect(joined).toContain('ON DELETE CASCADE')
  })
})
