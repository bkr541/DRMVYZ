import { describe, expect, it } from 'vitest'
import {
  buildWavTranscriptionChunk,
  isRiffWave,
  planWavTranscriptionChunks,
  WavChunkingError,
} from '../../../../supabase/functions/_shared/wavAudioChunking'

function writeFourCc(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < 4; index += 1) bytes[offset + index] = value.charCodeAt(index)
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function readFourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0
}

function makePcmWav(options: {
  sampleRate?: number
  channelCount?: number
  bitsPerSample?: number
  durationSec?: number
  audioFormat?: number
} = {}): Uint8Array {
  const sampleRate = options.sampleRate ?? 1_000
  const channelCount = options.channelCount ?? 1
  const bitsPerSample = options.bitsPerSample ?? 16
  const durationSec = options.durationSec ?? 12
  const audioFormat = options.audioFormat ?? 1
  const blockAlign = channelCount * (bitsPerSample / 8)
  const dataBytes = sampleRate * durationSec * blockAlign
  const output = new Uint8Array(44 + dataBytes)
  writeFourCc(output, 0, 'RIFF')
  writeUint32(output, 4, output.byteLength - 8)
  writeFourCc(output, 8, 'WAVE')
  writeFourCc(output, 12, 'fmt ')
  writeUint32(output, 16, 16)
  writeUint16(output, 20, audioFormat)
  writeUint16(output, 22, channelCount)
  writeUint32(output, 24, sampleRate)
  writeUint32(output, 28, sampleRate * blockAlign)
  writeUint16(output, 32, blockAlign)
  writeUint16(output, 34, bitsPerSample)
  writeFourCc(output, 36, 'data')
  writeUint32(output, 40, dataBytes)
  for (let offset = 44; offset < output.byteLength; offset += 1) output[offset] = offset & 0xff
  return output
}

describe('WAV provider chunking', () => {
  it('splits PCM WAV audio into valid overlapped RIFF files below the provider limit', () => {
    const source = makePcmWav()
    const maxFileBytes = 8_000
    const plan = planWavTranscriptionChunks(source, { maxFileBytes, overlapMs: 1_000 })

    expect(plan.chunks.length).toBeGreaterThan(1)
    expect(plan.sampleRate).toBe(1_000)
    expect(plan.blockAlign).toBe(2)
    expect(plan.chunks[0].unit).toMatchObject({ startMs: 0, overlapBeforeMs: 0 })
    expect(plan.chunks[0].unit.overlapAfterMs).toBeGreaterThan(900)
    expect(plan.chunks[1].unit.startMs).toBe(
      plan.chunks[0].unit.endMs - plan.chunks[0].unit.overlapAfterMs,
    )
    expect(plan.chunks[plan.chunks.length - 1]?.unit.endMs).toBe(12_000)

    for (const descriptor of plan.chunks) {
      const chunk = buildWavTranscriptionChunk(source, plan, descriptor)
      expect(chunk.byteLength).toBe(descriptor.fileBytes)
      expect(chunk.byteLength).toBeLessThanOrEqual(maxFileBytes)
      expect(readFourCc(chunk, 0)).toBe('RIFF')
      expect(readFourCc(chunk, 8)).toBe('WAVE')
      expect(readFourCc(chunk, 12)).toBe('fmt ')
      expect(readFourCc(chunk, 36)).toBe('data')
      expect(readUint32(chunk, 4)).toBe(chunk.byteLength - 8)
      expect(readUint32(chunk, 40)).toBe(descriptor.dataEnd - descriptor.dataStart)
    }
  })

  it('recognizes RIFF/WAVE input and rejects compressed WAV payloads', () => {
    const pcm = makePcmWav()
    expect(isRiffWave(pcm)).toBe(true)
    expect(isRiffWave(new Uint8Array([1, 2, 3]))).toBe(false)

    const compressed = makePcmWav({ audioFormat: 6 })
    expect(() => planWavTranscriptionChunks(compressed, { maxFileBytes: 8_000 }))
      .toThrowError(WavChunkingError)
  })
})
