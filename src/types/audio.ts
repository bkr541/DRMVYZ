export type MonitoringMode =
  | 'stereo'
  | 'mono'
  | 'left'
  | 'right'
  | 'mid'
  | 'side'
  | 'lowpass'
  | 'highpass'
  | 'phone'
  | 'car'
  | 'club'

export const MONITORING_MODE_LABELS: Record<MonitoringMode, string> = {
  stereo:   'Stereo',
  mono:     'Mono',
  left:     'Left Only',
  right:    'Right Only',
  mid:      'Mid Only',
  side:     'Side Only',
  lowpass:  'Low-Pass',
  highpass: 'High-Pass',
  phone:    'Phone Sim',
  car:      'Car Sim',
  club:     'Club / Sub',
}

export const MONITORING_MODE_DESCRIPTIONS: Record<MonitoringMode, string> = {
  stereo:   'Full stereo output',
  mono:     'Sum L+R to mono — check mono compatibility',
  left:     'Hear left channel only in both ears',
  right:    'Hear right channel only in both ears',
  mid:      'Hear mid (L+R sum) signal only',
  side:     'Hear side (L−R difference) signal only',
  lowpass:  'Low-pass filter ~300 Hz — check muddiness',
  highpass: 'High-pass filter ~3 kHz — check harshness',
  phone:    'Bandpass 300–3.4 kHz — phone speaker simulation',
  car:      'Bass boost + mid dip + treble rolloff — car simulation',
  club:     'Sub boost + high cut — club / subwoofer focus',
}

export interface ReferenceTrack {
  id: string
  name: string
  displayName: string
  url: string
  slot: number
}

export interface SpectralFeatures {
  centroid: number
  spread: number
  rolloff: number
  flatness: number
  bpm: number | null
}

// ── Lyric-transcription preparation ──────────────────────────────────────────

/**
 * A provider-safe PCM WAV generated in the browser from a stored source track.
 * Storage paths are always private, user-owned objects in the audio-tracks bucket.
 */
export interface PreparedTranscriptionAudioChunk {
  index: number
  storagePath: string
  fileName: string
  mimeType: 'audio/wav'
  byteSize: number
  startMs: number
  endMs: number
  overlapBeforeMs: number
  overlapAfterMs: number
}

export interface PreparedTranscriptionAudioManifest {
  version: 'browser-pcm16-v1'
  preparedAt: string
  sourceFileSize: number
  sourceMimeType: string | null
  durationMs: number
  sampleRate: 16000
  channels: 1
  bitsPerSample: 16
  chunks: PreparedTranscriptionAudioChunk[]
}
