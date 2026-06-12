export type ReactEngineId = 'shaderPads' | 'cinematicPortal' | 'oscilloscope' | 'laserDmx'

// ── Oscillator path/glyph types ───────────────────────────────────────────────

export type OscillatorSourceType = 'classic' | 'builtinShape' | 'text' | 'svgGlyph' | 'svgVisual'

export type ClassicScopeMode = 'sectionAuto' | 'waveform' | 'lissajous' | 'radialScope' | 'spiralScope'

export type BuiltinOscillatorShape =
  | 'circle' | 'square' | 'triangle' | 'star'
  | 'hexagon' | 'infinity' | 'spiral' | 'line'

export type OscillatorRenderMode = 'outline' | 'multiTrace' | 'dots' | 'ribbon'

export type OscillatorAudioDisplaceMode = 'normal' | 'radial' | 'tangent' | 'xy'

export type OscillatorTextWaveformMode = 'off' | 'normal' | 'radial' | 'tangent' | 'xy'

export interface OscillatorGlyphPoint {
  x: number
  y: number
  pathIndex: number
  progress: number
  normalX?: number
  normalY?: number
}

export interface OscillatorGlyphAsset {
  id: string
  name: string
  sourceType: 'builtinShape' | 'text' | 'svgGlyph'
  rawSvg?: string
  /** FNV-1a hash of rawSvg. Present on all SVG glyph assets created after compiler v2. */
  contentHash?: string
  text?: string
  shape?: BuiltinOscillatorShape
  pointCount: number
  createdAt: string
}

export interface OscillatorFontAsset {
  id: string
  name: string
  fileName: string
  fontFamilyName?: string
  rawFontDataBase64: string
  createdAt: string
  parseError?: string | null
}

export interface OscillatorSettings {
  sourceType: OscillatorSourceType
  classicMode: ClassicScopeMode
  builtinShape: BuiltinOscillatorShape
  selectedGlyphId: string | null
  selectedSvgVisualId: string | null
  text: string
  textFontId: string | null
  textFontSize: number
  textLetterSpacing: number
  renderMode: OscillatorRenderMode
  pathResolution: number
  pathScale: number
  audioDisplacement: number
  audioDisplaceMode: OscillatorAudioDisplaceMode
  textWaveformMode:   OscillatorTextWaveformMode
  textWaveformAmount: number
  textWaveformCycles: number
  textWaveformScroll: number
  bassScale: number
  midTwist: number
  highJitter: number
  beatBloom: number
  rotationSpeed: number
  duplicateTraces: number
  mirrorX: boolean
  mirrorY: boolean
  autoSectionMode: boolean
}

export const DEFAULT_OSCILLATOR_SETTINGS: OscillatorSettings = {
  sourceType:          'classic',
  classicMode:         'sectionAuto',
  builtinShape:        'circle',
  selectedGlyphId:     null,
  selectedSvgVisualId: null,
  text:                'DRMVYZ',
  textFontId:        null,
  textFontSize:      160,
  textLetterSpacing: 0,
  renderMode:        'outline',
  pathResolution:    512,
  pathScale:         0.78,
  audioDisplacement: 0.18,
  audioDisplaceMode: 'normal',
  textWaveformMode:   'off',
  textWaveformAmount: 0.10,
  textWaveformCycles: 5,
  textWaveformScroll: 0.20,
  bassScale:          0.25,
  midTwist:          0.15,
  highJitter:        0.08,
  beatBloom:         0.35,
  rotationSpeed:     0.08,
  duplicateTraces:   1,
  mirrorX:           false,
  mirrorY:           false,
  autoSectionMode:   true,
}

// ── LaserDMX types ────────────────────────────────────────────────────────────

export type LaserDmxProfileId =
  | 'genericRgbLaser'
  | 'genericRgbwLaser'
  | 'scannerLaser'
  | 'multiPatternLaser'

export type LaserDmxModulationTarget =
  | 'masterDimmer'
  | 'fixtureDimmer'
  | 'red' | 'green' | 'blue' | 'white' | 'alpha'
  | 'pan' | 'tilt' | 'rotation'
  | 'zoom' | 'beamWidth' | 'strobeRate'
  | 'scanSpeed' | 'pathProgress' | 'pathScale' | 'pathRotation' | 'pathSpread' | 'pathRadius' | 'pathComplexity'
  | 'hazeAmount' | 'glowAmount' | 'shutter'

export interface LaserDmxModulationRoute {
  id: string
  enabled: boolean
  source: string
  target: LaserDmxModulationTarget
  amount: number
  min: number
  max: number
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'pulse' | 'exponential'
  mode: 'set' | 'add' | 'multiply' | 'trigger'
  smoothing: number
  attack: number
  release: number
  invert: boolean
}

export interface LaserDmxFixture {
  id: string
  name: string
  enabled: boolean

  dmx: {
    universe: number
    startAddress: number
    profileId: LaserDmxProfileId
    channelMode: 'basic' | 'extended'
  }

  position: {
    originX: number
    originY: number
    originZ: number
    targetX: number
    targetY: number
    targetZ: number
    pan: number
    tilt: number
    rotation: number
    mirrorX: boolean
    mirrorY: boolean
  }

  color: {
    mode: 'fixed' | 'palette' | 'music'
    red: number
    green: number
    blue: number
    white: number
    alpha: number
    paletteId: string
    colorCycleSpeed: number
  }

  beam: {
    dimmer: number
    shutterOpen: boolean
    width: number
    zoom: number
    focus: number
    strobeRate: number
    flickerAmount: number
  }

  path: {
    kind:
      | 'staticBeam' | 'lineSweep' | 'fan' | 'cone' | 'circle' | 'spiral'
      | 'lissajous' | 'grid' | 'tunnel' | 'constellation' | 'svgPath' | 'textPath'
    scale: number
    rotation: number
    offsetX: number
    offsetY: number
    scanSpeed: number
    phaseOffset: number
    pointCount: number
    spread: number
    radius: number
    complexity: number
    smoothing: number
    pathProgress: number
    customPoints?: Array<{ x: number; y: number }>
  }

