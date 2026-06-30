import { createCinematicWorldConfig, createLegacyPortalCinematicConfig } from './CinematicWorldConfig'
import type { CinematicWorldConfig } from './CinematicWorldConfig'

export type ReactEngineId = 'shaderPads' | 'cinematicPortal' | 'oscilloscope' | 'laserDmx' | 'neonLattice'

// ── Neon Lattice performance trigger types ────────────────────────────────────

export type NeonLatticeTriggerType =
  | 'railBurst'
  | 'blockCascade'
  | 'crossFlare'
  | 'whiteout'
  | 'blackout'
  | 'reseed'
  | 'freezeTrails'
  | 'cyanStrike'

/** Non-persisted trigger event dispatched from the performance pads or UI. */
export interface NeonLatticeTriggerEvent {
  type: NeonLatticeTriggerType
  /** Monotonic counter; renderer consumes each seq at most once. */
  seq:  number
}

// ── Neon Lattice types ────────────────────────────────────────────────────────

/** Beat subdivision to which pulses are snapped. */
export type NeonLatticeSnapDivision = 1 | 2 | 4 | 8 | 16

/** How the engine reacts to a drop/kick during blackout-driven moments. */
export type NeonLatticeBlackoutMode = 'none' | 'instant' | 'fadeOut' | 'strobe'

/** How rail trail brightness decays between frames. */
export type NeonLatticeDecayStyle = 'linear' | 'exponential' | 'hold' | 'pulse'

/** Audio event that triggers pulse emission and block spawning. */
export type NeonLatticeTrigger = 'none' | 'beat' | 'downbeat' | 'kick' | 'snare' | 'drop'

export interface NeonLatticeSettings {
  /** 0–1 — how many rails are active across the canvas. */
  railDensity:      number
  /** 0–1 — 0 = all horizontal rails, 1 = all vertical, 0.5 = balanced. */
  verticalBias:     number
  /** 0–1 — how strongly rails cluster toward the canvas center. */
  centerBias:       number
  /** Seconds a rail persists before fading out. */
  railLifetime:     number
  /** 0–1 — speed of energy pulses travelling along rails. */
  pulseSpeed:       number
  /** 0–1 — brightness burst magnitude when the trigger fires. */
  flareAmount:      number
  /** Musical subdivision that pulse emission snaps to. */
  snapDivision:     NeonLatticeSnapDivision
  /** 0–1 — how many neon block rectangles overlay the lattice. */
  blockDensity:     number
  /** Seconds each block lingers before fading. */
  blockHold:        number
  /** 0–1 — probability that a rail is drawn in the cyan accent color. */
  cyanAccentChance: number
  /** 0–1 — bloom / glow intensity around hot rails. */
  bloom:            number
  /** 0–1 — z-plane depth separation between near and far rails. */
  depth:            number
  /** 0–1 — camera parallax offset magnitude. */
  parallax:         number
  /** 0–1 — speed of autonomous camera drift between bars. */
  cameraMotion:     number
  /** 0 = disabled, 1 = maximum. Controls probability, strength, scale, and opacity of shockwaves. */
  shockwaveAmount:  number
  /** Bars between full lattice regeneration; 0 = never reseed. */
  reseedInterval:   number
  blackoutMode:     NeonLatticeBlackoutMode
  decayStyle:       NeonLatticeDecayStyle
  trigger:          NeonLatticeTrigger
  /** Enables all continuous and event-driven audio modulation for the engine. */
  audioReactive:    boolean
  /** 0–1 — bass contribution to rail brightness and bloom. */
  bassBrightnessResponse: number
  /** 0–1 — kick contribution to vertical rail impacts. */
  kickRailResponse: number
  /** 0–1 — snare contribution to horizontal rail impacts. */
  snareRailResponse: number
  /** 0–1 — beat contribution to travelling pulses and block accents. */
  beatPulseResponse: number
  /** 0–1 — continuous mid-band contribution to block density. */
  midBlockResponse: number
  /** 0–1 — continuous high-band contribution to intersection flares. */
  highFlareResponse: number
  /** 0–1 — track energy contribution to live rail density. */
  energyDensityResponse: number
  /** 0–1 — build progress contribution to pulse and camera motion. */
  buildMotionResponse: number
  /** 0–1 — drop impact contribution to shockwave strength. */
  dropImpactResponse: number
  /** 0–1 — amount of section-aware choreography applied by the renderer. */
  sectionDynamics: number
  /** 0–1 — response smoothing; 0 is immediate and 1 is deliberately fluid. */
  audioSmoothing: number
  /** 0–1 — ignores audio energy below this normalized threshold. */
  audioGate: number
}

export const DEFAULT_NEON_LATTICE_SETTINGS: NeonLatticeSettings = {
  railDensity:      0.45,
  verticalBias:     0.60,
  centerBias:       0.30,
  railLifetime:     4.0,
  pulseSpeed:       0.60,
  flareAmount:      0.55,
  snapDivision:     4,
  blockDensity:     0.20,
  blockHold:        0.50,
  cyanAccentChance: 0.35,
  bloom:            0.65,
  depth:            0.30,
  parallax:         0.15,
  cameraMotion:     0.10,
  shockwaveAmount:  0.65,
  reseedInterval:   16,
  blackoutMode:     'none',
  decayStyle:       'exponential',
  trigger:          'beat',
  audioReactive:    true,
  bassBrightnessResponse: 0.85,
  kickRailResponse:       0.85,
  snareRailResponse:      0.80,
  beatPulseResponse:      0.80,
  midBlockResponse:       0.25,
  highFlareResponse:      0.35,
  energyDensityResponse:  0.20,
  buildMotionResponse:    0.20,
  dropImpactResponse:     0.85,
  sectionDynamics:        0.85,
  audioSmoothing:         0.18,
  audioGate:              0.04,
}

// ── Oscillator path/glyph types ───────────────────────────────────────────────

export type OscillatorSourceType = 'classic' | 'builtinShape' | 'text' | 'svg' | 'svgGlyph' | 'svgVisual'

export type SvgRenderMode = 'auto' | 'reactivePath' | 'originalArtwork'

export type ClassicScopeMode = 'sectionAuto' | 'waveform' | 'lissajous' | 'radialScope' | 'spiralScope'

export type BuiltinOscillatorShape =
  | 'circle' | 'square' | 'triangle' | 'star'
  | 'hexagon' | 'infinity' | 'spiral' | 'line'

export type OscillatorRenderMode = 'outline' | 'multiTrace' | 'dots' | 'ribbon'

export type OscillatorAudioDisplaceMode = 'normal' | 'radial' | 'tangent' | 'xy'

export type OscillatorTextWaveformMode = 'off' | 'normal' | 'radial' | 'tangent' | 'xy'

export type SoundDrawingTextSource = 'static' | 'activeLyricLine' | 'activeLyricWord'
export type SoundDrawingLyricGapBehavior = 'hide' | 'keepPrevious' | 'fallback'

export type OscillatorTextLetterReactionMode =
  | 'uniform'
  | 'alternating'
  | 'frequencySplit'
  | 'ripple'
  | 'custom'

export type LetterReactionSource = 'bass' | 'mid' | 'high' | 'beat'
export type LetterReactionTarget = 'scale' | 'rotation' | 'offsetX' | 'offsetY' | 'jitter'

export interface LetterReactionAssignment {
  characterIndex: number
  source:         LetterReactionSource
  target:         LetterReactionTarget
  amount:         number
  invert:         boolean
  phaseOffset:    number
}

export interface OscillatorGlyphPoint {
  x: number
  y: number
  pathIndex: number
  progress: number
  normalX?: number
  normalY?: number
  /** 0-based index of the source character within the rendered string. */
  characterIndex?: number
  /** Glyph table index in the font file for the character that produced this point. */
  glyphIndex?: number
  /** Progress 0→1 within the resampled contour — distinct from the global `progress`. */
  localProgress?: number
  /** 0-based line index for multiline text; absent (treated as 0) for single-line text. */
  lineIndex?: number
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
  id:              string
  name:            string
  fileName:        string
  fontFamilyName?: string
  storagePath:     string
  mimeType:        string
  fileSize:        number
  createdAt:       string
  parseError?:     string | null
}

export interface OscillatorSettings {
  sourceType: OscillatorSourceType
  classicMode: ClassicScopeMode
  builtinShape: BuiltinOscillatorShape
  selectedGlyphId: string | null
  selectedSvgVisualId: string | null
  /** Unified SVG asset selection (media ID). Used when sourceType === 'svg'. */
  selectedSvgId: string | null
  /** How to render the selected SVG. 'auto' resolves based on SVG capability analysis. */
  svgRenderMode: SvgRenderMode
  /** When true, composites the SVG through the active palette colors. */
  svgUseReactPalette: boolean
  /** Whether the shape continuously auto-rotates. When false, shape is stationary. */
  autoRotate: boolean
  text: string
  /** Missing persisted values migrate to static, preserving legacy projects. */
  textSource: SoundDrawingTextSource
  lyricGapBehavior: SoundDrawingLyricGapBehavior
  lyricFallbackText: string
  textFontId: string | null
  textFontSize: number
  textLetterSpacing: number
  renderMode: OscillatorRenderMode
  pathResolution: number
  pathScale: number
  audioDisplacement: number
  audioDisplaceMode: OscillatorAudioDisplaceMode
  textWaveformMode:         OscillatorTextWaveformMode
  textWaveformAmount:       number
  textWaveformCycles:       number
  textWaveformScroll:       number
  /** Line-height multiplier for multiline text (newline-separated). Default 1.2. */
  textLineHeight:  number
  /** Horizontal alignment for multiline text. Default 'center'. */
  textAlignment:   'left' | 'center' | 'right'
  textLetterReactionMode:   OscillatorTextLetterReactionMode
  textLetterAssignments:    LetterReactionAssignment[]
  bassScale: number
  midTwist: number
  altTwist: boolean
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
  selectedSvgId:       null,
  svgRenderMode:       'auto',
  svgUseReactPalette:  true,
  autoRotate:          false,
  text:                'DRMVYZ',
  textSource:          'static',
  lyricGapBehavior:    'hide',
  lyricFallbackText:   '',
  textFontId:        null,
  textFontSize:      160,
  textLetterSpacing: 0,
  renderMode:        'outline',
  pathResolution:    512,
  pathScale:         0.78,
  audioDisplacement: 0.18,
  audioDisplaceMode: 'normal',
  textWaveformMode:         'off',
  textWaveformAmount:       0.10,
  textWaveformCycles:       5,
  textWaveformScroll:       0.20,
  textLineHeight:  1.2,
  textAlignment:   'center',
  textLetterReactionMode:   'uniform',
  textLetterAssignments:    [],
  bassScale:          0.25,
  midTwist:          0.15,
  altTwist:          false,
  highJitter:        0.08,
  beatBloom:         0.35,
  rotationSpeed:     0.08,
  duplicateTraces:   1,
  mirrorX:           false,
  mirrorY:           false,
  autoSectionMode:   true,
}

// ── Sound Drawing Layer / Clip types ─────────────────────────────────────────
//
// Layers are reusable content descriptors (what to draw).
// Clips place a layer onto a track timeline (when to draw it).
// Both are stored per track ID so Track A's data never affects Track B.

export type SoundDrawingLayerSourceType = 'text' | 'svg' | 'builtinShape'
export type SoundDrawingLayerAlignment  = 'left' | 'center' | 'right'

export interface SoundDrawingLayer {
  id:         string
  name:       string
  enabled:    boolean
  sourceType: SoundDrawingLayerSourceType

  // Text content
  text:          string
  /** Optional for persisted backward compatibility; missing means static. */
  textSource?:          SoundDrawingTextSource
  lyricGapBehavior?:    SoundDrawingLyricGapBehavior
  lyricFallbackText?:   string
  fontId:        string | null
  letterSpacing: number
  lineHeight:    number
  alignment:     SoundDrawingLayerAlignment

  // SVG / shape
  svgId: string | null
  shape: BuiltinOscillatorShape

  // Position and transform (normalized glyph space)
  x:        number          // −1 to 1
  y:        number          // −1 to 1
  scale:    number          // multiplier, 1 = no change
  rotation: number          // degrees
  width?:   number          // optional horizontal extent override

  // Layer-specific reactive behavior merged on top of global OscillatorSettings at render time
  oscillatorOverride: Partial<OscillatorSettings>
}

export interface SoundDrawingClip {
  id:       string
  trackId:  string
  layerId:  string
  startSec: number
  endSec:   number   // always > startSec
  enabled:  boolean
  zIndex:   number
  fadeInMs: number
  fadeOutMs: number
}

// ── LaserDMX types ────────────────────────────────────────────────────────────

export type LaserDmxProfileId =
  | 'genericRgbLaser'
  | 'genericRgbwLaser'
  | 'scannerLaser'
  | 'multiPatternLaser'

export type LaserDmxModulationTarget =
  // Spatial Fixtures targets
  | 'masterDimmer'
  | 'fixtureDimmer'
  | 'red' | 'green' | 'blue' | 'white' | 'alpha'
  | 'pan' | 'tilt' | 'rotation'
  | 'zoom' | 'beamWidth' | 'strobeRate'
  | 'scanSpeed' | 'pathProgress' | 'pathScale' | 'pathRotation' | 'pathSpread' | 'pathRadius' | 'pathComplexity'
  | 'hazeAmount' | 'glowAmount' | 'shutter'
  // Beam Matrix targets
  | 'dimmer'
  | 'beamDivergence'
  | 'beamGlow'
  | 'flickerAmount'
  | 'originOffsetX' | 'originOffsetY'
  | 'targetOffsetX' | 'targetOffsetY' | 'targetDepth'
  | 'fogDensity' | 'fogOpacity' | 'fogDriftSpeed' | 'fogDriftDirection'
  | 'fogTurbulence' | 'fogDiffusion' | 'fogDissipation' | 'fogBeamScatter'
  // Beam Matrix global-route targets (output-level controls)
  | 'backgroundFade' | 'beamPersistence'
  | 'globalBeamWidth' | 'globalGlow' | 'globalStrobeRate'
  // Beam Matrix beam-route targets
  | 'focus'

