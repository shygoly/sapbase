/**
 * 测试夹具：把一条实现绑成**可运行**状态。
 *
 * 生产路径是 `submitted → built → tested → shadow → canary → active`，每一级都要
 * 平台记录的对应证据（闸 4）。在"验证执行链"的用例里重走这五级只是噪音 ——
 * 那些用例的对象是执行，不是准入。所以这里用闸 4 提供的**唯一例外**：一次性补录，
 * 且补录必须带理由与决定人（`decidedBy` 一眼能看出是测试）。
 *
 * 反面提醒：如果你在写"准入/闸 4"的用例，**不要**用这个夹具 ——
 * 那条路径必须逐级带证据走，见 `shadow-release.spec.ts`。
 */
import { AdmissionStatus } from './atomic-implementation.entity'
import type { AtomicRegistryService } from './atomic-registry.service'

export async function bindRunnableForTest(
  registry: AtomicRegistryService,
  contractId: string,
  input: Parameters<AtomicRegistryService['bindImplementation']>[1],
) {
  const impl = await registry.bindImplementation(contractId, {
    ...input,
    // 起点：闸 4 不允许"首次绑定就落在可运行状态"
    status: AdmissionStatus.SUBMITTED,
  })
  return registry.grandfatherImplementation(impl.id, {
    reason: '测试夹具：替代逐级晋升（本条不验证准入，只验证执行）',
    decidedBy: 'jest-fixture',
  })
}
