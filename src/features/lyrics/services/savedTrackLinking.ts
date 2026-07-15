import type { Track } from '../../../types'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { loadLyricManagerTrackPage } from './lyricManagerData'

export interface SavedTrackLinkCandidate {
  track: LyricManagerTrack
  score: number
  signals: string[]
  durationMismatch: boolean
}

function stem(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\.[a-z0-9]{1,6}$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function durationDifference(localDuration: number, savedDuration: number | null): number | null {
  if (!Number.isFinite(localDuration) || localDuration <= 0 || !savedDuration || savedDuration <= 0) return null
  return Math.abs(localDuration - savedDuration)
}

export function rankSavedTrackLinkCandidates(
  runtimeTrack: Track,
  savedTracks: readonly LyricManagerTrack[],
  limit = 8,
): SavedTrackLinkCandidate[] {
  const runtimeFile = stem(runtimeTrack.name)
  const runtimeTitle = stem(runtimeTrack.title || runtimeTrack.displayName)
  const runtimeArtist = stem(runtimeTrack.artist || runtimeTrack.externalMetadata?.artist)
  const runtimeSize = runtimeTrack.sourceFile?.size ?? null

  return savedTracks
    .map(track => {
      const signals: string[] = []
      let score = 0
      const savedFile = stem(track.fileName)
      const savedTitle = stem(track.title)
      const savedArtist = stem(track.artist)
      const difference = durationDifference(runtimeTrack.duration, track.durationSec)
      const durationMismatch = difference !== null && difference > 4

      if (runtimeFile && savedFile && runtimeFile === savedFile) {
        score += 45
        signals.push('Same normalized filename')
      }
      if (runtimeTitle && savedTitle && runtimeTitle === savedTitle) {
        score += 35
        signals.push('Same normalized title')
      } else if (runtimeTitle && savedTitle && (runtimeTitle.includes(savedTitle) || savedTitle.includes(runtimeTitle))) {
        score += 18
        signals.push('Similar title')
      }
      if (difference !== null) {
        if (difference <= 0.75) {
          score += 35
          signals.push('Duration within 0.75 seconds')
        } else if (difference <= 2) {
          score += 22
          signals.push('Duration within 2 seconds')
        } else if (difference <= 4) {
          score += 10
          signals.push('Duration within 4 seconds')
        } else {
          score -= Math.min(35, Math.round(difference))
          signals.push(`Duration differs by ${difference.toFixed(1)} seconds`)
        }
      }
      if (runtimeSize && track.fileSizeByte) {
        const ratio = Math.abs(runtimeSize - track.fileSizeByte) / Math.max(runtimeSize, track.fileSizeByte)
        if (ratio <= 0.005) {
          score += 30
          signals.push('File size closely matches')
        } else if (ratio <= 0.03) {
          score += 12
          signals.push('File size is similar')
        }
      }
      if (runtimeArtist && savedArtist && runtimeArtist === savedArtist) {
        score += 16
        signals.push('Same artist metadata')
      }

      return { track, score, signals, durationMismatch }
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.track.createdAt.localeCompare(a.track.createdAt))
    .slice(0, Math.max(1, Math.min(12, limit)))
}

export async function findSavedTrackLinkCandidates(
  userId: string,
  runtimeTrack: Track,
): Promise<SavedTrackLinkCandidate[]> {
  const query = stem(runtimeTrack.title || runtimeTrack.displayName || runtimeTrack.name).slice(0, 80)
  const firstPage = await loadLyricManagerTrackPage(userId, {
    limit: 50,
    search: query,
  })
  let source = firstPage.tracks
  if (source.length === 0 && query) {
    source = (await loadLyricManagerTrackPage(userId, { limit: 50 })).tracks
  }
  return rankSavedTrackLinkCandidates(runtimeTrack, source)
}