// ── Trigger route timing filter ───────────────────────────────────────────────
// Controls which musical positions are allowed to fire a trigger-mode route.
// All bar/beat numbers in this interface are 1-based (matching the UI).

export type LaserDmxTriggerTimingFilterMode =
  | 'everyOccurrence'  // default — no position filtering
  | 'specificPosition' // exact bar (+ optional beat)
  | 'specificBars'     // explicit list of bars
  | 'barRange'         // inclusive start..end
  | 'barInterval'      // every N bars from an anchor

export interface LaserDmxTriggerTimingFilter {
  mode: LaserDmxTriggerTimingFilterMode
  // specificPosition
  bar?:  number           // 1-based bar number
  beat?: number | 'any'  // 1-based beat number, or 'any' to match all beats
  // specificBars
  bars?: number[]         // 1-based bar numbers (stored sorted + deduped)
  // barRange
  startBar?: number       // 1-based, inclusive
  endBar?:   number       // 1-based, inclusive (omit = open-ended)
  // barInterval
  intervalBars?:       number  // fire every N bars
  intervalAnchorBar?:  number  // 1-based anchor (default 1); valid bars = anchor, anchor+N, ...
}

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
  /** Optional hold duration in seconds (default 0). Applied between attack and release. */
  hold?: number
  release: number
  invert: boolean
  /**
   * Optional activation threshold [0,1] for continuous (non-trigger) routes.
   * When source value ≤ threshold the output is clamped to 0.
   * Above threshold the value is rescaled: (source − threshold) / (1 − threshold).
   */
  threshold?: number
  /**
   * Optional musical-position filter for trigger-mode routes.
   * When absent or mode='everyOccurrence', the route fires on every event occurrence.
   * Only evaluated when route.mode === 'trigger'.
   */
  timingFilter?: LaserDmxTriggerTimingFilter
}

export interface LaserDmxBeamMatrixPresetSummary {
  beamCount:     number
  groupCount:    number
  lineBeamCount: number
  coneBeamCount: number
  usesFog:       boolean
  musicSources:  string[]
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

// ── Beam Matrix workspace ─────────────────────────────────────────────────────

export type LaserDmxWorkspaceMode = 'spatialFixtures' | 'beamMatrix'

export const LASER_DMX_MATRIX_COLUMNS = 15
export const LASER_DMX_MATRIX_ROWS    = 10
export const LASER_DMX_MATRIX_MAX_BEAMS = 300

export interface LaserDmxMatrixGridAnchor {
  column: number  // 1–15
  row:    number  // 1–10
  z:      number  // −1–1
}

export interface LaserDmxMatrixGridTarget {
  kind:   'grid'
  column: number  // 1–15
  row:    number  // 1–10
  z:      number  // −1–1
}

export interface LaserDmxMatrixStageTarget {
  kind: 'stage'
  x:    number   // −1–2 (outside 0–1 = offscreen)
  y:    number   // −1–2
  z:    number   // −1–2
}

export type LaserDmxMatrixTarget = LaserDmxMatrixGridTarget | LaserDmxMatrixStageTarget

export type LaserDmxMatrixBeamGeometry = 'line' | 'volumetricCone'

// ── Beam travel / sequencer types ─────────────────────────────────────────────

export type LaserDmxBeamTravelMode =
  | 'static'      // Full beam always visible — no travel animation
  | 'grow'        // Beam tip extends from origin toward target
  | 'projectile'  // Segment travels along path; tail trails behind
  | 'scanner'     // Short bright segment sweeps along path
  | 'pulseTrain'  // Multiple pulse segments traveling in unison
  | 'pingPong'    // Beam tip bounces back and forth (triangle wave)

export interface LaserDmxBeamMotion {
  mode:           LaserDmxBeamTravelMode
  beatsPerTravel: number   // 0.25–16 beats for a full path traversal
  phaseOffset:    number   // 0–1 phase shift (delays beat alignment per beam)
  direction:      'forward' | 'reverse' | 'alternate'
  tailLength:     number   // 0–1 fraction of path used as tail / pulse width
  headGlow:       number   // 0–1 extra brightness at beam head
  easing:         'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  retrigger:      'restart' | 'continue' | 'queue'
}

// ── Audio Launch settings ─────────────────────────────────────────────────────

/** MI event that causes a beam to launch. */
export type LaserDmxLaunchTrigger =
  | 'none'        // Sequencer or free-running only; no audio-triggered launch
  | 'beat'        // Any beat boundary
  | 'downbeat'    // Bar-1 boundary only
  | 'kick'        // Kick transient (sub-band onset)
  | 'snare'       // Snare transient (mid-band onset)
  | 'dropImpact'  // Drop energy burst (mi.energy.dropImpact)

export interface LaserDmxLaunchSettings {
  trigger:       LaserDmxLaunchTrigger
  /** 0–1 minimum trigger strength (kickStrength / snareStrength / dropImpact magnitude) */
  threshold:     number
  /** Minimum beats between successive launches (0 = no cooldown) */
  cooldownBeats: number
  /** 0–1 minimum mi.energy.instant value before a launch fires */
  minimumEnergy: number
}

export const DEFAULT_LAUNCH_SETTINGS: LaserDmxLaunchSettings = {
  trigger:       'none',
  threshold:     0.4,
  cooldownBeats: 0,
  minimumEnergy: 0,
}

export type LaserDmxSequenceMode =
  | 'all'          // All beams in group active simultaneously
  | 'forward'      // Step through beams in sequenceIndex order
  | 'reverse'      // Step through beams in reverse sequenceIndex order
  | 'alternate'    // Alternate between even/odd half-groups per step
  | 'centerOut'    // Step outward from center beam
  | 'outsideIn'    // Step inward from outer beams
  | 'randomSeeded' // Deterministic shuffle using seed
  | 'custom'       // Respects user-set sequenceIndex exactly

export interface LaserDmxBeamSequence {
  enabled:          boolean
  mode:             LaserDmxSequenceMode
  stepsPerBeat:     number   // 0.25–4 steps per beat
  stepGate:         number   // 0–1 fraction of step duration the beam is "on"
  /** Stagger offset per sequence position in BEATS.
   *  Beam at position i has its sequence clock shifted back by i * phaseSpread beats.
   *  0 = all beams in sync. 1 = each beam is 1 beat behind the previous. */
  phaseSpread:      number
  rotateEveryBars:  number   // 0 = no rotation; 1–32 bars between rotations
  resetOnDownbeat:  boolean  // If true, sequence resets to bar boundary each bar
  seed:             number   // Seed for randomSeeded mode
}

export const DEFAULT_BEAM_MOTION: LaserDmxBeamMotion = {
  mode:           'static',
  beatsPerTravel: 1,
  phaseOffset:    0,
  direction:      'forward',
  tailLength:     0.3,
  headGlow:       0.5,
  easing:         'linear',
  retrigger:      'restart',
}

export const DEFAULT_BEAM_SEQUENCE: LaserDmxBeamSequence = {
  enabled:         false,
  mode:            'forward',
  stepsPerBeat:    1,
  stepGate:        0.5,
  phaseSpread:     0,
  rotateEveryBars: 0,
  resetOnDownbeat: false,
  seed:            42,
}

export interface LaserDmxMatrixBeamColor {
  red:   number  // 0–255
  green: number
  blue:  number
  white: number
  alpha: number  // 0–1
}

export interface LaserDmxMatrixBeamAppearance {
  dimmer:        number  // 0–1
  shutterOpen:   boolean
  width:         number  // 0.1–8
  focus:         number  // 0–1
  strobeRate:    number  // 0–1
  flickerAmount: number  // 0–1
  divergence:    number  // 0–1
  glow:          number  // 0–1
  geometry:      LaserDmxMatrixBeamGeometry
}

export interface LaserDmxMatrixBeam {
  id:      string
  name:    string
  enabled: boolean
  sequenceIndex: number  // stable 0-based ordering used by the BPM sequencer

  origin: LaserDmxMatrixGridAnchor
  target: LaserDmxMatrixTarget

  groupId:       string | null
  useGroupColor: boolean

  color:      LaserDmxMatrixBeamColor
  appearance: LaserDmxMatrixBeamAppearance
  motion:     LaserDmxBeamMotion

  modulationRoutes: LaserDmxModulationRoute[]
}

export interface LaserDmxReactionGroup {
  id:      string
  name:    string
  enabled: boolean
  muted:   boolean
  soloed:  boolean

  colorOverrideEnabled: boolean
  color:                LaserDmxMatrixBeamColor

  sequence: LaserDmxBeamSequence

  /** Audio-triggered launch settings.  trigger='none' = no audio launch. */
  launch: LaserDmxLaunchSettings
  /** 0 = unlimited; >0 limits the number of simultaneously active beams in this group. */
  maxActiveBeams: number

  modulationRoutes: LaserDmxModulationRoute[]
}

export interface LaserDmxBeamMatrixOutputSettings {
  masterDimmer:     number  // 0–1
  blackout:         boolean
  safetyClamp:      number  // 0–1
  backgroundFade:   number  // 0–1
  beamPersistence:  number  // 0–1
  globalBeamWidth:  number  // 0.1–6
  globalGlow:       number  // 0–1
  globalStrobeRate: number  // 0–1
}

export interface LaserDmxFogSettings {
  enabled:        boolean
  density:        number  // 0–1
  opacity:        number  // 0–1
  noiseScale:     number  // 0.1–4
  driftSpeed:     number  // 0–1
  driftDirection: number  // 0–1 (maps to 0–360°)
  turbulence:     number  // 0–1
  diffusion:      number  // 0–1
  dissipation:    number  // 0–1
  beamScatter:    number  // 0–1
  colorAbsorption:number  // 0–1
  quality:        'low' | 'medium' | 'high'
}

export interface LaserDmxBeamMatrixEditorSettings {
  guidesVisible:     boolean
  snapEnabled:       boolean
  overscanAmount:    number  // 0–1
  beamEditorVisible: boolean
  beamPathsVisible:  boolean
}

// ── Beam Matrix cue scheduling ────────────────────────────────────────────────

/** 4/4 is the only currently supported meter.
 *  Centralized so musical-timing conversions have a single change point. */
export const BEATS_PER_BAR = 4

export type LaserDmxBeamCueTimingMode = 'musical' | 'absolute'
export type LaserDmxBeamCueAction     = 'gate'    | 'trigger'

/**
 * A persistent cue that gates or triggers a beam or reaction group at a
 * precise musical or absolute position within a track.
 *
 * Musical timing: 1-based bar/beat (bar 1 beat 1 = track start).
 *   Internally converted by BEATS_PER_BAR.  Beat 1 = first beat in bar.
 * Absolute timing: milliseconds from track start.
 *
 * Gate cue:
 *   target active while playhead is inside [start, end).
 *   Seeking into the range activates immediately; seeking out deactivates.
 *   No end = open-ended (active until track end or preset change).
 *   With ≥1 enabled gate cue: cueGate = 0 outside all active ranges.
 *   With no enabled gate cues: cueGate = 1 (backward-compatible default).
 *
 * Trigger cue:
 *   One-shot when playhead crosses start in forward playback.
 *   Does NOT fire on seek-forward.  Rearms when playhead moves back before start.
 *   Contributes a 0.5 s decay envelope to cueGate; OR'd with gate cues.
 *
 * Evaluation order (per compiled beam):
 *   beam.enabled → group active → group routes → beam routes →
 *   safety → strobe → flicker → cueGate × sequenceGate → finalIntensity.
 *   Blackout precedes beam iteration and always wins.
 */
export interface LaserDmxBeamMatrixCue {
  id:         string
  name:       string
  enabled:    boolean

  targetType: 'beam' | 'group'
  targetId:   string

  timingMode: LaserDmxBeamCueTimingMode
  action:     LaserDmxBeamCueAction

  // Musical timing — 1-based (bar 1 = first bar, beat 1 = first beat in bar)
  startBar?:  number
  startBeat?: number  // defaults to 1
  endBar?:    number  // gate only; undefined = open-ended
  endBeat?:   number  // defaults to 1

  // Absolute timing — milliseconds from track start
  startMs?:   number
  endMs?:     number  // gate only; undefined = open-ended
}

export interface LaserDmxBeamMatrixSettings {
  selectedBeamIds:  string[]
  selectedGroupId:  string | null

  beams:  LaserDmxMatrixBeam[]
  groups: LaserDmxReactionGroup[]

  globalModulationRoutes: LaserDmxModulationRoute[]
  output: LaserDmxBeamMatrixOutputSettings
  fog:    LaserDmxFogSettings
  editor: LaserDmxBeamMatrixEditorSettings

