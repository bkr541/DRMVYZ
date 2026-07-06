import type { ReactEngineId } from './ReactTypes'

export interface ReactEngineCatalogEntry {
  id: ReactEngineId
  label: string
  shortLabel: string
  icon: string
  description: string
}

export const REACT_ENGINE_IDS: ReactEngineId[] = [
  'shaderPads',
  'cinematicPortal',
  'oscilloscope',
  'laserDmx',
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
  oscilloscope: {
    id: 'oscilloscope',
    label: 'Sound Drawing',
    shortLabel: 'Draw',
    icon: '〜',
    description: 'Live audio waveform drawing with glyph, SVG and text rendering.',
  },
  laserDmx: {
    id: 'laserDmx',
    label: 'LaserDMX',
    shortLabel: 'Laser',
    icon: '✦',
    description: 'DMX Beam Matrix control with production-ready cues, fog, and audio-reactive laser looks.',
  },
}

const REACT_ENGINE_ID_SET = new Set<string>(REACT_ENGINE_IDS)

export function isSelectableReactEngineId(value: unknown): value is ReactEngineId {
  return typeof value === 'string' && REACT_ENGINE_ID_SET.has(value)
}
