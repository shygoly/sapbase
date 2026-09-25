// 模块吊销 —— 三条路各自独立生效，叠加使用：
//   1. 吊销名单（本文件）：平台把哈希打进名单，Runtime 随批次拿到；
//   2. 撤 Blueprint 固定：客户把 Blueprint 里的 pinnedModules 改掉 → 哈希不符当场拒；
//   3. 撤签名：平台不再对该哈希出签名 → 新 Runtime 拉不到可验证的模块。
//
// 执行前检查 1：吊销即拒、**不回退到内置实现** —— 静默回退等于吊销没做。
//
// 移植来源：medtrust/packages/wasm-algorithms（SM3 → SHA-256，见 README）。

export type RevocationReason =
  | "security-incident"
  | "failed-shadow"
  | "reproducibility-lost"
  | "vendor-withdrawn"
  | "superseded"
  | "other";

export interface ModuleRevocation {
  /** 被吊销模块的 SHA-256（小写 64 hex）。 */
  sha256: string;
  reason: RevocationReason;
  /** 吊销时间（ISO）。 */
  revokedAt: string;
  /** 吊销发起方（平台审查者 / 客户管理员）。 */
  revokedBy: string;
  detail?: string;
}

/** 随批次下发给 Runtime 的吊销名单。 */
export interface RevocationList {
  /** 名单版本（单调递增，Runtime 据此判断是否更新）。 */
  version: number;
  issuedAt: string;
  revoked: ModuleRevocation[];
}

export const EMPTY_REVOCATION_LIST: RevocationList = {
  version: 0,
  issuedAt: new Date(0).toISOString(),
  revoked: [],
};

export class ModuleRevokedError extends Error {
  constructor(
    readonly sha256: string,
    readonly revocation: ModuleRevocation,
  ) {
    super(
      `模块已吊销，拒绝执行且不回退到内置实现：sha256=${sha256} ` +
        `reason=${revocation.reason} at=${revocation.revokedAt} by=${revocation.revokedBy}` +
        (revocation.detail ? ` detail=${revocation.detail}` : ""),
    );
    this.name = "ModuleRevokedError";
  }
}

/** 查名单。命中返回吊销记录，未命中返回 undefined。 */
export function findRevocation(
  list: RevocationList | undefined,
  sha256: string,
): ModuleRevocation | undefined {
  if (!list) return undefined;
  const key = (sha256 ?? "").toLowerCase();
  return list.revoked.find((r) => r.sha256.toLowerCase() === key);
}

/**
 * 执行前吊销检查。命中即抛 ModuleRevokedError。
 *
 * 注意"名单缺失"不等于"未吊销"：Runtime 从未拿到过名单时，调用方应按部署策略
 * 决定 —— 本函数只负责"拿到的名单说什么"。
 */
export function assertNotRevoked(
  list: RevocationList | undefined,
  sha256: string,
): void {
  const hit = findRevocation(list, sha256);
  if (hit) throw new ModuleRevokedError(sha256.toLowerCase(), hit);
}

/** 合并新下发的名单：版本更高才接受（防回放旧名单把吊销"撤销"掉）。 */
export function mergeRevocationList(
  current: RevocationList,
  incoming: RevocationList,
): RevocationList {
  return incoming.version > current.version ? incoming : current;
}
