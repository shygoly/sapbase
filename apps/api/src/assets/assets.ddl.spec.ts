import { ASSET_DDL } from './assets.ddl'
import { Asset, AssetUploadSession, AssetVariant } from './entities'
import { PLATFORM_CORE_ENTITIES } from '../platform-core.entities'

describe('asset DDL/registration', () => {
  const joined = ASSET_DDL.join('\n')

  it('创建 assets / asset_variants / asset_upload_sessions', () => {
    for (const table of ['assets', 'asset_variants', 'asset_upload_sessions']) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
    expect(joined).toContain('UQ_asset_org_object_key')
    expect(joined).toContain('UQ_asset_variant_asset_kind')
    expect(joined).toContain('UQ_asset_upload_object_key')
  })

  it('实体注册包含资产三张表', () => {
    const names = PLATFORM_CORE_ENTITIES.map((entity) => entity.name)
    expect(names).toEqual(expect.arrayContaining(['Asset', 'AssetVariant', 'AssetUploadSession']))
    expect([Asset, AssetVariant, AssetUploadSession]).toHaveLength(3)
  })
})
