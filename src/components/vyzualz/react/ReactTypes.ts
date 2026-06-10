export type ReactEngineId = 'shaderPads' | 'cinematicPortal' | 'oscilloscope'

export interface ReactPerformancePad {
  id: string
  presetId: string | null
  label: string
  color: string
  keyBinding: string
  transitionTimeMs: number
}

export type ReactSectionType = 'intro' | 'verse' | 'build' | 'drop' | 'breakdown' | 'outro'

export interface ReactPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  highlight: string
  text: string
}

export interface ReactPresetParams {
  intensity: number
  motion: number
  glow: number
  bassReactivity: number
  colorShift: number
  complexity: number
}

export interface ReactScene {
  id: string
  sectionType: ReactSectionType
  engineId: ReactEngineId
  params: Partial<ReactPresetParams>
  palette?: Partial<ReactPalette>
}

export interface ReactTrackSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  engineId?: ReactEngineId
}

export interface ReactSectionMapping {
  sectionType: ReactSectionType
  sceneId: string
}

export interface ReactPreset {
  id: string
  name: string
  description: string
  engine: ReactEngineId
  palette: ReactPalette
  params: ReactPresetParams
  scenes: ReactScene[]
  sectionMappings: ReactSectionMapping[]
}

// ── DVYDRM palette constants ──────────────────────────────────────────────────

export const DVYDRM_CYAN   = '#4ac7db'
export const DVYDRM_EMERALD = '#61d6aa'
export const DVYDRM_BLACK  = '#060d10'
export const DVYDRM_WHITE  = '#e8f4f8'
export const DVYDRM_GOLD   = '#d8b95a'
export const DVYDRM_CRIMSON = '#c0314a'

export const PALETTE_SHADER_PADS: ReactPalette = {
  primary:    DVYDRM_CYAN,
  secondary:  DVYDRM_EMERALD,
  accent:     DVYDRM_GOLD,
  background: DVYDRM_BLACK,
  highlight:  '#80dfc0',
  text:       DVYDRM_WHITE,
}

export const PALETTE_CINEMATIC: ReactPalette = {
  primary:    '#b84fc9',
  secondary:  DVYDRM_CYAN,
  accent:     DVYDRM_GOLD,
  background: '#06080e',
  highlight:  DVYDRM_CRIMSON,
  text:       DVYDRM_WHITE,
}

export const PALETTE_OSCILLOSCOPE: ReactPalette = {
  primary:    DVYDRM_EMERALD,
  secondary:  DVYDRM_CYAN,
  accent:     DVYDRM_WHITE,
  background: DVYDRM_BLACK,
  highlight:  DVYDRM_GOLD,
  text:       DVYDRM_WHITE,
}

// ── Additional palettes ───────────────────────────────────────────────────────

const PALETTE_LAVA: ReactPalette = {
  primary:    '#d8b95a',
  secondary:  DVYDRM_CRIMSON,
  accent:     '#ff8c42',
  background: '#0a0604',
  highlight:  '#f5c26b',
  text:       DVYDRM_WHITE,
}

const PALETTE_DREAM: ReactPalette = {
  primary:    '#5b8def',
  secondary:  '#b84fc9',
  accent:     DVYDRM_CYAN,
  background: '#04060e',
  highlight:  '#8bb4ff',
  text:       DVYDRM_WHITE,
}

const PALETTE_EMERALD_FOG: ReactPalette = {
  primary:    DVYDRM_EMERALD,
  secondary:  DVYDRM_CYAN,
  accent:     '#80dfc0',
  background: '#030e0a',
  highlight:  '#9fffdc',
  text:       DVYDRM_WHITE,
}

const PALETTE_OVERLOAD: ReactPalette = {
  primary:    '#b84fc9',
  secondary:  DVYDRM_CRIMSON,
  accent:     DVYDRM_CYAN,
  background: DVYDRM_BLACK,
  highlight:  DVYDRM_GOLD,
  text:       DVYDRM_WHITE,
}