  /** Scheduled cues. Empty array = no cue restrictions (backward-compatible). */
  cues?: LaserDmxBeamMatrixCue[]
}

// ── Beam Matrix preset types ──────────────────────────────────────────────────

export type LaserDmxBeamMatrixPresetCategory =
  | 'minimal'
  | 'rhythmic'
  | 'multiReactive'
  | 'build'
  | 'drop'
  | 'atmospheric'

export interface LaserDmxBeamMatrixPreset {
  id:          string
  name:        string
  description: string
  category:    LaserDmxBeamMatrixPresetCategory
  tags:        string[]
  /** Returns a fully isolated settings object — no shared mutable state. */
  createSettings: () => LaserDmxBeamMatrixSettings
}

function makeReactionGroup(
  id: string, name: string,
  colorR: number, colorG: number, colorB: number,
  routes: LaserDmxModulationRoute[],
): LaserDmxReactionGroup {
  return {
    id, name, enabled: true, muted: false, soloed: false,
    colorOverrideEnabled: true,
    color: { red: colorR, green: colorG, blue: colorB, white: 0, alpha: 1 },
    sequence: DEFAULT_BEAM_SEQUENCE,
    launch:   DEFAULT_LAUNCH_SETTINGS,
    maxActiveBeams: 0,
    modulationRoutes: routes,
  }
}

export function createDefaultLaserDmxBeamMatrixSettings(): LaserDmxBeamMatrixSettings {
  const bassReact  = makeReactionGroup('grp-bass',   'Bass React',   255, 30,  30,  [
    { id: 'bm-r1', enabled: true,  source: 'nBass', target: 'dimmer',     amount: 1,   min: 0.15, max: 1,   curve: 'easeOut', mode: 'set',  smoothing: 0.35, attack: 0.01, release: 0.18, invert: false },
    { id: 'bm-r2', enabled: true,  source: 'nBass', target: 'beamWidth',  amount: 0.7, min: 0.5,  max: 2.5, curve: 'easeOut', mode: 'set',  smoothing: 0.3,  attack: 0.01, release: 0.2,  invert: false },
  ])
  const snareReact = makeReactionGroup('grp-snare',  'Snare React',  30,  80,  255, [
    { id: 'bm-r3', enabled: true,  source: 'snare', target: 'dimmer',     amount: 1,   min: 0,    max: 1,   curve: 'pulse',   mode: 'trigger', smoothing: 0, attack: 0.005, release: 0.22, invert: false },
  ])
  const beatReact  = makeReactionGroup('grp-beat',   'Beat React',   30,  220, 60,  [
    { id: 'bm-r4', enabled: true,  source: 'beat',      target: 'dimmer',      amount: 1,   min: 0,    max: 1,   curve: 'pulse',  mode: 'trigger', smoothing: 0,   attack: 0.005, release: 0.3,  invert: false },
    { id: 'bm-r5', enabled: true,  source: 'beatPhase', target: 'beamDivergence', amount: 0.3, min: 0.05, max: 0.4, curve: 'linear', mode: 'set',     smoothing: 0.2, attack: 0,     release: 0,    invert: false },
  ])
  const customReact = makeReactionGroup('grp-custom', 'Custom React', 160, 30,  220, [
    { id: 'bm-r6', enabled: false, source: 'bass', target: 'dimmer', amount: 1, min: 0, max: 1, curve: 'linear', mode: 'set', smoothing: 0, attack: 0, release: 0, invert: false },
  ])

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams:  [],
    groups: [bassReact, snareReact, beatReact, customReact],
    globalModulationRoutes: [],
    output: {
      masterDimmer:     0.85,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.18,
      beamPersistence:  0.6,
      globalBeamWidth:  1,
      globalGlow:       0.65,
      globalStrobeRate: 0,
    },
    fog: {
      enabled:         false,
      density:         0.4,
      opacity:         0.5,
      noiseScale:      1,
      driftSpeed:      0.15,
      driftDirection:  0.25,
      turbulence:      0.2,
      diffusion:       0.3,
      dissipation:     0.4,
      beamScatter:     0.2,
      colorAbsorption: 0.1,
      quality:         'medium',
    },
    editor: {
      guidesVisible:     true,
      snapEnabled:       true,
      overscanAmount:    0,
      beamEditorVisible: true,
      beamPathsVisible:  true,
    },
    cues: [],
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
}

/** Global renderer controls that are part of a preset's reproducible look. */
export interface ReactPresetRenderSettings {
  trailDecay: number
  fogDensity: number
  particleDensity: number
}

/** Numeric controls that can be interpolated by a performance-pad transition. */
export interface ReactPresetControlValues extends ReactPresetParams, ReactPresetRenderSettings {}

/** Transient visual tween created when a performance pad activates a preset. */
export interface ReactPerformancePadTransition {
  startedAtMs: number
  durationMs: number
  from: ReactPresetControlValues
  to: ReactPresetControlValues
}

export interface ReactScene {
  id: string
  sectionType: ReactSectionType
  engineId: ReactEngineId
  params: Partial<ReactPresetParams>
}

export interface ReactTrackSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  engineId?: ReactEngineId
  source?: 'manual' | 'auto' | 'mock' | 'user-edited-auto' | 'user-created'
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
  /** Omitted values resolve from DEFAULT_REACT_PRESET_RENDER_SETTINGS. */
  renderSettings?: Partial<ReactPresetRenderSettings>
  scenes: ReactScene[]
  sectionMappings: ReactSectionMapping[]
  /** When present, selecting this preset merges these values onto DEFAULT_OSCILLATOR_SETTINGS. */
  oscillatorSettings?: Partial<OscillatorSettings>
  /** When present, selecting this preset merges these values onto createDefaultLaserDmxSettings(). */
  laserDmxSettings?: Partial<LaserDmxSettings>
  /** When present, selecting this preset merges these values onto DEFAULT_NEON_LATTICE_SETTINGS. */
  neonLatticeSettings?: Partial<NeonLatticeSettings>
  /** Normalized Cinematic Worlds configuration. Present on cinematicPortal presets after migration. */
  cinematicConfig?: CinematicWorldConfig
}

// ── React preset automation cues ─────────────────────────────────────────────

/**
 * A cue that assigns a React preset at a specific track position.
 * `presetId` is the source of truth for which preset (and therefore which
 * Engine) becomes active.  No Engine ID is stored separately.
 */
export interface ReactPresetAutomationCue {
  id:           string
  timeSec:      number
  presetId:     string
  label:        string
  enabled:      boolean
  transitionMs: number
  sectionId?:   string
}

// ── DVYDRM palette constants ──────────────────────────────────────────────────

export const DVYDRM_CYAN   = '#4ac7db'
export const DVYDRM_EMERALD = '#61d6aa'
export const DVYDRM_BLACK  = '#060d10'
export const DVYDRM_WHITE  = '#e8f4f8'
export const DVYDRM_GOLD   = '#d8b95a'
export const DVYDRM_CRIMSON = '#c0314a'

/**
 * Deterministic defaults for global controls that were historically left live
 * across preset changes. Every preset now resolves a complete render-settings
 * snapshot from these values plus any preset-specific overrides.
 */
