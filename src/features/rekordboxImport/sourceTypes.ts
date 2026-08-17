/** Source identifiers emitted by DRMVYZ's explicit Rekordbox import workflows. */
export type RekordboxImportSource = 'rekordbox_xml' | 'rekordbox_usb'

export type RekordboxPhraseMood = 'high_energy' | 'mid_energy' | 'low_energy'
export type RekordboxPhraseBank = 'default' | 'cool' | 'natural' | 'hot' | 'subtle' | 'warm' | 'vivid' | 'club_1' | 'club_2'
export type RekordboxSerializableValue = string | number | boolean | null

/**
 * Native Rekordbox PSSI song-structure record.
 * This remains source-faithful data, not a DRMVYZ Track Section classification.
 * All fields are JSON-safe so the record can travel with persisted Track Intelligence.
 */
export interface RekordboxPhrase {
  /** Zero-based phrase position after parsing. */
  phraseIndex: number
  /** Rekordbox's one-based source phrase index, when present. */
  sourceIndex?: number | null
  /** Raw Rekordbox track mood code. */
  sourceMood: number
  mood: RekordboxPhraseMood | null
  /** Raw Rekordbox phrase-kind code. */
  sourceKind: number
  /** Rekordbox phrase-kind enum label (for example verse_2 or chorus). */
  rekordboxKind: string | null
  /** Raw Rekordbox lighting-bank code. */
  sourceBank: number
  bank: RekordboxPhraseBank | null
  /** Human-readable label derived from Rekordbox's phrase-kind enum. */
  sourceLabel: string | null
  /** Coarser normalized source label retained for DRMVYZ semantic mapping. */
  normalizedLabel: string | null
  /** One-based Rekordbox beat numbers. endBeat is an exclusive boundary. */
  startBeat: number
  endBeat: number | null
  /** Timestamps derived from PQTZ beat timings when safely resolvable. */
  startTimeSec: number | null
  endTimeSec: number | null
  fillStartBeat: number | null
  fillStartTimeSec: number | null
  /** Raw/diagnostic PSSI flags retained so later stages do not need to reparse ANLZ. */
  sourceFlags: Record<string, RekordboxSerializableValue>
  sourcePayload: Record<string, RekordboxSerializableValue>
}

export interface RekordboxFeatureAvailability {
  bpm: boolean
  beatGrid: boolean
  key: boolean
  phrases: boolean
}
