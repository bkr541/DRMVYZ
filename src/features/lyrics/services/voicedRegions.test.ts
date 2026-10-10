import { describe, expect, it } from 'vitest'
import { findVoicedRegions, refineTranscriptTiming, snapWordsToVoicedRegions } from '../../../../supabase/functions/_shared/voicedRegions'

/** 16-bit mono PCM WAV: silence for `silentSec`, then a loud tone for `toneSec`. */
function wav(silentSec: number, toneSec: number, sampleRate = 8000): Uint8Array {
  const samples = Math.round((silentSec + toneSec) * sampleRate)
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, text: string) => [...text].forEach((char, index) => { bytes[offset + index] = char.charCodeAt(0) })
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = Math.round(silentSec * sampleRate); index < samples; index += 1) {
    view.setInt16(44 + index * 2, Math.round(Math.sin(index * 0.3) * 20000), true)
  }
  return bytes
}

describe('voiced regions', () => {
  it('finds where the sound starts after a silent intro', () => {
    const regions = findVoicedRegions(wav(3, 2))!
    expect(regions).toHaveLength(1)
    expect(regions[0]!.startSec).toBeCloseTo(3, 1)
    expect(regions[0]!.endSec).toBeCloseTo(5, 1)
  })

  it('returns null for unreadable or non-WAV data', () => {
    expect(findVoicedRegions(new Uint8Array(100))).toBeNull()
  })

  it('moves words the provider put in the silence to where the sound starts, in order', () => {
    const regions = [{ startSec: 29, endSec: 40 }]
    const snapped = snapWordsToVoicedRegions([
      { word: 'In', start: 0, end: 10.26 },
      { word: 'the', start: 10.26, end: 28 },
      { word: 'night', start: 31, end: 31.5 },
    ], regions)
    expect(snapped[0]!.start).toBeCloseTo(29)
    expect(snapped[0]!.end - snapped[0]!.start).toBeLessThanOrEqual(0.5)
    expect(snapped[1]!.start).toBeGreaterThanOrEqual(snapped[0]!.end)
    expect(snapped[1]!.start).toBeLessThan(31)
    expect(snapped[2]).toMatchObject({ start: 31, end: 31.5 })
  })

  it('refines a whole transcript against the audio and leaves it alone when the audio cannot be read', () => {
    const transcript = {
      language: 'en',
      words: [{ word: 'In', start: 0, end: 2.5 }, { word: 'the', start: 2.5, end: 3.4 }],
      segments: [{ text: 'In the', start: 0, end: 3.4, words: [{ word: 'In', start: 0, end: 2.5 }, { word: 'the', start: 2.5, end: 3.4 }] }],
    }
    const refined = refineTranscriptTiming(transcript, wav(3, 2), 'en')
    expect(refined.words![0]!.start).toBeGreaterThanOrEqual(2.9)
    expect(refined.segments![0]!.start).toBeGreaterThanOrEqual(2.9)
    expect(refineTranscriptTiming(transcript, new Uint8Array(10), 'en')).toBe(transcript)
  })
})
