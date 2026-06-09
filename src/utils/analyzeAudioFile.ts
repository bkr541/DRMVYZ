import { analyze as analyzeBPM } from 'web-audio-beat-detector'

export interface AudioFileAnalysis {
  durationSec: number
  sampleRate: number
  channels: number
  bpm: number | null
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
 * and detected BPM.  The full file is decoded into an AudioBuffer so BPM
 * analysis has access to the complete waveform.  For very long files the
 * browser may take a few seconds — this is called before upload, so the
 * small delay is acceptable.
 */
export async function analyzeAudioFile(file: File): Promise<AudioFileAnalysis> {
  const duration = await getAudioDuration(file)

  let sampleRate = 44100
  let channels   = 2
  let bpm: number | null = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    // Reuse or create a temporary AudioContext for decoding
    const actx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const audioBuffer = await actx.decodeAudioData(arrayBuffer)
    actx.close()

    sampleRate = audioBuffer.sampleRate
    channels   = audioBuffer.numberOfChannels

    const detectedBpm = await analyzeBPM(audioBuffer)
    // web-audio-beat-detector returns a number (the BPM value)
    bpm = typeof detectedBpm === 'number' ? Math.round(detectedBpm * 10) / 10 : null
  } catch {
    // Non-fatal — proceed with defaults and no BPM
  }

  return { durationSec: duration, sampleRate, channels, bpm }
}
