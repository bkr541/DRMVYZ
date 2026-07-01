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
  'neonLattice',
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
    description: 'DMX beam matrix and spatial fixture control with production atmosphere.',
  },
  neonLattice: {
    id: 'neonLattice',
    label: 'Neon Lattice',
    shortLabel: 'Lattice',
    icon: '⬡',
    description: 'Beat-reactive neon rail grid with pulsing blocks and shockwaves.',
  },
}