const PALETTE_RUINS: ReactPalette = {
  primary:    '#7a9bac',
  secondary:  '#5c7a7a',
  accent:     '#9ab0b0',
  background: DVYDRM_BLACK,
  highlight:  '#a8c0c8',
  text:       '#c8d8dc',
}

const PALETTE_SPIRAL: ReactPalette = {
  primary:    DVYDRM_GOLD,
  secondary:  '#f5c26b',
  accent:     DVYDRM_CYAN,
  background: DVYDRM_BLACK,
  highlight:  '#ffe080',
  text:       DVYDRM_WHITE,
}

const PALETTE_RADIAL: ReactPalette = {
  primary:    DVYDRM_WHITE,
  secondary:  DVYDRM_CYAN,
  accent:     DVYDRM_EMERALD,
  background: DVYDRM_BLACK,
  highlight:  '#ffffff',
  text:       DVYDRM_WHITE,
}

const PALETTE_NEON_TRACE: ReactPalette = {
  primary:    '#b84fc9',
  secondary:  DVYDRM_CYAN,
  accent:     DVYDRM_GOLD,
  background: DVYDRM_BLACK,
  highlight:  '#e888ff',
  text:       DVYDRM_WHITE,
}

// ── Scene builder helpers ─────────────────────────────────────────────────────

function makeScenes(prefix: string, engine: ReactEngineId): ReactScene[] {
  return [
    { id: `${prefix}-intro`,  sectionType: 'intro',     engineId: engine, params: { intensity: 0.3,  motion: 0.3  } },
    { id: `${prefix}-verse`,  sectionType: 'verse',     engineId: engine, params: { intensity: 0.5,  motion: 0.45 } },
    { id: `${prefix}-build`,  sectionType: 'build',     engineId: engine, params: { intensity: 0.72, motion: 0.65 } },
    { id: `${prefix}-drop`,   sectionType: 'drop',      engineId: engine, params: { intensity: 1.0,  motion: 0.95 } },
    { id: `${prefix}-break`,  sectionType: 'breakdown', engineId: engine, params: { intensity: 0.45, motion: 0.4  } },
    { id: `${prefix}-outro`,  sectionType: 'outro',     engineId: engine, params: { intensity: 0.25, motion: 0.25 } },
  ]
}

function makeMappings(prefix: string): ReactSectionMapping[] {
  return [
    { sectionType: 'intro',     sceneId: `${prefix}-intro`  },
    { sectionType: 'verse',     sceneId: `${prefix}-verse`  },
    { sectionType: 'build',     sceneId: `${prefix}-build`  },
    { sectionType: 'drop',      sceneId: `${prefix}-drop`   },
    { sectionType: 'breakdown', sceneId: `${prefix}-break`  },
    { sectionType: 'outro',     sceneId: `${prefix}-outro`  },
  ]
}

// ── Default presets ───────────────────────────────────────────────────────────

