import { analyze as analyzeBPM } from 'web-audio-beat-detector'
import { detectAudioBufferMusicalKey } from '../features/musicIntelligence/offlineTrackAnalyzer'

export interface AudioFileAnalysis {
  durationSec: number
  sampleRate: number
  channels: number
  artist: string | null
  bpm: number | null
  musicalKey: string | null
  keyNote: string | null
  keyMode: 'major' | 'minor' | null
  keyConfidence: number | null
}

const ENHARMONIC_KEY_NAMES: Readonly<Record<string, string>> = {
  'C#': 'C#/Db',
  'D#': 'D#/Eb',
  'F#': 'F#/Gb',
  'G#': 'G#/Ab',
  'A#': 'A#/Bb',
}

function bytesEqual(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset < 0 || offset + value.length > bytes.length) return false
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

function uint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)
}

function uint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) + ((bytes[offset + 1] ?? 0) << 8) + ((bytes[offset + 2] ?? 0) << 16) + ((bytes[offset + 3] ?? 0) * 0x1000000)
}

function syncSafeInt(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 21) | ((bytes[offset + 1] ?? 0) << 14) | ((bytes[offset + 2] ?? 0) << 7) | (bytes[offset + 3] ?? 0)
}

function cleanArtist(value: string): string | null {
  const artist = value
    .replace(/^\uFEFF/, '')
    .split(/\0+/)
    .map(part => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' / ')
  return artist || null
}

function decodeId3Text(bytes: Uint8Array): string | null {
  if (bytes.length < 2) return null
  const encoding = bytes[0]
  let payload = bytes.subarray(1)
  if (encoding === 0) return cleanArtist(new TextDecoder('iso-8859-1').decode(payload))
  if (encoding === 3) return cleanArtist(new TextDecoder().decode(payload))
  if (encoding === 2) {
    const swapped = new Uint8Array(payload.length)
    for (let index = 0; index + 1 < payload.length; index += 2) {
      swapped[index] = payload[index + 1]
      swapped[index + 1] = payload[index]
    }
    payload = swapped
  }
  return cleanArtist(new TextDecoder('utf-16le').decode(payload))
}

function readId3v2Artist(bytes: Uint8Array): string | null {
  if (!bytesEqual(bytes, 0, 'ID3') || bytes.length < 10) return null
  const version = bytes[3]
  const tagEnd = Math.min(bytes.length, 10 + syncSafeInt(bytes, 6))
  let offset = 10
  if (((bytes[5] ?? 0) & 0x40) !== 0 && offset + 4 <= tagEnd) {
    const extendedSize = version === 4 ? syncSafeInt(bytes, offset) : uint32BE(bytes, offset) + 4
    if (extendedSize > 0 && offset + extendedSize <= tagEnd) offset += extendedSize
  }
  const frameIdLength = version === 2 ? 3 : 4
  const frameHeaderLength = version === 2 ? 6 : 10
  while (offset + frameHeaderLength <= tagEnd) {
    const frameId = String.fromCharCode(...bytes.subarray(offset, offset + frameIdLength))
    if (!frameId.trim()) break
    const frameSize = version === 2
      ? ((bytes[offset + 3] ?? 0) << 16) | ((bytes[offset + 4] ?? 0) << 8) | (bytes[offset + 5] ?? 0)
      : version === 4 ? syncSafeInt(bytes, offset + 4) : uint32BE(bytes, offset + 4)
    const frameStart = offset + frameHeaderLength
    const frameEnd = frameStart + frameSize
    if (frameSize <= 0 || frameEnd > tagEnd) break
    if (frameId === (version === 2 ? 'TP1' : 'TPE1')) return decodeId3Text(bytes.subarray(frameStart, frameEnd))
    offset = frameEnd
  }
  return null
}

function readMp4Artist(bytes: Uint8Array): string | null {
  if (!bytesEqual(bytes, 4, 'ftyp')) return null
  for (let offset = 0; offset + 4 < bytes.length; offset += 1) {
    const isArtistAtom = bytes[offset] === 0xa9 && bytesEqual(bytes, offset + 1, 'ART')
    const isAlbumArtistAtom = bytesEqual(bytes, offset, 'aART')
    if (!isArtistAtom && !isAlbumArtistAtom) continue
    const searchEnd = Math.min(bytes.length - 4, offset + 1024)
    for (let dataOffset = offset + 4; dataOffset <= searchEnd; dataOffset += 1) {
      if (!bytesEqual(bytes, dataOffset, 'data') || dataOffset < 4) continue
      const boxStart = dataOffset - 4
      const boxSize = uint32BE(bytes, boxStart)
      const textStart = dataOffset + 12
      const boxEnd = boxStart + boxSize
      if (boxSize >= 16 && textStart <= boxEnd && boxEnd <= bytes.length) {
        const artist = cleanArtist(new TextDecoder().decode(bytes.subarray(textStart, boxEnd)))
        if (artist) return artist
      }
    }
  }
  return null
}

