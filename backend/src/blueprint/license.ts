/**
 * 蓝图授权签名：Ed25519，Node 内置 crypto，零新依赖。
 * 与 wasm-modules 的签名选择同一套，不新造第二套密码学（元语不变量 12）。
 */
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import { canonicalizeJson } from './canonical-json'
import { stampSignature, unpackBlueprint } from './packager'

export interface BlueprintLicense {
  license: 'blueprint-license/v1' | string
  grantedTo: string[]
  resell: boolean
  expiresAt?: string
  issuer: string
  signature?: string
}

/** 签名覆盖对象：manifest 去掉 signature，避免自指。 */
export function manifestPayload(manifest: BlueprintManifest): Record<string, unknown> {
  const { signature: _ignored, ...payload } = manifest
  return payload
}

export function signManifest(manifest: BlueprintManifest, privateKeyPem: string): string {
  const bytes = Buffer.from(canonicalizeJson(manifestPayload(manifest)))
  return sign(null, bytes, createPrivateKey(privateKeyPem)).toString('base64')
}

export function verifySignature(
  manifest: BlueprintManifest,
  signature: string,
  publicKeyPem: string,
): boolean {
  try {
    const bytes = Buffer.from(canonicalizeJson(manifestPayload(manifest)))
    return verify(null, bytes, createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

export function readTrustRoots(env: NodeJS.ProcessEnv): string[] {
  const raw = env.BLUEPRINT_LICENSE_PUBLIC_KEYS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) return []
    return parsed
  } catch {
    return []
  }
}

/** 未配置公钥 → 失败（fail-closed），不静默通过。 */
export function verifyAgainstTrustRoots(
  manifest: BlueprintManifest,
  signature: string,
  env: NodeJS.ProcessEnv,
): boolean {
  const roots = readTrustRoots(env)
  if (roots.length === 0) return false
  return roots.some((pem) => verifySignature(manifest, signature, pem))
}

export function isUnsignedExemption(env: NodeJS.ProcessEnv, allowUnsigned?: boolean): boolean {
  return (
    allowUnsigned === true ||
    env.BLUEPRINT_ALLOW_UNSIGNED === '1' ||
    env.BLUEPRINT_ALLOW_UNSIGNED === 'true'
  )
}

/** 平台侧签名并写回清单。私钥不得进仓库；调用方从环境或现场密钥对传入。 */
export function signPackage(packagePath: string, privateKeyPem: string): BlueprintManifest {
  const unpacked = unpackBlueprint(packagePath)
  const signature = signManifest(unpacked.manifest, privateKeyPem)
  return stampSignature(packagePath, signature)
}