export const DEFAULT_REACT_PRESETS: ReactPreset[] = [
  // ── Shader Pads (5) ──────────────────────────────────────────────────────
  {
    id: 'preset-neon-energy-cloud',
    name: 'Neon Energy Cloud',
    description: 'Reactive particle cloud driven by frequency bands — ambient and expansive.',
    engine: 'shaderPads',
    palette: PALETTE_SHADER_PADS,
    params: { intensity: 0.75, motion: 0.55, glow: 0.85, bassReactivity: 0.85, colorShift: 0.5, complexity: 0.7 },
    scenes: makeScenes('nec', 'shaderPads'),
    sectionMappings: makeMappings('nec'),
  },
  {
    id: 'preset-lava-tunnel',
    name: 'Lava Tunnel',
    description: 'Warm dot tunnel pulsing in gold and crimson, beat-burst at every drop.',
    engine: 'shaderPads',
    palette: PALETTE_LAVA,
    params: { intensity: 0.8, motion: 0.7, glow: 0.75, bassReactivity: 0.95, colorShift: 0.65, complexity: 0.6 },
    scenes: makeScenes('lt', 'shaderPads'),
    sectionMappings: makeMappings('lt'),
  },
  {
    id: 'preset-synth-sun',
    name: 'Synth Sun',
    description: 'Golden radial rays emanating from a central sun, driven by frequency bands.',
    engine: 'shaderPads',
    palette: {
      primary:    DVYDRM_GOLD,
      secondary:  DVYDRM_WHITE,
      accent:     DVYDRM_CYAN,
      background: DVYDRM_BLACK,
      highlight:  '#fff0a0',
      text:       DVYDRM_WHITE,
    },
    params: { intensity: 0.7, motion: 0.45, glow: 0.9, bassReactivity: 0.8, colorShift: 0.35, complexity: 0.55 },
    scenes: makeScenes('ss', 'shaderPads'),
    sectionMappings: makeMappings('ss'),
  },
  {
    id: 'preset-dot-warp',
    name: 'Dot Warp',
    description: 'High-speed perspective dot tunnel with cyan motion trails.',
    engine: 'shaderPads',
    palette: {
      primary:    DVYDRM_CYAN,
      secondary:  DVYDRM_WHITE,
      accent:     DVYDRM_EMERALD,
      background: '#040810',
      highlight:  '#aaeeff',
      text:       DVYDRM_WHITE,
    },
    params: { intensity: 0.65, motion: 0.85, glow: 0.6, bassReactivity: 0.9, colorShift: 0.3, complexity: 0.8 },
    scenes: makeScenes('dw', 'shaderPads'),
    sectionMappings: makeMappings('dw'),
  },
  {
    id: 'preset-festival-burst',
    name: 'Festival Burst',
    description: 'Maximum energy multicolor explosion — full chromatic chaos at peak intensity.',
    engine: 'shaderPads',
    palette: {
      primary:    DVYDRM_CRIMSON,
      secondary:  DVYDRM_GOLD,
      accent:     DVYDRM_CYAN,
      background: DVYDRM_BLACK,
      highlight:  '#b84fc9',
      text:       DVYDRM_WHITE,
    },
    params: { intensity: 0.95, motion: 0.9, glow: 0.95, bassReactivity: 1.0, colorShift: 0.85, complexity: 0.9 },
    scenes: makeScenes('fb', 'shaderPads'),
    sectionMappings: makeMappings('fb'),
  },

  // ── Cinematic Portal (5) ─────────────────────────────────────────────────
  {
    id: 'preset-dream-gate',
    name: 'Dream Gate',
    description: 'Soft blue-violet portal with gossamer fog and slow ember drift.',
    engine: 'cinematicPortal',
    palette: PALETTE_DREAM,
    params: { intensity: 0.6, motion: 0.5, glow: 0.75, bassReactivity: 0.7, colorShift: 0.55, complexity: 0.65 },
    scenes: makeScenes('dg', 'cinematicPortal'),
    sectionMappings: makeMappings('dg'),
  },
  {
    id: 'preset-crimson-rift',
    name: 'Crimson Rift',
    description: 'Intense crimson-gold portal with aggressive ring expansion and camera shake on drops.',
    engine: 'cinematicPortal',
    palette: {
      primary:    DVYDRM_CRIMSON,
      secondary:  DVYDRM_GOLD,
      accent:     '#ff6b35',
      background: '#07030a',
      highlight:  '#ff4466',
      text:       DVYDRM_WHITE,
    },
    params: { intensity: 0.85, motion: 0.75, glow: 0.9, bassReactivity: 0.95, colorShift: 0.7, complexity: 0.75 },
    scenes: makeScenes('cr', 'cinematicPortal'),
    sectionMappings: makeMappings('cr'),
  },
  {
    id: 'preset-emerald-fog',
    name: 'Emerald Fog',
    description: 'Dense green-teal mist with a slow-breathing portal monolith at center.',
    engine: 'cinematicPortal',
    palette: PALETTE_EMERALD_FOG,
    params: { intensity: 0.55, motion: 0.4, glow: 0.7, bassReactivity: 0.65, colorShift: 0.4, complexity: 0.5 },
    scenes: makeScenes('ef', 'cinematicPortal'),
    sectionMappings: makeMappings('ef'),
  },
  {
    id: 'preset-portal-overload',
    name: 'Portal Overload',
    description: 'Every parameter maxed — rings multiply rapidly and fog fills the frame.',
    engine: 'cinematicPortal',
    palette: PALETTE_OVERLOAD,
    params: { intensity: 1.0, motion: 1.0, glow: 1.0, bassReactivity: 1.0, colorShift: 0.9, complexity: 0.95 },
    scenes: makeScenes('po', 'cinematicPortal'),
    sectionMappings: makeMappings('po'),
  },
  {
    id: 'preset-quiet-ruins',
    name: 'Quiet Ruins',
    description: 'Muted, ambient atmosphere — barely visible fog and distant ember glow.',
    engine: 'cinematicPortal',
    palette: PALETTE_RUINS,
    params: { intensity: 0.3, motion: 0.25, glow: 0.4, bassReactivity: 0.45, colorShift: 0.2, complexity: 0.3 },
    scenes: makeScenes('qr', 'cinematicPortal'),
    sectionMappings: makeMappings('qr'),
  },

  // ── Sound Drawing (5) ────────────────────────────────────────────────────
  {
    id: 'preset-xy-cyan-scope',
    name: 'XY Cyan Scope',
    description: 'Classic cyan lissajous figures that morph with frequency content.',
    engine: 'oscilloscope',
    palette: PALETTE_OSCILLOSCOPE,
    params: { intensity: 0.65, motion: 0.7, glow: 0.7, bassReactivity: 0.6, colorShift: 0.3, complexity: 0.65 },
    scenes: makeScenes('xyc', 'oscilloscope'),
    sectionMappings: makeMappings('xyc'),
  },
  {
    id: 'preset-lissajous-flower',
    name: 'Lissajous Flower',
    description: 'Emerald lissajous patterns that bloom into floral forms at high complexity.',
    engine: 'oscilloscope',
    palette: {
      primary:    DVYDRM_EMERALD,
      secondary:  DVYDRM_CYAN,
      accent:     DVYDRM_GOLD,
      background: DVYDRM_BLACK,
      highlight:  '#80dfc0',
      text:       DVYDRM_WHITE,
    },
    params: { intensity: 0.7, motion: 0.65, glow: 0.6, bassReactivity: 0.55, colorShift: 0.45, complexity: 0.7 },
    scenes: makeScenes('lf', 'oscilloscope'),
    sectionMappings: makeMappings('lf'),
  },
  {
    id: 'preset-spiral-signal',
    name: 'Spiral Signal',
    description: 'Golden frequency-mapped spiral that expands and contracts with audio energy.',
    engine: 'oscilloscope',
    palette: PALETTE_SPIRAL,
    params: { intensity: 0.6, motion: 0.75, glow: 0.65, bassReactivity: 0.7, colorShift: 0.5, complexity: 0.75 },
    scenes: makeScenes('spi', 'oscilloscope'),
    sectionMappings: makeMappings('spi'),
  },
  {
    id: 'preset-radial-voice',
    name: 'Radial Voice',
    description: 'Pure white radial oscilloscope that rings like a sound membrane.',
    engine: 'oscilloscope',
    palette: PALETTE_RADIAL,
    params: { intensity: 0.7, motion: 0.6, glow: 0.8, bassReactivity: 0.65, colorShift: 0.25, complexity: 0.6 },
    scenes: makeScenes('rv', 'oscilloscope'),
    sectionMappings: makeMappings('rv'),
  },
  {
    id: 'preset-neon-text-trace',
    name: 'Neon Text Trace',
    description: 'Purple-cyan waveform trace with high glow — text-style oscilloscope aesthetics.',
    engine: 'oscilloscope',
    palette: PALETTE_NEON_TRACE,
    params: { intensity: 0.75, motion: 0.5, glow: 0.9, bassReactivity: 0.7, colorShift: 0.6, complexity: 0.55 },
    scenes: makeScenes('ntt', 'oscilloscope'),
    sectionMappings: makeMappings('ntt'),
  },
]

