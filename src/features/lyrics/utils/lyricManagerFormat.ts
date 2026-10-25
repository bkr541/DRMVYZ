import { trackInitials as sharedTrackInitials } from '../../../components/vyzualz/media/trackInitials'
import type { LyricManagerTrack } from '../lyricManagerTypes'

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatMsClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '0:00.00'
  const safe = Math.max(0, Math.round(ms))
  const mins = Math.floor(safe / 60_000)
  const secs = Math.floor((safe % 60_000) / 1_000)
  const hundredths = Math.floor((safe % 1_000) / 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}

export function trackInitials(track: LyricManagerTrack | null): string {
  return sharedTrackInitials(track)
}

export const LYRIC_SOURCE_LABELS: Readonly<Record<string, string>> = {
  manual: 'Manual',
  lrc_import: 'LRC',
  enhanced_lrc_import: 'eLRC',
  vtt_import: 'VTT',
  ai_transcription: 'AI',
  api_lookup: 'API',
  json_import: 'JSON',
}

export function formatRelativeDate(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}
