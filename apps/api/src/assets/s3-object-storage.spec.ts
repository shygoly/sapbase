import { S3ObjectStorage } from '@sap/platform-core/assets/s3-object-storage'

describe('S3ObjectStorage', () => {
  const storage = new S3ObjectStorage({
    bucket: 'assets',
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:9000',
    forcePathStyle: true,
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  })

  it('生成带签名的 read/write URL', async () => {
    const read = await storage.signedUrl('org/o/a.png', 'read', 60)
    expect(read).toContain('X-Amz-Signature=')
    expect(read).toContain('assets')
    const write = await storage.signedUrl('org/o/a.png', 'write', 60)
    expect(write).toContain('X-Amz-Signature=')
  })

  it('生成 multipart part URL', async () => {
    const url = await storage.signedPartUrl('org/o/video.mp4', 'upload-1', 2, 60)
    expect(url).toContain('partNumber=2')
    expect(url).toContain('uploadId=upload-1')
    expect(url).toContain('X-Amz-Signature=')
  })

  it('拒绝路径穿越', async () => {
    await expect(storage.signedUrl('../escape', 'read', 60)).rejects.toThrow(/非法对象 key/)
  })
})
