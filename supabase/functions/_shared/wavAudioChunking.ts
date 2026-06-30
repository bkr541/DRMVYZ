import type { TranscriptionUnitPlan } from './lyricTranscriptionCore.ts'

const RIFF_HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8
const FACT_SAMPLE_LENGTH_BYTES = 4
const PCM_FORMAT = 0x0001
const IEEE_FLOAT_FORMAT = 0x0003
const EXTENSIBLE_FORMAT = 0xfffe

export interface WavChunkDescriptor {
  index: number
  dataStart: number
  dataEnd: number
  frameStart: number
  frameEnd: number
  fileBytes: number
  unit: TranscriptionUnitPlan
}

export interface WavChunkPlan {
  formatPayload: Uint8Array
  sourceDataOffset: number
  sourceDataBytes: number
  sampleRate: number
  channelCount: number
  bitsPerSample: number
  blockAlign: number
  audioFormat: number
  includeFactChunk: boolean
  headerBytes: number
  totalFrames: number
  chunks: WavChunkDescriptor[]
}

export class WavChunkingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WavChunkingError'
  }
}

function bytesView(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

function readFourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function writeFourCc(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < 4; index += 1) bytes[offset + index] = value.charCodeAt(index)
}

function uint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function paddedChunkBytes(payloadBytes: number): number {
  return CHUNK_HEADER_BYTES + payloadBytes + (payloadBytes & 1)
}

function chunkHeaderBytes(formatPayloadBytes: number, includeFactChunk: boolean): number {
  return RIFF_HEADER_BYTES +
    paddedChunkBytes(formatPayloadBytes) +
    (includeFactChunk ? paddedChunkBytes(FACT_SAMPLE_LENGTH_BYTES) : 0) +
    CHUNK_HEADER_BYTES
}

function resolvedAudioFormat(formatPayload: Uint8Array): number {
  const formatTag = uint16(formatPayload, 0)
  if (formatTag !== EXTENSIBLE_FORMAT) return formatTag
  if (formatPayload.byteLength < 40) {
    throw new WavChunkingError('The WAVE_FORMAT_EXTENSIBLE header is incomplete.')
  }
  return uint16(formatPayload, 24)
}

function parseWav(input: ArrayBuffer | Uint8Array): Omit<WavChunkPlan, 'chunks'> {
  const bytes = bytesView(input)
  if (bytes.byteLength < RIFF_HEADER_BYTES || readFourCc(bytes, 0) !== 'RIFF' || readFourCc(bytes, 8) !== 'WAVE') {
    throw new WavChunkingError('The file is not a supported RIFF/WAVE container.')
  }

  let formatPayload: Uint8Array | null = null
  let sourceDataOffset = -1
  let sourceDataBytes = 0
  let offset = RIFF_HEADER_BYTES

  while (offset + CHUNK_HEADER_BYTES <= bytes.byteLength) {
    const chunkId = readFourCc(bytes, offset)
    const declaredBytes = uint32(bytes, offset + 4)
    const payloadOffset = offset + CHUNK_HEADER_BYTES
    const payloadEnd = payloadOffset + declaredBytes
    if (payloadEnd > bytes.byteLength) {
      throw new WavChunkingError(`The ${chunkId.trim() || 'unknown'} WAV chunk is truncated.`)
    }

    if (chunkId === 'fmt ' && formatPayload === null) {
      formatPayload = bytes.slice(payloadOffset, payloadEnd)
    } else if (chunkId === 'data' && sourceDataOffset < 0) {
      sourceDataOffset = payloadOffset
      sourceDataBytes = declaredBytes
    }

    offset = payloadEnd + (declaredBytes & 1)
  }

  if (!formatPayload || formatPayload.byteLength < 16) {
    throw new WavChunkingError('The WAV file does not contain a complete fmt chunk.')
  }
  if (sourceDataOffset < 0 || sourceDataBytes <= 0) {
    throw new WavChunkingError('The WAV file does not contain an audio data chunk.')
  }

  const audioFormat = resolvedAudioFormat(formatPayload)
  if (audioFormat !== PCM_FORMAT && audioFormat !== IEEE_FLOAT_FORMAT) {
    throw new WavChunkingError('Only uncompressed PCM or IEEE-float WAV files can be split safely.')
  }

  const channelCount = uint16(formatPayload, 2)
  const sampleRate = uint32(formatPayload, 4)
  const blockAlign = uint16(formatPayload, 12)
  const bitsPerSample = uint16(formatPayload, 14)
  if (channelCount <= 0 || sampleRate <= 0 || blockAlign <= 0 || bitsPerSample <= 0) {
    throw new WavChunkingError('The WAV format metadata is invalid.')
  }

  const totalFrames = Math.floor(sourceDataBytes / blockAlign)
  if (totalFrames <= 0) throw new WavChunkingError('The WAV data chunk does not contain complete audio frames.')
  const alignedDataBytes = totalFrames * blockAlign
  const includeFactChunk = audioFormat === IEEE_FLOAT_FORMAT
  const headerBytes = chunkHeaderBytes(formatPayload.byteLength, includeFactChunk)

  return {
    formatPayload,
    sourceDataOffset,
    sourceDataBytes: alignedDataBytes,
    sampleRate,
    channelCount,
    bitsPerSample,
    blockAlign,
    audioFormat,
    includeFactChunk,
    headerBytes,
    totalFrames,
  }
}

