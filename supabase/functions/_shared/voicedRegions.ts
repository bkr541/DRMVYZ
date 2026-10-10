import { removeHallucinatedText, type ProviderTranscript, type ProviderWord } from './lyricTranscriptionCore.ts'

export interface VoicedRegion {
  startSec: number
  endSec: number
}

const FRAME_SEC = 0.02
const MERGE_GAP_SEC = 0.25
const MIN_REGION_SEC = 0.08
/** How far below the loud part of the track a frame may fall and still count as sound. */
const RANGE_DB = 32

/**
 * Finds where there is actual sound in a PCM WAV (16-bit or 32-bit float). Whisper-family models stretch the first
 * words after a long silence back toward the start of the file, so their timestamps are corrected against this.
 * Returns null when the file cannot be read or is too quiet to judge, in which case timing is left untouched.
 */
export function findVoicedRegions(input: Uint8Array): VoicedRegion[] | null {
  if (input.byteLength < 44) return null
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  const tag = (offset: number) => String.fromCharCode(input[offset], input[offset + 1], input[offset + 2], input[offset + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null

  let format = 0
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let dataStart = -1
  let dataLength = 0
  let offset = 12
  while (offset + 8 <= input.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ' && body + 16 <= input.byteLength) {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
      if (format === 0xfffe && size >= 26 && body + 26 <= input.byteLength) format = view.getUint16(body + 24, true)
    } else if (id === 'data') {
      dataStart = body
      dataLength = Math.min(size, input.byteLength - body)
      break
    }
    offset = body + size + (size % 2)
  }
  if (dataStart < 0 || channels < 1 || sampleRate < 8000) return null
  const bytesPerSample = bits / 8
  const isPcm16 = format === 1 && bits === 16
  const isFloat32 = format === 3 && bits === 32
  if (!isPcm16 && !isFloat32) return null

  const frameSamples = Math.max(1, Math.round(sampleRate * FRAME_SEC))
  const frameBytes = frameSamples * channels * bytesPerSample
  const frameCount = Math.floor(dataLength / frameBytes)
  if (frameCount < 2) return null

  const levels = new Float64Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0
    const base = dataStart + frame * frameBytes
    for (let sample = 0; sample < frameSamples; sample += 1) {
      let mixed = 0
      for (let channel = 0; channel < channels; channel += 1) {
        const at = base + (sample * channels + channel) * bytesPerSample
        mixed += isPcm16 ? view.getInt16(at, true) / 32768 : view.getFloat32(at, true)
      }
      mixed /= channels
      sum += mixed * mixed
    }
    levels[frame] = 20 * Math.log10(Math.sqrt(sum / frameSamples) + 1e-9)
  }

  const sorted = Array.from(levels).sort((a, b) => a - b)
  const loud = sorted[Math.floor(sorted.length * 0.95)]!
  if (loud < -60) return null
  const threshold = loud - RANGE_DB

  const regions: VoicedRegion[] = []
  let start = -1
  let lastActive = -1
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (levels[frame]! > threshold) {
      if (start < 0) start = frame
      lastActive = frame
    } else if (start >= 0 && (frame - lastActive) * FRAME_SEC > MERGE_GAP_SEC) {
      regions.push({ startSec: start * FRAME_SEC, endSec: (lastActive + 1) * FRAME_SEC })
      start = -1
    }
  }
  if (start >= 0) regions.push({ startSec: start * FRAME_SEC, endSec: (lastActive + 1) * FRAME_SEC })
  const kept = regions.filter(region => region.endSec - region.startSec >= MIN_REGION_SEC)
  return kept.length > 0 ? kept : null
}

/**
 * Moves words that the provider placed in silence into the next stretch of sound, in order, so a vocal that
 * enters late is not timed from the start of the file. Words already over sound keep their own timing.
 */
export function snapWordsToVoicedRegions(words: readonly ProviderWord[], regions: readonly VoicedRegion[]): ProviderWord[] {
  const ordered = [...words].sort((a, b) => a.start - b.start)
  let cursor = 0
  return ordered.map(word => {
    const originalStart = Number(word.start)
    const originalEnd = Number(word.end)
    if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd) || originalEnd <= originalStart) return word
    let start = Math.max(originalStart, cursor)
    const inside = regions.some(region => start >= region.startSec && start <= region.endSec)
    if (!inside) {
      const next = regions.find(region => region.endSec > start)
      if (!next) return word
      start = Math.max(start, next.startSec)
    }
    if (start === originalStart) {
      cursor = originalEnd
      return word
    }
    const duration = originalEnd - originalStart
    const end = originalEnd > start + 0.08
      ? Math.min(originalEnd, start + 1.5)
      : start + Math.min(Math.max(duration, 0.08), 0.5)
    cursor = end
    return { ...word, start, end }
  })
}

export function refineTranscriptTiming(
  input: ProviderTranscript,
  wavBytes: Uint8Array,
  language: string | null | undefined,
): ProviderTranscript {
  const regions = findVoicedRegions(wavBytes)
  if (!regions) return input
  // Invented text is removed first so it cannot be carried into the next stretch of sound.
  const transcript = removeHallucinatedText(input, language).transcript
  const words = Array.isArray(transcript.words) ? snapWordsToVoicedRegions(transcript.words, regions) : transcript.words
  const segments = Array.isArray(transcript.segments)
    ? transcript.segments.map(segment => {
        if (!Array.isArray(segment.words) || segment.words.length === 0) return segment
        const snapped = snapWordsToVoicedRegions(segment.words, regions)
        return {
          ...segment,
          words: snapped,
          start: Math.max(segment.start, snapped[0]!.start),
          end: Math.max(segment.end, snapped[snapped.length - 1]!.end),
        }
      })
    : transcript.segments
  return { ...transcript, words, segments }
}
