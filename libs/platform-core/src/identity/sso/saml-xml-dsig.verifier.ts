import { createHash } from 'node:crypto'
import { DOMParser } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'
import type { SamlSignatureVerifier } from './saml-sso.adapter'

const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'

function normalizeCertificate(certificate: string): string {
  return certificate
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '')
}

function firstSignature(xml: string): any {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const namespaced = doc.getElementsByTagNameNS(DSIG_NS, 'Signature')
  if (namespaced.length > 0) return namespaced.item(0)
  const plain = doc.getElementsByTagName('Signature')
  return plain.length > 0 ? plain.item(0) : null
}

/**
 * 生产 XML DSig verifier：
 *   - 只信任配置的 IdP 证书（可选 SHA-256 指纹固定）
 *   - 校验签名与引用摘要；失败一律 false（调用方 fail-closed）
 */
export function createSamlXmlDsigVerifier(
  certificate: string,
  fingerprint?: string | null,
): SamlSignatureVerifier {
  return async (xml: string): Promise<boolean> => {
    if (fingerprint) {
      const actual = createHash('sha256')
        .update(normalizeCertificate(certificate))
        .digest('hex')
      if (actual !== fingerprint.replace(/[^a-f0-9]/gi, '').toLowerCase()) {
        return false
      }
    }
    const signatureNode = firstSignature(xml)
    if (!signatureNode) return false
    try {
      const signedXml = new SignedXml({
        publicCert: certificate,
        getCertFromKeyInfo: () => certificate,
      })
      signedXml.loadSignature(signatureNode)
      return signedXml.checkSignature(xml)
    } catch {
      return false
    }
  }
}
