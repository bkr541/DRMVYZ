import type { ReactEngineId } from './ReactTypes'

export interface ReactEngineCatalogEntry {
  id: ReactEngineId
  label: string
  shortLabel: string
  icon: string
  description: string
}

export const REACT_KNOWN_ENGINE_IDS: ReactEngineId[] = [
  'shaderPads',
  'cinematicPortal',
  'cinema',
  'oscilloscope',
  'canvas',
  'laserDmx',
  'pixGrid',
  'headliner',
]

/** User-facing engine choices. Legacy Shader Pads/Cinematic Worlds IDs remain known only for restore/import compatibility. */
export const REACT_ENGINE_IDS: ReactEngineId[] = REACT_KNOWN_ENGINE_IDS.filter(
  engineId => engineId !== 'shaderPads' && engineId !== 'cinematicPortal',
)

export const REACT_ENGINE_CATALOG: Record<ReactEngineId, ReactEngineCatalogEntry> = {
  shaderPads: {
    id: 'shaderPads',
    label: 'Shader Pads',
    shortLabel: 'Shader',
    icon: '◈',
    description: 'Reactive shader fields driven by audio bands and beat timing.',
  },
  cinematicPortal: {
    id: 'cinematicPortal',
    label: 'Cinematic Worlds',
    shortLabel: 'Worlds',
    icon: '◎',
    description: 'Immersive cinematic environments, portals, media worlds and directed cameras.',
  },
  cinema: {
    id: 'cinema',
    label: 'Cinema',
    shortLabel: 'Cinema',
    icon: '◇',
    description: 'Composition-native visual graphs with one canonical Cinema runtime.',
  },
  oscilloscope: {
    id: 'oscilloscope',
    label: 'Sound Drawing',
    shortLabel: 'Draw',
    icon: '〜',
    description: 'Live audio waveform drawing with glyph, SVG and text rendering.',
  },
  canvas: {
    id: 'canvas',
    label: 'CANVAS',
    shortLabel: 'Canvas',
    icon: '▣',
    description: 'Uploaded videos, images, and SVGs for audio-reactive shows.',
  },
  laserDmx: {
    id: 'laserDmx',
    label: 'LaserDMX',
    shortLabel: 'Laser',
    icon: '✦',
    description: 'DMX Beam Matrix control with cues, fog, and audio-reactive looks.',
  },
  pixGrid: {
    id: 'pixGrid',
    label: 'PixGrid',
    shortLabel: 'PixGrid',
    icon: '▦',
    description: 'Programmable LED-cell artwork, animation, and full-song pixel choreography.',
  },
  headliner: {
    id: 'headliner',
    label: 'HEADLINER',
    shortLabel: 'Headliner',
    icon: '★',
    description: 'Headliner engine.',
  },
}

const REACT_ENGINE_ID_SET = new Set<string>(REACT_ENGINE_IDS)
const REACT_KNOWN_ENGINE_ID_SET = new Set<string>(REACT_KNOWN_ENGINE_IDS)

export function isKnownReactEngineId(value: unknown): value is ReactEngineId {
  return typeof value === 'string' && REACT_KNOWN_ENGINE_ID_SET.has(value)
}

export function isSelectableReactEngineId(value: unknown): value is ReactEngineId {
  return typeof value === 'string' && REACT_ENGINE_ID_SET.has(value)
}
