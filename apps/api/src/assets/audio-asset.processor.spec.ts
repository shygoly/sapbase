import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalObjectStorage } from '@sap/platform-core/assets/local-object-storage'
import { AudioAssetProcessor } from '@sap/platform-core/assets/audio-asset.processor'

describe('AudioAssetProcessor', () => {
  it('probe 时长并生成 waveform', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asset-audio-spec-'))
    const wav = join(dir, 'a.wav')
    execFileSync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      wav,
    ])
    const storage = new LocalObjectStorage({ rootDir: dir })
    const key = 'org/org-1/assets/a.wav'
    await storage.put(key, readFileSync(wav), { contentType: 'audio/wav' })
    const processor = new AudioAssetProcessor(storage)
    const result = await processor.process({
      id: 'a1',
      organizationId: 'org-1',
      objectKey: key,
      kind: 'audio',
      mimeType: 'audio/wav',
      originalName: 'a.wav',
      metadata: { generateWaveform: true },
    } as never)
    expect(result.status).toBe('ready')
    expect(result.durationMs).toBeGreaterThanOrEqual(900)
    expect(result.variants?.some((variant) => variant.kind === 'waveform')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})
