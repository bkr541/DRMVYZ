export interface TrackInitialsSource {
  title?: string | null
  fileName?: string | null
  artist?: string | null
}

/** Placeholder artwork text for a saved track (tracks have no artwork field): the first letters of its first two words. */
export function trackInitials(track: TrackInitialsSource | null): string {
  if (!track) return '♪'
  const source = `${track.title || track.fileName || ''} ${track.artist || ''}`.trim()
  const initials = source
    .split(/\s+/)
    // Skip separators like the dash in "MPH - Raw" so they don't become an initial.
    .filter(part => /[\p{L}\p{N}]/u.test(part))
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '♪'
}
