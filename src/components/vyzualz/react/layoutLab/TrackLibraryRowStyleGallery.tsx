import { AudioTrackRow } from '../controls/AudioTrackRow'

// ── TrackLibraryRowStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning track-library row
// treatment — Vinyl Row — shown live using the real, reusable AudioTrackRow
// component directly so this preview matches production exactly.

interface TrackRowSample {
  title: string
  artist: string
  duration: string
  bpm: string
  musicalKey: string
  date: string
}

const TRACK_SAMPLES: TrackRowSample[] = [
  { title: 'Midnight Run (Extended Mix)', artist: 'DVYDRM, Reverie', duration: '2:40', bpm: '173', musicalKey: 'Key —', date: '8/12/2026' },
  { title: 'Neon Skyline VIP', artist: 'DVYDRM', duration: '2:09', bpm: '142', musicalKey: 'Em', date: '7/14/2026' },
  { title: 'Warehouse Two', artist: 'DVYDRM', duration: '2:19', bpm: '142', musicalKey: 'Em', date: '7/14/2026' },
]

function VinylRowRows() {
  return (
    <div className="lltl-vinyl-list">
      {TRACK_SAMPLES.map((track, index) => (
        <AudioTrackRow
          key={track.title}
          title={track.title}
          artist={track.artist}
          duration={track.duration}
          bpm={track.bpm}
          musicalKey={track.musicalKey}
          date={track.date}
          active={index === 0}
        />
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'vinyl', title: '01 · Vinyl Row', blurb: 'The thumbnail becomes a spinning record with grooves and a center label hole. The meta line reads like a DJ deck readout — BPM highlighted, dot-separated from key, duration, and date.', Rows: VinylRowRows },
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
