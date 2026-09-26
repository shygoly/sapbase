/**
 * 汽配五原子的库内登记（真实部署入口）。
 *
 * 为什么不在这里再写一份契约：列布局 / 权限点 / 错误码的唯一真源是
 * `atomic-runtime/autoparts-contracts.ts`。本文件只负责把它落到 PostgreSQL。
 * 实现哈希从 `wasm-modules/build/manifest.json` 读并对字节重算（不采信自述）。
 */
import { DataSource } from 'typeorm'
import { AtomicContract } from '../atomic-registry/atomic-contract.entity'
import { AtomicImplementation } from '../atomic-registry/atomic-implementation.entity'
import { AtomicModuleManifest } from '../atomic-registry/atomic-module-manifest.entity'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { registerAutopartsContracts } from '../atomic-runtime/autoparts-contracts'

export async function seedAutopartsAtoms(
  registry: AtomicRegistryService,
): Promise<Array<{ atomicType: string; contractId: string; sha256: string }>> {
  return registerAutopartsContracts(registry)
}

/** 从已连接的 DataSource 取出注册表服务再登记（幂等）。 */
export async function seedAutopartsAtomsFromDataSource(
  dataSource: DataSource,
): Promise<Array<{ atomicType: string; contractId: string; sha256: string }>> {
  const registry = new AtomicRegistryService(
    dataSource.getRepository(AtomicContract),
    dataSource.getRepository(AtomicImplementation),
    dataSource.getRepository(AtomicModuleManifest),
  )
  return seedAutopartsAtoms(registry)
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'mac',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sapbasic',
    entities: [
      AtomicContract,
      AtomicImplementation,
      AtomicModuleManifest,
    ],
    synchronize: false,
  })
  await dataSource.initialize()
  try {
    const result = await seedAutopartsAtomsFromDataSource(dataSource)
    for (const row of result) {
      console.log(
        `seeded ${row.atomicType} contract=${row.contractId} sha256=${row.sha256.slice(0, 12)}…`,
      )
    }
  } finally {
    await dataSource.destroy()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