function readVorbisArtist(bytes: Uint8Array): string | null {
  if (!bytesEqual(bytes, 0, 'fLaC') && !bytesEqual(bytes, 0, 'OggS')) return null
  const key = 'ARTIST='
  for (let offset = 4; offset + key.length <= bytes.length; offset += 1) {
    let matches = true
    for (let index = 0; index < key.length; index += 1) {
      const byte = bytes[offset + index] ?? 0
      if (String.fromCharCode(byte).toUpperCase() !== key[index]) { matches = false; break }
    }
    if (!matches) continue
    const commentLength = uint32LE(bytes, offset - 4)
    const valueLength = commentLength - key.length
    if (valueLength < 1 || valueLength > 1024 || offset + key.length + valueLength > bytes.length) continue
    return cleanArtist(new TextDecoder().decode(bytes.subarray(offset + key.length, offset + key.length + valueLength)))
  }
  return null
}

function readWaveArtist(bytes: Uint8Array): string | null {
  if (!bytesEqual(bytes, 0, 'RIFF') || !bytesEqual(bytes, 8, 'WAVE')) return null
  for (let offset = 12; offset + 8 <= bytes.length; offset += 1) {
    if (bytesEqual(bytes, offset, 'IART')) {
      const size = uint32LE(bytes, offset + 4)
      return cleanArtist(new TextDecoder('iso-8859-1').decode(bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + size))))
    }
  }
  return null
}

function readId3v1Artist(bytes: Uint8Array): string | null {
  const offset = bytes.length - 128
  if (offset < 0 || !bytesEqual(bytes, offset, 'TAG')) return null
  return cleanArtist(new TextDecoder('iso-8859-1').decode(bytes.subarray(offset + 33, offset + 63)))
}

/** Reads an artist stored in common audio container tags; it does not infer an artist from the filename. */
export function extractArtistFromAudioMetadata(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  return readId3v2Artist(bytes)
    ?? readMp4Artist(bytes)
    ?? readVorbisArtist(bytes)
    ?? readWaveArtist(bytes)
    ?? readId3v1Artist(bytes)
}

export function formatDetectedMusicalKey(note: string | null, mode: 'major' | 'minor' | null): string | null {
  if (!note || !mode) return null
  const normalized = ENHARMONIC_KEY_NAMES[note] ?? note
  if (mode === 'major') return normalized
  return normalized.includes('/')
    ? normalized.split('/').map(name => `${name}m`).join('/')
    : `${normalized}m`
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio()
    const objUrl = URL.createObjectURL(file)
    audio.onloadedmetadata = () => { resolve(audio.duration || 0); URL.revokeObjectURL(objUrl) }
    audio.onerror          = () => { resolve(0);                    URL.revokeObjectURL(objUrl) }
    audio.src = objUrl
  })
}

/**
 * Decodes an audio file and returns duration, sample rate, channel count,
 * embedded artist metadata, detected BPM, and detected musical key. The full file is decoded into an
 * AudioBuffer so both analyses have access to the waveform. For very long
 * files the browser may take a few seconds — this is called before upload,
 * so the small delay is acceptable.
 */
export async function analyzeAudioFile(file: File): Promise<AudioFileAnalysis> {
  const duration = await getAudioDuration(file)

  let sampleRate = 44100
  let channels   = 2
  let artist: string | null = null
  let bpm: number | null = null
  let keyNote: string | null = null
  let keyMode: 'major' | 'minor' | null = null
  let keyConfidence: number | null = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    artist = extractArtistFromAudioMetadata(arrayBuffer)
    // Reuse or create a temporary AudioContext for decoding
    const actx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const audioBuffer = await actx.decodeAudioData(arrayBuffer)
    actx.close()

    sampleRate = audioBuffer.sampleRate
    channels   = audioBuffer.numberOfChannels

    const [detectedBpm, detectedKey] = await Promise.all([
      analyzeBPM(audioBuffer).catch(() => null),
      detectAudioBufferMusicalKey(audioBuffer).catch(() => null),
    ])
    // web-audio-beat-detector returns a number (the BPM value)
    bpm = typeof detectedBpm === 'number' ? Math.round(detectedBpm * 10) / 10 : null
    keyNote = detectedKey?.key ?? null
    keyMode = detectedKey?.mode ?? null
    keyConfidence = detectedKey ? detectedKey.confidence : null
  } catch {
    // Non-fatal — proceed with defaults and no detected metadata.
  }

  return {
    durationSec: duration,
    sampleRate,
    channels,
    artist,
    bpm,
    musicalKey: formatDetectedMusicalKey(keyNote, keyMode),
    keyNote,
    keyMode,
    keyConfidence,
  }
}