export function isRiffWave(input: ArrayBuffer | Uint8Array): boolean {
  const bytes = bytesView(input)
  return bytes.byteLength >= RIFF_HEADER_BYTES && readFourCc(bytes, 0) === 'RIFF' && readFourCc(bytes, 8) === 'WAVE'
}

export function planWavTranscriptionChunks(
  input: ArrayBuffer | Uint8Array,
  options: { maxFileBytes: number; overlapMs?: number },
): WavChunkPlan {
  const parsed = parseWav(input)
  const maxFileBytes = Math.floor(options.maxFileBytes)
  if (!Number.isFinite(maxFileBytes) || maxFileBytes <= parsed.headerBytes + parsed.blockAlign + 1) {
    throw new WavChunkingError('The configured provider byte limit is too small for a valid WAV chunk.')
  }

  // Reserve one byte for RIFF padding so every generated file remains below the limit.
  const maxDataBytes = Math.floor((maxFileBytes - parsed.headerBytes - 1) / parsed.blockAlign) * parsed.blockAlign
  const maxFrames = Math.floor(maxDataBytes / parsed.blockAlign)
  if (maxFrames <= 0) throw new WavChunkingError('The configured provider byte limit cannot hold one WAV audio frame.')

  const requestedOverlapMs = Number.isFinite(options.overlapMs) ? Math.max(0, Math.round(options.overlapMs ?? 0)) : 0
  const requestedOverlapFrames = Math.round((requestedOverlapMs / 1000) * parsed.sampleRate)
  const overlapFrames = Math.min(requestedOverlapFrames, Math.max(0, Math.floor(maxFrames / 4)), Math.max(0, maxFrames - 1))
  const chunks: WavChunkDescriptor[] = []

  let frameStart = 0
  let index = 0
  while (frameStart < parsed.totalFrames) {
    const frameEnd = Math.min(parsed.totalFrames, frameStart + maxFrames)
    const dataBytes = (frameEnd - frameStart) * parsed.blockAlign
    const startMs = Math.round((frameStart / parsed.sampleRate) * 1000)
    const endMs = Math.round((frameEnd / parsed.sampleRate) * 1000)
    const nextFrameStart = frameEnd === parsed.totalFrames ? parsed.totalFrames : frameEnd - overlapFrames
    const overlapAfterFrames = frameEnd === parsed.totalFrames ? 0 : frameEnd - nextFrameStart
    const priorFrameEnd = chunks[index - 1]?.frameEnd ?? frameStart
    const overlapBeforeFrames = index === 0 ? 0 : Math.max(0, priorFrameEnd - frameStart)
    const fileBytes = parsed.headerBytes + dataBytes + (dataBytes & 1)

    chunks.push({
      index,
      dataStart: parsed.sourceDataOffset + frameStart * parsed.blockAlign,
      dataEnd: parsed.sourceDataOffset + frameEnd * parsed.blockAlign,
      frameStart,
      frameEnd,
      fileBytes,
      unit: {
        index,
        startMs,
        endMs,
        overlapBeforeMs: Math.round((overlapBeforeFrames / parsed.sampleRate) * 1000),
        overlapAfterMs: Math.round((overlapAfterFrames / parsed.sampleRate) * 1000),
      },
    })

    if (frameEnd === parsed.totalFrames) break
    frameStart = nextFrameStart
    index += 1
  }

  return { ...parsed, chunks }
}

export function buildWavTranscriptionChunk(
  input: ArrayBuffer | Uint8Array,
  plan: WavChunkPlan,
  descriptor: WavChunkDescriptor,
): Uint8Array {
  const source = bytesView(input)
  if (descriptor.dataStart < plan.sourceDataOffset ||
      descriptor.dataEnd > plan.sourceDataOffset + plan.sourceDataBytes ||
      descriptor.dataEnd <= descriptor.dataStart) {
    throw new WavChunkingError('The requested WAV chunk is outside the source audio data.')
  }

  const dataBytes = descriptor.dataEnd - descriptor.dataStart
  const totalBytes = plan.headerBytes + dataBytes + (dataBytes & 1)
  if (totalBytes !== descriptor.fileBytes) throw new WavChunkingError('The WAV chunk plan is internally inconsistent.')

  const output = new Uint8Array(totalBytes)
  let offset = 0
  writeFourCc(output, offset, 'RIFF')
  writeUint32(output, offset + 4, totalBytes - 8)
  writeFourCc(output, offset + 8, 'WAVE')
  offset += RIFF_HEADER_BYTES

  writeFourCc(output, offset, 'fmt ')
  writeUint32(output, offset + 4, plan.formatPayload.byteLength)
  output.set(plan.formatPayload, offset + CHUNK_HEADER_BYTES)
  offset += paddedChunkBytes(plan.formatPayload.byteLength)

  if (plan.includeFactChunk) {
    writeFourCc(output, offset, 'fact')
    writeUint32(output, offset + 4, FACT_SAMPLE_LENGTH_BYTES)
    writeUint32(output, offset + CHUNK_HEADER_BYTES, descriptor.frameEnd - descriptor.frameStart)
    offset += paddedChunkBytes(FACT_SAMPLE_LENGTH_BYTES)
  }

  writeFourCc(output, offset, 'data')
  writeUint32(output, offset + 4, dataBytes)
  offset += CHUNK_HEADER_BYTES
  output.set(source.subarray(descriptor.dataStart, descriptor.dataEnd), offset)
  return output
}