export const DEFAULT_REACT_PRESET_RENDER_SETTINGS: ReactPresetRenderSettings = {
  trailDecay:      0.08,
  fogDensity:      0.5,
  particleDensity: 0.5,
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

export const PALETTE_NEON_LATTICE: ReactPalette = {
  primary:    DVYDRM_CYAN,
  secondary:  '#b84fc9',
  accent:     DVYDRM_EMERALD,
  background: '#03070d',
  highlight:  '#80ffef',
  text:       DVYDRM_WHITE,
}

const PALETTE_ACID_MAGENTA: ReactPalette = {
  primary:    '#e040fb',
  secondary:  DVYDRM_WHITE,
  accent:     DVYDRM_GOLD,
  background: '#08010d',
  highlight:  DVYDRM_CYAN,
  text:       DVYDRM_WHITE,
}

const PALETTE_DRMVYZ_LATTICE: ReactPalette = {
  primary:    DVYDRM_CYAN,
  secondary:  DVYDRM_EMERALD,
  accent:     DVYDRM_GOLD,
  background: '#010812',
  highlight:  DVYDRM_WHITE,
  text:       DVYDRM_WHITE,
}

const PALETTE_SPARSE_STARLINES: ReactPalette = {
  primary:    '#c8e8ff',
  secondary:  DVYDRM_WHITE,
  accent:     DVYDRM_CYAN,
  background: '#010308',
  highlight:  '#ffffff',
  text:       DVYDRM_WHITE,
}

const PALETTE_OVERLOAD_MATRIX: ReactPalette = {
  primary:    '#ff3c6e',
  secondary:  DVYDRM_CYAN,
  accent:     DVYDRM_GOLD,
  background: '#050008',
  highlight:  '#ff80a0',
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
  // ── Cinematic Portal (5) ─────────────────────────────────────────────────
  {
    id: 'preset-dream-gate',
    name: 'Dream Gate',
    description: 'Soft blue-violet portal with gossamer fog and slow ember drift.',
    engine: 'cinematicPortal',
    palette: PALETTE_DREAM,
    params: { intensity: 0.6, motion: 0.5, glow: 0.75, bassReactivity: 0.7 },
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 0.6, motion: 0.5, glow: 0.75, bassReactivity: 0.7 }),
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
    params: { intensity: 0.85, motion: 0.75, glow: 0.9, bassReactivity: 0.95 },
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 0.85, motion: 0.75, glow: 0.9, bassReactivity: 0.95 }),
    scenes: makeScenes('cr', 'cinematicPortal'),
    sectionMappings: makeMappings('cr'),
  },
  {
    id: 'preset-emerald-fog',
    name: 'Emerald Fog',
    description: 'Dense green-teal mist with a slow-breathing portal monolith at center.',
    engine: 'cinematicPortal',
    palette: PALETTE_EMERALD_FOG,
    params: { intensity: 0.55, motion: 0.4, glow: 0.7, bassReactivity: 0.65 },
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 0.55, motion: 0.4, glow: 0.7, bassReactivity: 0.65 }),
    scenes: makeScenes('ef', 'cinematicPortal'),
    sectionMappings: makeMappings('ef'),
  },
  {
    id: 'preset-portal-overload',
    name: 'Portal Overload',
    description: 'Every parameter maxed — rings multiply rapidly and fog fills the frame.',
    engine: 'cinematicPortal',
    palette: PALETTE_OVERLOAD,
    params: { intensity: 1.0, motion: 1.0, glow: 1.0, bassReactivity: 1.0 },
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 1.0, motion: 1.0, glow: 1.0, bassReactivity: 1.0 }),
    scenes: makeScenes('po', 'cinematicPortal'),
    sectionMappings: makeMappings('po'),
  },
  {
    id: 'preset-quiet-ruins',
    name: 'Quiet Ruins',
    description: 'Muted, ambient atmosphere — barely visible fog and distant ember glow.',
    engine: 'cinematicPortal',
    palette: PALETTE_RUINS,
    params: { intensity: 0.3, motion: 0.25, glow: 0.4, bassReactivity: 0.45 },
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 0.3, motion: 0.25, glow: 0.4, bassReactivity: 0.45 }),
    scenes: makeScenes('qr', 'cinematicPortal'),
    sectionMappings: makeMappings('qr'),
  },

  // Cinematic Worlds: Event Horizon (3)
  {
    id: 'preset-singularity-crown',
    name: 'Singularity Crown',
    description: 'A compact black core wrapped in a tilted cyan-gold accretion crown with layered stars and controlled lensing.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_CYAN,
      secondary: '#6b4cff',
      accent: DVYDRM_GOLD,
      background: '#010208',
      highlight: '#e8fbff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.78, motion: 0.52, glow: 0.82, bassReactivity: 0.9 },
    cinematicConfig: createCinematicWorldConfig('eventHorizon', {
      coreRadius: 0.16,
      ringRadius: 0.33,
      ringThickness: 0.052,
      accretionTilt: 0.48,
      lensingStrength: 0.88,
      depthLayers: 5,
      rotationSpeed: 0.28,
      shockwaveStrength: 0.72,
      dropExpansion: 0.22,
      bloomBoost: 0.20,
      chromaticAberrationBoost: 0.06,
    }, {
      portalShape: 'circle',
      cameraRig: 'orbit',
      seed: 31001,
      environment: { depth: 0.9, stars: 0.72, fog: 0.16, debris: 0.12, atmosphere: 0.66 },
      material: { bloom: 0.76, chromaticAberration: 0.04, distortion: 0.22, glow: 0.88 },
    }),
    scenes: makeScenes('ehsc', 'cinematicPortal'),
    sectionMappings: makeMappings('ehsc'),
  },
  {
    id: 'preset-quasar-maw',
    name: 'Quasar Maw',
    description: 'A wide crimson singularity with a thick turbulent disk, violent bass pressure, and aggressive drop shockwaves.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#ff4f70',
      secondary: '#7a24ff',
      accent: '#ffb13b',
      background: '#050006',
      highlight: '#ffd5a8',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.96, motion: 0.86, glow: 1, bassReactivity: 1 },
    cinematicConfig: createCinematicWorldConfig('eventHorizon', {
      coreRadius: 0.23,
      ringRadius: 0.43,
      ringThickness: 0.12,
      accretionTilt: -0.62,
      lensingStrength: 1.24,
      depthLayers: 3,
      rotationSpeed: -0.72,
      shockwaveStrength: 1.28,
      dropExpansion: 0.46,
      bloomBoost: 0.34,
      chromaticAberrationBoost: 0.24,
    }, {
      portalShape: 'circle',
      cameraRig: 'autoDirector',
      seed: 31002,
      environment: { depth: 1, stars: 0.38, fog: 0.28, debris: 0.3, atmosphere: 0.92 },
      material: { bloom: 0.95, chromaticAberration: 0.14, distortion: 0.5, glow: 1 },
    }),
    scenes: makeScenes('ehqm', 'cinematicPortal'),
    sectionMappings: makeMappings('ehqm'),
  },
  {
    id: 'preset-binary-collapse',
    name: 'Binary Collapse',
    description: 'A smaller emerald core with a split-color disk, dense deep-star parallax, and restrained cinematic motion.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_EMERALD,
      secondary: '#9ec8ff',
      accent: '#f2f6ff',
      background: '#01070a',
      highlight: '#baffea',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.68, motion: 0.34, glow: 0.72, bassReactivity: 0.75 },
    cinematicConfig: createCinematicWorldConfig('eventHorizon', {
      coreRadius: 0.12,
      ringRadius: 0.29,
      ringThickness: 0.034,
      accretionTilt: 0.12,
      lensingStrength: 0.56,
      depthLayers: 7,
      rotationSpeed: 0.12,
      shockwaveStrength: 0.44,
      dropExpansion: 0.14,
      bloomBoost: 0.12,
      chromaticAberrationBoost: 0.02,
    }, {
      portalShape: 'circle',
      cameraRig: 'locked',
      seed: 31003,
      environment: { depth: 0.82, stars: 0.94, fog: 0.08, debris: 0.05, atmosphere: 0.48 },
      material: { bloom: 0.58, chromaticAberration: 0.01, distortion: 0.1, glow: 0.7 },
    }),
    scenes: makeScenes('ehbc', 'cinematicPortal'),
    sectionMappings: makeMappings('ehbc'),
  },

  // Cinematic Worlds: Infinite Corridor (3)
  {
    id: 'preset-cathedral-run',
    name: 'Cathedral Run',
    description: 'Tall repeating arches recede through blue fog while alternating gold ribs ignite on the beat.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_CYAN,
      secondary: '#234c8f',
      accent: DVYDRM_GOLD,
      background: '#01040a',
      highlight: '#dffaff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.74, motion: 0.58, glow: 0.72, bassReactivity: 0.68 },
    cinematicConfig: createCinematicWorldConfig('infiniteCorridor', {
      corridorDensity: 0.76,
      travelSpeed: 0.42,
      tunnelWidth: 0.86,
      archThickness: 0.052,
      alternatingLights: 0.92,
      fogDensity: 0.62,
      cameraSway: 0.08,
      vanishingOffset: 0,
      structureStyle: 0,
    }, {
      portalShape: 'arch',
      cameraRig: 'flyThrough',
      seed: 32001,
      environment: { depth: 1, architecture: 0.9, fog: 0.72, debris: 0.06, stars: 0.02, atmosphere: 0.78 },
      material: { bloom: 0.68, chromaticAberration: 0.02, feedback: 0, glow: 0.75 },
    }),
    scenes: makeScenes('iccr', 'cinematicPortal'),
    sectionMappings: makeMappings('iccr'),
  },
  {
    id: 'preset-neon-transit',
    name: 'Neon Transit',
    description: 'A fast pillar-lined transit tunnel with lateral camera sway, sharp alternating light lanes, and thin haze.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#ff42d0',
      secondary: DVYDRM_CYAN,
      accent: '#f6ff5a',
      background: '#030108',
      highlight: '#ffb9ee',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.9, motion: 0.98, glow: 0.84, bassReactivity: 0.82 },
    cinematicConfig: createCinematicWorldConfig('infiniteCorridor', {
      corridorDensity: 0.46,
      travelSpeed: 1.42,
      tunnelWidth: 0.58,
      archThickness: 0.026,
      alternatingLights: 1.36,
      fogDensity: 0.2,
      cameraSway: 0.42,
      vanishingOffset: -0.16,
      structureStyle: 1,
    }, {
      portalShape: 'rectangle',
      cameraRig: 'handheld',
      seed: 32002,
      environment: { depth: 0.88, architecture: 0.72, fog: 0.2, debris: 0.16, stars: 0, atmosphere: 0.64 },
      material: { bloom: 0.82, chromaticAberration: 0.16, distortion: 0.18, glow: 0.9 },
    }),
    scenes: makeScenes('icnt', 'cinematicPortal'),
    sectionMappings: makeMappings('icnt'),
  },
  {
    id: 'preset-obsidian-vault',
    name: 'Obsidian Vault',
    description: 'Broad octagonal vault segments drift forward slowly through heavy fog with sparse white-green guide lights.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#d7e5e8',
      secondary: '#244943',
      accent: DVYDRM_EMERALD,
      background: '#010303',
      highlight: '#efffff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.56, motion: 0.28, glow: 0.48, bassReactivity: 0.58 },
    cinematicConfig: createCinematicWorldConfig('infiniteCorridor', {
      corridorDensity: 0.92,
      travelSpeed: 0.18,
      tunnelWidth: 1.08,
      archThickness: 0.11,
      alternatingLights: 0.28,
      fogDensity: 0.9,
      cameraSway: 0.03,
      vanishingOffset: 0.12,
      structureStyle: 2,
    }, {
      portalShape: 'rectangle',
      cameraRig: 'dolly',
      seed: 32003,
      environment: { depth: 1, architecture: 1, fog: 0.94, debris: 0.02, stars: 0, atmosphere: 0.84 },
      material: { bloom: 0.44, chromaticAberration: 0, distortion: 0.03, glow: 0.48 },
    }),
    scenes: makeScenes('icov', 'cinematicPortal'),
    sectionMappings: makeMappings('icov'),
  },

  // Cinematic Worlds: Fracture Rift (3)
  {
    id: 'preset-glass-wound',
    name: 'Glass Wound',
    description: 'A narrow vertical tear with crisp crystalline edges, suspended glass shards, and a luminous grid world behind it.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#bfeeff',
      secondary: '#4776ff',
      accent: '#ffffff',
      background: '#02040b',
      highlight: '#e9fbff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.72, motion: 0.52, glow: 0.78, bassReactivity: 0.74 },
    cinematicConfig: createCinematicWorldConfig('fractureRift', {
      openingAmount: 0.42,
      edgeComplexity: 0.48,
      shardDensity: 0.76,
      crackPropagation: 0.58,
      fractureMotion: 0.44,
      innerDepth: 0.82,
      shardDrift: 0.28,
      openingShape: 0,
      innerSurface: 1,
    }, {
      portalShape: 'fracture',
      cameraRig: 'locked',
      seed: 33001,
      environment: { depth: 0.86, architecture: 0.08, fog: 0.18, debris: 0.84, stars: 0.12, atmosphere: 0.58 },
      material: { bloom: 0.74, chromaticAberration: 0.05, refraction: 0.42, distortion: 0.34, glow: 0.82 },
    }),
    scenes: makeScenes('frgw', 'cinematicPortal'),
    sectionMappings: makeMappings('frgw'),
  },
  {
    id: 'preset-wildspace-tear',
    name: 'Wildspace Tear',
    description: 'A diagonal organic rupture with turbulent red-gold interior weather, spreading cracks, and restless debris.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_CRIMSON,
      secondary: '#7b1cff',
      accent: DVYDRM_GOLD,
      background: '#060104',
      highlight: '#ffad73',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.94, motion: 0.92, glow: 0.92, bassReactivity: 0.98 },
    cinematicConfig: createCinematicWorldConfig('fractureRift', {
      openingAmount: 0.74,
      edgeComplexity: 1.28,
      shardDensity: 0.92,
      crackPropagation: 1.32,
      fractureMotion: 1.34,
      innerDepth: 1.18,
      shardDrift: 1.14,
      openingShape: 1,
      innerSurface: 2,
    }, {
      portalShape: 'organic',
      cameraRig: 'handheld',
      seed: 33002,
      environment: { depth: 1, architecture: 0.05, fog: 0.38, debris: 1, stars: 0.04, atmosphere: 0.96 },
      material: { bloom: 0.92, chromaticAberration: 0.24, feedback: 0.08, refraction: 0.72, distortion: 0.78, glow: 1 },
    }),
    scenes: makeScenes('frwt', 'cinematicPortal'),
    sectionMappings: makeMappings('frwt'),
  },
  {
    id: 'preset-prismatic-fault',
    name: 'Prismatic Fault',
    description: 'A radial polygonal fault opens onto a striped alternate surface while sparse colored shards orbit its rim.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#e45cff',
      secondary: DVYDRM_EMERALD,
      accent: DVYDRM_CYAN,
      background: '#030308',
      highlight: '#f6d7ff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.76, motion: 0.46, glow: 0.8, bassReactivity: 0.72 },
    cinematicConfig: createCinematicWorldConfig('fractureRift', {
      openingAmount: 0.62,
      edgeComplexity: 0.86,
      shardDensity: 0.42,
      crackPropagation: 0.82,
      fractureMotion: 0.62,
      innerDepth: 0.56,
      shardDrift: 0.52,
      openingShape: 2,
      innerSurface: 0,
    }, {
      portalShape: 'fracture',
      cameraRig: 'orbit',
      seed: 33003,
      environment: { depth: 0.72, architecture: 0, fog: 0.1, debris: 0.5, stars: 0.2, atmosphere: 0.7 },
      material: { bloom: 0.78, chromaticAberration: 0.32, feedback: 0.04, refraction: 0.5, distortion: 0.48, glow: 0.86 },
    }),
    scenes: makeScenes('frpf', 'cinematicPortal'),
    sectionMappings: makeMappings('frpf'),
  },

  // Cinematic Worlds: Monolith Gate (3)
  {
    id: 'preset-titan-seal',
    name: 'Titan Seal',
    description: 'A colossal locked slab gate with nine columns, concentric seals, dense glyphs, and gold downbeat ignition.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_GOLD,
      secondary: '#263744',
      accent: DVYDRM_CYAN,
      background: '#010305',
      highlight: '#fff0b5',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.82, motion: 0.34, glow: 0.78, bassReactivity: 0.8 },
    cinematicConfig: createCinematicWorldConfig('monolithGate', {
      gateScale: 0.92,
      columnCount: 9,
      slabDepth: 1.18,
      ringCount: 6,
      lightShaftIntensity: 0.54,
      glyphDensity: 0.88,
      openingAmount: 0.18,
      lockStrength: 0.94,
      cameraTravel: 0.08,
      architectureStyle: 0,
    }, {
      portalShape: 'arch',
      cameraRig: 'locked',
      seed: 34001,
      environment: { depth: 1, architecture: 1, fog: 0.48, debris: 0.08, stars: 0, atmosphere: 0.82 },
      material: { bloom: 0.72, chromaticAberration: 0.02, feedback: 0, glow: 0.82 },
    }),
    scenes: makeScenes('mgts', 'cinematicPortal'),
    sectionMappings: makeMappings('mgts'),
  },
  {
    id: 'preset-sunken-oracle',
    name: 'Sunken Oracle',
    description: 'Tapered emerald pillars frame a half-open drowned gate with heavy shafts, slow dolly motion, and sparse runes.',
    engine: 'cinematicPortal',
    palette: {
      primary: DVYDRM_EMERALD,
      secondary: '#173e55',
      accent: '#a8fff1',
      background: '#010708',
      highlight: '#c7fff2',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.64, motion: 0.26, glow: 0.68, bassReactivity: 0.62 },
    cinematicConfig: createCinematicWorldConfig('monolithGate', {
      gateScale: 0.78,
      columnCount: 4,
      slabDepth: 0.74,
      ringCount: 2,
      lightShaftIntensity: 1.26,
      glyphDensity: 0.34,
      openingAmount: 0.54,
      lockStrength: 0.36,
      cameraTravel: 0.42,
      architectureStyle: 1,
    }, {
      portalShape: 'arch',
      cameraRig: 'dolly',
      seed: 34002,
      environment: { depth: 0.94, architecture: 0.84, fog: 0.9, debris: 0.04, stars: 0, atmosphere: 0.9 },
      material: { bloom: 0.62, chromaticAberration: 0, feedback: 0, glow: 0.7 },
    }),
    scenes: makeScenes('mgso', 'cinematicPortal'),
    sectionMappings: makeMappings('mgso'),
  },
  {
    id: 'preset-ascension-array',
    name: 'Ascension Array',
    description: 'Angular white monoliths form a fully opening array with fast camera lift, bright magenta rings, and rhythmic glyph lanes.',
    engine: 'cinematicPortal',
    palette: {
      primary: '#eaf4ff',
      secondary: '#7d46ff',
      accent: '#ff4fd8',
      background: '#020208',
      highlight: '#ffffff',
      text: DVYDRM_WHITE,
    },
    params: { intensity: 0.94, motion: 0.78, glow: 0.96, bassReactivity: 0.9 },
    cinematicConfig: createCinematicWorldConfig('monolithGate', {
      gateScale: 0.68,
      columnCount: 6,
      slabDepth: 0.32,
      ringCount: 4,
      lightShaftIntensity: 1.08,
      glyphDensity: 0.72,
      openingAmount: 0.78,
      lockStrength: 0.12,
      cameraTravel: 0.68,
      architectureStyle: 2,
    }, {
      portalShape: 'triangle',
      cameraRig: 'autoDirector',
      seed: 34003,
      environment: { depth: 0.82, architecture: 0.76, fog: 0.28, debris: 0.12, stars: 0.04, atmosphere: 0.88 },
      material: { bloom: 0.98, chromaticAberration: 0.12, feedback: 0.02, glow: 1 },
    }),
    scenes: makeScenes('mgaa', 'cinematicPortal'),
    sectionMappings: makeMappings('mgaa'),
  },

  // Cinematic Worlds Pack B: Liquid Membrane (3)
  {
    id: 'preset-placid-veil',
    name: 'Placid Veil',
    description: 'A heavy translucent membrane that breathes slowly, holds its shape, and reveals a softly refracted world beneath the surface.',
    engine: 'cinematicPortal',
    palette: { primary: '#8de9ff', secondary: '#254e82', accent: '#d7fff8', background: '#01060a', highlight: '#ffffff', text: DVYDRM_WHITE },
    params: { intensity: 0.58, motion: 0.28, glow: 0.62, bassReactivity: 0.58 },
    renderSettings: { trailDecay: 0.04, fogDensity: 0.38, particleDensity: 0.18 },
    cinematicConfig: createCinematicWorldConfig('liquidMembrane', {
      membraneScale: 0.84, viscosity: 0.92, stretch: 0.28, rippleDensity: 3, rippleSpeed: 0.22,
      tearAmount: 0.12, refractionStrength: 0.72, surfaceDetail: 5, edgeSoftness: 0.14,
      openingBias: 0.34, midSurfaceMotion: 0.36,
    }, {
      portalShape: 'organic', cameraRig: 'locked', seed: 41001, qualityTier: 'high',
      environment: { depth: 0.56, architecture: 0.04, fog: 0.34, debris: 0.04, stars: 0.14, atmosphere: 0.52 },
      material: { distortion: 0.24, refraction: 0.74, bloom: 0.54, chromaticAberration: 0.01, feedback: 0.02, glow: 0.62 },
      audioMapping: { enabled: true, smoothingMs: 140, routes: [
        { id: 'pv-bass-stretch', enabled: true, source: 'bass', target: 'distortion', amount: 0.38, attackMs: 60, releaseMs: 340 },
        { id: 'pv-mid-sheen', enabled: true, source: 'mid', target: 'refraction', amount: 0.42, attackMs: 90, releaseMs: 420 },
      ] },
    }),
    scenes: makeScenes('lmpv', 'cinematicPortal'), sectionMappings: makeMappings('lmpv'),
  },
  {
    id: 'preset-bass-breach',
    name: 'Bass Breach',
    description: 'A taut dimensional skin stretches under low-end pressure, tears wide on drops, and snaps back through fast concentric ripples.',
    engine: 'cinematicPortal',
    palette: { primary: '#ff4d8a', secondary: '#6026c7', accent: '#ffcf5c', background: '#070109', highlight: '#ffd9ea', text: DVYDRM_WHITE },
    params: { intensity: 0.94, motion: 0.9, glow: 0.9, bassReactivity: 1 },
    renderSettings: { trailDecay: 0.1, fogDensity: 0.5, particleDensity: 0.42 },
    cinematicConfig: createCinematicWorldConfig('liquidMembrane', {
      membraneScale: 0.68, viscosity: 0.2, stretch: 1.28, rippleDensity: 10, rippleSpeed: 1.52,
      tearAmount: 0.94, refractionStrength: 0.46, surfaceDetail: 6, edgeSoftness: 0.034,
      openingBias: 0.76, midSurfaceMotion: 0.82,
    }, {
      portalShape: 'fracture', cameraRig: 'handheld', seed: 41002, qualityTier: 'high',
      environment: { depth: 0.88, architecture: 0.02, fog: 0.42, debris: 0.38, stars: 0.04, atmosphere: 0.9 },
      material: { distortion: 0.88, refraction: 0.46, bloom: 0.88, chromaticAberration: 0.18, feedback: 0.06, glow: 0.94 },
      audioMapping: { enabled: true, smoothingMs: 42, routes: [
        { id: 'bb-bass-breach', enabled: true, source: 'bass', target: 'portalPulse', amount: 1.35, attackMs: 8, releaseMs: 190 },
        { id: 'bb-kick-tear', enabled: true, source: 'kick', target: 'distortion', amount: 1.1, attackMs: 0, releaseMs: 150 },
      ] },
      transition: { mode: 'portalWipe', durationMs: 420, easing: 'easeOut', preserveCamera: false },
    }),
    scenes: makeScenes('lmbb', 'cinematicPortal'), sectionMappings: makeMappings('lmbb'),
  },
  {
    id: 'preset-prismatic-amnion',
    name: 'Prismatic Amnion',
    description: 'A floating iridescent membrane orbits gently while midrange detail crawls across its surface and bends the inner spectrum.',
    engine: 'cinematicPortal',
    palette: { primary: '#65ffd1', secondary: '#536dff', accent: '#f070ff', background: '#02030a', highlight: '#e7fffa', text: DVYDRM_WHITE },
    params: { intensity: 0.76, motion: 0.58, glow: 0.82, bassReactivity: 0.7 },
    renderSettings: { trailDecay: 0.07, fogDensity: 0.24, particleDensity: 0.28 },
    cinematicConfig: createCinematicWorldConfig('liquidMembrane', {
      membraneScale: 0.76, viscosity: 0.56, stretch: 0.62, rippleDensity: 7, rippleSpeed: 0.76,
      tearAmount: 0.34, refractionStrength: 1.32, surfaceDetail: 7, edgeSoftness: 0.072,
      openingBias: 0.58, midSurfaceMotion: 1.34,
    }, {
      portalShape: 'circle', cameraRig: 'orbit', seed: 41003, qualityTier: 'ultra',
      environment: { depth: 0.72, architecture: 0, fog: 0.16, debris: 0.12, stars: 0.32, atmosphere: 0.74 },
      material: { distortion: 0.46, refraction: 0.96, bloom: 0.76, chromaticAberration: 0.28, feedback: 0.04, glow: 0.84 },
      audioMapping: { enabled: true, smoothingMs: 76, routes: [
        { id: 'pa-mid-refraction', enabled: true, source: 'mid', target: 'refraction', amount: 0.92, attackMs: 55, releaseMs: 240 },
        { id: 'pa-high-spectrum', enabled: true, source: 'high', target: 'chromaticAberration', amount: 0.52, attackMs: 24, releaseMs: 180 },
      ] },
    }),
    scenes: makeScenes('lmpa', 'cinematicPortal'), sectionMappings: makeMappings('lmpa'),
  },

  // Cinematic Worlds Pack B: Celestial Cathedral (3)
  {
    id: 'preset-starlit-basilica',
    name: 'Starlit Basilica',
    description: 'A long procession of rounded cosmic arches advances through a star-filled nave with slow ceremonial light.',
    engine: 'cinematicPortal',
    palette: { primary: '#85d9ff', secondary: '#263a88', accent: '#f2ce78', background: '#01020a', highlight: '#e9f8ff', text: DVYDRM_WHITE },
    params: { intensity: 0.72, motion: 0.36, glow: 0.78, bassReactivity: 0.56 },
    renderSettings: { trailDecay: 0.03, fogDensity: 0.42, particleDensity: 0.58 },
    cinematicConfig: createCinematicWorldConfig('celestialCathedral', {
      cathedralScale: 0.9, archCount: 16, pillarCount: 9, ribDensity: 0.72, aisleDepth: 1.18,
      lightShaftIntensity: 0.7, starDensity: 0.92, majesticSpeed: 0.12, cameraDrift: 0.06,
      illuminationResponse: 0.58, architectureStyle: 0,
    }, {
      portalShape: 'arch', cameraRig: 'flyThrough', seed: 42001, qualityTier: 'ultra',
      environment: { depth: 1, architecture: 0.94, fog: 0.48, debris: 0.02, stars: 0.96, atmosphere: 0.84 },
      material: { distortion: 0.03, refraction: 0.02, bloom: 0.74, chromaticAberration: 0.01, feedback: 0, glow: 0.78 },
      audioMapping: { enabled: true, smoothingMs: 160, routes: [
        { id: 'sb-mid-arches', enabled: true, source: 'mid', target: 'glow', amount: 0.58, attackMs: 120, releaseMs: 520 },
        { id: 'sb-volume-shafts', enabled: true, source: 'volume', target: 'atmosphere', amount: 0.36, attackMs: 160, releaseMs: 620 },
      ] },
    }),
    scenes: makeScenes('ccsb', 'cinematicPortal'), sectionMappings: makeMappings('ccsb'),
  },
  {
    id: 'preset-solar-nave',
    name: 'Solar Nave',
    description: 'Massive sparse pillars frame a blazing central aisle where broad shafts ignite from midrange chords and downbeats.',
    engine: 'cinematicPortal',
    palette: { primary: '#fff0b0', secondary: '#8a3d18', accent: '#ffffff', background: '#080401', highlight: '#fff8d9', text: DVYDRM_WHITE },
    params: { intensity: 0.9, motion: 0.32, glow: 0.98, bassReactivity: 0.7 },
    renderSettings: { trailDecay: 0.025, fogDensity: 0.72, particleDensity: 0.22 },
    cinematicConfig: createCinematicWorldConfig('celestialCathedral', {
      cathedralScale: 1.18, archCount: 6, pillarCount: 5, ribDensity: 0.24, aisleDepth: 0.74,
      lightShaftIntensity: 1.46, starDensity: 0.24, majesticSpeed: 0.08, cameraDrift: 0.03,
      illuminationResponse: 1.42, architectureStyle: 2,
    }, {
      portalShape: 'rectangle', cameraRig: 'dolly', seed: 42002, qualityTier: 'high',
      environment: { depth: 0.9, architecture: 1, fog: 0.82, debris: 0.04, stars: 0.2, atmosphere: 1 },
      material: { distortion: 0.02, refraction: 0.03, bloom: 1, chromaticAberration: 0.02, feedback: 0, glow: 1 },
      audioMapping: { enabled: true, smoothingMs: 88, routes: [
        { id: 'sn-mid-shafts', enabled: true, source: 'mid', target: 'bloom', amount: 1.05, attackMs: 60, releaseMs: 360 },
        { id: 'sn-beat-pillars', enabled: true, source: 'beat', target: 'glow', amount: 0.78, attackMs: 0, releaseMs: 240 },
      ] },
    }),
    scenes: makeScenes('ccsn', 'cinematicPortal'), sectionMappings: makeMappings('ccsn'),
  },
  {
    id: 'preset-void-choir',
    name: 'Void Choir',
    description: 'Pointed black ribs hover in a cavernous starless sanctuary, moving almost imperceptibly until the architecture answers the music.',
    engine: 'cinematicPortal',
    palette: { primary: '#c8d4e8', secondary: '#20283d', accent: '#7566ff', background: '#000104', highlight: '#e8edff', text: DVYDRM_WHITE },
    params: { intensity: 0.5, motion: 0.16, glow: 0.48, bassReactivity: 0.44 },
    renderSettings: { trailDecay: 0.02, fogDensity: 0.62, particleDensity: 0.04 },
    cinematicConfig: createCinematicWorldConfig('celestialCathedral', {
      cathedralScale: 1.28, archCount: 8, pillarCount: 13, ribDensity: 1.34, aisleDepth: 1.42,
      lightShaftIntensity: 0.26, starDensity: 0.04, majesticSpeed: 0.035, cameraDrift: 0.015,
      illuminationResponse: 0.94, architectureStyle: 1,
    }, {
      portalShape: 'triangle', cameraRig: 'locked', seed: 42003, qualityTier: 'high',
      environment: { depth: 1, architecture: 1, fog: 0.72, debris: 0, stars: 0.03, atmosphere: 0.62 },
      material: { distortion: 0.01, refraction: 0, bloom: 0.44, chromaticAberration: 0, feedback: 0, glow: 0.5 },
      audioMapping: { enabled: true, smoothingMs: 210, routes: [
        { id: 'vc-mid-ribs', enabled: true, source: 'mid', target: 'glow', amount: 0.88, attackMs: 180, releaseMs: 720 },
        { id: 'vc-section-depth', enabled: true, source: 'sectionEnergy', target: 'depth', amount: 0.52, attackMs: 300, releaseMs: 900 },
      ] },
    }),
    scenes: makeScenes('ccvc', 'cinematicPortal'), sectionMappings: makeMappings('ccvc'),
  },

  // Cinematic Worlds Pack B: Mirror Dimension (3)
  {
    id: 'preset-sixfold-chamber',
    name: 'Sixfold Chamber',
    description: 'A readable six-way mirrored room folds inward through five chambers and locks its facets into place on beats.',
    engine: 'cinematicPortal',
    palette: { primary: '#6ee8ff', secondary: '#3e4eaa', accent: '#ffffff', background: '#010208', highlight: '#dffbff', text: DVYDRM_WHITE },
    params: { intensity: 0.72, motion: 0.46, glow: 0.76, bassReactivity: 0.62 },
    renderSettings: { trailDecay: 0.1, fogDensity: 0.18, particleDensity: 0.08 },
    cinematicConfig: createCinematicWorldConfig('mirrorDimension', {
      symmetryCount: 6, recursionDepth: 5, chamberDepth: 0.76, mirrorScale: 0.88, feedbackAmount: 0.2,
      feedbackDrift: 0.12, snapStrength: 0.82, foldStrength: 0.74, rotationSpeed: 0.11, structureStyle: 0,
    }, {
      portalShape: 'circle', cameraRig: 'locked', seed: 43001, qualityTier: 'high',
      environment: { depth: 0.86, architecture: 0.74, fog: 0.12, debris: 0, stars: 0.05, atmosphere: 0.56 },
      material: { distortion: 0.18, refraction: 0.08, bloom: 0.68, chromaticAberration: 0.04, feedback: 0.18, glow: 0.78 },
      audioMapping: { enabled: true, smoothingMs: 72, routes: [
        { id: 'sc-beat-snap', enabled: true, source: 'beat', target: 'portalPulse', amount: 0.92, attackMs: 0, releaseMs: 180 },
        { id: 'sc-high-facets', enabled: true, source: 'high', target: 'glow', amount: 0.48, attackMs: 35, releaseMs: 210 },
      ] },
    }),
    scenes: makeScenes('mdsc', 'cinematicPortal'), sectionMappings: makeMappings('mdsc'),
  },
  {
    id: 'preset-crystal-mandala',
    name: 'Crystal Mandala',
    description: 'A twelvefold crystal mechanism rotates through dense recursion, snapping into sharp radial mandalas without losing the center.',
    engine: 'cinematicPortal',
    palette: { primary: '#f26bff', secondary: '#3e9cff', accent: '#72ffd8', background: '#020106', highlight: '#ffe8ff', text: DVYDRM_WHITE },
    params: { intensity: 0.9, motion: 0.76, glow: 0.9, bassReactivity: 0.82 },
    renderSettings: { trailDecay: 0.15, fogDensity: 0.12, particleDensity: 0.14 },
    cinematicConfig: createCinematicWorldConfig('mirrorDimension', {
      symmetryCount: 12, recursionDepth: 8, chamberDepth: 0.54, mirrorScale: 1.08, feedbackAmount: 0.4,
      feedbackDrift: 0.38, snapStrength: 1.36, foldStrength: 1.42, rotationSpeed: -0.34, structureStyle: 1,
    }, {
      portalShape: 'organic', cameraRig: 'orbit', seed: 43002, qualityTier: 'ultra',
      environment: { depth: 0.72, architecture: 0.9, fog: 0.06, debris: 0.06, stars: 0.08, atmosphere: 0.78 },
      material: { distortion: 0.42, refraction: 0.22, bloom: 0.86, chromaticAberration: 0.2, feedback: 0.36, glow: 0.92 },
      audioMapping: { enabled: true, smoothingMs: 38, routes: [
        { id: 'cm-beat-fold', enabled: true, source: 'beat', target: 'distortion', amount: 1.12, attackMs: 0, releaseMs: 150 },
        { id: 'cm-high-prism', enabled: true, source: 'high', target: 'chromaticAberration', amount: 0.72, attackMs: 18, releaseMs: 150 },
      ] },
    }),
    scenes: makeScenes('mdcm', 'cinematicPortal'), sectionMappings: makeMappings('mdcm'),
  },
  {
    id: 'preset-infinite-gallery',
    name: 'Infinite Gallery',
    description: 'Four mirrored corridors recede like an endless gallery, drifting forward slowly with restrained feedback and architectural depth.',
    engine: 'cinematicPortal',
    palette: { primary: '#e5edf5', secondary: '#375b64', accent: '#8df5d2', background: '#010303', highlight: '#ffffff', text: DVYDRM_WHITE },
    params: { intensity: 0.62, motion: 0.28, glow: 0.58, bassReactivity: 0.54 },
    renderSettings: { trailDecay: 0.08, fogDensity: 0.46, particleDensity: 0.03 },
    cinematicConfig: createCinematicWorldConfig('mirrorDimension', {
      symmetryCount: 4, recursionDepth: 7, chamberDepth: 1.36, mirrorScale: 0.72, feedbackAmount: 0.24,
      feedbackDrift: 0.06, snapStrength: 0.38, foldStrength: 0.5, rotationSpeed: 0.035, structureStyle: 2,
    }, {
      portalShape: 'rectangle', cameraRig: 'autoDirector', seed: 43003, qualityTier: 'high',
      environment: { depth: 1, architecture: 1, fog: 0.52, debris: 0, stars: 0, atmosphere: 0.48 },
      material: { distortion: 0.08, refraction: 0.04, bloom: 0.5, chromaticAberration: 0.01, feedback: 0.22, glow: 0.6 },
      audioMapping: { enabled: true, smoothingMs: 128, routes: [
        { id: 'ig-volume-depth', enabled: true, source: 'volume', target: 'depth', amount: 0.42, attackMs: 120, releaseMs: 520 },
        { id: 'ig-beat-lock', enabled: true, source: 'beat', target: 'portalPulse', amount: 0.46, attackMs: 0, releaseMs: 260 },
      ] },
    }),
    scenes: makeScenes('mdig', 'cinematicPortal'), sectionMappings: makeMappings('mdig'),
  },

  // Cinematic Worlds Pack B: Ancient Machine (3)
  {
    id: 'preset-oracle-lock',
    name: 'Oracle Lock',
    description: 'Glyph-covered concentric seals advance one bar at a time while a nearly closed oracle aperture waits for the drop.',
    engine: 'cinematicPortal',
    palette: { primary: '#d5b66d', secondary: '#33454b', accent: '#66e2d4', background: '#020403', highlight: '#fff0b5', text: DVYDRM_WHITE },
    params: { intensity: 0.74, motion: 0.38, glow: 0.72, bassReactivity: 0.72 },
    renderSettings: { trailDecay: 0.025, fogDensity: 0.36, particleDensity: 0.12 },
    cinematicConfig: createCinematicWorldConfig('ancientMachine', {
      gateRadius: 0.66, ringCount: 8, gearCount: 5, glyphDensity: 0.96, rotationSpeed: 0.16,
      lockProgress: 0.94, unlockResponse: 1.1, radialComplexity: 0.86, mechanicalDepth: 1.08,
      progressionMode: 0, toothDensity: 0.48,
    }, {
      portalShape: 'circle', cameraRig: 'locked', seed: 44001, qualityTier: 'high',
      environment: { depth: 0.86, architecture: 0.7, fog: 0.4, debris: 0.08, stars: 0, atmosphere: 0.68 },
      material: { distortion: 0.05, refraction: 0, bloom: 0.66, chromaticAberration: 0.01, feedback: 0, glow: 0.74 },
      audioMapping: { enabled: true, smoothingMs: 92, routes: [
        { id: 'ol-beat-rings', enabled: true, source: 'beat', target: 'portalPulse', amount: 0.8, attackMs: 0, releaseMs: 210 },
        { id: 'ol-high-glyphs', enabled: true, source: 'high', target: 'glow', amount: 0.68, attackMs: 30, releaseMs: 240 },
      ] },
    }),
    scenes: makeScenes('amol', 'cinematicPortal'), sectionMappings: makeMappings('amol'),
  },
  {
    id: 'preset-gear-sun',
    name: 'Gear Sun',
    description: 'A dense crown of fast interlocking gears drives a bright radial aperture, progressing on every beat with aggressive unlock motion.',
    engine: 'cinematicPortal',
    palette: { primary: '#ff8d3b', secondary: '#8f1f20', accent: '#ffe37c', background: '#070201', highlight: '#fff4c4', text: DVYDRM_WHITE },
    params: { intensity: 0.96, motion: 0.92, glow: 0.98, bassReactivity: 1 },
    renderSettings: { trailDecay: 0.08, fogDensity: 0.28, particleDensity: 0.3 },
    cinematicConfig: createCinematicWorldConfig('ancientMachine', {
      gateRadius: 0.54, ringCount: 5, gearCount: 14, glyphDensity: 0.38, rotationSpeed: 1.16,
      lockProgress: 0.38, unlockResponse: 1.46, radialComplexity: 1, mechanicalDepth: 0.62,
      progressionMode: 1, toothDensity: 1,
    }, {
      portalShape: 'circle', cameraRig: 'orbit', seed: 44002, qualityTier: 'ultra',
      environment: { depth: 0.72, architecture: 0.82, fog: 0.22, debris: 0.26, stars: 0, atmosphere: 0.92 },
      material: { distortion: 0.32, refraction: 0.04, bloom: 0.96, chromaticAberration: 0.12, feedback: 0.03, glow: 1 },
      audioMapping: { enabled: true, smoothingMs: 28, routes: [
        { id: 'gs-kick-drive', enabled: true, source: 'kick', target: 'portalPulse', amount: 1.4, attackMs: 0, releaseMs: 125 },
        { id: 'gs-bass-unlock', enabled: true, source: 'bass', target: 'glow', amount: 1.05, attackMs: 18, releaseMs: 180 },
      ] },
    }),
    scenes: makeScenes('amgs', 'cinematicPortal'), sectionMappings: makeMappings('amgs'),
  },
  {
    id: 'preset-epoch-engine',
    name: 'Epoch Engine',
    description: 'Deep layered mechanisms turn at geological speed, unlocking across the song section instead of chasing each individual beat.',
    engine: 'cinematicPortal',
    palette: { primary: '#9da9b5', secondary: '#26363b', accent: '#7a8dff', background: '#010203', highlight: '#e9f1ff', text: DVYDRM_WHITE },
    params: { intensity: 0.62, motion: 0.22, glow: 0.56, bassReactivity: 0.5 },
    renderSettings: { trailDecay: 0.02, fogDensity: 0.68, particleDensity: 0.06 },
    cinematicConfig: createCinematicWorldConfig('ancientMachine', {
      gateRadius: 0.82, ringCount: 6, gearCount: 9, glyphDensity: 0.62, rotationSpeed: -0.09,
      lockProgress: 0.76, unlockResponse: 0.72, radialComplexity: 0.52, mechanicalDepth: 1.44,
      progressionMode: 2, toothDensity: 0.66,
    }, {
      portalShape: 'arch', cameraRig: 'dolly', seed: 44003, qualityTier: 'high',
      environment: { depth: 1, architecture: 0.92, fog: 0.74, debris: 0.04, stars: 0, atmosphere: 0.66 },
      material: { distortion: 0.04, refraction: 0.02, bloom: 0.5, chromaticAberration: 0, feedback: 0, glow: 0.58 },
      audioMapping: { enabled: true, smoothingMs: 180, routes: [
        { id: 'ee-section-unlock', enabled: true, source: 'sectionEnergy', target: 'portalPulse', amount: 0.9, attackMs: 260, releaseMs: 840 },
        { id: 'ee-volume-depth', enabled: true, source: 'volume', target: 'depth', amount: 0.34, attackMs: 180, releaseMs: 680 },
      ] },
    }),
    scenes: makeScenes('amee', 'cinematicPortal'), sectionMappings: makeMappings('amee'),
  },

  // Cinematic Worlds Pack B: Storm Gateway (3)
  {
    id: 'preset-tempest-eye',
    name: 'Tempest Eye',
    description: 'Dense layered storm clouds spiral around a deep open eye while debris and branching lightning whip through the foreground.',
    engine: 'cinematicPortal',
    palette: { primary: '#6aaeff', secondary: '#27395c', accent: '#d8f2ff', background: '#010309', highlight: '#ffffff', text: DVYDRM_WHITE },
    params: { intensity: 0.92, motion: 0.86, glow: 0.84, bassReactivity: 0.92 },
    renderSettings: { trailDecay: 0.06, fogDensity: 0.9, particleDensity: 0.82 },
    cinematicConfig: createCinematicWorldConfig('stormGateway', {
      stormIntensity: 1.34, cloudDensity: 0.94, cloudLayers: 8, vortexStrength: 1.3, windSpeed: 0.9,
      debrisDensity: 0.86, lightningFrequency: 0.62, lightningBranching: 0.9, gatewayRadius: 0.48,
      atmosphericDepth: 1.36, turbulence: 1.24, lightningResponse: 1.12,
    }, {
      portalShape: 'circle', cameraRig: 'autoDirector', seed: 45001, qualityTier: 'ultra',
      environment: { depth: 1, architecture: 0, fog: 1, debris: 0.92, stars: 0, atmosphere: 1 },
      material: { distortion: 0.52, refraction: 0.14, bloom: 0.82, chromaticAberration: 0.08, feedback: 0.04, glow: 0.86 },
      audioMapping: { enabled: true, smoothingMs: 42, routes: [
        { id: 'te-transient-lightning', enabled: true, source: 'snare', target: 'bloom', amount: 1.18, attackMs: 0, releaseMs: 135 },
        { id: 'te-bass-vortex', enabled: true, source: 'bass', target: 'distortion', amount: 0.84, attackMs: 24, releaseMs: 210 },
      ] },
    }),
    scenes: makeScenes('sgte', 'cinematicPortal'), sectionMappings: makeMappings('sgte'),
  },
  {
    id: 'preset-electric-front',
    name: 'Electric Front',
    description: 'A fast-moving thin cloud front leaves the portal exposed while frequent transient-driven bolts become the main performance gesture.',
    engine: 'cinematicPortal',
    palette: { primary: '#b9e8ff', secondary: '#5f33a8', accent: '#ffffff', background: '#02020a', highlight: '#ffffff', text: DVYDRM_WHITE },
    params: { intensity: 0.88, motion: 0.96, glow: 1, bassReactivity: 0.68 },
    renderSettings: { trailDecay: 0.035, fogDensity: 0.42, particleDensity: 0.26 },
    cinematicConfig: createCinematicWorldConfig('stormGateway', {
      stormIntensity: 0.88, cloudDensity: 0.52, cloudLayers: 3, vortexStrength: 0.42, windSpeed: 1.82,
      debrisDensity: 0.22, lightningFrequency: 0.96, lightningBranching: 1, gatewayRadius: 0.58,
      atmosphericDepth: 0.46, turbulence: 0.92, lightningResponse: 1.5,
    }, {
      portalShape: 'fracture', cameraRig: 'handheld', seed: 45002, qualityTier: 'high',
      environment: { depth: 0.72, architecture: 0, fog: 0.46, debris: 0.28, stars: 0, atmosphere: 0.82 },
      material: { distortion: 0.3, refraction: 0.06, bloom: 1, chromaticAberration: 0.2, feedback: 0.02, glow: 1 },
      audioMapping: { enabled: true, smoothingMs: 18, routes: [
        { id: 'ef-snare-flash', enabled: true, source: 'snare', target: 'bloom', amount: 1.6, attackMs: 0, releaseMs: 100 },
        { id: 'ef-high-aberration', enabled: true, source: 'high', target: 'chromaticAberration', amount: 0.62, attackMs: 14, releaseMs: 120 },
      ] },
    }),
    scenes: makeScenes('sgef', 'cinematicPortal'), sectionMappings: makeMappings('sgef'),
  },
  {
    id: 'preset-ashen-cyclone',
    name: 'Ashen Cyclone',
    description: 'A slow black ash vortex carries heavy debris through deep fog, favoring wind and depth over frequent lightning spectacle.',
    engine: 'cinematicPortal',
    palette: { primary: '#aeb9bb', secondary: '#3a3b40', accent: '#cc784d', background: '#020202', highlight: '#e9e4df', text: DVYDRM_WHITE },
    params: { intensity: 0.7, motion: 0.48, glow: 0.5, bassReactivity: 0.76 },
    renderSettings: { trailDecay: 0.08, fogDensity: 1, particleDensity: 1 },
    cinematicConfig: createCinematicWorldConfig('stormGateway', {
      stormIntensity: 1.06, cloudDensity: 0.86, cloudLayers: 6, vortexStrength: 1.48, windSpeed: 0.34,
      debrisDensity: 1, lightningFrequency: 0.12, lightningBranching: 0.34, gatewayRadius: 0.36,
      atmosphericDepth: 1.5, turbulence: 0.68, lightningResponse: 0.48,
    }, {
      portalShape: 'organic', cameraRig: 'orbit', seed: 45003, qualityTier: 'high',
      environment: { depth: 1, architecture: 0.02, fog: 1, debris: 1, stars: 0, atmosphere: 0.94 },
      material: { distortion: 0.44, refraction: 0.04, bloom: 0.42, chromaticAberration: 0.02, feedback: 0.08, glow: 0.52 },
      audioMapping: { enabled: true, smoothingMs: 110, routes: [
        { id: 'ac-bass-pressure', enabled: true, source: 'bass', target: 'fog', amount: 0.86, attackMs: 70, releaseMs: 420 },
        { id: 'ac-volume-debris', enabled: true, source: 'volume', target: 'debris', amount: 0.64, attackMs: 120, releaseMs: 560 },
      ] },
    }),
    scenes: makeScenes('sgac', 'cinematicPortal'), sectionMappings: makeMappings('sgac'),
  },

  // Cinematic Worlds: Reactive Constellation (3)
  {
    id: 'preset-crystal-synapse',
    name: 'Crystal Synapse',
    description: 'A clustered cyan-violet neural field of mixed faceted crystals with bright connected hubs.',
    engine: 'cinematicPortal',
    palette: { primary: '#4ac7db', secondary: '#7857ff', accent: '#d8f7ff', background: '#01050d', highlight: '#61d6aa', text: DVYDRM_WHITE },
    params: { intensity: 0.72, motion: 0.56, glow: 0.78, bassReactivity: 0.68 },
    renderSettings: { trailDecay: 0.05, fogDensity: 0.24, particleDensity: 0.36 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      nodeCount: 48, topologyStyle: 'cluster', polyhedronStyle: 'mixed', networkSpread: 1.28,
      depthSpread: 0.78, neighborCount: 4, nodeScale: 0.115, nodeScaleVariation: 0.54,
      faceOpacity: 0.82, rimIntensity: 1.12, wireframeAmount: 0.34, nodeSpin: 0.42,
      beamWidth: 2.2, beamCoreBrightness: 2.8, beamGlow: 1.25, edgeOpacity: 0.8, trailSamples: 14, trailDecay: 0.8, trailSpacing: 0.03, beamFanAmount: 1.05,
      centralGravity: 0.18, cameraOrbit: 0.16, springStrength: 0.82, damping: 0.58, driftAmount: 0.28, turbulence: 0.2, orbitAmount: 0.22, elasticity: 0.68, topologyStability: 0.76, collapseAmount: 0.05, burstStrength: 0.58, reseedEveryBars: 0,
    }, {
      cameraRig: 'autoDirector', seed: 48001, qualityTier: 'high',
      environment: { depth: 0.78, architecture: 0.12, fog: 0.18, debris: 0.08, stars: 0.46, atmosphere: 0.5 },
      material: { distortion: 0.03, refraction: 0.04, bloom: 0.72, chromaticAberration: 0.025, feedback: 0, glow: 0.82 },
    }),
    scenes: makeScenes('rcs1', 'cinematicPortal'), sectionMappings: makeMappings('rcs1'),
  },
  {
    id: 'preset-helix-reliquary',
    name: 'Helix Reliquary',
    description: 'A slow emerald-gold crystal helix with irregular relic nodes suspended through deep space.',
    engine: 'cinematicPortal',
    palette: { primary: '#61d6aa', secondary: '#1b6f79', accent: '#d8b95a', background: '#020906', highlight: '#b7ffe4', text: DVYDRM_WHITE },
    params: { intensity: 0.62, motion: 0.38, glow: 0.66, bassReactivity: 0.58 },
    renderSettings: { trailDecay: 0.04, fogDensity: 0.34, particleDensity: 0.28 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      nodeCount: 38, topologyStyle: 'chain', polyhedronStyle: 'irregularCrystal', networkSpread: 1.02,
      depthSpread: 1.05, neighborCount: 2, nodeScale: 0.14, nodeScaleVariation: 0.72,
      faceOpacity: 0.7, rimIntensity: 0.96, wireframeAmount: 0.16, nodeSpin: -0.22,
      beamWidth: 1.8, beamCoreBrightness: 2.2, beamGlow: 0.9, edgeOpacity: 0.68, trailSamples: 10, trailDecay: 0.74, trailSpacing: 0.045, beamFanAmount: 0.85,
      centralGravity: 0.06, cameraOrbit: -0.12, springStrength: 0.56, damping: 0.72, driftAmount: 0.36, turbulence: 0.08, orbitAmount: -0.16, elasticity: 0.42, topologyStability: 0.84, collapseAmount: 0.02, burstStrength: 0.3, reseedEveryBars: 16,
    }, {
      cameraRig: 'orbit', seed: 48002, qualityTier: 'high',
      environment: { depth: 0.92, architecture: 0.08, fog: 0.3, debris: 0.02, stars: 0.34, atmosphere: 0.62 },
      material: { distortion: 0.02, refraction: 0.06, bloom: 0.58, chromaticAberration: 0.012, feedback: 0, glow: 0.68 },
    }),
    scenes: makeScenes('rcs2', 'cinematicPortal'), sectionMappings: makeMappings('rcs2'),
  },
  {
    id: 'preset-polyhedral-supernova',
    name: 'Polyhedral Supernova',
    description: 'A dense radial bloom of sharp icosahedra with hot crimson edges and aggressive orbital motion.',
    engine: 'cinematicPortal',
    palette: { primary: '#ff5c78', secondary: '#b84fc9', accent: '#ffd36a', background: '#090108', highlight: '#fff0c2', text: DVYDRM_WHITE },
    params: { intensity: 0.92, motion: 0.86, glow: 0.94, bassReactivity: 0.9 },
    renderSettings: { trailDecay: 0.08, fogDensity: 0.18, particleDensity: 0.5 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      nodeCount: 72, topologyStyle: 'starburst', polyhedronStyle: 'icosahedron', networkSpread: 1.62,
      depthSpread: 1.18, neighborCount: 6, nodeScale: 0.09, nodeScaleVariation: 0.36,
      faceOpacity: 0.9, rimIntensity: 1.48, wireframeAmount: 0.62, nodeSpin: 0.92,
      beamWidth: 3, beamCoreBrightness: 3.8, beamGlow: 1.6, edgeOpacity: 0.92, trailSamples: 18, trailDecay: 0.84, trailSpacing: 0.022, beamFanAmount: 1.35,
      centralGravity: 0.3, cameraOrbit: 0.54, springStrength: 1.08, damping: 0.42, driftAmount: 0.18, turbulence: 0.46, orbitAmount: 0.72, elasticity: 0.86, topologyStability: 0.54, collapseAmount: 0.14, burstStrength: 1.08, reseedEveryBars: 8,
    }, {
      cameraRig: 'autoDirector', seed: 48003, qualityTier: 'high',
      environment: { depth: 0.86, architecture: 0.04, fog: 0.14, debris: 0.1, stars: 0.72, atmosphere: 0.42 },
      material: { distortion: 0.06, refraction: 0.03, bloom: 0.92, chromaticAberration: 0.085, feedback: 0, glow: 1 },
    }),
    scenes: makeScenes('rcs3', 'cinematicPortal'), sectionMappings: makeMappings('rcs3'),
  },

  // Cinematic Worlds: Media Portal (6)
  {
    id: 'preset-clean-broadcast-gate', name: 'Clean Broadcast Gate', description: 'Media Portal treatment with a distinct rectangle frame and contain media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.55, motion: 0.30, glow: 0.55, bassReactivity: 0.55 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'contain', zoom: 1.00, panX: 0, panY: 0, rotation: 0.0, mirrorX: false, mirrorY: false, loop: true, muted: true, displacement: 0.02, scanlines: 0.02, edgeGlow: 0.12, ripple: 0.06, pixelation: 0, revealAmount: 1, beatFlash: 0.18, bassWarping: 0.08, maskMode: 'alpha' }, { portalShape: 'rectangle', cameraRig: 'locked', seed: 47001, material: { distortion: 0.02, refraction: 0.04, bloom: 0.45, chromaticAberration: 0.020, feedback: 0.00, glow: 0.10 } }),
    scenes: makeScenes('mp1', 'cinematicPortal'), sectionMappings: makeMappings('mp1'),
  },
  {
    id: 'preset-reactive-logo-chamber', name: 'Reactive Logo Chamber', description: 'Media Portal treatment with a distinct circle frame and contain media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.62, motion: 0.38, glow: 0.61, bassReactivity: 0.62 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'contain', zoom: 1.04, panX: 0, panY: 0, rotation: 0.0, mirrorX: false, mirrorY: false, loop: true, muted: true, displacement: 0.12, scanlines: 0.06, edgeGlow: 0.65, ripple: 0.14, pixelation: 0, revealAmount: 1, beatFlash: 0.30, bassWarping: 0.36, maskMode: 'alpha' }, { portalShape: 'circle', cameraRig: 'locked', seed: 47002, material: { distortion: 0.12, refraction: 0.08, bloom: 0.53, chromaticAberration: 0.055, feedback: 0.00, glow: 0.54 } }),
    scenes: makeScenes('mp2', 'cinematicPortal'), sectionMappings: makeMappings('mp2'),
  },
  {
    id: 'preset-fractured-video-rift', name: 'Fractured Video Rift', description: 'Media Portal treatment with a distinct fracture frame and cover media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.69, motion: 0.46, glow: 0.67, bassReactivity: 0.69 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'cover', zoom: 1.08, panX: 0, panY: 0, rotation: 0.0, mirrorX: false, mirrorY: false, loop: true, muted: true, displacement: 0.34, scanlines: 0.16, edgeGlow: 0.9, ripple: 0.22, pixelation: 0.12, revealAmount: 0.88, beatFlash: 0.42, bassWarping: 0.58, maskMode: 'alpha' }, { portalShape: 'fracture', cameraRig: 'autoDirector', seed: 47003, material: { distortion: 0.34, refraction: 0.12, bloom: 0.61, chromaticAberration: 0.090, feedback: 0.08, glow: 0.75 } }),
    scenes: makeScenes('mp3', 'cinematicPortal'), sectionMappings: makeMappings('mp3'),
  },
  {
    id: 'preset-liquid-memory', name: 'Liquid Memory', description: 'Media Portal treatment with a distinct organic frame and cover media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.76, motion: 0.54, glow: 0.73, bassReactivity: 0.76 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'cover', zoom: 1.12, panX: 0, panY: 0, rotation: 0.0, mirrorX: false, mirrorY: false, loop: true, muted: true, displacement: 0.28, scanlines: 0.04, edgeGlow: 0.72, ripple: 0.30, pixelation: 0, revealAmount: 0.78, beatFlash: 0.54, bassWarping: 0.74, maskMode: 'alpha' }, { portalShape: 'organic', cameraRig: 'autoDirector', seed: 47004, material: { distortion: 0.28, refraction: 0.16, bloom: 0.69, chromaticAberration: 0.125, feedback: 0.10, glow: 0.60 } }),
    scenes: makeScenes('mp4', 'cinematicPortal'), sectionMappings: makeMappings('mp4'),
  },
  {
    id: 'preset-mirror-screen', name: 'Mirror Screen', description: 'Media Portal treatment with a distinct triangle frame and stretch media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.83, motion: 0.62, glow: 0.79, bassReactivity: 0.83 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'stretch', zoom: 1.16, panX: 0, panY: 0, rotation: 0.08, mirrorX: true, mirrorY: false, loop: true, muted: true, displacement: 0.08, scanlines: 0.1, edgeGlow: 0.5, ripple: 0.38, pixelation: 0.08, revealAmount: 1, beatFlash: 0.66, bassWarping: 0.24, maskMode: 'alpha' }, { portalShape: 'triangle', cameraRig: 'autoDirector', seed: 47005, material: { distortion: 0.08, refraction: 0.20, bloom: 0.77, chromaticAberration: 0.160, feedback: 0.12, glow: 0.42 } }),
    scenes: makeScenes('mp5', 'cinematicPortal'), sectionMappings: makeMappings('mp5'),
  },
  {
    id: 'preset-storm-transmission', name: 'Storm Transmission', description: 'Media Portal treatment with a distinct arch frame and centerCrop media composition.',
    engine: 'cinematicPortal', palette: { primary: DVYDRM_CYAN, secondary: '#6b4cff', accent: DVYDRM_GOLD, background: '#010309', highlight: DVYDRM_WHITE, text: DVYDRM_WHITE },
    params: { intensity: 0.90, motion: 0.70, glow: 0.85, bassReactivity: 0.90 },
    cinematicConfig: createCinematicWorldConfig('mediaPortal', { sourceMediaId: null, sourceLabel: 'Relink media', fit: 'centerCrop', zoom: 1.20, panX: 0, panY: 0, rotation: 0.08, mirrorX: false, mirrorY: false, loop: true, muted: true, displacement: 0.42, scanlines: 0.34, edgeGlow: 1.1, ripple: 0.46, pixelation: 0.22, revealAmount: 0.72, beatFlash: 0.78, bassWarping: 0.92, maskMode: 'alpha' }, { portalShape: 'arch', cameraRig: 'autoDirector', seed: 47006, material: { distortion: 0.42, refraction: 0.24, bloom: 0.85, chromaticAberration: 0.195, feedback: 0.14, glow: 0.92 } }),
    scenes: makeScenes('mp6', 'cinematicPortal'), sectionMappings: makeMappings('mp6'),
  },

  // ── Sound Drawing (5) ────────────────────────────────────────────────────
  {
    id: 'preset-xy-cyan-scope',
    name: 'XY Cyan Scope',
    description: 'Classic cyan lissajous figures that morph with frequency content.',
    engine: 'oscilloscope',
    palette: PALETTE_OSCILLOSCOPE,
    params: { intensity: 0.65, motion: 0.7, glow: 0.7, bassReactivity: 0.6 },
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
    params: { intensity: 0.7, motion: 0.65, glow: 0.6, bassReactivity: 0.55 },
    scenes: makeScenes('lf', 'oscilloscope'),
    sectionMappings: makeMappings('lf'),
  },
  {
    id: 'preset-spiral-signal',
    name: 'Spiral Signal',
    description: 'Golden frequency-mapped spiral that expands and contracts with audio energy.',
    engine: 'oscilloscope',
    palette: PALETTE_SPIRAL,
    params: { intensity: 0.6, motion: 0.75, glow: 0.65, bassReactivity: 0.7 },
    scenes: makeScenes('spi', 'oscilloscope'),
    sectionMappings: makeMappings('spi'),
  },
  {
    id: 'preset-radial-voice',
    name: 'Radial Voice',
    description: 'Pure white radial oscilloscope that rings like a sound membrane.',
    engine: 'oscilloscope',
    palette: PALETTE_RADIAL,
    params: { intensity: 0.7, motion: 0.6, glow: 0.8, bassReactivity: 0.65 },
    scenes: makeScenes('rv', 'oscilloscope'),
    sectionMappings: makeMappings('rv'),
  },
  {
    id: 'preset-neon-text-trace',
    name: 'Neon Text Trace',
    description: 'Purple-cyan waveform trace with high glow — text-style oscilloscope aesthetics.',
    engine: 'oscilloscope',
    palette: PALETTE_NEON_TRACE,
    params: { intensity: 0.75, motion: 0.5, glow: 0.9, bassReactivity: 0.7 },
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
    params: { intensity: 0.72, motion: 0.55, glow: 0.8, bassReactivity: 0.85 },
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
    params: { intensity: 0.8, motion: 0.65, glow: 0.75, bassReactivity: 0.95 },
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
    params: { intensity: 0.65, motion: 0.45, glow: 0.72, bassReactivity: 0.7 },
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
    params: { intensity: 0.75, motion: 0.42, glow: 0.88, bassReactivity: 0.75 },
    scenes: makeScenes('dtt', 'oscilloscope'),
    sectionMappings: makeMappings('dtt'),
    oscillatorSettings: {
      sourceType:        'text',
      text:              'DRMVYZ',
      renderMode:        'multiTrace',
      autoSectionMode:   true,
      autoRotate:        false,
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
    params: { intensity: 0.88, motion: 0.75, glow: 0.85, bassReactivity: 0.95 },
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
    name: 'SVG Slot',
    description: 'Import an SVG from the Media tab and select it here — Reactive Path deforms it with audio, Original Artwork renders it at full fidelity.',
    engine: 'oscilloscope',
    palette: PALETTE_SVG_SLOT,
    params: { intensity: 0.7, motion: 0.5, glow: 0.78, bassReactivity: 0.8 },
    scenes: makeScenes('sgs', 'oscilloscope'),
    sectionMappings: makeMappings('sgs'),
    oscillatorSettings: {
      sourceType:         'svg',
      selectedSvgId:      null,
      svgRenderMode:      'auto',
      svgUseReactPalette: true,
      autoRotate:         false,
      renderMode:         'outline',
      autoSectionMode:    true,
      bassScale:          0.3,
      beatBloom:          0.4,
      rotationSpeed:      0.06,
      duplicateTraces:    2,
      audioDisplacement:  0.18,
      midTwist:           0.1,
      highJitter:         0.05,
    },
  },

  // ── LaserDMX (1) ─────────────────────────────────────────────────────────
  {
    id: 'preset-laser-dmx-default',
    name: 'Laser Fan Grid',
    description: 'Virtual laser show: fan beams from left and right with a lissajous accent at center.',
    engine: 'laserDmx',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.85, motion: 0.55, glow: 0.7, bassReactivity: 0.8 },
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
    params: { intensity: 0.95, motion: 0.75, glow: 0.8, bassReactivity: 0.95 },
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
    params: { intensity: 0.9, motion: 0.6, glow: 0.5, bassReactivity: 1.0 },
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
    params: { intensity: 0.5, motion: 0.3, glow: 0.9, bassReactivity: 0.4 },
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
    params: { intensity: 0.8, motion: 0.85, glow: 0.6, bassReactivity: 0.85 },
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
    params: { intensity: 0.7, motion: 0.5, glow: 0.85, bassReactivity: 0.6 },
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

  // ── Neon Lattice (1) – Acid Magenta ──────────────────────────────────────
  {
    id:          'preset-nl-acid-magenta',
    name:        'Acid Magenta',
    description: 'Magenta rails with cyan accents, white intersections, and heavy bloom.',
    engine:      'neonLattice',
    palette:     PALETTE_ACID_MAGENTA,
    params:      { intensity: 0.80, motion: 0.65, glow: 0.90, bassReactivity: 0.90 },
    scenes:      makeScenes('nlam', 'neonLattice'),
    sectionMappings: makeMappings('nlam'),
    neonLatticeSettings: {
      railDensity: 0.55, verticalBias: 0.55, centerBias: 0.25, railLifetime: 3.5,
      pulseSpeed: 0.70, flareAmount: 0.75, snapDivision: 4,
      blockDensity: 0.30, blockHold: 0.60, cyanAccentChance: 0.45,
      bloom: 0.90, depth: 0.35, parallax: 0.30, cameraMotion: 0.15,
      shockwaveAmount: 0.75, reseedInterval: 16,
      decayStyle: 'exponential', blackoutMode: 'none', trigger: 'kick',
      audioReactive: true, bassBrightnessResponse: 1.00,
      kickRailResponse: 1.00, snareRailResponse: 0.75, beatPulseResponse: 0.85,
      midBlockResponse: 0.35, highFlareResponse: 0.45, energyDensityResponse: 0.25,
      buildMotionResponse: 0.25, dropImpactResponse: 1.00, sectionDynamics: 1.00,
      audioSmoothing: 0.15, audioGate: 0.05,
    },
  },

  // ── Neon Lattice (2) – DVYDRM Lattice ────────────────────────────────────
  {
    id:          'preset-nl-drmvyz-lattice',
    name:        'DVYDRM Lattice',
    description: 'Cyan and emerald rails, gold blocks, dark background with clean bloom.',
    engine:      'neonLattice',
    palette:     PALETTE_DRMVYZ_LATTICE,
    params:      { intensity: 0.75, motion: 0.55, glow: 0.75, bassReactivity: 0.85 },
    scenes:      makeScenes('nldl', 'neonLattice'),
    sectionMappings: makeMappings('nldl'),
    neonLatticeSettings: {
      railDensity: 0.45, verticalBias: 0.60, centerBias: 0.30, railLifetime: 4.5,
      pulseSpeed: 0.55, flareAmount: 0.55, snapDivision: 4,
      blockDensity: 0.25, blockHold: 0.55, cyanAccentChance: 0.50,
      bloom: 0.70, depth: 0.28, parallax: 0.15, cameraMotion: 0.08,
      shockwaveAmount: 0.55, reseedInterval: 16,
      decayStyle: 'exponential', blackoutMode: 'none', trigger: 'beat',
      audioReactive: true, bassBrightnessResponse: 0.85,
      kickRailResponse: 0.80, snareRailResponse: 0.80, beatPulseResponse: 0.75,
      midBlockResponse: 0.25, highFlareResponse: 0.35, energyDensityResponse: 0.15,
      buildMotionResponse: 0.15, dropImpactResponse: 0.80, sectionDynamics: 0.80,
      audioSmoothing: 0.20, audioGate: 0.04,
    },
  },

  // ── Neon Lattice (3) – Sparse Starlines ──────────────────────────────────
  {
    id:          'preset-nl-sparse-starlines',
    name:        'Sparse Starlines',
    description: 'Low density, large isolated flares, long persistence, minimal blocks.',
    engine:      'neonLattice',
    palette:     PALETTE_SPARSE_STARLINES,
    params:      { intensity: 0.60, motion: 0.35, glow: 0.60, bassReactivity: 0.70 },
    scenes:      makeScenes('nlss', 'neonLattice'),
    sectionMappings: makeMappings('nlss'),
    neonLatticeSettings: {
      railDensity: 0.20, verticalBias: 0.65, centerBias: 0.20, railLifetime: 7.0,
      pulseSpeed: 0.40, flareAmount: 0.85, snapDivision: 2,
      blockDensity: 0.05, blockHold: 0.80, cyanAccentChance: 0.60,
      bloom: 0.55, depth: 0.20, parallax: 0.10, cameraMotion: 0.05,
      shockwaveAmount: 0, reseedInterval: 32,
      decayStyle: 'exponential', blackoutMode: 'none', trigger: 'beat',
      audioReactive: true, bassBrightnessResponse: 0.65,
      kickRailResponse: 0.45, snareRailResponse: 0.50, beatPulseResponse: 0.65,
      midBlockResponse: 0.05, highFlareResponse: 0.80, energyDensityResponse: 0.05,
      buildMotionResponse: 0.10, dropImpactResponse: 0.35, sectionDynamics: 0.60,
      audioSmoothing: 0.35, audioGate: 0.08,
    },
  },

  // ── Neon Lattice (4) – Overload Matrix ───────────────────────────────────
  {
    id:          'preset-nl-overload-matrix',
    name:        'Overload Matrix',
    description: 'High density, short lifetimes, aggressive cascades and impact bloom.',
    engine:      'neonLattice',
    palette:     PALETTE_OVERLOAD_MATRIX,
    params:      { intensity: 0.90, motion: 0.85, glow: 1.00, bassReactivity: 0.95 },
    scenes:      makeScenes('nlom', 'neonLattice'),
    sectionMappings: makeMappings('nlom'),
    neonLatticeSettings: {
      railDensity: 0.75, verticalBias: 0.50, centerBias: 0.40, railLifetime: 2.0,
      pulseSpeed: 0.90, flareAmount: 0.65, snapDivision: 8,
      blockDensity: 0.45, blockHold: 0.35, cyanAccentChance: 0.30,
      bloom: 1.00, depth: 0.55, parallax: 0.40, cameraMotion: 0.25,
      shockwaveAmount: 0.90, reseedInterval: 8,
      decayStyle: 'exponential', blackoutMode: 'none', trigger: 'kick',
      audioReactive: true, bassBrightnessResponse: 1.00,
      kickRailResponse: 1.00, snareRailResponse: 1.00, beatPulseResponse: 0.95,
      midBlockResponse: 0.70, highFlareResponse: 0.55, energyDensityResponse: 0.65,
      buildMotionResponse: 0.55, dropImpactResponse: 1.00, sectionDynamics: 1.00,
      audioSmoothing: 0.08, audioGate: 0.03,
    },
  },
]

