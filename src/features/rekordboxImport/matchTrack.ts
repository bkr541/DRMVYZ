import type { RekordboxLibrary, RekordboxTrackMetadata } from './types'
import { getNativeFilePath } from './nativeBridge'

function asRelativePath(file: File): string {
  const maybeRelative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return (getNativeFilePath(file) || maybeRelative || file.name).replace(/\\/g, '/').toLowerCase()
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim().toLowerCase()
}

function basename(path: string | null | undefined): string | null {
  if (!path) return null
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]!.toLowerCase() : path.toLowerCase()
}

export interface RekordboxTrackMatch {
  track: RekordboxTrackMetadata
  confidence: number
  reason: string
}

export function matchFileToRekordboxTrack(file: File, library: RekordboxLibrary | null): RekordboxTrackMatch | null {
  if (!library) return null

  const relativePath = asRelativePath(file)
  const nativePath = getNativeFilePath(file)?.toLowerCase() ?? ''
  const fileName = file.name.toLowerCase()
  const fileStem = stripExtension(file.name)

  const candidates: RekordboxTrackMatch[] = []
  const accept = (candidate: RekordboxTrackMetadata, confidence: number, reason: string) => {
    candidates.push({ track: candidate, confidence, reason })
  }

  for (const track of library.tracks) {
    const location = track.location?.toLowerCase() ?? ''
    const rbFilename = (track.filename ?? basename(track.location) ?? '').toLowerCase()
    const rbStem = rbFilename ? stripExtension(rbFilename) : ''

    if (location && nativePath && (nativePath.endsWith(location) || location.endsWith(nativePath))) {
      accept(track, 0.995, 'Native USB path matched Rekordbox Location')
      continue
    }

    if (location && relativePath && (location.endsWith(relativePath) || relativePath.endsWith(location))) {
      accept(track, 0.98, 'USB relative path matched Rekordbox Location')
      continue
    }

    if (location && fileName && location.endsWith(`/${fileName}`)) {
      accept(track, 0.92, 'Filename matched Rekordbox Location')
      continue
    }

    if (rbFilename && rbFilename === fileName) {
      accept(track, 0.86, 'Filename matched Rekordbox filename')
      continue
    }

    if (rbStem && rbStem === fileStem) {
      accept(track, 0.72, 'Filename stem matched Rekordbox filename')
      continue
    }

    const titleStem = stripExtension(track.name)
    if (titleStem && titleStem === fileStem) {
      accept(track, 0.58, 'Filename stem matched Rekordbox title')
    }
  }

  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0] ?? null
  return best && best.confidence >= 0.55 ? best : null
}
