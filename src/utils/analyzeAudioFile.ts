import { analyze as analyzeBPM } from 'web-audio-beat-detector'
import { detectAudioBufferMusicalKey } from '../features/musicIntelligence/offlineTrackAnalyzer'

export interface AudioFileAnalysis {
  durationSec: number
  sampleRate: number
  channels: number
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
 * detected BPM, and detected musical key. The full file is decoded into an
 * AudioBuffer so both analyses have access to the waveform. For very long
 * files the browser may take a few seconds — this is called before upload,
 * so the small delay is acceptable.
 */
export async function analyzeAudioFile(file: File): Promise<AudioFileAnalysis> {
  const duration = await getAudioDuration(file)

  let sampleRate = 44100
  let channels   = 2
  let bpm: number | null = null
  let keyNote: string | null = null
  let keyMode: 'major' | 'minor' | null = null
  let keyConfidence: number | null = null

  try {
    const arrayBuffer = await file.arrayBuffer()
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
    bpm,
    musicalKey: formatDetectedMusicalKey(keyNote, keyMode),
    keyNote,
    keyMode,
    keyConfidence,
  }
}
