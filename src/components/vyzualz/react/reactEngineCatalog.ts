import type { ReactEngineId } from './ReactTypes'

export type ReactLiveEngineId = Exclude<ReactEngineId, 'shaderPads' | 'cinematicPortal' | 'cinema'>

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
  'cinema2',
  'oscilloscope',
  'canvas',
  'laserDmx',
  'pixGrid',
  'headliner',
]

/** User-facing engine choices. Retired identities remain known only for restore/import compatibility. */
export const REACT_ENGINE_IDS: ReactLiveEngineId[] = [
  'cinema2',
  'oscilloscope',
  'canvas',
  'laserDmx',
  'pixGrid',
  'headliner',
]

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
    description: 'Retired compatibility identity migrated to Cinema 2.0.',
  },
  cinema2: {
    id: 'cinema2',
    label: 'Cinema 2.0',
    shortLabel: 'Cinema 2',
    icon: '◆',
    description: 'Composition-native visuals powered by the canonical Cinema 2.0 runtime.',
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

export function isSelectableReactEngineId(value: unknown): value is ReactLiveEngineId {
  return typeof value === 'string' && REACT_ENGINE_ID_SET.has(value)
}