// ── Default performance pads ──────────────────────────────────────────────────

export const DEFAULT_PERFORMANCE_PADS: ReactPerformancePad[] = [
  // Row 1 — Mixed live-performance presets
  { id: 'pad-1',  presetId: 'preset-bass-triangle-reactor',  label: 'Reactor',   color: DVYDRM_GOLD,    keyBinding: '1', transitionTimeMs: 500 },
  { id: 'pad-2',  presetId: 'preset-laser-dmx-drop-cage',    label: 'Drop Cage', color: DVYDRM_CYAN,    keyBinding: '2', transitionTimeMs: 400 },
  { id: 'pad-3',  presetId: 'preset-infinity-signal',        label: 'Infinity',  color: DVYDRM_EMERALD, keyBinding: '3', transitionTimeMs: 600 },
  { id: 'pad-4',  presetId: 'preset-laser-dmx-build-tunnel', label: 'Tunnel',    color: '#ff8c42',      keyBinding: '4', transitionTimeMs: 300 },
  { id: 'pad-17', presetId: 'preset-quiet-ruins',            label: 'Ruins',    color: '#7a9bac',      keyBinding: '5', transitionTimeMs: 600 },
  // Row 2 — Cinematic / Neon Lattice
  { id: 'pad-5',  presetId: 'preset-dream-gate',             label: 'Dream',    color: '#5b8def',      keyBinding: 'q', transitionTimeMs: 800 },
  { id: 'pad-6',  presetId: 'preset-crimson-rift',           label: 'Rift',     color: DVYDRM_CRIMSON, keyBinding: 'w', transitionTimeMs: 400 },
  { id: 'pad-7',  presetId: 'preset-emerald-fog',            label: 'Fog',      color: DVYDRM_EMERALD, keyBinding: 'e', transitionTimeMs: 700 },
  { id: 'pad-8',  presetId: 'preset-portal-overload',        label: 'Overload', color: '#b84fc9',      keyBinding: 'r', transitionTimeMs: 200 },
  { id: 'pad-18', presetId: 'preset-nl-acid-magenta',        label: 'Acid NL',  color: '#e040fb',      keyBinding: 't', transitionTimeMs: 300 },
  // Row 3 — Sound Drawing
  { id: 'pad-9',  presetId: 'preset-xy-cyan-scope',          label: 'XY Scope', color: DVYDRM_CYAN,    keyBinding: 'a', transitionTimeMs: 300 },
  { id: 'pad-10', presetId: 'preset-lissajous-flower',       label: 'Lissajous',color: DVYDRM_EMERALD, keyBinding: 's', transitionTimeMs: 400 },
  { id: 'pad-11', presetId: 'preset-spiral-signal',          label: 'Spiral',   color: DVYDRM_GOLD,    keyBinding: 'd', transitionTimeMs: 350 },
  { id: 'pad-12', presetId: 'preset-radial-voice',           label: 'Radial',   color: DVYDRM_WHITE,   keyBinding: 'f', transitionTimeMs: 450 },
  { id: 'pad-19', presetId: 'preset-bass-triangle-reactor',  label: 'Triangle', color: DVYDRM_CRIMSON, keyBinding: 'g', transitionTimeMs: 250 },
  // Row 4 — Peak / enhanced visuals
  { id: 'pad-13', presetId: 'preset-nl-overload-matrix',     label: 'Matrix',   color: '#ff3c6e',      keyBinding: 'z', transitionTimeMs: 200 },
  { id: 'pad-14', presetId: 'preset-drmvyz-text-trace',      label: 'DRMVYZ',   color: '#b84fc9',      keyBinding: 'x', transitionTimeMs: 400 },
  { id: 'pad-15', presetId: 'preset-star-drop-burst',        label: 'StarBurst',color: DVYDRM_GOLD,    keyBinding: 'c', transitionTimeMs: 250 },
  { id: 'pad-16', presetId: 'preset-glyph-circle-pulse',     label: 'Circle',   color: DVYDRM_CYAN,    keyBinding: 'v', transitionTimeMs: 400 },
  { id: 'pad-20', presetId: 'preset-laser-dmx-default',      label: 'Laser Fan',color: '#00ffdc',      keyBinding: 'b', transitionTimeMs: 300 },
]
