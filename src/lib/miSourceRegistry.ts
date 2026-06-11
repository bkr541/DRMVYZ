// Central registry for all Music Intelligence modulation sources.
// Covers Layers 1–8 and preserves full backward-compat with legacy AudioBand keys.

export type MISourceCategory =
  | 'bands'
  | 'rhythm'
  | 'grid'
  | 'energy'
  | 'section'
  | 'harmonic'
  | 'stems'
  | 'semantic'

export interface MISourceDef {
  key:          string
  label:        string
  category:     MISourceCategory
  /** true = original AudioBand key (bass/lowMid/mid/high/volume/beat) */
  isLegacy?:    boolean
  /** true = discrete boolean event (0 or 1) */
  isTrigger?:   boolean
  /** true = slow-changing boolean state (condition) */
  isCondition?: boolean
  description?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// All available sources, ordered by layer

export const MI_SOURCE_REGISTRY: MISourceDef[] = [
  // ── Layer 1: Audio Bands ─────────────────────────────────────────────────
  { key: 'sub',        label: 'Sub',         category: 'bands', description: '20–60 Hz sub-bass' },
  { key: 'bass',       label: 'Bass',        category: 'bands', isLegacy: true },
  { key: 'lowMid',     label: 'Low Mid',     category: 'bands', isLegacy: true },
  { key: 'mid',        label: 'Mid',         category: 'bands', isLegacy: true },
  { key: 'high',       label: 'High',        category: 'bands', isLegacy: true },
  { key: 'air',        label: 'Air',         category: 'bands', description: '8–20 kHz presence' },
  { key: 'volume',     label: 'Volume',      category: 'bands', isLegacy: true },
  { key: 'rms',        label: 'RMS',         category: 'bands' },
  { key: 'peak',       label: 'Peak',        category: 'bands' },
  { key: 'nSub',       label: 'Sub (norm)',  category: 'bands' },
  { key: 'nBass',      label: 'Bass (norm)', category: 'bands' },
  { key: 'nLowMid',    label: 'LMid (norm)', category: 'bands' },
  { key: 'nMid',       label: 'Mid (norm)',  category: 'bands' },
  { key: 'nHigh',      label: 'High (norm)', category: 'bands' },
  { key: 'nAir',       label: 'Air (norm)',  category: 'bands' },

  // ── Layer 2: Rhythm Events ───────────────────────────────────────────────
  { key: 'beat',      label: 'Beat',          category: 'rhythm', isLegacy: true, isTrigger: true },
  { key: 'beatPhase', label: 'Beat Phase',    category: 'rhythm' },
  { key: 'kick',      label: 'Kick Strength', category: 'rhythm' },
  { key: 'snare',     label: 'Snare Str.',    category: 'rhythm' },
  { key: 'hat',       label: 'Hat Str.',      category: 'rhythm' },
  { key: 'transient', label: 'Transient',     category: 'rhythm' },
  { key: 'downbeat',  label: 'Downbeat',      category: 'rhythm', isTrigger: true },

  // ── Layer 3: Musical Grid ────────────────────────────────────────────────
  { key: 'phrase4',     label: 'Phrase 4',    category: 'grid' },
  { key: 'phrase8',     label: 'Phrase 8',    category: 'grid' },
  { key: 'phrase16',    label: 'Phrase 16',   category: 'grid' },
  { key: 'phrase32',    label: 'Phrase 32',   category: 'grid' },
  { key: 'phrase4Hit',  label: 'Ph4 Hit',     category: 'grid', isTrigger: true },
  { key: 'phrase8Hit',  label: 'Ph8 Hit',     category: 'grid', isTrigger: true },
  { key: 'phrase16Hit', label: 'Ph16 Hit',    category: 'grid', isTrigger: true },
  { key: 'phrase32Hit', label: 'Ph32 Hit',    category: 'grid', isTrigger: true },

  // ── Layer 4: Energy ──────────────────────────────────────────────────────
  { key: 'energy',          label: 'Energy',         category: 'energy' },
  { key: 'energyShort',     label: 'Energy Short',   category: 'energy' },
  { key: 'energyLong',      label: 'Energy Long',    category: 'energy' },
  { key: 'spectralFlux',    label: 'Spectral Flux',  category: 'energy' },
  { key: 'tension',         label: 'Tension',        category: 'energy' },
  { key: 'complexity',      label: 'Complexity',     category: 'energy' },
  { key: 'buildProgress',   label: 'Build Progress', category: 'energy' },
  { key: 'dropImpact',      label: 'Drop Impact',    category: 'energy' },
  { key: 'crestFactor',     label: 'Crest Factor',   category: 'energy' },
  { key: 'percentile',      label: 'Percentile',     category: 'energy' },
  { key: 'delta',           label: 'Energy Delta',   category: 'energy' },
  { key: 'spectralCentroid',label: 'Centroid',       category: 'energy' },
  { key: 'spectralFlatness',label: 'Flatness',       category: 'energy' },

  // ── Layer 5: Sections ────────────────────────────────────────────────────
  { key: 'sectionProgress',  label: 'Section Prog.', category: 'section' },
  { key: 'sectionIntensity', label: 'Section Int.',  category: 'section' },

  // ── Layer 6: Harmonic ────────────────────────────────────────────────────
  { key: 'pitchHz',        label: 'Pitch (Hz)',      category: 'harmonic' },
  { key: 'melodyHeight',   label: 'Melody Height',   category: 'harmonic' },
  { key: 'keyConfidence',  label: 'Key Conf.',       category: 'harmonic' },
  { key: 'chordConfidence',label: 'Chord Conf.',     category: 'harmonic' },
  { key: 'chordChange',    label: 'Chord Change',    category: 'harmonic', isTrigger: true },

  // ── Layer 7: Stems & Lyrics ──────────────────────────────────────────────
  { key: 'vocalEnergy',       label: 'Vocal Energy',  category: 'stems' },
  { key: 'drumEnergy',        label: 'Drum Energy',   category: 'stems' },
  { key: 'bassStemEnergy',    label: 'Bass Stem',     category: 'stems' },
  { key: 'instrumentEnergy',  label: 'Instr. Energy', category: 'stems' },
  { key: 'vocalActivity',     label: 'Vocal Act.',    category: 'stems' },
  { key: 'lyricActivity',     label: 'Lyric Act.',    category: 'stems' },
  { key: 'lyricLineProgress', label: 'Lyric Prog.',   category: 'stems' },
  { key: 'phraseConfidence',  label: 'Phrase Conf.',  category: 'stems' },
  { key: 'wordHit',           label: 'Word Hit',      category: 'stems', isTrigger: true },
  { key: 'drumTrans',         label: 'Drum Trans.',   category: 'stems', isTrigger: true },
  { key: 'bassTrans',         label: 'Bass Trans.',   category: 'stems', isTrigger: true },

  // ── Layer 8: Semantic ────────────────────────────────────────────────────
  { key: 'buildConfidence',     label: 'Build Conf.',    category: 'semantic' },
  { key: 'dropConfidence',      label: 'Drop Conf.',     category: 'semantic' },
  { key: 'fakeoutConfidence',   label: 'Fakeout Conf.',  category: 'semantic' },
  { key: 'vocalHookConfidence', label: 'Hook Conf.',     category: 'semantic' },
]

// ─────────────────────────────────────────────────────────────────────────────

/** All valid modulation source keys — superset of AudioBand. */
export type ModulationSourceKey =
  // Legacy AudioBand
  | 'bass' | 'lowMid' | 'mid' | 'high' | 'volume' | 'beat'
  // Layer 1
  | 'sub' | 'air' | 'rms' | 'peak'
  | 'nSub' | 'nBass' | 'nLowMid' | 'nMid' | 'nHigh' | 'nAir'
  // Layer 2
  | 'beatPhase' | 'kick' | 'snare' | 'hat' | 'transient' | 'downbeat'
  // Layer 3
  | 'phrase4' | 'phrase8' | 'phrase16' | 'phrase32'
  | 'phrase4Hit' | 'phrase8Hit' | 'phrase16Hit' | 'phrase32Hit'
  // Layer 4
  | 'energy' | 'energyShort' | 'energyLong'
  | 'spectralFlux' | 'tension' | 'complexity' | 'buildProgress' | 'dropImpact'
  | 'crestFactor' | 'percentile' | 'delta'
  | 'spectralCentroid' | 'spectralFlatness'
  // Layer 5
  | 'sectionProgress' | 'sectionIntensity'
  // Layer 6
  | 'pitchHz' | 'melodyHeight' | 'keyConfidence' | 'chordConfidence' | 'chordChange'
  // Layer 7
  | 'vocalEnergy' | 'drumEnergy' | 'bassStemEnergy' | 'instrumentEnergy' | 'vocalActivity'
  | 'lyricActivity' | 'lyricLineProgress' | 'phraseConfidence'
  | 'wordHit' | 'drumTrans' | 'bassTrans'
  // Layer 8
  | 'buildConfidence' | 'dropConfidence' | 'fakeoutConfidence' | 'vocalHookConfidence'

export const MI_SOURCE_CATEGORY_LABELS: Record<MISourceCategory, string> = {
  bands:    'Audio Bands',
  rhythm:   'Rhythm',
  grid:     'Musical Grid',
  energy:   'Energy',
  section:  'Section',
  harmonic: 'Harmonic',
  stems:    'Stems & Lyrics',
  semantic: 'Semantic',
}

const _labelMap: Record<string, string> = Object.fromEntries(
  MI_SOURCE_REGISTRY.map(d => [d.key, d.label]),
)

export function getMISourceLabel(key: string): string {
  return _labelMap[key] ?? key
}

export function getMISourceDef(key: string): MISourceDef | undefined {
  return MI_SOURCE_REGISTRY.find(d => d.key === key)
}

/** Sources grouped by category — for building category-organised dropdowns. */
export const MI_SOURCES_BY_CATEGORY: Record<MISourceCategory, MISourceDef[]> = (() => {
  const out: Record<MISourceCategory, MISourceDef[]> = {
    bands: [], rhythm: [], grid: [], energy: [],
    section: [], harmonic: [], stems: [], semantic: [],
  }
  for (const def of MI_SOURCE_REGISTRY) out[def.category].push(def)
  return out
})()
