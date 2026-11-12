import { generateKeyPairSync } from 'node:crypto'
import { SignedXml } from 'xml-crypto'
import { createSamlXmlDsigVerifier } from '@sap/platform-core/identity/sso/saml-xml-dsig.verifier'

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  return { privateKey, publicKey }
}

function signedAssertion(privateKey: string, publicKey: string): string {
  const xml = `<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" ID="assert-1"><saml2:Issuer>https://idp.example.com</saml2:Issuer><saml2:Subject><saml2:NameID>ext-1</saml2:NameID></saml2:Subject></saml2:Assertion>`
  const sig = new SignedXml({
    privateKey,
    publicCert: publicKey,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  })
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  })
  sig.computeSignature(xml)
  return sig.getSignedXml()
}

describe('SAML XML DSig verifier', () => {
  it('验签通过；篡改后失败', async () => {
    const { privateKey, publicKey } = keypair()
    const signed = signedAssertion(privateKey, publicKey)
    const verify = createSamlXmlDsigVerifier(publicKey)
    await expect(verify(signed, publicKey)).resolves.toBe(true)
    await expect(verify(signed.replace('ext-1', 'ext-2'), publicKey)).resolves.toBe(false)
  })

  it('证书指纹不匹配 → fail-closed', async () => {
    const { privateKey, publicKey } = keypair()
    const signed = signedAssertion(privateKey, publicKey)
    const verify = createSamlXmlDsigVerifier(publicKey, 'deadbeef')
    await expect(verify(signed, publicKey)).resolves.toBe(false)
  })
})