  modulationRoutes: LaserDmxModulationRoute[]
}

export interface LaserDmxSettings {
  selectedFixtureId: string | null
  masterDimmer: number
  blackout: boolean
  hazeAmount: number
  beamPersistence: number
  glowAmount: number
  globalBeamWidth: number
  globalStrobeRate: number
  safetyClamp: number
  backgroundFade: number
  showFixtureOrigins?: boolean
  showPathPoints?: boolean
  showDmxDebug?: boolean
  fixtures: LaserDmxFixture[]
}

export interface LaserDmxFixtureFrame {
  fixtureId: string
  universe: number
  startAddress: number
  channels: Record<string, number>
  visual: {
    origin: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    points: Array<{ x: number; y: number }>
    color: string
    rgba: { r: number; g: number; b: number; a: number }
    intensity: number
    beamWidth: number
    strobeVisible: boolean
    /** 0=soft/diffuse, 1=sharp/tight. Computed from fixture.beam.focus. Used to scale glow blur. */
    focusFactor: number
  }
}

export function createDefaultLaserDmxSettings(): LaserDmxSettings {
  const leftFan: LaserDmxFixture = {
    id: 'laser-fixture-left',
    name: 'Left Fan Laser',
    enabled: true,
    dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
    position: { originX: 0.12, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.35, targetZ: 0, pan: 0, tilt: 0, rotation: -18, mirrorX: false, mirrorY: false },
    color: { mode: 'fixed', red: 0, green: 255, blue: 220, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.75, radius: 0.45, complexity: 0.45, smoothing: 0, pathProgress: 0 },
    modulationRoutes: [
      { id: 'ldx-r1', enabled: true,  source: 'kick',          target: 'fixtureDimmer', amount: 0.85, min: 0.35, max: 1,    curve: 'pulse',   mode: 'trigger',  smoothing: 0.1, attack: 0.02, release: 0.25, invert: false },
      { id: 'ldx-r2', enabled: true,  source: 'snare',         target: 'strobeRate',    amount: 0.6,  min: 0,    max: 0.65, curve: 'pulse',   mode: 'trigger',  smoothing: 0,   attack: 0,    release: 0.2,  invert: false },
      { id: 'ldx-r3', enabled: true,  source: 'beatPhase',     target: 'pathProgress',  amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',      smoothing: 0,   attack: 0,    release: 0,    invert: false },
      { id: 'ldx-r4', enabled: true,  source: 'buildProgress', target: 'pathSpread',    amount: 1,    min: 0.2,  max: 1,    curve: 'easeOut', mode: 'set',      smoothing: 0.3, attack: 0.1,  release: 0.5,  invert: false },
      { id: 'ldx-r5', enabled: true,  source: 'dropImpact',    target: 'masterDimmer',  amount: 1,    min: 0.65, max: 1,    curve: 'pulse',   mode: 'trigger',  smoothing: 0,   attack: 0,    release: 0.3,  invert: false },
    ],
  }
  const rightFan: LaserDmxFixture = {
    id: 'laser-fixture-right',
    name: 'Right Fan Laser',
    enabled: true,
    dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbLaser', channelMode: 'basic' },
    position: { originX: 0.88, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.35, targetZ: 0, pan: 0, tilt: 0, rotation: 18, mirrorX: false, mirrorY: false },
    color: { mode: 'fixed', red: 0, green: 255, blue: 120, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.75, radius: 0.45, complexity: 0.45, smoothing: 0, pathProgress: 0 },
    modulationRoutes: [
      { id: 'ldx-r6', enabled: true, source: 'kick',      target: 'fixtureDimmer', amount: 0.85, min: 0.35, max: 1,   curve: 'pulse',  mode: 'trigger', smoothing: 0.1, attack: 0.02, release: 0.25, invert: false },
      { id: 'ldx-r7', enabled: true, source: 'beatPhase', target: 'pathProgress',  amount: 1,    min: 0,    max: 1,   curve: 'linear', mode: 'set',     smoothing: 0,   attack: 0,    release: 0,    invert: true  },
    ],
  }
  const centerAccent: LaserDmxFixture = {
    id: 'laser-fixture-center',
    name: 'Center Accent Laser',
    enabled: true,
    dmx: { universe: 1, startAddress: 33, profileId: 'genericRgbwLaser', channelMode: 'extended' },
    position: { originX: 0.5, originY: 0.82, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
    color: { mode: 'fixed', red: 80, green: 255, blue: 255, white: 80, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: 'lissajous', scale: 0.65, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.35, phaseOffset: 0, pointCount: 96, spread: 0.5, radius: 0.35, complexity: 0.6, smoothing: 0, pathProgress: 0 },
    modulationRoutes: [
      { id: 'ldx-r8', enabled: true, source: 'vocalActivity', target: 'alpha',         amount: 0.8, min: 0.3, max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.4, attack: 0.1, release: 0.6, invert: false },
      { id: 'ldx-r9', enabled: true, source: 'energy',        target: 'pathComplexity', amount: 1,   min: 0.2, max: 0.95, curve: 'easeIn',  mode: 'set',     smoothing: 0.2, attack: 0.1, release: 0.3, invert: false },
    ],
  }
  return {
    selectedFixtureId: leftFan.id,
    masterDimmer:      0.85,
    blackout:          false,
    hazeAmount:        0.55,
    beamPersistence:   0.72,
    glowAmount:        0.7,
    globalBeamWidth:   1,
    globalStrobeRate:  0,
    safetyClamp:       0.85,
    backgroundFade:    0.18,
    showFixtureOrigins: false,
    showPathPoints:     false,
    showDmxDebug:       false,
    fixtures: [leftFan, rightFan, centerAccent],
  }
}

export interface ReactPerformancePad {
  id: string
  presetId: string | null
  label: string
  color: string
  keyBinding: string
  transitionTimeMs: number
}

export type ReactSectionType = 'intro' | 'verse' | 'build' | 'preDrop' | 'drop' | 'breakdown' | 'bridge' | 'outro' | 'unknown'

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
  source?: 'manual' | 'auto' | 'mock'
  confidence?: number
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
  /** When present, selecting this preset merges these values onto DEFAULT_OSCILLATOR_SETTINGS. */
  oscillatorSettings?: Partial<OscillatorSettings>
  /** When present, selecting this preset merges these values onto createDefaultLaserDmxSettings(). */
  laserDmxSettings?: Partial<LaserDmxSettings>
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

const PALETTE_STAR_BURST: ReactPalette = {
  primary:    DVYDRM_GOLD,
  secondary:  DVYDRM_CRIMSON,
  accent:     '#ff8c42',
  background: DVYDRM_BLACK,
  highlight:  '#ffe080',
  text:       DVYDRM_WHITE,
}

const PALETTE_DEEP_PULSE: ReactPalette = {
  primary:    DVYDRM_CYAN,
  secondary:  DVYDRM_EMERALD,
  accent:     DVYDRM_GOLD,
  background: '#030c10',
  highlight:  '#80dfc0',
  text:       DVYDRM_WHITE,
}

const PALETTE_SVG_SLOT: ReactPalette = {
  primary:    DVYDRM_WHITE,
  secondary:  DVYDRM_CYAN,
  accent:     '#b84fc9',
  background: DVYDRM_BLACK,
  highlight:  '#d0eeff',
  text:       DVYDRM_WHITE,
}

export const PALETTE_LASER_DMX: ReactPalette = {
  primary:    '#00ffdc',
  secondary:  '#00ff78',
  accent:     '#50ffff',
  background: DVYDRM_BLACK,
  highlight:  '#80ffe8',
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

  // ── Enhanced Oscillator presets (6) ─────────────────────────────────────
  {
    id: 'preset-glyph-circle-pulse',
    name: 'Glyph Circle Pulse',
    description: 'A clean circle that breathes with bass, twists on mids, and blooms on every beat.',
    engine: 'oscilloscope',
    palette: PALETTE_DEEP_PULSE,
    params: { intensity: 0.72, motion: 0.55, glow: 0.8, bassReactivity: 0.85, colorShift: 0.35, complexity: 0.6 },
    scenes: makeScenes('gcp', 'oscilloscope'),
    sectionMappings: makeMappings('gcp'),
    oscillatorSettings: {
      sourceType:        'builtinShape',
      builtinShape:      'circle',
      renderMode:        'outline',
      autoSectionMode:   true,
      bassScale:         0.3,
      beatBloom:         0.45,
      rotationSpeed:     0.05,
      duplicateTraces:   2,
      audioDisplacement: 0.2,
      midTwist:          0.12,
      highJitter:        0.05,
    },
  },
  {
    id: 'preset-bass-triangle-reactor',
    name: 'Bass Triangle Reactor',
    description: 'Triple-trace triangle that explodes outward on bass hits — heavy and percussive.',
    engine: 'oscilloscope',
    palette: PALETTE_LAVA,
    params: { intensity: 0.8, motion: 0.65, glow: 0.75, bassReactivity: 0.95, colorShift: 0.55, complexity: 0.65 },
    scenes: makeScenes('btr', 'oscilloscope'),
    sectionMappings: makeMappings('btr'),
    oscillatorSettings: {
      sourceType:        'builtinShape',
      builtinShape:      'triangle',
      renderMode:        'multiTrace',
      autoSectionMode:   true,
      bassScale:         0.5,
      beatBloom:         0.55,
      rotationSpeed:     0.12,
      duplicateTraces:   3,
      audioDisplacement: 0.22,
      midTwist:          0.08,
      highJitter:        0.06,
    },
  },
  {
    id: 'preset-infinity-signal',
    name: 'Infinity Signal',
    description: 'Ribbon-rendered infinity loop with mid-driven twist — meditative and hypnotic.',
    engine: 'oscilloscope',
    palette: PALETTE_EMERALD_FOG,
    params: { intensity: 0.65, motion: 0.45, glow: 0.72, bassReactivity: 0.7, colorShift: 0.4, complexity: 0.55 },
    scenes: makeScenes('inf', 'oscilloscope'),
    sectionMappings: makeMappings('inf'),
    oscillatorSettings: {
      sourceType:        'builtinShape',
      builtinShape:      'infinity',
      renderMode:        'ribbon',
      autoSectionMode:   true,
      bassScale:         0.2,
      beatBloom:         0.35,
      rotationSpeed:     0.04,
      duplicateTraces:   1,
      audioDisplacement: 0.15,
      midTwist:          0.28,
      highJitter:        0.03,
    },
  },
  {
    id: 'preset-drmvyz-text-trace',
    name: 'DRMVYZ Text Trace',
    description: 'The DRMVYZ logotype traced as a glyph path — dual trace with high glow.',
    engine: 'oscilloscope',
    palette: PALETTE_NEON_TRACE,
    params: { intensity: 0.75, motion: 0.42, glow: 0.88, bassReactivity: 0.75, colorShift: 0.6, complexity: 0.5 },
    scenes: makeScenes('dtt', 'oscilloscope'),
    sectionMappings: makeMappings('dtt'),
    oscillatorSettings: {
      sourceType:        'text',
      text:              'DRMVYZ',
      renderMode:        'multiTrace',
      autoSectionMode:   true,
      bassScale:         0.22,
      beatBloom:         0.4,
      rotationSpeed:     0.02,
      duplicateTraces:   2,
      audioDisplacement: 0.12,
      midTwist:          0.1,
      highJitter:        0.07,
    },
  },
  {
    id: 'preset-star-drop-burst',
    name: 'Star Drop Burst',
    description: 'Four-trace star that detonates on drop — high beatBloom and rotating ghost echoes.',
    engine: 'oscilloscope',
    palette: PALETTE_STAR_BURST,
    params: { intensity: 0.88, motion: 0.75, glow: 0.85, bassReactivity: 0.95, colorShift: 0.6, complexity: 0.7 },
    scenes: makeScenes('sdb', 'oscilloscope'),
    sectionMappings: makeMappings('sdb'),
    oscillatorSettings: {
      sourceType:        'builtinShape',
      builtinShape:      'star',
      renderMode:        'multiTrace',
      autoSectionMode:   true,
      bassScale:         0.4,
      beatBloom:         0.7,
      rotationSpeed:     0.18,
      duplicateTraces:   4,
      audioDisplacement: 0.2,
      midTwist:          0.15,
      highJitter:        0.1,
    },
  },
  {
    id: 'preset-svg-glyph-slot',
    name: 'SVG Glyph Slot',
    description: 'Import an SVG from the Media tab and select it in SOURCE & MODE → SVG Glyph to render it as a reactive oscillator path.',
    engine: 'oscilloscope',
    palette: PALETTE_SVG_SLOT,
    params: { intensity: 0.7, motion: 0.5, glow: 0.78, bassReactivity: 0.8, colorShift: 0.35, complexity: 0.55 },
    scenes: makeScenes('sgs', 'oscilloscope'),
    sectionMappings: makeMappings('sgs'),
    oscillatorSettings: {
      sourceType:        'svgGlyph',
      selectedGlyphId:   null,
      renderMode:        'outline',
      autoSectionMode:   true,
      bassScale:         0.3,
      beatBloom:         0.4,
      rotationSpeed:     0.06,
      duplicateTraces:   2,
      audioDisplacement: 0.18,
      midTwist:          0.1,
      highJitter:        0.05,
    },
  },

  // ── LaserDMX (1) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-default',
    name: 'Laser Fan Grid',
    description: 'Virtual laser show: fan beams from left and right with a lissajous accent at center.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.85, motion: 0.55, glow: 0.7, bassReactivity: 0.8, colorShift: 0.4, complexity: 0.6 },
    scenes: makeScenes('ldx', 'laserDmx'),
    sectionMappings: makeMappings('ldx'),
    // Explicit settings so selecting this preset always produces a valid selectedFixtureId
    // and the layout matches the documented "fan grid" look.
    laserDmxSettings: {
      selectedFixtureId: 'laser-fixture-left',
      masterDimmer: 0.85,
      hazeAmount: 0.55,
      beamPersistence: 0.72,
      glowAmount: 0.7,
      globalBeamWidth: 1,
      globalStrobeRate: 0,
      safetyClamp: 0.85,
      backgroundFade: 0.18,
      blackout: false,
      fixtures: [
        {
          id: 'laser-fixture-left',
          name: 'Left Fan Laser',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.12, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.35, targetZ: 0, pan: 0, tilt: 0, rotation: -18, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 255, blue: 220, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0 },
          beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.75, radius: 0.45, complexity: 0.45, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'ldx-r1', enabled: true, source: 'kick',          target: 'fixtureDimmer', amount: 0.85, min: 0.35, max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0.1, attack: 0.02, release: 0.25, invert: false },
            { id: 'ldx-r2', enabled: true, source: 'snare',         target: 'strobeRate',    amount: 0.6,  min: 0,    max: 0.65, curve: 'pulse',   mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.2,  invert: false },
            { id: 'ldx-r3', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,   attack: 0,    release: 0,    invert: false },
            { id: 'ldx-r4', enabled: true, source: 'buildProgress', target: 'pathSpread',    amount: 1,    min: 0.2,  max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.3, attack: 0.1,  release: 0.5,  invert: false },
            { id: 'ldx-r5', enabled: true, source: 'dropImpact',    target: 'masterDimmer',  amount: 1,    min: 0.65, max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.3,  invert: false },
          ],
        },
        {
          id: 'laser-fixture-right',
          name: 'Right Fan Laser',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.88, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.35, targetZ: 0, pan: 0, tilt: 0, rotation: 18, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 255, blue: 120, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0 },
          beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.75, radius: 0.45, complexity: 0.45, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'ldx-r6', enabled: true, source: 'kick',      target: 'fixtureDimmer', amount: 0.85, min: 0.35, max: 1, curve: 'pulse',  mode: 'trigger', smoothing: 0.1, attack: 0.02, release: 0.25, invert: false },
            { id: 'ldx-r7', enabled: true, source: 'beatPhase', target: 'pathProgress',  amount: 1,    min: 0,    max: 1, curve: 'linear', mode: 'set',     smoothing: 0,   attack: 0,    release: 0,    invert: true  },
          ],
        },
        {
          id: 'laser-fixture-center',
          name: 'Center Accent Laser',
          enabled: true,
          dmx: { universe: 1, startAddress: 33, profileId: 'genericRgbwLaser', channelMode: 'extended' },
          position: { originX: 0.5, originY: 0.82, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 80, green: 255, blue: 255, white: 80, alpha: 1, paletteId: '', colorCycleSpeed: 0 },
          beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'lissajous', scale: 0.65, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.35, phaseOffset: 0, pointCount: 96, spread: 0.5, radius: 0.35, complexity: 0.6, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'ldx-r8', enabled: true, source: 'vocalActivity', target: 'alpha',         amount: 0.8, min: 0.3, max: 1,    curve: 'easeOut', mode: 'set', smoothing: 0.4, attack: 0.1, release: 0.6, invert: false },
            { id: 'ldx-r9', enabled: true, source: 'energy',        target: 'pathComplexity', amount: 1,   min: 0.2, max: 0.95, curve: 'easeIn',  mode: 'set', smoothing: 0.2, attack: 0.1, release: 0.3, invert: false },
          ],
        },
      ],
    },
  },

  // ── LaserDMX (2) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-fan-sweep',
    name: 'Club Fan Sweep',
    description: 'Wide synchronized fan beams from both sides sweep in time with the beat.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.95, motion: 0.75, glow: 0.8, bassReactivity: 0.95, colorShift: 0.3, complexity: 0.5 },
    scenes: makeScenes('cfs', 'laserDmx'),
    sectionMappings: makeMappings('cfs'),
    laserDmxSettings: {
      masterDimmer: 0.9,
      hazeAmount: 0.6,
      beamPersistence: 0.3,
      glowAmount: 0.8,
      globalBeamWidth: 1.4,
      globalStrobeRate: 0,
      backgroundFade: 0.22,
      safetyClamp: 0.9,
      fixtures: [
        {
          id: 'cfs-left',
          name: 'Left Fan',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.08, originY: 0.92, originZ: 0, targetX: 0.5, targetY: 0.3, targetZ: 0, pan: 0, tilt: 0, rotation: -22, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 255, blue: 220, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 1, shutterOpen: true, width: 1.2, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'fan', scale: 1.1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.55, phaseOffset: 0, pointCount: 22, spread: 0.9, radius: 0.5, complexity: 0.4, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'cfs-l1', enabled: true, source: 'kick',      target: 'fixtureDimmer', amount: 0.9, min: 0.3, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0.08, attack: 0.02, release: 0.22, invert: false },
            { id: 'cfs-l2', enabled: true, source: 'beatPhase', target: 'pathProgress',  amount: 1,   min: 0,   max: 1,    curve: 'linear', mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: false },
            { id: 'cfs-l3', enabled: true, source: 'snare',     target: 'strobeRate',    amount: 0.7, min: 0,   max: 0.7,  curve: 'pulse',  mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.18, invert: false },
            { id: 'cfs-l4', enabled: true, source: 'dropImpact',target: 'masterDimmer',  amount: 1,   min: 0.7, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.3,  invert: false },
          ],
        },
        {
          id: 'cfs-right',
          name: 'Right Fan',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.92, originY: 0.92, originZ: 0, targetX: 0.5, targetY: 0.3, targetZ: 0, pan: 0, tilt: 0, rotation: 22, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 255, blue: 100, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 1, shutterOpen: true, width: 1.2, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'fan', scale: 1.1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.55, phaseOffset: 0.5, pointCount: 22, spread: 0.9, radius: 0.5, complexity: 0.4, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'cfs-r1', enabled: true, source: 'kick',      target: 'fixtureDimmer', amount: 0.9, min: 0.3, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0.08, attack: 0.02, release: 0.22, invert: false },
            { id: 'cfs-r2', enabled: true, source: 'beatPhase', target: 'pathProgress',  amount: 1,   min: 0,   max: 1,    curve: 'linear', mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: true  },
            { id: 'cfs-r3', enabled: true, source: 'dropImpact',target: 'masterDimmer',  amount: 1,   min: 0.7, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.3,  invert: false },
          ],
        },
        {
          id: 'cfs-center',
          name: 'Center Sweep',
          enabled: true,
          dmx: { universe: 1, startAddress: 33, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.5, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.4, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 80, green: 255, blue: 255, white: 0, alpha: 0.85, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.9, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'lineSweep', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.6, phaseOffset: 0.25, pointCount: 12, spread: 0.5, radius: 0.3, complexity: 0.3, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'cfs-c1', enabled: true, source: 'beat',        target: 'fixtureDimmer', amount: 0.8, min: 0.4, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0.1, attack: 0.02, release: 0.3,  invert: false },
            { id: 'cfs-c2', enabled: true, source: 'buildProgress',target: 'pathSpread',   amount: 1,   min: 0.2, max: 0.8,  curve: 'easeOut',mode: 'set',     smoothing: 0.3, attack: 0.1,  release: 0.5,  invert: false },
          ],
        },
      ],
    },
  },

  // ── LaserDMX (3) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-drop-cage',
    name: 'Drop Cage',
    description: 'Hard grid and tunnel beams that explode on drops and lock into phrase-driven rotation.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.9, motion: 0.6, glow: 0.5, bassReactivity: 1.0, colorShift: 0.2, complexity: 0.8 },
    scenes: makeScenes('dc', 'laserDmx'),
    sectionMappings: makeMappings('dc'),
    laserDmxSettings: {
      masterDimmer: 0.85,
      hazeAmount: 0.3,
      beamPersistence: 0.15,
      glowAmount: 0.5,
      globalBeamWidth: 1.6,
      globalStrobeRate: 0,
      backgroundFade: 0.3,
      safetyClamp: 0.9,
      fixtures: [
        {
          id: 'dc-left',
          name: 'Left Static',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'scannerLaser', channelMode: 'extended' },
          position: { originX: 0.15, originY: 0.9, originZ: 0, targetX: 0.35, targetY: 0.35, targetZ: 0, pan: -25, tilt: 0, rotation: -10, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 255, green: 255, blue: 255, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 1, shutterOpen: true, width: 1.8, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'staticBeam', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.2, phaseOffset: 0, pointCount: 2, spread: 0.1, radius: 0.5, complexity: 0.1, smoothing: 0, pathProgress: 1 },
          modulationRoutes: [
            { id: 'dc-l1', enabled: true, source: 'dropImpact', target: 'fixtureDimmer', amount: 1, min: 0.2, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.35, invert: false },
            { id: 'dc-l2', enabled: true, source: 'phrase16',   target: 'pan',           amount: 1, min: -1,  max: 1,    curve: 'linear', mode: 'set',     smoothing: 0.4, attack: 0.2,  release: 0.6,  invert: false },
            { id: 'dc-l3', enabled: true, source: 'downbeat',   target: 'white',         amount: 1, min: 0,   max: 200,  curve: 'pulse',  mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.1,  invert: false },
          ],
        },
        {
          id: 'dc-right',
          name: 'Right Static',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'scannerLaser', channelMode: 'extended' },
          position: { originX: 0.85, originY: 0.9, originZ: 0, targetX: 0.65, targetY: 0.35, targetZ: 0, pan: 25, tilt: 0, rotation: 10, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 255, green: 255, blue: 255, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 1, shutterOpen: true, width: 1.8, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'staticBeam', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.2, phaseOffset: 0.5, pointCount: 2, spread: 0.1, radius: 0.5, complexity: 0.1, smoothing: 0, pathProgress: 1 },
          modulationRoutes: [
            { id: 'dc-r1', enabled: true, source: 'dropImpact', target: 'fixtureDimmer', amount: 1, min: 0.2, max: 1,    curve: 'pulse',  mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.35, invert: false },
            { id: 'dc-r2', enabled: true, source: 'phrase16',   target: 'pan',           amount: 1, min: 1,   max: -1,   curve: 'linear', mode: 'set',     smoothing: 0.4, attack: 0.2,  release: 0.6,  invert: false },
            { id: 'dc-r3', enabled: true, source: 'downbeat',   target: 'white',         amount: 1, min: 0,   max: 200,  curve: 'pulse',  mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.1,  invert: false },
          ],
        },
        {
          id: 'dc-center',
          name: 'Center Grid',
          enabled: true,
          dmx: { universe: 1, startAddress: 33, profileId: 'multiPatternLaser', channelMode: 'extended' },
          position: { originX: 0.5, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.45, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 255, blue: 200, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 1, shutterOpen: true, width: 1.2, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'grid', scale: 0.8, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.25, phaseOffset: 0, pointCount: 48, spread: 0.7, radius: 0.4, complexity: 0.7, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'dc-c1', enabled: true, source: 'dropImpact',  target: 'masterDimmer',  amount: 1,   min: 0.6, max: 1,    curve: 'pulse',       mode: 'trigger', smoothing: 0,   attack: 0,    release: 0.4,  invert: false },
            { id: 'dc-c2', enabled: true, source: 'phrase16',    target: 'rotation',      amount: 1,   min: -45, max: 45,   curve: 'linear',      mode: 'set',     smoothing: 0.5, attack: 0.3,  release: 0.7,  invert: false },
            { id: 'dc-c3', enabled: true, source: 'beatPhase',   target: 'pathProgress',  amount: 1,   min: 0,   max: 1,    curve: 'linear',      mode: 'set',     smoothing: 0,   attack: 0,    release: 0,    invert: false },
            { id: 'dc-c4', enabled: true, source: 'energy',      target: 'pathComplexity',amount: 1,   min: 0.3, max: 1,    curve: 'easeIn',      mode: 'set',     smoothing: 0.2, attack: 0.1,  release: 0.3,  invert: false },
          ],
        },
      ],
    },
  },

  // ── LaserDMX (4) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-constellation',
    name: 'Breakdown Constellation',
    description: 'Ambient star-field laser scatter with vocal activity driving color and glow.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.5, motion: 0.3, glow: 0.9, bassReactivity: 0.4, colorShift: 0.7, complexity: 0.4 },
    scenes: makeScenes('bkc', 'laserDmx'),
    sectionMappings: makeMappings('bkc'),
    laserDmxSettings: {
      masterDimmer: 0.55,
      hazeAmount: 0.92,
      beamPersistence: 0.78,
      glowAmount: 0.95,
      globalBeamWidth: 0.8,
      globalStrobeRate: 0,
      backgroundFade: 0.08,
      safetyClamp: 0.7,
      fixtures: [
        {
          id: 'bkc-left',
          name: 'Left Stars',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.25, originY: 0.7, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 40, green: 120, blue: 255, white: 0, alpha: 0.7, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.65, shutterOpen: true, width: 0.7, zoom: 1, focus: 0.8, strobeRate: 0, flickerAmount: 0.15 },
          path: { kind: 'constellation', scale: 1, rotation: 0, offsetX: -0.15, offsetY: 0, scanSpeed: 0.12, phaseOffset: 0, pointCount: 24, spread: 0.65, radius: 0.55, complexity: 0.35, smoothing: 0.3, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bkc-l1', enabled: true, source: 'vocalActivity', target: 'alpha',         amount: 0.8,  min: 0.2, max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.5, attack: 0.15, release: 0.7,  invert: false },
            { id: 'bkc-l2', enabled: true, source: 'tension',       target: 'blue',          amount: 0.9,  min: 80,  max: 255,  curve: 'easeIn',  mode: 'set',     smoothing: 0.4, attack: 0.2,  release: 0.8,  invert: false },
            { id: 'bkc-l3', enabled: true, source: 'energy',        target: 'fixtureDimmer', amount: 0.6,  min: 0.3, max: 0.85, curve: 'easeOut', mode: 'set',     smoothing: 0.3, attack: 0.1,  release: 0.5,  invert: false },
          ],
        },
        {
          id: 'bkc-right',
          name: 'Right Stars',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.75, originY: 0.7, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 80, green: 60, blue: 255, white: 0, alpha: 0.7, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.65, shutterOpen: true, width: 0.7, zoom: 1, focus: 0.8, strobeRate: 0, flickerAmount: 0.15 },
          path: { kind: 'constellation', scale: 1, rotation: 0, offsetX: 0.15, offsetY: 0, scanSpeed: 0.12, phaseOffset: 0.4, pointCount: 24, spread: 0.65, radius: 0.55, complexity: 0.35, smoothing: 0.3, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bkc-r1', enabled: true, source: 'vocalActivity',     target: 'alpha',         amount: 0.8,  min: 0.2, max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.5, attack: 0.15, release: 0.7,  invert: false },
            { id: 'bkc-r2', enabled: true, source: 'harmonicConfidence',target: 'green',         amount: 0.8,  min: 20,  max: 180,  curve: 'easeOut', mode: 'set',     smoothing: 0.6, attack: 0.2,  release: 1.0,  invert: false },
            { id: 'bkc-r3', enabled: true, source: 'energy',            target: 'fixtureDimmer', amount: 0.6,  min: 0.3, max: 0.85, curve: 'easeOut', mode: 'set',     smoothing: 0.3, attack: 0.1,  release: 0.5,  invert: false },
          ],
        },
        {
          id: 'bkc-center',
          name: 'Center Drift',
          enabled: true,
          dmx: { universe: 1, startAddress: 33, profileId: 'genericRgbwLaser', channelMode: 'extended' },
          position: { originX: 0.5, originY: 0.6, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 120, green: 80, blue: 255, white: 20, alpha: 0.6, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.55, shutterOpen: true, width: 0.6, zoom: 1, focus: 0.7, strobeRate: 0, flickerAmount: 0.2 },
          path: { kind: 'constellation', scale: 1.2, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.08, phaseOffset: 0.7, pointCount: 32, spread: 0.8, radius: 0.65, complexity: 0.45, smoothing: 0.4, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bkc-c1', enabled: true, source: 'vocalActivity', target: 'alpha',    amount: 1,    min: 0.15, max: 0.9,  curve: 'easeOut', mode: 'set', smoothing: 0.6, attack: 0.2, release: 0.9, invert: false },
            { id: 'bkc-c2', enabled: true, source: 'sectionProgress',target: 'pathScale',amount: 1,   min: 0.6,  max: 1.4,  curve: 'linear',  mode: 'set', smoothing: 0.5, attack: 0.3, release: 0.8, invert: false },
          ],
        },
      ],
    },
  },

  // ── LaserDMX (5) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-build-tunnel',
    name: 'Build Tunnel',
    description: 'Tunnel beams expand and accelerate through buildups before dropping hard.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.8, motion: 0.85, glow: 0.6, bassReactivity: 0.85, colorShift: 0.5, complexity: 0.65 },
    scenes: makeScenes('bt', 'laserDmx'),
    sectionMappings: makeMappings('bt'),
    laserDmxSettings: {
      masterDimmer: 0.75,
      hazeAmount: 0.45,
      beamPersistence: 0.22,
      glowAmount: 0.65,
      globalBeamWidth: 1.2,
      globalStrobeRate: 0,
      backgroundFade: 0.25,
      safetyClamp: 0.88,
      fixtures: [
        {
          id: 'bt-left',
          name: 'Left Tunnel',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.28, originY: 0.85, originZ: 0, targetX: 0.5, targetY: 0.45, targetZ: 0, pan: -10, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 255, green: 140, blue: 0, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.8, shutterOpen: true, width: 1.1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'tunnel', scale: 0.9, rotation: 0, offsetX: -0.05, offsetY: 0, scanSpeed: 0.35, phaseOffset: 0, pointCount: 36, spread: 0.4, radius: 0.35, complexity: 0.5, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bt-l1', enabled: true, source: 'buildProgress', target: 'pathSpread',    amount: 1,   min: 0.15, max: 0.9,  curve: 'easeOut', mode: 'set',     smoothing: 0.35, attack: 0.15, release: 0.6,  invert: false },
            { id: 'bt-l2', enabled: true, source: 'buildProgress', target: 'scanSpeed',     amount: 1,   min: 0.2,  max: 0.9,  curve: 'easeIn',  mode: 'set',     smoothing: 0.3,  attack: 0.1,  release: 0.5,  invert: false },
            { id: 'bt-l3', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,   min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: false },
            { id: 'bt-l4', enabled: true, source: 'dropImpact',    target: 'fixtureDimmer', amount: 1,   min: 0.5,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.4,  invert: false },
          ],
        },
        {
          id: 'bt-center',
          name: 'Center Tunnel',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbwLaser', channelMode: 'extended' },
          position: { originX: 0.5, originY: 0.88, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 255, green: 200, blue: 0, white: 40, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.9, shutterOpen: true, width: 1.3, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'tunnel', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.4, phaseOffset: 0.33, pointCount: 48, spread: 0.5, radius: 0.45, complexity: 0.6, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bt-c1', enabled: true, source: 'buildProgress', target: 'masterDimmer',  amount: 1,   min: 0.4,  max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.4,  attack: 0.2,  release: 0.7,  invert: false },
            { id: 'bt-c2', enabled: true, source: 'buildProgress', target: 'pathRadius',    amount: 1,   min: 0.2,  max: 0.7,  curve: 'easeOut', mode: 'set',     smoothing: 0.3,  attack: 0.15, release: 0.5,  invert: false },
            { id: 'bt-c3', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,   min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: false },
            { id: 'bt-c4', enabled: true, source: 'dropImpact',    target: 'fixtureDimmer', amount: 1,   min: 0.8,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.35, invert: false },
          ],
        },
        {
          id: 'bt-right',
          name: 'Right Tunnel',
          enabled: true,
          dmx: { universe: 1, startAddress: 49, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.72, originY: 0.85, originZ: 0, targetX: 0.5, targetY: 0.45, targetZ: 0, pan: 10, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 255, green: 100, blue: 20, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.8, shutterOpen: true, width: 1.1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'tunnel', scale: 0.9, rotation: 0, offsetX: 0.05, offsetY: 0, scanSpeed: 0.35, phaseOffset: 0.67, pointCount: 36, spread: 0.4, radius: 0.35, complexity: 0.5, smoothing: 0, pathProgress: 0 },
          modulationRoutes: [
            { id: 'bt-r1', enabled: true, source: 'buildProgress', target: 'pathSpread',    amount: 1,   min: 0.15, max: 0.9,  curve: 'easeOut', mode: 'set',     smoothing: 0.35, attack: 0.15, release: 0.6,  invert: false },
            { id: 'bt-r2', enabled: true, source: 'buildProgress', target: 'scanSpeed',     amount: 1,   min: 0.2,  max: 0.9,  curve: 'easeIn',  mode: 'set',     smoothing: 0.3,  attack: 0.1,  release: 0.5,  invert: false },
            { id: 'bt-r3', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,   min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: true  },
            { id: 'bt-r4', enabled: true, source: 'dropImpact',    target: 'fixtureDimmer', amount: 1,   min: 0.5,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.4,  invert: false },
          ],
        },
      ],
    },
  },

  // ── LaserDMX (6) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-vocal-skywriter',
    name: 'Vocal Skywriter',
    description: 'Lissajous and spiral beams trace shapes in the air driven by vocal energy and beat phase.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.7, motion: 0.5, glow: 0.85, bassReactivity: 0.6, colorShift: 0.6, complexity: 0.75 },
    scenes: makeScenes('vs', 'laserDmx'),
    sectionMappings: makeMappings('vs'),
    laserDmxSettings: {
      masterDimmer: 0.7,
      hazeAmount: 0.75,
      beamPersistence: 0.62,
      glowAmount: 0.88,
      globalBeamWidth: 0.9,
      globalStrobeRate: 0,
      backgroundFade: 0.12,
      safetyClamp: 0.82,
      fixtures: [
        {
          id: 'vs-left',
          name: 'Left Spiral',
          enabled: true,
          dmx: { universe: 1, startAddress: 1, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.3, originY: 0.78, originZ: 0, targetX: 0.5, targetY: 0.45, targetZ: 0, pan: 0, tilt: 0, rotation: -5, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 220, blue: 255, white: 0, alpha: 0.85, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.8, shutterOpen: true, width: 0.9, zoom: 1, focus: 0.9, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'spiral', scale: 0.85, rotation: 0, offsetX: -0.1, offsetY: 0, scanSpeed: 0.3, phaseOffset: 0, pointCount: 64, spread: 0.45, radius: 0.38, complexity: 0.55, smoothing: 0.1, pathProgress: 0 },
          modulationRoutes: [
            { id: 'vs-l1', enabled: true, source: 'vocalActivity', target: 'alpha',         amount: 0.85, min: 0.25, max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.45, attack: 0.12, release: 0.65, invert: false },
            { id: 'vs-l2', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: false },
            { id: 'vs-l3', enabled: true, source: 'wordHit',       target: 'fixtureDimmer', amount: 1,    min: 0.3,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.25, invert: false },
            { id: 'vs-l4', enabled: true, source: 'energy',        target: 'pathComplexity',amount: 0.8,  min: 0.25, max: 0.9,  curve: 'easeOut', mode: 'set',     smoothing: 0.3,  attack: 0.1,  release: 0.4,  invert: false },
          ],
        },
        {
          id: 'vs-center',
          name: 'Center Lissajous',
          enabled: true,
          dmx: { universe: 1, startAddress: 17, profileId: 'genericRgbwLaser', channelMode: 'extended' },
          position: { originX: 0.5, originY: 0.8, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 220, green: 255, blue: 255, white: 60, alpha: 0.9, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.9, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'lissajous', scale: 0.75, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.28, phaseOffset: 0, pointCount: 128, spread: 0.55, radius: 0.42, complexity: 0.65, smoothing: 0.1, pathProgress: 0 },
          modulationRoutes: [
            { id: 'vs-c1', enabled: true, source: 'vocalActivity', target: 'alpha',          amount: 0.9,  min: 0.3,  max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.4,  attack: 0.1,  release: 0.7,  invert: false },
            { id: 'vs-c2', enabled: true, source: 'beatPhase',     target: 'pathProgress',   amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: false },
            { id: 'vs-c3', enabled: true, source: 'wordHit',       target: 'fixtureDimmer',  amount: 1,    min: 0.4,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.3,  invert: false },
            { id: 'vs-c4', enabled: true, source: 'energy',        target: 'pathComplexity', amount: 0.9,  min: 0.3,  max: 0.95, curve: 'easeIn',  mode: 'set',     smoothing: 0.25, attack: 0.1,  release: 0.35, invert: false },
          ],
        },
        {
          id: 'vs-right',
          name: 'Right Spiral',
          enabled: true,
          dmx: { universe: 1, startAddress: 33, profileId: 'genericRgbLaser', channelMode: 'basic' },
          position: { originX: 0.7, originY: 0.78, originZ: 0, targetX: 0.5, targetY: 0.45, targetZ: 0, pan: 0, tilt: 0, rotation: 5, mirrorX: false, mirrorY: false },
          color: { mode: 'fixed', red: 0, green: 180, blue: 255, white: 0, alpha: 0.85, paletteId: '', colorCycleSpeed: 0.5 },
          beam: { dimmer: 0.8, shutterOpen: true, width: 0.9, zoom: 1, focus: 0.9, strobeRate: 0, flickerAmount: 0 },
          path: { kind: 'spiral', scale: 0.85, rotation: 0, offsetX: 0.1, offsetY: 0, scanSpeed: 0.3, phaseOffset: 0.5, pointCount: 64, spread: 0.45, radius: 0.38, complexity: 0.55, smoothing: 0.1, pathProgress: 0 },
          modulationRoutes: [
            { id: 'vs-r1', enabled: true, source: 'vocalActivity', target: 'alpha',         amount: 0.85, min: 0.25, max: 1,    curve: 'easeOut', mode: 'set',     smoothing: 0.45, attack: 0.12, release: 0.65, invert: false },
            { id: 'vs-r2', enabled: true, source: 'beatPhase',     target: 'pathProgress',  amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',     smoothing: 0,    attack: 0,    release: 0,    invert: true  },
            { id: 'vs-r3', enabled: true, source: 'wordHit',       target: 'fixtureDimmer', amount: 1,    min: 0.3,  max: 1,    curve: 'pulse',   mode: 'trigger', smoothing: 0,    attack: 0,    release: 0.25, invert: false },
            { id: 'vs-r4', enabled: true, source: 'energy',        target: 'pathComplexity',amount: 0.8,  min: 0.25, max: 0.9,  curve: 'easeOut', mode: 'set',     smoothing: 0.3,  attack: 0.1,  release: 0.4,  invert: false },
          ],
        },
      ],
    },
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
  // Row 4 — Festival / enhanced oscillator
  { id: 'pad-13', presetId: 'preset-festival-burst',       label: 'Festival', color: DVYDRM_CRIMSON, keyBinding: 'z', transitionTimeMs: 200 },
  { id: 'pad-14', presetId: 'preset-drmvyz-text-trace',    label: 'DRMVYZ',   color: '#b84fc9',      keyBinding: 'x', transitionTimeMs: 400 },
  { id: 'pad-15', presetId: 'preset-star-drop-burst',      label: 'StarBurst',color: DVYDRM_GOLD,    keyBinding: 'c', transitionTimeMs: 250 },
  { id: 'pad-16', presetId: 'preset-glyph-circle-pulse',   label: 'Circle',   color: DVYDRM_CYAN,    keyBinding: 'v', transitionTimeMs: 400 },
]