// ── Default performance pads ──────────────────────────────────────────────────

export const DEFAULT_PERFORMANCE_PADS: ReactPerformancePad[] = [
  // Row 1 — Shader Pads variants
  { id: 'pad-1', presetId: 'preset-neon-energy-cloud', label: 'Energy',   color: DVYDRM_CYAN,    keyBinding: '1', transitionTimeMs: 500 },
  { id: 'pad-2', presetId: 'preset-lava-tunnel',       label: 'Lava',     color: DVYDRM_GOLD,    keyBinding: '2', transitionTimeMs: 400 },
  { id: 'pad-3', presetId: 'preset-synth-sun',         label: 'Sun',      color: DVYDRM_GOLD,    keyBinding: '3', transitionTimeMs: 600 },
  { id: 'pad-4', presetId: 'preset-dot-warp',          label: 'Warp',     color: '#aaeeff',      keyBinding: '4', transitionTimeMs: 300 },
  // Row 2 — Cinematic variants
  { id: 'pad-5', presetId: 'preset-dream-gate',        label: 'Dream',    color: '#5b8def',      keyBinding: 'q', transitionTimeMs: 800 },
  { id: 'pad-6', presetId: 'preset-crimson-rift',      label: 'Rift',     color: DVYDRM_CRIMSON, keyBinding: 'w', transitionTimeMs: 400 },
  { id: 'pad-7', presetId: 'preset-emerald-fog',       label: 'Fog',      color: DVYDRM_EMERALD, keyBinding: 'e', transitionTimeMs: 700 },
  { id: 'pad-8', presetId: 'preset-portal-overload',   label: 'Overload', color: '#b84fc9',      keyBinding: 'r', transitionTimeMs: 200 },
  // Row 3 — Sound Drawing variants
  { id: 'pad-9',  presetId: 'preset-xy-cyan-scope',    label: 'XY Scope', color: DVYDRM_CYAN,    keyBinding: 'a', transitionTimeMs: 300 },
  { id: 'pad-10', presetId: 'preset-lissajous-flower', label: 'Lissajous',color: DVYDRM_EMERALD, keyBinding: 's', transitionTimeMs: 400 },
  { id: 'pad-11', presetId: 'preset-spiral-signal',    label: 'Spiral',   color: DVYDRM_GOLD,    keyBinding: 'd', transitionTimeMs: 350 },
  { id: 'pad-12', presetId: 'preset-radial-voice',     label: 'Radial',   color: DVYDRM_WHITE,   keyBinding: 'f', transitionTimeMs: 450 },
  // Row 4 — Festival / overload / quiet
  { id: 'pad-13', presetId: 'preset-festival-burst',   label: 'Festival', color: DVYDRM_CRIMSON, keyBinding: 'z', transitionTimeMs: 200 },
  { id: 'pad-14', presetId: 'preset-neon-text-trace',  label: 'Neon',     color: '#b84fc9',      keyBinding: 'x', transitionTimeMs: 400 },
  { id: 'pad-15', presetId: 'preset-quiet-ruins',      label: 'Quiet',    color: '#7a9bac',      keyBinding: 'c', transitionTimeMs: 1000 },
  { id: 'pad-16', presetId: null,                      label: '—',        color: '#2a3a40',      keyBinding: 'v', transitionTimeMs: 500 },
]
