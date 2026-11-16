/**
 * Choosing a track from the phone itself. The browser's file picker returns any file, so the file is checked before it is handed to the
 * audio engine, which decodes the whole track to analyse it (memory is the limit on a phone).
 */
export const MAX_PHONE_TRACK_BYTES = 100 * 1024 * 1024

/** What the file picker is asked for. iOS and Android both show their audio-capable file browsers for these. */
export const PHONE_TRACK_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.aif,.aiff'

const AUDIO_EXTENSION = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|aif|aiff|caf|weba)$/i

export interface PickedFile { name: string; type: string; size: number }

/** A plain-language reason the file cannot be played, or null when it can. */
export function describeUnplayableFile(file: PickedFile): string | null {
  const isAudio = file.type.startsWith('audio/') || (file.type === '' && AUDIO_EXTENSION.test(file.name)) || AUDIO_EXTENSION.test(file.name)
  if (!isAudio) return 'That file is not an audio file. Choose an MP3, M4A, WAV, FLAC or similar.'
  if (file.size <= 0) return 'That file is empty.'
  if (file.size > MAX_PHONE_TRACK_BYTES) return `That file is too large for a phone (${Math.round(file.size / 1024 / 1024)} MB). Choose one under ${MAX_PHONE_TRACK_BYTES / 1024 / 1024} MB.`
  return null
}
