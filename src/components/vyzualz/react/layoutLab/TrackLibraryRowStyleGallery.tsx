// ── TrackLibraryRowStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. Three candidate treatments for a
// "record" row in a track library list — thumbnail/initials, title, artist,
// and a strip of meta badges (duration, BPM, key, date).

interface TrackRowSample {
  title: string
  artist: string
  duration: string
  bpm: string
  musicalKey: string
  date: string
}

function initialsFor(title: string): string {
  const letters = title.match(/[A-Za-z0-9]/g) ?? []
  return (letters[0] ?? '♪').toUpperCase() + (letters[1] ?? '').toUpperCase()
}

const TRACK_SAMPLES: TrackRowSample[] = [
  { title: 'Midnight Run (Extended Mix)', artist: 'DVYDRM, Reverie', duration: '2:40', bpm: '173 BPM', musicalKey: 'Key —', date: '8/12/2026' },
  { title: 'Neon Skyline VIP', artist: 'DVYDRM', duration: '2:09', bpm: '142 BPM', musicalKey: 'Em', date: '7/14/2026' },
  { title: 'Warehouse Two', artist: 'DVYDRM', duration: '2:19', bpm: '142 BPM', musicalKey: 'Em', date: '7/14/2026' },
]

// ── 01 · Compact Grid Card ───────────────────────────────────────────────────

function CompactGridCardRows() {
  return (
    <div className="lltl-list lltl-list--grid">
      {TRACK_SAMPLES.map((track, index) => (
        <button type="button" className={`lltl-card${index === 0 ? ' is-active' : ''}`} key={track.title}>
          <span className="lltl-art" aria-hidden="true">{initialsFor(track.title)}</span>
          <span className="lltl-main">
            <span className="lltl-title">{track.title}</span>
            <span className="lltl-artist">{track.artist}</span>
            <span className="lltl-meta">
              <span>{track.duration}</span>
              <span>{track.bpm}</span>
              <span>{track.musicalKey}</span>
              <span>{track.date}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 02 · Condensed List Row ──────────────────────────────────────────────────

function CondensedListRows() {
  return (
    <div className="lltl-list lltl-list--condensed">
      {TRACK_SAMPLES.map((track, index) => (
        <button type="button" className={`lltl-row${index === 0 ? ' is-active' : ''}`} key={track.title}>
          <span className="lltl-art lltl-art--sm" aria-hidden="true">{initialsFor(track.title)}</span>
          <span className="lltl-row-text">
            <strong>{track.title}</strong>
            <span>{track.artist} · {track.duration} · {track.bpm}</span>
          </span>
          <span className="lltl-row-date">{track.date}</span>
        </button>
      ))}
    </div>
  )
}

// ── 03 · Stacked Media Tile ──────────────────────────────────────────────────

function StackedTileRows() {
  return (
    <div className="lltl-list lltl-list--tiles">
      {TRACK_SAMPLES.map((track, index) => (
        <button type="button" className={`lltl-tile${index === 0 ? ' is-active' : ''}`} key={track.title}>
          <span className="lltl-art lltl-art--lg" aria-hidden="true">{initialsFor(track.title)}</span>
          <span className="lltl-tile-title">{track.title}</span>
          <span className="lltl-tile-artist">{track.artist}</span>
          <span className="lltl-tile-meta">
            <span>{track.duration}</span>
            <span>{track.bpm}</span>
            <span>{track.musicalKey}</span>
            <span>{track.date}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'grid', title: '01 · Compact Grid Card', blurb: 'Thumbnail left, title/artist/meta stacked right in a two-column grid — the current production shape. Meta renders as a wrapped strip of small badges.', Rows: CompactGridCardRows },
  { id: 'condensed', title: '02 · Condensed List Row', blurb: 'A smaller thumbnail with title, artist, duration, and BPM collapsed onto one line, plus a date on the right — the most space-efficient option for long lists.', Rows: CondensedListRows },
  { id: 'tiles', title: '03 · Stacked Media Tile', blurb: 'A larger thumbnail with title and artist below it, meta as a wrapped chip strip beneath — reads as a media card rather than a list row, suited to a grid layout.', Rows: StackedTileRows },
]

export function TrackLibraryRowStyleGallery() {
  return (
    <div className="lltl-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Rows />
          </div>
        </div>
      ))}
    </div>
  )
}
