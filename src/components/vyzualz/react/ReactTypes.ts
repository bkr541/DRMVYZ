import { DEFAULT_SOUND_DRAWING_SCOPE_STATE } from '../../../audio/scope/scopeTypes'
import type { SoundDrawingScopeState } from '../../../audio/scope/scopeTypes'
import { createCinematicWorldConfig } from './CinematicWorldConfig'
import type { CinematicWorldConfig } from './CinematicWorldConfig'
import { REACTIVE_CONSTELLATION_CURATED_PRESETS } from './ReactiveConstellationPresets'
import { PIX_GRID_PRESETS } from './pixGrid/PixGridPresets'
import type { PixGridPresetSettings } from './pixGrid/PixGridTypes'
import { createDefaultProductionStageModel } from './LaserDmxProductionRig'
import type {
  ProductionChoreographySettings,
  ProductionCompoundCue,
  ProductionFixtureCapabilityOverride,
  ProductionFixtureGroup,
  ProductionFixtureKind,
  ProductionLook,
  ProductionLookTransitionSettings,
  ProductionPresetMetadata,
  ProductionMovingHeadSettings,
  ProductionFixtureColorPolicy,
  ProductionFlashPatternSettings,
  ProductionLedBarSettings,
  ProductionAtmosphereSettings,
  ProductionAtmosphericFixtureSettings,
  ProductionVisualComfortSettings,
  ProductionWashSettings,
  ProductionStageModel,
  ProductionStageTransform,
  ProductionTarget,
} from './LaserDmxProductionRig'

export type ReactEngineId = 'shaderPads' | 'cinematicPortal' | 'oscilloscope' | 'canvas' | 'laserDmx' | 'pixGrid'

// ── Oscillator path/glyph types ───────────────────────────────────────────────

export type OscillatorSourceType = 'classic' | 'builtinShape' | 'text' | 'svg' | 'svgGlyph' | 'svgVisual'

export type SvgRenderMode = 'auto' | 'reactivePath' | 'originalArtwork'

/**
 * Classic scope presentations.
 *
 * `monoDelayXY` is the accurate name for the long-standing `lissajous` mode: it
 * plots the signal against a delayed copy of itself, an expressive phase
 * portrait rather than a stereo measurement. `lissajous` stays in the union so
 * unmigrated values still render; normalization maps it to `monoDelayXY`, which
 * draws identically.
 *
 * `professionalScope` routes to the professional signal core. Which signal it
 * plots is `OscillatorSettings.scope.signalMode` — one selector for the scope
 * family, one for the signal, so the two never disagree. The core needs the
 * synchronized stereo capture tap; without it the renderer falls back to the
 * legacy waveform rather than presenting mono-derived geometry as stereo.
 */
export type ClassicScopeMode =
  | 'sectionAuto'
  | 'waveform'
  | 'lissajous'
  | 'monoDelayXY'
  | 'radialScope'
  | 'spiralScope'
  | 'professionalScope'

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
  /** Normalized 0..1 inverse-velocity ratio from pre-resample source spacing; absent for sources that don't resample (built-in shapes, SVG). */
  velocityRatio?: number
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
  /** Optional: routes paths through simulated galvo slew limits (corner dwell + blanking) before rasterizing. Default off — a purely optional "realistic scanner" mode, not required for normal rendering. */
  scannerKinematicsEnabled: boolean
  /** Extra dwell (microseconds) budgeted for sharp corners when scanner kinematics are enabled. Mirrors LaserDmxScannerHead.cornerDwellMicros. */
  scannerCornerDwellMicros: number
  /** Blanking gap (microseconds) at corners sharp enough to demand a retrace when scanner kinematics are enabled. Mirrors LaserDmxScannerHead.blankingDelayMicros. */
  scannerBlankingDelayMicros: number
  /** Maximum sustained angular velocity (degrees/sec) the simulated galvo can hit when scanner kinematics are enabled. Mirrors LaserDmxScannerHead.maximumAngularVelocity. */
  scannerMaxAngularVelocityDegPerSec: number
  /**
   * Professional scope signal core configuration.
   *
   * Lives here rather than in a parallel store so it follows the existing
   * oscillator persistence, preset, and normalization path. Signal only — beam,
   * phosphor, and CRT presentation belong to the renderer patches and enter
   * through a versioned migration on `SoundDrawingScopeState`.
   */
  scope: SoundDrawingScopeState
}

// ── CANVAS engine types ─────────────────────────────────────────────────────

export type CanvasMediaKind = 'video' | 'image' | 'svg' | 'visualAsset'
export type CanvasMediaItemType = 'video' | 'image' | 'svg'
export type CanvasFitMode = 'contain' | 'cover' | 'stretch'

export type CanvasPresetId =
  | 'canvas-clean-playback'
  | 'canvas-bass-bloom'
  | 'canvas-ghost-echo'
  | 'canvas-glitch-pulse'
  | 'canvas-luma-melt'
  | 'canvas-frame-stutter'
  | 'canvas-particle-aura'
  | 'canvas-fractures'

export type CanvasPresetRendererKind = 'standard' | 'particleAura' | 'fragmentCollage'
export type CanvasPresetColorMode = 'original' | 'palette' | 'audioReactive'
export type CanvasParticleQuality = 'low' | 'balanced' | 'high'
export type CanvasFractureAnchorMode = 'alwaysVisible' | 'reactive' | 'fadeWithMusic' | 'fullyFragmented'
export type CanvasFractureMode = 'mixed' | 'rectangles' | 'horizontalSlices' | 'verticalSlices' | 'angledQuads'
export type CanvasFracturePlacementMode = 'balanced' | 'offscreenSpill' | 'heavyOverlap' | 'anchorCover' | 'repeatedCrops' | 'mirrorFlip' | 'randomMix'
export type CanvasFractureTransitionMode = 'hardGlitchCut' | 'staggeredAssembly' | 'zoomInOut'
export type CanvasFractureColorSourceMode = 'imageSampled' | 'brandKit' | 'manualOverride'
export type CanvasFractureLumaMode = 'highlights' | 'shadows' | 'band'
export type CanvasFractureQualityMode = 'auto' | 'low' | 'balanced' | 'high' | 'ultra'
export type CanvasFractureResolvedQualityTier = Exclude<CanvasFractureQualityMode, 'auto'>
export type CanvasFractureQuantizeInterval = 'manualOnly' | 'bar' | '4bars' | '8bars' | '16bars' | 'section' | 'beat' | '2bars'
/** Persisted command identity for deterministic manual transition reconstruction. */
export type CanvasFractureManualAction = 'none' | 'refracture' | 'shuffleLayout' | 'returnToAnchor' | 'releaseFreeze'
export type CanvasFractureEffectRole = 'clean' | 'glow' | 'outline' | 'glitch' | 'luma' | 'displacement' | 'texture'

export const CANVAS_FRACTURE_EFFECT_ROLES: readonly CanvasFractureEffectRole[] = [
  'clean',
  'glow',
  'outline',
  'glitch',
  'luma',
  'displacement',
  'texture',
] as const
/**
 * `legacyComposite` preserves the pre-v2 Source Visibility product for loaded
 * projects. New presets use `dryOnly`, where Dry Source Mix owns only the
 * untreated contribution and processed passes remain independent.
 */
export type CanvasSourceMixMode = 'dryOnly' | 'legacyComposite'

export type CanvasPresetControlKey =
  | 'drySourceMix'
  /** @deprecated Legacy automation/control alias. */
  | 'sourceVisibility'
  | 'intensity'
  | 'bassReactivity'
  | 'beatPulse'
  | 'glow'
  | 'trailAmount'
  | 'rgbSplit'
  | 'glitchAmount'
  | 'stutterRate'
  | 'lumaThreshold'
  | 'motionAmount'
  | 'turbulence'
  | 'particleDensity'
  | 'particleSize'
  | 'particleColorMode'
  | 'particleQuality'

export type CanvasTriggerOn =
  | 'manualOnly'
  | 'trackStart'
  | 'sectionChange'
  | 'drop'
  | 'every8Bars'
  | 'every16Bars'

export type CanvasSectionTriggerType = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro'

export interface CanvasVideoTimingSettings {
  clipStartSec: number
  clipEndSec: number
  loopClipRange: boolean
  restartOnDrop: boolean
  restartOnSectionChange: boolean
  restartOnManualPresetChange: boolean
  triggerOn: CanvasTriggerOn
  sectionTriggerTypes: CanvasSectionTriggerType[]
}

export const DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS: CanvasVideoTimingSettings = {
  clipStartSec: 0,
  clipEndSec: 0,
  loopClipRange: false,
  restartOnDrop: false,
  restartOnSectionChange: false,
  restartOnManualPresetChange: false,
  triggerOn: 'manualOnly',
  sectionTriggerTypes: ['intro', 'build', 'drop', 'breakdown', 'outro'],
}

export const CANVAS_PRESET_SETTINGS_SCHEMA_VERSION = 5 as const

export interface CanvasPresetSettings {
  schemaVersion: typeof CANVAS_PRESET_SETTINGS_SCHEMA_VERSION
  sourceMixMode: CanvasSourceMixMode
  /** Untreated source-layer contribution only. */
  drySourceMix: number
  /** @deprecated Read/write compatibility alias for drySourceMix. */
  sourceVisibility: number
  intensity: number
  bassReactivity: number
  beatPulse: number
  glow: number
  trailAmount: number
  rgbSplit: number
  glitchAmount: number
  stutterRate: number
  lumaThreshold: number
  motionAmount: number
  turbulence: number
  particleDensity: number
  particleSize: number
  particleColorMode: CanvasPresetColorMode
  particleQuality: CanvasParticleQuality
  fractureIntensity: number
  fractureMode: CanvasFractureMode
  fractureAnchorMode: CanvasFractureAnchorMode
  fractureFocusProtection: number
  fractureFocusX: number
  fractureFocusY: number
  fractureComposition: number
  fracturePlacementMode: CanvasFracturePlacementMode
  fractureTopologyInterval: CanvasFractureQuantizeInterval
  fractureLayoutInterval: CanvasFractureQuantizeInterval
  fractureVariationSeed: number
  fractureQuality: CanvasFractureQualityMode
  fractureMotionAmount: number
  fractureTransitionMode: CanvasFractureTransitionMode
  fractureTransitionSpeed: number
  fractureStaggerAmount: number
  fractureZoomAmount: number
  fractureFreezeLayout: boolean
  fractureFreezePositionSec: number
  fractureReturnToAnchor: boolean
  fractureLastManualAction: CanvasFractureManualAction
  fractureManualTransitionPositionSec: number
  fractureTopologyRevision: number
  fractureLayoutRevision: number
  fractureEffectsIntensity: number
  fractureGlowAmount: number
  fractureOutlineAmount: number
  fractureOutlineThickness: number
  fractureRgbSplitAmount: number
  fractureLumaMode: CanvasFractureLumaMode
  fractureLumaThreshold: number
  fractureSliceDisplacementAmount: number
  fracturePixelationAmount: number
  fractureScanlineAmount: number
  fractureNoiseAmount: number
  fractureGlitchAmount: number
  fractureTextureAmount: number
  fractureTrailsAmount: number
  fractureDepthAmount: number
  fractureDuplicationAmount: number
  fractureColorTreatmentAmount: number
  fractureEffectRoleWeights: Record<CanvasFractureEffectRole, number>
  fractureColorSourceMode: CanvasFractureColorSourceMode
  fractureManualPrimaryColor: string
  fractureManualSupportingColor: string
  fractureAudioResponse: number
  fractureBassMotion: number
  fractureTransientGlitch: number
  fractureStructuralResponse: number
  /** @deprecated Read/write compatibility for persisted pre-recipe CANVAS sessions only. */
  motionTrailAmount: number
  particleAmount: number
  dissolveAmount: number
  trailLength: number
  bassBurst: number
}

export interface CanvasPresetDefinition {
  id: CanvasPresetId
  name: string
  description: string
  accent: string
  rendererKind: CanvasPresetRendererKind
  settings: Partial<CanvasPresetSettings>
  controls: CanvasPresetControlKey[]
}

export interface CanvasPresetOverrideState {
  source: 'manual' | 'auto'
  presetId: CanvasPresetId | null
  label: string | null
}

export interface CanvasMediaItem {
  id: string
  name: string
  type: CanvasMediaItemType
  objectUrl: string
  dataUrl?: string
  thumbnailUrl?: string | null
  mimeType?: string | null
  fileSize?: number
  meta?: string
  source?: 'library' | 'legacySession'
  createdAt: string
  timing?: CanvasVideoTimingSettings
  width?: number
  height?: number
  durationSec?: number
  fps?: number
  hasAlpha?: boolean
  loopable?: boolean
  bpm?: number
  energy?: 'low' | 'medium' | 'high' | 'peak'
  tags?: string[]
  collectionIds?: string[]
  libraryRole?: string | null
  mediaRevision?: number
}

export interface CanvasEngineSettings {
  selectedMediaId: string | null
  mediaIds: string[]
  /** @deprecated CANVAS imports now route through the shared media library. */
  uploadEnabled: boolean
  autoSelectEnabled: boolean
  manualMediaOverrideId: string | null

  supportedMediaKinds: CanvasMediaKind[]
  fitMode: CanvasFitMode
  scale: number
  positionX: number
  positionY: number
  rotation: number
  opacity: number
  loopVideo: boolean
}

export const DEFAULT_CANVAS_ENGINE_SETTINGS: CanvasEngineSettings = {
  selectedMediaId: null,
  mediaIds: [],
  uploadEnabled: false,
  autoSelectEnabled: false,
  manualMediaOverrideId: null,
  supportedMediaKinds: ['video', 'image', 'svg'],
  fitMode: 'contain',
  scale: 1,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  opacity: 1,
  loopVideo: true,
}

export const DEFAULT_CANVAS_PRESET_ID: CanvasPresetId = 'canvas-clean-playback'

export const DEFAULT_CANVAS_PRESET_SETTINGS: CanvasPresetSettings = {
  schemaVersion: CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
  sourceMixMode: 'dryOnly',
  drySourceMix: 1,
  sourceVisibility: 1,
  intensity: 0.08,
  bassReactivity: 0,
  beatPulse: 0,
  glow: 0,
  trailAmount: 0,
  rgbSplit: 0,
  glitchAmount: 0,
  stutterRate: 0,
  lumaThreshold: 0.55,
  motionAmount: 0,
  turbulence: 0,
  particleDensity: 0,
  particleSize: 2.4,
  particleColorMode: 'original',
  particleQuality: 'balanced',
  fractureIntensity: 0.34,
  fractureMode: 'mixed',
  fractureAnchorMode: 'alwaysVisible',
  fractureFocusProtection: 0.7,
  fractureFocusX: 0.5,
  fractureFocusY: 0.5,
  fractureComposition: 0.25,
  fracturePlacementMode: 'balanced',
  fractureTopologyInterval: '4bars',
  fractureLayoutInterval: 'bar',
  fractureVariationSeed: 1337,
  fractureQuality: 'balanced',
  fractureMotionAmount: 0.24,
  fractureTransitionMode: 'staggeredAssembly',
  fractureTransitionSpeed: 0.45,
  fractureStaggerAmount: 0.28,
  fractureZoomAmount: 0.18,
  fractureFreezeLayout: false,
  fractureFreezePositionSec: 0,
  fractureReturnToAnchor: false,
  fractureLastManualAction: 'none',
  fractureManualTransitionPositionSec: 0,
  fractureTopologyRevision: 0,
  fractureLayoutRevision: 0,
  fractureEffectsIntensity: 0.25,
  fractureGlowAmount: 0.18,
  fractureOutlineAmount: 0.45,
  fractureOutlineThickness: 0.32,
  fractureRgbSplitAmount: 0.32,
  fractureLumaMode: 'highlights',
  fractureLumaThreshold: 0.62,
  fractureSliceDisplacementAmount: 0.28,
  fracturePixelationAmount: 0.22,
  fractureScanlineAmount: 0.18,
  fractureNoiseAmount: 0.16,
  fractureGlitchAmount: 0.12,
  fractureTextureAmount: 0.2,
  fractureTrailsAmount: 0.08,
  fractureDepthAmount: 0.22,
  fractureDuplicationAmount: 0.1,
  fractureColorTreatmentAmount: 0.18,
  fractureEffectRoleWeights: {
    clean: 0.34,
    glow: 0.14,
    outline: 0.14,
    glitch: 0.1,
    luma: 0.08,
    displacement: 0.1,
    texture: 0.1,
  },
  fractureColorSourceMode: 'imageSampled',
  fractureManualPrimaryColor: '#4AC7DB',
  fractureManualSupportingColor: '#61D6AA',
  fractureAudioResponse: 0.35,
  fractureBassMotion: 0.3,
  fractureTransientGlitch: 0.25,
  fractureStructuralResponse: 0.35,
  motionTrailAmount: 0,
  particleAmount: 0,
  dissolveAmount: 0,
  trailLength: 0,
  bassBurst: 0,
}

export const DEFAULT_CANVAS_PRESET_OVERRIDE_STATE: CanvasPresetOverrideState | null = null

export const CANVAS_PRESETS: CanvasPresetDefinition[] = [
  {
    id: 'canvas-clean-playback',
    name: 'Clean Playback',
    description: 'A clean source-forward recipe with high source visibility, neutral motion, and minimal reactive FX.',
    accent: '#e8f4f8',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 1,
      sourceVisibility: 1,
      intensity: 0.06,
      bassReactivity: 0,
      beatPulse: 0,
      glow: 0,
      trailAmount: 0,
      rgbSplit: 0,
      glitchAmount: 0,
      stutterRate: 0,
      motionAmount: 0,
      turbulence: 0,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity'],
  },
  {
    id: 'canvas-bass-bloom',
    name: 'Bass Bloom',
    description: 'A glow-forward recipe that swells source scale, bloom, and exposure with bass energy.',
    accent: '#61d6aa',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.94,
      sourceVisibility: 0.94,
      intensity: 0.7,
      bassReactivity: 0.82,
      beatPulse: 0.32,
      glow: 0.74,
      trailAmount: 0.12,
      rgbSplit: 0.03,
      glitchAmount: 0,
      stutterRate: 0,
      motionAmount: 0.18,
      turbulence: 0.08,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity', 'bassReactivity', 'beatPulse', 'glow', 'trailAmount', 'motionAmount'],
  },
  {
    id: 'canvas-ghost-echo',
    name: 'Ghost Echo',
    description: 'A soft echo recipe with visible source blend, trails, slow motion drift, and light glow.',
    accent: '#9ddcff',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.76,
      sourceVisibility: 0.76,
      intensity: 0.56,
      bassReactivity: 0.18,
      beatPulse: 0.12,
      glow: 0.34,
      trailAmount: 0.68,
      rgbSplit: 0.05,
      glitchAmount: 0,
      stutterRate: 0,
      motionAmount: 0.46,
      turbulence: 0.18,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity', 'trailAmount', 'motionAmount', 'glow', 'bassReactivity'],
  },
  {
    id: 'canvas-glitch-pulse',
    name: 'Glitch Pulse',
    description: 'A high-energy recipe with RGB split, glitch shake, beat pulse, and tight stutter accents.',
    accent: '#ff4fd8',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.92,
      sourceVisibility: 0.92,
      intensity: 0.66,
      bassReactivity: 0.38,
      beatPulse: 0.66,
      glow: 0.2,
      trailAmount: 0.1,
      rgbSplit: 0.72,
      glitchAmount: 0.66,
      stutterRate: 4,
      lumaThreshold: 0.55,
      motionAmount: 0.28,
      turbulence: 0.32,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity', 'beatPulse', 'rgbSplit', 'glitchAmount', 'stutterRate', 'motionAmount'],
  },
  {
    id: 'canvas-luma-melt',
    name: 'Luma Melt',
    description: 'A liquid highlight recipe that uses luma threshold, blur, glow, and motion smear as one look.',
    accent: '#d8b95a',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.84,
      sourceVisibility: 0.84,
      intensity: 0.58,
      bassReactivity: 0.2,
      beatPulse: 0.18,
      glow: 0.46,
      trailAmount: 0.42,
      rgbSplit: 0.08,
      glitchAmount: 0,
      stutterRate: 0,
      lumaThreshold: 0.64,
      motionAmount: 0.62,
      turbulence: 0.26,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity', 'lumaThreshold', 'glow', 'trailAmount', 'motionAmount', 'turbulence'],
  },
  {
    id: 'canvas-frame-stutter',
    name: 'Frame Stutter',
    description: 'A rhythmic frame-hold recipe with beat sync, stutter rate, RGB edge split, and frame shake.',
    accent: '#4ac7db',
    rendererKind: 'standard',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.95,
      sourceVisibility: 0.95,
      intensity: 0.55,
      bassReactivity: 0.22,
      beatPulse: 0.7,
      glow: 0.18,
      trailAmount: 0.08,
      rgbSplit: 0.42,
      glitchAmount: 0.26,
      stutterRate: 6,
      motionAmount: 0.18,
      turbulence: 0.12,
      particleDensity: 0,
    },
    controls: ['drySourceMix', 'intensity', 'beatPulse', 'stutterRate', 'rgbSplit', 'glitchAmount'],
  },
  {
    id: 'canvas-particle-aura',
    name: 'Particle Aura',
    description: 'A dense particle hologram that reconstructs media with audio-reactive diffusion, chromatic slicing, and scanline detail.',
    accent: '#dffcff',
    rendererKind: 'particleAura',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 0.04,
      sourceVisibility: 0.04,
      intensity: 0.94,
      bassReactivity: 0.72,
      beatPulse: 0.62,
      glow: 0.82,
      trailAmount: 0.74,
      rgbSplit: 0.42,
      glitchAmount: 0.36,
      stutterRate: 0,
      lumaThreshold: 0.36,
      motionAmount: 0.68,
      turbulence: 0.58,
      particleDensity: 0.94,
      particleSize: 1.72,
      particleColorMode: 'audioReactive',
      particleQuality: 'high',
    },
    controls: [
      'drySourceMix',
      'intensity',
      'particleDensity',
      'particleSize',
      'turbulence',
      'motionAmount',
      'trailAmount',
      'glow',
      'rgbSplit',
      'glitchAmount',
      'bassReactivity',
      'beatPulse',
      'particleColorMode',
      'particleQuality',
    ],
  },
  {
    id: 'canvas-fractures',
    name: 'Fractures',
    description: 'A deterministic fragment collage with protected focal regions, independent source crops, and editorial-to-chaotic composition.',
    accent: '#8de7ff',
    rendererKind: 'fragmentCollage',
    settings: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      drySourceMix: 1,
      sourceVisibility: 1,
      intensity: 0,
      bassReactivity: 0,
      beatPulse: 0,
      glow: 0,
      trailAmount: 0,
      rgbSplit: 0,
      glitchAmount: 0,
      stutterRate: 0,
      motionAmount: 0,
      turbulence: 0,
      particleDensity: 0,
    },
    controls: [],
  },
]


export const CANVAS_PRESET_BY_ID: Record<CanvasPresetId, CanvasPresetDefinition> = CANVAS_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset
  return acc
}, {} as Record<CanvasPresetId, CanvasPresetDefinition>)

export function resolveCanvasPresetRendererKind(presetId: CanvasPresetId): CanvasPresetRendererKind {
  return CANVAS_PRESET_BY_ID[presetId]?.rendererKind ?? 'standard'
}

export const DEFAULT_OSCILLATOR_SETTINGS: OscillatorSettings = {
  sourceType:          'classic',
  classicMode:         'waveform',
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
  autoSectionMode:   false,
  scannerKinematicsEnabled:           false,
  scannerCornerDwellMicros:           64,
  scannerBlankingDelayMicros:         18,
  scannerMaxAngularVelocityDegPerSec: 18_000,
  scope:             DEFAULT_SOUND_DRAWING_SCOPE_STATE,
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
  | 'genericMovingHeadBeam'
  | 'genericMovingHeadSpot'
  | 'genericMovingHeadWash'
  | 'genericStaticWash'
  | 'genericWhiteStrobe'
  | 'genericRgbwStrobe'
  | 'genericAudienceBlinder'
  | 'genericLedBar'
  | 'genericHazer'
  | 'genericFogger'
  | 'genericCryoJet'

export type LaserDmxModulationTarget =
  // Legacy rig targets
  | 'masterDimmer'
  | 'fixtureDimmer'
  | 'red' | 'green' | 'blue' | 'white' | 'alpha'
  | 'pan' | 'tilt' | 'rotation'
  | 'zoom' | 'focus' | 'iris' | 'frost' | 'goboRotation' | 'prismRotation' | 'beamWidth' | 'strobeRate'
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

// ── LaserDMX Show Director layout foundation ─────────────────────────────────
// This is the safe authoring model for the future drag/drop 2D stage builder.
// It compiles into Beam Matrix through LaserDmxShowDirectorBeamMatrixCompiler when selected as the preview source.

export const LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION = 15

export type LaserDmxShowDirectorFixtureKind =
  | 'laser'
  | 'movingHead'
  | 'ledBar'
  | 'ledTube'
  | 'strobe'
  | 'blinder'
  | 'parWash'
  | 'videoWall'
  | 'haze'
  | 'co2Jet'

export const LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS: readonly LaserDmxShowDirectorFixtureKind[] = [
  'laser',
  'movingHead',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'parWash',
  'videoWall',
  'haze',
  'co2Jet',
] as const

export const LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS: Record<LaserDmxShowDirectorFixtureKind, string> = {
  laser:      'Laser',
  movingHead: 'Moving Head',
  ledBar:     'LED Bar',
  ledTube:    'LED Tube',
  strobe:     'Strobe',
  blinder:    'Blinder',
  parWash:    'PAR Wash',
  videoWall:  'Video Wall',
  haze:       'Haze',
  co2Jet:     'CO₂ Jet',
}

export type LaserDmxShowDirectorColorMode = 'fixed' | 'palette' | 'music' | 'fixtureDefault'
export type LaserDmxShowDirectorBeamTargetMode = 'fixed' | 'fan' | 'sweep' | 'cross' | 'mirror' | 'audioReactive'

export type LaserDmxShowDirectorTriggerMode =
  | 'alwaysOn'
  | 'beat'
  | 'bar'
  | 'phrase'
  | 'section'
  | 'cuePoint'
  | 'bassHit'
  | 'snareTransient'
  | 'energy'
  | 'audioBand'

export type LaserDmxShowDirectorBeatDivision = 0.25 | 0.5 | 1 | 2 | 4 | 8
export type LaserDmxShowDirectorSectionType = 'intro' | 'verse' | 'build' | 'preDrop' | 'drop' | 'breakdown' | 'bridge' | 'outro' | 'unknown'
export type LaserDmxShowDirectorAudioBand = 'sub' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'high'
export type LaserDmxShowDirectorTriggerRetrigger = 'allow' | 'oncePerBeat' | 'oncePerBar' | 'oncePerPhrase'
export type LaserDmxShowDirectorTriggerQuantize = 'none' | 'beat' | 'bar' | 'phrase' | 'section'
export type LaserDmxShowDirectorLedDirection = 'leftToRight' | 'rightToLeft' | 'centerOut' | 'edgesIn' | 'chase'
export type LaserDmxShowDirectorMovingHeadPanTiltStyle = 'locked' | 'smoothSweep' | 'snap' | 'figureEight' | 'audioReactive'
export type LaserDmxShowDirectorVideoWallSource = 'placeholder' | 'reactVisual' | 'media' | 'camera'
export type LaserDmxShowDirectorGoboPattern = 'open' | 'circle' | 'dots' | 'bars' | 'triangle' | 'star' | 'breakup' | 'radial' | 'grid'
export type LaserDmxShowDirectorDiffractionMode = 'none' | 'line' | 'grid' | 'burst'
export type LaserDmxShowDirectorMirrorAxis = 'horizontal' | 'vertical'
export type LaserDmxShowDirectorPresentationMode = 'edit' | 'hybrid' | 'live' | 'capture'
export type LaserDmxShowDirectorRendererMode = 'canvas2d' | 'webgl' | 'auto'
export type LaserDmxShowDirectorWebGLQuality = 'low' | 'medium' | 'high' | 'ultra' | 'auto'
export type LaserDmxShowDirectorOpticalPrimitiveType =
  | 'auto'
  | 'fan'
  | 'layeredFan'
  | 'parallelBank'
  | 'crossBank'
  | 'sheet'
  | 'tunnel'
  | 'canopy'
  | 'audienceRake'
  | 'diamondPlane'
  | 'mirroredCorridor'
  | 'rotatingLattice'
  | 'apertureBurst'
  | 'scannerWave'
  | 'washCone'
  | 'blinderBank'
  | 'strobeField'
  | 'co2Burst'
export type LaserDmxShowDirectorDepthLayer =
  | 'auto'
  | 'cameraFacingAir'
  | 'frontAir'
  | 'midAir'
  | 'deepAir'
  | 'upperAir'
  | 'lowerAir'


export type LaserDmxShowDirectorScannerPatternType =
  | 'holdBeam'
  | 'lineSweep'
  | 'fanSweep'
  | 'circle'
  | 'arc'
  | 'triangle'
  | 'polygon'
  | 'wave'
  | 'tunnel'
  | 'mirroredCorridor'
  | 'gridScan'
  | 'customPath'
  | 'diffractionLine'
  | 'diffractionGrid'
  | 'diffractionBurst'
export type LaserDmxShowDirectorScannerRepeatMode = 'loop' | 'pingPong' | 'once'
export type LaserDmxShowDirectorScannerDirection = 'forward' | 'reverse' | 'alternating'
export type LaserDmxShowDirectorScannerInterpolation = 'linear' | 'arc' | 'bezier'
export type LaserDmxShowDirectorScannerOpticalMode = 'normal' | 'prism' | 'lineDiffraction' | 'gridDiffraction' | 'burstDiffraction'
export type LaserDmxShowDirectorScannerMigrationStatus = 'native' | 'legacy' | 'previewed' | 'migrated'
export type LaserDmxShowDirectorScannerSwitchBoundary = 'immediate' | 'beat' | 'bar' | 'phrase' | 'section'

export interface LaserDmxShowDirectorScannerPathPoint {
  id: string
  x: number
  y: number
  z?: number
  depthLayer?: LaserDmxShowDirectorDepthLayer
  blanked: boolean
  dwellMicros: number
  cornerDwellMicros?: number
  intensity?: number
  color?: string
}

export interface LaserDmxShowDirectorScannerPathConfig {
  points: LaserDmxShowDirectorScannerPathPoint[]
  closed: boolean
  repeatMode: LaserDmxShowDirectorScannerRepeatMode
  interpolation: LaserDmxShowDirectorScannerInterpolation
  retraceBlanking: boolean
  blankingDelayMicros: number
  pointDwellMicros: number
  cornerDwellMicros: number
}

export interface LaserDmxShowDirectorScannerOpticsConfig {
  mode: LaserDmxShowDirectorScannerOpticalMode
  copyCount: number
  spreadDeg: number
  apertureCount: number
}

export interface LaserDmxShowDirectorScannerAdvancedConfig {
  maximumVelocity: number
  maximumAcceleration: number
  shutterExposureSeconds: number
  calibrationProfileId: string
}

export interface LaserDmxShowDirectorScannerMigrationMetadata {
  status: LaserDmxShowDirectorScannerMigrationStatus
  version: number
  sourceTargetIds: string[]
  ambiguous: boolean
  warnings: string[]
  backupTargets?: LaserDmxShowDirectorBeamTarget[]
}

export interface LaserDmxShowDirectorScannerConfig {
  schemaVersion: 1
  enabled: boolean
  patternType: LaserDmxShowDirectorScannerPatternType
  scanRatePps: number
  durationBeats: number
  direction: LaserDmxShowDirectorScannerDirection
  reversePath: boolean
  phase: number
  size: number
  fanWidth: number
  radius: number
  depthLayer: LaserDmxShowDirectorDepthLayer
  switchBoundary: LaserDmxShowDirectorScannerSwitchBoundary
  shutterClosed: boolean
  pathResetToken: number
  path: LaserDmxShowDirectorScannerPathConfig
  optics: LaserDmxShowDirectorScannerOpticsConfig
  advanced: LaserDmxShowDirectorScannerAdvancedConfig
  migration: LaserDmxShowDirectorScannerMigrationMetadata
}

export type LaserDmxShowDirectorMacroEffectFamily =
  | 'heldBeam'
  | 'steppedFan'
  | 'smoothFanSweep'
  | 'parallelSheet'
  | 'mirroredFan'
  | 'opposedFans'
  | 'crossingFans'
  | 'xFan'
  | 'centerOutFan'
  | 'outsideInFan'
  | 'tunnel'
  | 'corridor'
  | 'upperAirCanopy'
  | 'frontAirRake'
  | 'sequentialCircle'
  | 'arcSweep'
  | 'polygonOutline'
  | 'progressiveWave'
  | 'gridScan'
  | 'lineDiffraction'
  | 'gridDiffraction'
  | 'burstDiffraction'
  | 'movingHeadPositionLook'
  | 'movingHeadSweep'
  | 'movingHeadGoboLook'
  | 'washScene'
  | 'strobeAccent'
  | 'blinderImpact'
  | 'ledChase'
  | 'co2Impact'
  | 'mixedFixtureScene'

export type LaserDmxShowDirectorMacroSpacingCurve =
  | 'linear'
  | 'centerWeighted'
  | 'edgeWeighted'
  | 'symmetricEase'
  | 'custom'

export interface LaserDmxShowDirectorMacroScanPlan {
  schemaVersion: 1
  authoritative: true
  cueFrameId: string
  cueId: string
  macroId: string
  topologyId: string
  topologyRevision: number
  topologyCacheKey: string
  family: LaserDmxShowDirectorMacroEffectFamily
  assignmentId: string
  relationshipId?: string
  relationshipMode?: string
  fixtureMemberIndex: number
  fixtureMemberCount: number
  raySlots: number[]
  pathPointCount: number
  spacingCurve: LaserDmxShowDirectorMacroSpacingCurve
  traversal: 'sequential' | 'pingPong' | 'simultaneousOpticalCopies'
  centerX: number
  centerY: number
  depth: number
  width: number
  height: number
  radius: number
  rotationDeg: number
  fanSpreadDeg: number
  scanRatePps: number
  direction: LaserDmxShowDirectorScannerDirection
  phase: number
  pointDwellMicros: number
  cornerDwellMicros: number
  edgeDwellMicros: number
  blankingDelayMicros: number
  retraceBlanking: boolean
  blankBetweenSlots: boolean
  repeatMode: LaserDmxShowDirectorScannerRepeatMode
  interpolation: LaserDmxShowDirectorScannerInterpolation
  totalDutyCycle: number
  intensity: number
  colorBlend: number
  opticalMode: LaserDmxShowDirectorScannerOpticalMode
  opticalCopyCount: number
  opticalCopySpreadDeg: number
  apertureCount: number
  transitionType: string
  transitionProgress: number
  shutterClosed: boolean
  clearTemporalHistory: boolean
  preservePhase: boolean
  outputGateOpen?: boolean
  lifecycleState?: 'off' | 'attack' | 'movement' | 'hold' | 'release' | 'blackout'
  /** True only when the finite cue runtime is authoritatively changing pattern geometry. */
  patternAnimationActive?: boolean
  /** True only when the finite cue runtime is authoritatively changing fixture aim. */
  fixtureMovementActive?: boolean
  /** Deterministic finite-cue movement progress. Renderers must never advance it. */
  movementProgress?: number
  /** Cue-owned parameters retained for renderer diagnostics and history policy. */
  ownedParameters?: string[]
}

/**
 * Transient shutter authority resolved by the finite Show Director cue runtime.
 * This is deliberately separate from brightness: a closed gate emits no scanner
 * samples, fallback rays, glow, or temporal-history contribution.
 */
export interface LaserDmxShowDirectorRuntimeOutputGate {
  open: boolean
  reason: 'cue' | 'accent' | 'blackout' | 'unassigned' | 'constraint' | 'inactive'
  cueId: string | null
  lifecycleState: 'off' | 'attack' | 'movement' | 'hold' | 'release' | 'blackout'
  clearTemporalHistory: boolean
}

/** Transient high-level scanner controls reconstructed by the authoritative performance timeline. */
export interface LaserDmxShowDirectorScannerRuntimeOverrides {
  patternType?: LaserDmxShowDirectorScannerPatternType
  scanRatePps?: number
  durationBeats?: number
  direction?: LaserDmxShowDirectorScannerDirection
  reversePath?: boolean
  phase?: number
  fanWidth?: number
  radius?: number
  size?: number
  depthLayer?: LaserDmxShowDirectorDepthLayer
  retraceBlanking?: boolean
  opticalMode?: LaserDmxShowDirectorScannerOpticalMode
  opticalCopyCount?: number
  shutterClosed?: boolean
  heldBeam?: boolean
  pathResetToken?: number
  switchBoundary?: LaserDmxShowDirectorScannerSwitchBoundary
  authoritativeSource?: 'macro' | 'authored' | 'legacy'
  macroPlan?: LaserDmxShowDirectorMacroScanPlan
}

export const LASER_DMX_SHOW_DIRECTOR_DEPTH_LAYER_LABELS: Record<LaserDmxShowDirectorDepthLayer, string> = {
  auto: 'Auto',
  cameraFacingAir: 'Camera-Facing Air',
  frontAir: 'Front Air',
  midAir: 'Mid Air',
  deepAir: 'Deep Air',
  upperAir: 'Upper Air',
  lowerAir: 'Lower Air',
}

export const LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS = 24

export interface LaserDmxShowDirectorBeamTarget {
  id: string
  x:  number
  y:  number
  /** Optional continuous depth. Positive values are nearer the locked presentation camera. */
  z?: number
  /** Optional per-ray layer override. Most authored shows should leave this on auto. */
  depthLayer?: LaserDmxShowDirectorDepthLayer
}

export interface LaserDmxShowDirectorGridSize {
  columns: number
  rows:    number
}

export interface LaserDmxShowDirectorSettings {
  gridSize:          LaserDmxShowDirectorGridSize
  snapEnabled:       boolean
  showLabels:        boolean
  showBeams:         boolean
  showGrid:          boolean
  highlightFixtures: boolean
  zoom:              number
  presentationMode:  LaserDmxShowDirectorPresentationMode
  rendererMode:      LaserDmxShowDirectorRendererMode
  webglQuality:      LaserDmxShowDirectorWebGLQuality
  /** Atmosphere quality is independent from the full-resolution sharp-beam pass. */
  webglAtmosphereQuality?: LaserDmxShowDirectorWebGLQuality
  webglRenderScale:  number
}

export type LaserDmxShowDirectorSettingsPatch = Partial<Omit<LaserDmxShowDirectorSettings, 'gridSize'>> & {
  gridSize?: Partial<LaserDmxShowDirectorGridSize>
}

export interface LaserDmxShowDirectorBeamConfig {
  beamEnabled: boolean
  /** Direction in degrees on the 2D stage plane. */
  beamAngle:   number
  /** Cone/fan spread in degrees. 0 = tight beam. */
  beamSpread:  number
  /** 0 = soft/diffuse, 1 = sharp/tight. */
  focus:       number
  targetMode:  LaserDmxShowDirectorBeamTargetMode
  targetX?:    number
  targetY?:    number
  targetZ?:    number
  /** Coarse target depth override used by WebGL while the 2D editor remains unchanged. */
  targetDepthLayer?: LaserDmxShowDirectorDepthLayer
  /** Optional editable endpoint handles. targetX/targetY mirror the primary target for legacy project compatibility. */
  targets?:    LaserDmxShowDirectorBeamTarget[]
}

export interface LaserDmxShowDirectorTriggerConfig {
  mode:             LaserDmxShowDirectorTriggerMode
  quantize:         LaserDmxShowDirectorTriggerQuantize
  retrigger:        LaserDmxShowDirectorTriggerRetrigger
  beatDivision:     LaserDmxShowDirectorBeatDivision
  barInterval:      number
  phraseLengthBars: number
  sectionTypes:     LaserDmxShowDirectorSectionType[]
  cuePointIds:      string[]
  energyThreshold:  number
  audioBand:        LaserDmxShowDirectorAudioBand
  audioThreshold:   number
  fadeInMs:         number
  fadeOutMs:        number
}

export interface LaserDmxShowDirectorFixtureSpecificConfig {
  strobeRate:          number
  ledCellCount:        number
  ledDirection:        LaserDmxShowDirectorLedDirection
  movingHeadPanTiltStyle: LaserDmxShowDirectorMovingHeadPanTiltStyle
  hazeIntensity:       number
  co2BurstDurationMs:  number
  videoWallBrightness: number
  videoWallSource:     LaserDmxShowDirectorVideoWallSource
}

/**
 * High-level optical intent shared by WebGL and Canvas fallback compilation.
 * The inspector intentionally exposes only this compact surface instead of raw
 * shader uniforms or fixture-console jargon.
 */
export interface LaserDmxShowDirectorOpticsConfig {
  primitiveType: LaserDmxShowDirectorOpticalPrimitiveType
  rayCount: number
  fanWidth: number
  opticalSoftness: number
  sourceIntensity: number
  atmosphereResponse: number
  zoom: number
  iris: number
  frost: number
  prismFacets: 1 | 3 | 5
  goboAmount: number
  goboPattern: LaserDmxShowDirectorGoboPattern
  /** Authored base rotation in degrees. Runtime motion remains transport deterministic. */
  goboRotation: number
  /** Authored prism orientation in degrees. */
  prismRotation: number
  /** Explicit fixture-level diffraction. This remains off for normal single-beam scanners. */
  diffractionMode: LaserDmxShowDirectorDiffractionMode
  /** Total physical optical outputs, including the direct output. */
  diffractionCopies: number
  /** Restrained fixture-level RGB angular separation in degrees. */
  spectralSeparation: number
  /** Number of distinct emitter origins. */
  apertureCount: number
  /** Normalized physical spacing between multiple apertures. */
  apertureSpacing: number
}

export interface LaserDmxShowDirectorGroup {
  schemaVersion?: number
  id:    string
  /** Stable program-facing key; fixture/group IDs remain the persistence identity. */
  semanticKey?: string
  label: string
}

export interface LaserDmxShowDirectorFixture {
  schemaVersion?: number
  id:        string
  /** Stable program-facing key; fixture IDs remain unchanged and authoritative for editing. */
  semanticKey?: string
  kind:      LaserDmxShowDirectorFixtureKind
  label:     string
  enabled:   boolean
  x:         number
  y:         number
  z:         number
  /** Coarse fixture depth override. Auto invokes deterministic spatial inference. */
  depthLayer?: LaserDmxShowDirectorDepthLayer
  rotation:  number
  groupId:   string | null
  /** Shared ID for optional linked mirror pairs. Null/missing means this fixture is independent. */
  linkedPairId?: string | null
  /** Axis used by a linked mirror pair. Horizontal mirrors across the stage centerline left/right. */
  mirrorAxis?: LaserDmxShowDirectorMirrorAxis | null
  color:     string
  colorMode: LaserDmxShowDirectorColorMode
  brightness: number
  beam:      LaserDmxShowDirectorBeamConfig
  trigger:   LaserDmxShowDirectorTriggerConfig
  component: LaserDmxShowDirectorFixtureSpecificConfig
  optics: LaserDmxShowDirectorOpticsConfig
  /** Optional persistent physical scanner authoring. Missing means legacy targets remain readable and previewable. */
  scanner?: LaserDmxShowDirectorScannerConfig
  /** Transient high-level scanner override. Normalization intentionally omits this field. */
  runtimeScanner?: LaserDmxShowDirectorScannerRuntimeOverrides
  /** Transient finite-cue shutter authority. Normalization intentionally omits this field. */
  runtimeOutputGate?: LaserDmxShowDirectorRuntimeOutputGate
  /** Transient performance-program appearance override. Normalization intentionally omits this field. */
  runtimeBeamAppearance?: Partial<LaserDmxMatrixBeamAppearance>
  /** Transient performance-program renderer role. Normalization intentionally omits this field. */
  runtimeBeamVisualRole?: LaserDmxMatrixBeamVisualRole
  /** Transient performance-program travel override. Normalization intentionally omits this field. */
  runtimeBeamTravel?: Partial<LaserDmxBeamMotion>
}

export type LaserDmxShowDirectorFixturePatch = Partial<Omit<LaserDmxShowDirectorFixture, 'beam' | 'trigger' | 'component' | 'optics' | 'scanner' | 'runtimeScanner' | 'runtimeOutputGate'>> & {
  beam?:      Partial<LaserDmxShowDirectorBeamConfig>
  trigger?:   Partial<LaserDmxShowDirectorTriggerConfig>
  component?: Partial<LaserDmxShowDirectorFixtureSpecificConfig>
  optics?:    Partial<LaserDmxShowDirectorOpticsConfig>
  scanner?:   LaserDmxShowDirectorScannerConfig
}

export interface LaserDmxShowDirectorState {
  schemaVersion?: number
  /** Starter layout source retained so the preset browser can show selected/modified state. */
  sourceTemplateId?: string | null
  groups:             LaserDmxShowDirectorGroup[]
  fixtures:           LaserDmxShowDirectorFixture[]
  selectedFixtureId:  string | null
  /** Multi-selection IDs. selectedFixtureId remains the primary selection for legacy/single-fixture inspector flows. */
  selectedFixtureIds: string[]
  settings:           LaserDmxShowDirectorSettings
}

const SHOW_DIRECTOR_BEAM_FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser',
  'movingHead',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'parWash',
])

export const DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS: LaserDmxShowDirectorSettings = {
  gridSize:          { columns: 15, rows: 10 },
  snapEnabled:       true,
  showLabels:        true,
  showBeams:         true,
  showGrid:          true,
  highlightFixtures: true,
  zoom:              1,
  presentationMode:  'edit',
  rendererMode:      'auto',
  webglQuality:      'high',
  webglAtmosphereQuality: 'auto',
  webglRenderScale:  1,
}

export const DEFAULT_LASER_DMX_SHOW_DIRECTOR_TRIGGER: LaserDmxShowDirectorTriggerConfig = {
  mode:             'alwaysOn',
  quantize:         'beat',
  retrigger:        'allow',
  beatDivision:     1,
  barInterval:      1,
  phraseLengthBars: 8,
  sectionTypes:     ['drop'],
  cuePointIds:      [],
  energyThreshold:  0.7,
  audioBand:        'bass',
  audioThreshold:   0.65,
  fadeInMs:         0,
  fadeOutMs:        0,
}

export const DEFAULT_LASER_DMX_SHOW_DIRECTOR_COMPONENT: LaserDmxShowDirectorFixtureSpecificConfig = {
  strobeRate:          8,
  ledCellCount:        8,
  ledDirection:        'leftToRight',
  movingHeadPanTiltStyle: 'smoothSweep',
  hazeIntensity:       0.5,
  co2BurstDurationMs:  350,
  videoWallBrightness: 0.85,
  videoWallSource:     'placeholder',
}

export const DEFAULT_LASER_DMX_SHOW_DIRECTOR_OPTICS: LaserDmxShowDirectorOpticsConfig = {
  primitiveType: 'auto',
  rayCount: 7,
  fanWidth: 52,
  opticalSoftness: 0.18,
  sourceIntensity: 0.86,
  atmosphereResponse: 0.78,
  zoom: 0.45,
  iris: 1,
  frost: 0,
  prismFacets: 1,
  goboAmount: 0,
  goboPattern: 'open',
  goboRotation: 0,
  prismRotation: 0,
  diffractionMode: 'none',
  diffractionCopies: 1,
  spectralSeparation: 0,
  apertureCount: 1,
  apertureSpacing: 0.012,
}

function showDirectorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function showDirectorFinite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  return Number.isFinite(candidate) ? candidate : fallback
}

function showDirectorBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function coerceShowDirectorPresentationMode(value: unknown): LaserDmxShowDirectorPresentationMode {
  return value === 'hybrid' || value === 'live' || value === 'capture' ? value : 'edit'
}

function coerceShowDirectorRendererMode(value: unknown): LaserDmxShowDirectorRendererMode {
  if (value === 'canvas2d' || value === 'webgl' || value === 'auto') return value
  // Missing or invalid legacy values migrate to capability-aware WebGL-first Auto.
  return 'auto'
}

function coerceShowDirectorWebGLQuality(value: unknown): LaserDmxShowDirectorWebGLQuality {
  return value === 'low' || value === 'medium' || value === 'ultra' || value === 'auto' ? value : 'high'
}

export function coerceLaserDmxShowDirectorDepthLayer(value: unknown): LaserDmxShowDirectorDepthLayer {
  return value === 'cameraFacingAir'
    || value === 'frontAir'
    || value === 'midAir'
    || value === 'deepAir'
    || value === 'upperAir'
    || value === 'lowerAir'
    ? value
    : 'auto'
}

function showDirectorString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function showDirectorStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function showDirectorTargetId(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim() : ''
  return candidate.length > 0 ? candidate : fallback
}

function showDirectorSafeIdSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'group'
}

export function showDirectorSafeSemanticKey(value: unknown, fallback = 'fixture'): string {
  const candidate = typeof value === 'string' ? value : ''
  return candidate.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || fallback
}

function reserveShowDirectorSemanticKey(base: string, used: Set<string>): string {
  let key = base.slice(0, 64)
  let suffix = 2
  while (used.has(key)) {
    const suffixText = `-${suffix}`
    key = `${base.slice(0, Math.max(1, 64 - suffixText.length))}${suffixText}`
    suffix += 1
  }
  used.add(key)
  return key
}

function createShowDirectorGroupIdFromLabel(label: string, index: number): string {
  return `show-director-group-${showDirectorSafeIdSegment(label)}-${index + 1}`
}

function showDirectorGroupLabel(value: unknown, fallback: string): string {
  return showDirectorString(value, fallback).slice(0, 48)
}

function showDirectorMs(value: unknown, fallback: number, max = 10000): number {
  return Math.max(0, Math.min(max, Math.round(showDirectorFinite(value, fallback))))
}

function showDirectorUnit(value: unknown, fallback: number): number {
  return Math.max(0, Math.min(1, showDirectorFinite(value, fallback)))
}

function showDirectorPositiveInt(value: unknown, fallback: number, min = 1, max = 128): number {
  return Math.max(min, Math.min(max, Math.round(showDirectorFinite(value, fallback))))
}

export function isLaserDmxShowDirectorFixtureKind(value: unknown): value is LaserDmxShowDirectorFixtureKind {
  return typeof value === 'string' && LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.includes(value as LaserDmxShowDirectorFixtureKind)
}

function coerceShowDirectorColorMode(value: unknown): LaserDmxShowDirectorColorMode {
  return value === 'palette' || value === 'music' || value === 'fixtureDefault' ? value : 'fixed'
}

function coerceShowDirectorTargetMode(value: unknown): LaserDmxShowDirectorBeamTargetMode {
  if (value === 'fan' || value === 'sweep' || value === 'cross' || value === 'mirror' || value === 'audioReactive') return value
  // Earlier projects used forward/stageCenter/customPoint/musicReactive. They all recover into a safe, editable target mode.
  if (value === 'musicReactive') return 'audioReactive'
  return 'fixed'
}

function coerceShowDirectorTriggerMode(value: unknown): LaserDmxShowDirectorTriggerMode {
  if (value === 'beat'
    || value === 'bar'
    || value === 'phrase'
    || value === 'section'
    || value === 'cuePoint'
    || value === 'bassHit'
    || value === 'snareTransient'
    || value === 'energy'
    || value === 'audioBand') return value
  return 'alwaysOn'
}

function coerceShowDirectorAudioBand(value: unknown): LaserDmxShowDirectorAudioBand {
  return value === 'sub' || value === 'lowMid' || value === 'mid' || value === 'highMid' || value === 'high'
    ? value
    : 'bass'
}

function coerceShowDirectorTriggerRetrigger(value: unknown): LaserDmxShowDirectorTriggerRetrigger {
  return value === 'oncePerBeat' || value === 'oncePerBar' || value === 'oncePerPhrase' ? value : 'allow'
}

function coerceShowDirectorTriggerQuantize(value: unknown): LaserDmxShowDirectorTriggerQuantize {
  return value === 'none' || value === 'bar' || value === 'phrase' || value === 'section' ? value : 'beat'
}

function coerceShowDirectorBeatDivision(value: unknown): LaserDmxShowDirectorBeatDivision {
  if (value === '1/4' || value === 'quarter') return 0.25
  if (value === '1/2' || value === 'half') return 0.5
  const candidate = showDirectorFinite(value, 1)
  if (candidate === 0.25 || candidate === 0.5 || candidate === 2 || candidate === 4 || candidate === 8) return candidate
  // Earlier projects stored 16 as the fastest supported division. Clamp it into the current public range.
  if (candidate >= 8) return 8
  return 1
}

function coerceShowDirectorSectionType(value: unknown): LaserDmxShowDirectorSectionType | null {
  return value === 'intro'
    || value === 'verse'
    || value === 'build'
    || value === 'preDrop'
    || value === 'drop'
    || value === 'breakdown'
    || value === 'bridge'
    || value === 'outro'
    || value === 'unknown'
    ? value
    : null
}

function coerceShowDirectorSectionTypes(value: unknown): LaserDmxShowDirectorSectionType[] {
  const sections = showDirectorStringArray(value).flatMap(section => {
    const normalized = coerceShowDirectorSectionType(section)
    return normalized ? [normalized] : []
  })
  return sections.length ? sections : ['drop']
}

function coerceShowDirectorLedDirection(value: unknown): LaserDmxShowDirectorLedDirection {
  return value === 'rightToLeft' || value === 'centerOut' || value === 'edgesIn' || value === 'chase'
    ? value
    : 'leftToRight'
}

function coerceShowDirectorMovingHeadPanTiltStyle(value: unknown): LaserDmxShowDirectorMovingHeadPanTiltStyle {
  return value === 'locked' || value === 'snap' || value === 'figureEight' || value === 'audioReactive'
    ? value
    : 'smoothSweep'
}

function coerceShowDirectorVideoWallSource(value: unknown): LaserDmxShowDirectorVideoWallSource {
  return value === 'reactVisual' || value === 'media' || value === 'camera' ? value : 'placeholder'
}

function coerceShowDirectorGoboPattern(value: unknown): LaserDmxShowDirectorGoboPattern {
  return value === 'circle'
    || value === 'dots'
    || value === 'bars'
    || value === 'triangle'
    || value === 'star'
    || value === 'breakup'
    || value === 'radial'
    || value === 'grid'
    ? value
    : 'open'
}

function coerceShowDirectorDiffractionMode(value: unknown): LaserDmxShowDirectorDiffractionMode {
  return value === 'line' || value === 'grid' || value === 'burst' ? value : 'none'
}

function coerceShowDirectorOpticalPrimitiveType(value: unknown): LaserDmxShowDirectorOpticalPrimitiveType {
  return value === 'fan'
    || value === 'layeredFan'
    || value === 'parallelBank'
    || value === 'crossBank'
    || value === 'sheet'
    || value === 'tunnel'
    || value === 'canopy'
    || value === 'audienceRake'
    || value === 'diamondPlane'
    || value === 'mirroredCorridor'
    || value === 'rotatingLattice'
    || value === 'apertureBurst'
    || value === 'scannerWave'
    || value === 'washCone'
    || value === 'blinderBank'
    || value === 'strobeField'
    || value === 'co2Burst'
    ? value
    : 'auto'
}

function coerceShowDirectorMirrorAxis(value: unknown): LaserDmxShowDirectorMirrorAxis | null {
  return value === 'vertical' || value === 'horizontal' ? value : null
}

function createDefaultLaserDmxShowDirectorBeamConfig(kind: LaserDmxShowDirectorFixtureKind): LaserDmxShowDirectorBeamConfig {
  return {
    beamEnabled: SHOW_DIRECTOR_BEAM_FIXTURE_KINDS.has(kind),
    beamAngle:   kind === 'movingHead' ? -90 : 0,
    beamSpread:  kind === 'laser' ? 18 : kind === 'parWash' ? 55 : 0,
    focus:       kind === 'parWash' ? 0.45 : 0.8,
    targetMode:  kind === 'laser' ? 'fan' : 'fixed',
    targetX:     Math.floor(DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.columns / 2),
    targetY:     Math.floor(DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.rows / 2),
    targetZ:     0,
    targetDepthLayer: 'auto',
    targets:    [{
      id: 'target-1',
      x:  Math.floor(DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.columns / 2),
      y:  Math.floor(DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.rows / 2),
    }],
  }
}

function clampDefaultShowDirectorCoordinate(value: number, max: number): number {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0))
}

function createDefaultLaserDmxShowDirectorBeamEndpoint(
  kind: LaserDmxShowDirectorFixtureKind,
  x: number,
  y: number,
  rotation = 0,
): { targetX: number; targetY: number } {
  const fallbackBeam = createDefaultLaserDmxShowDirectorBeamConfig(kind)
  const columns = DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.columns
  const rows = DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.rows
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const distance = Math.max(2, Math.min(columns, rows) * 0.32)
  const radians = (rotation + fallbackBeam.beamAngle) * Math.PI / 180
  return {
    targetX: Math.round(clampDefaultShowDirectorCoordinate(x + Math.cos(radians) * distance, maxX)),
    targetY: Math.round(clampDefaultShowDirectorCoordinate(y + Math.sin(radians) * distance, maxY)),
  }
}

function createDefaultLaserDmxShowDirectorTriggerConfig(kind: LaserDmxShowDirectorFixtureKind): LaserDmxShowDirectorTriggerConfig {
  const fallback: LaserDmxShowDirectorTriggerConfig = {
    ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_TRIGGER,
    sectionTypes: [...DEFAULT_LASER_DMX_SHOW_DIRECTOR_TRIGGER.sectionTypes],
    cuePointIds: [],
  }

  switch (kind) {
    case 'laser':
      return { ...fallback, mode: 'section', quantize: 'section', sectionTypes: ['drop'], fadeInMs: 120, fadeOutMs: 380 }
    case 'movingHead':
      return { ...fallback, mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 1, fadeOutMs: 220, sectionTypes: ['drop'] }
    case 'ledBar':
      return { ...fallback, mode: 'beat', quantize: 'beat', retrigger: 'oncePerBeat', beatDivision: 1, fadeOutMs: 140 }
    case 'ledTube':
      return { ...fallback, mode: 'beat', quantize: 'beat', retrigger: 'oncePerBeat', beatDivision: 1, fadeOutMs: 140 }
    case 'strobe':
      return { ...fallback, mode: 'snareTransient', quantize: 'none', retrigger: 'allow', audioBand: 'highMid', audioThreshold: 0.58, fadeOutMs: 120 }
    case 'blinder':
      return { ...fallback, mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 4, fadeOutMs: 360, sectionTypes: ['drop'] }
    case 'parWash':
      return { ...fallback, mode: 'energy', quantize: 'none', energyThreshold: 0.7, fadeInMs: 180, fadeOutMs: 420 }
    case 'haze':
      return { ...fallback, mode: 'alwaysOn', fadeInMs: 600, fadeOutMs: 1200 }
    case 'co2Jet':
      return { ...fallback, mode: 'cuePoint', quantize: 'bar', retrigger: 'oncePerBar', cuePointIds: ['drop'], fadeOutMs: 450 }
    case 'videoWall':
      return { ...fallback, mode: 'section', quantize: 'section', sectionTypes: ['drop'], fadeInMs: 120, fadeOutMs: 380 }
    default:
      return fallback
  }
}

export function createDefaultLaserDmxShowDirectorFixture(
  kind: LaserDmxShowDirectorFixtureKind,
  id: string,
  index = 0,
): LaserDmxShowDirectorFixture {
  const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]
  const column = index % DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.columns
  const row = Math.floor(index / DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize.columns)
  const beam = createDefaultLaserDmxShowDirectorBeamConfig(kind)
  const defaultEndpoint = createDefaultLaserDmxShowDirectorBeamEndpoint(kind, column, row)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    id,
    semanticKey: showDirectorSafeSemanticKey(`${label}-${index + 1}`, `${kind}-${index + 1}`),
    kind,
    label: `${label} ${index + 1}`,
    enabled: true,
    x: column,
    y: row,
    z: 0,
    depthLayer: 'auto',
    rotation: 0,
    groupId: null,
    linkedPairId: null,
    mirrorAxis: null,
    color: '#4ac7db',
    colorMode: 'fixed',
    brightness: 0.85,
    beam: { ...beam, ...defaultEndpoint },
    trigger: createDefaultLaserDmxShowDirectorTriggerConfig(kind),
    component: { ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_COMPONENT },
    optics: {
      ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_OPTICS,
      primitiveType: 'auto',
      rayCount: kind === 'laser' ? 7 : 1,
      fanWidth: beam.beamSpread,
      opticalSoftness: kind === 'laser' ? 0.08 : kind === 'movingHead' ? 0.34 : kind === 'parWash' ? 0.72 : 0.28,
      sourceIntensity: kind === 'blinder' || kind === 'strobe' ? 1 : 0.86,
      atmosphereResponse: kind === 'laser' ? 0.86 : kind === 'movingHead' || kind === 'parWash' ? 0.92 : 0.68,
      zoom: kind === 'movingHead' ? 0.42 : kind === 'parWash' ? 0.78 : 0.28,
    },
  }
}

export function createDefaultLaserDmxShowDirectorState(): LaserDmxShowDirectorState {
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    sourceTemplateId: null,
    groups: [],
    fixtures: [],
    selectedFixtureId: null,
    selectedFixtureIds: [],
    settings: {
      ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS,
      gridSize: { ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize },
    },
  }
}

export function normalizeLaserDmxShowDirectorSettings(raw: unknown): LaserDmxShowDirectorSettings {
  const fallback = DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS
  const value = showDirectorRecord(raw) ? raw : {}
  const rawGrid = showDirectorRecord(value.gridSize) ? value.gridSize : {}
  return {
    gridSize: {
      columns: showDirectorPositiveInt(rawGrid.columns, fallback.gridSize.columns, 1, 64),
      rows:    showDirectorPositiveInt(rawGrid.rows,    fallback.gridSize.rows,    1, 64),
    },
    snapEnabled: showDirectorBoolean(value.snapEnabled, fallback.snapEnabled),
    showLabels:        showDirectorBoolean(value.showLabels,        fallback.showLabels),
    showBeams:         showDirectorBoolean(value.showBeams,         fallback.showBeams),
    showGrid:          showDirectorBoolean(value.showGrid,          fallback.showGrid),
    highlightFixtures: showDirectorBoolean(value.highlightFixtures, fallback.highlightFixtures),
    zoom:              Math.max(0.25, Math.min(4, showDirectorFinite(value.zoom, fallback.zoom))),
    presentationMode:  coerceShowDirectorPresentationMode(value.presentationMode),
    rendererMode:      coerceShowDirectorRendererMode(value.rendererMode),
    webglQuality:      coerceShowDirectorWebGLQuality(value.webglQuality),
    webglAtmosphereQuality: coerceShowDirectorWebGLQuality(value.webglAtmosphereQuality ?? fallback.webglAtmosphereQuality),
    webglRenderScale:  Math.max(0.25, Math.min(1, showDirectorFinite(value.webglRenderScale, fallback.webglRenderScale))),
  }
}

export function normalizeLaserDmxShowDirectorGroup(raw: unknown, index = 0): LaserDmxShowDirectorGroup {
  const value = showDirectorRecord(raw) ? raw : {}
  const fallbackLabel = `Group ${index + 1}`
  const label = showDirectorGroupLabel(value.label ?? value.name, fallbackLabel)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    id: showDirectorTargetId(value.id, createShowDirectorGroupIdFromLabel(label, index)),
    semanticKey: showDirectorSafeSemanticKey(value.semanticKey ?? label, `group-${index + 1}`),
    label,
  }
}

function normalizeLaserDmxShowDirectorBeamTargets(
  raw: unknown,
  primary: { x: number; y: number; z?: number; depthLayer?: LaserDmxShowDirectorDepthLayer },
  fixtureId: string,
): LaserDmxShowDirectorBeamTarget[] {
  const primaryTarget: LaserDmxShowDirectorBeamTarget = {
    id: `${fixtureId}-target-1`,
    x:  showDirectorFinite(primary.x, 0),
    y:  showDirectorFinite(primary.y, 0),
    ...(primary.z == null ? {} : { z: Math.max(-1, Math.min(1, showDirectorFinite(primary.z, 0))) }),
    ...(primary.depthLayer == null ? {} : { depthLayer: coerceLaserDmxShowDirectorDepthLayer(primary.depthLayer) }),
  }

  if (!Array.isArray(raw)) return [primaryTarget]

  const targets = raw
    .filter(showDirectorRecord)
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index): LaserDmxShowDirectorBeamTarget => ({
      id: showDirectorTargetId(target.id, `${fixtureId}-target-${index + 1}`),
      x:  showDirectorFinite(target.x, primaryTarget.x),
      y:  showDirectorFinite(target.y, primaryTarget.y),
      ...(target.z == null ? {} : { z: Math.max(-1, Math.min(1, showDirectorFinite(target.z, primaryTarget.z ?? 0))) }),
      ...(target.depthLayer == null ? {} : { depthLayer: coerceLaserDmxShowDirectorDepthLayer(target.depthLayer) }),
    }))

  if (targets.length === 0) return [primaryTarget]

  return [
    {
      ...targets[0],
      x: primaryTarget.x,
      y: primaryTarget.y,
      ...(primaryTarget.z == null ? {} : { z: primaryTarget.z }),
      ...(primaryTarget.depthLayer == null ? {} : { depthLayer: primaryTarget.depthLayer }),
    },
    ...targets.slice(1),
  ]
}

function normalizeLaserDmxShowDirectorBeamConfig(raw: unknown, kind: LaserDmxShowDirectorFixtureKind): LaserDmxShowDirectorBeamConfig {
  const fallback = createDefaultLaserDmxShowDirectorBeamConfig(kind)
  const value = showDirectorRecord(raw) ? raw : {}
  return {
    beamEnabled: showDirectorBoolean(value.beamEnabled, fallback.beamEnabled),
    beamAngle:   Math.max(-360, Math.min(360, showDirectorFinite(value.beamAngle, fallback.beamAngle))),
    beamSpread:  Math.max(0, Math.min(180, showDirectorFinite(value.beamSpread, fallback.beamSpread))),
    focus:       showDirectorUnit(value.focus, fallback.focus),
    targetMode:  coerceShowDirectorTargetMode(value.targetMode),
    targetX:     showDirectorFinite(value.targetX, fallback.targetX ?? 0),
    targetY:     showDirectorFinite(value.targetY, fallback.targetY ?? 0),
    targetZ:     Math.max(-1, Math.min(1, showDirectorFinite(value.targetZ, fallback.targetZ ?? 0))),
    targetDepthLayer: coerceLaserDmxShowDirectorDepthLayer(value.targetDepthLayer),
  }
}

function normalizeLaserDmxShowDirectorTriggerConfig(raw: unknown, kind: LaserDmxShowDirectorFixtureKind): LaserDmxShowDirectorTriggerConfig {
  const fallback = createDefaultLaserDmxShowDirectorTriggerConfig(kind)
  const value = showDirectorRecord(raw) ? raw : {}
  const sectionTypes = coerceShowDirectorSectionTypes(value.sectionTypes)
  const cuePointIds = showDirectorStringArray(value.cuePointIds).slice(0, 16)
  return {
    mode:             value.mode == null ? fallback.mode : coerceShowDirectorTriggerMode(value.mode),
    quantize:         value.quantize == null ? fallback.quantize : coerceShowDirectorTriggerQuantize(value.quantize),
    retrigger:        value.retrigger == null ? fallback.retrigger : coerceShowDirectorTriggerRetrigger(value.retrigger),
    beatDivision:     value.beatDivision == null ? fallback.beatDivision : coerceShowDirectorBeatDivision(value.beatDivision),
    barInterval:      showDirectorPositiveInt(value.barInterval, fallback.barInterval, 1, 64),
    phraseLengthBars: showDirectorPositiveInt(value.phraseLengthBars, fallback.phraseLengthBars, 1, 128),
    sectionTypes:     sectionTypes.length > 0 ? sectionTypes : [...fallback.sectionTypes],
    cuePointIds:      cuePointIds.length > 0 ? cuePointIds : [...fallback.cuePointIds],
    energyThreshold:  showDirectorUnit(value.energyThreshold, fallback.energyThreshold),
    audioBand:        value.audioBand == null ? fallback.audioBand : coerceShowDirectorAudioBand(value.audioBand),
    audioThreshold:   showDirectorUnit(value.audioThreshold, fallback.audioThreshold),
    fadeInMs:         showDirectorMs(value.fadeInMs, fallback.fadeInMs),
    fadeOutMs:        showDirectorMs(value.fadeOutMs, fallback.fadeOutMs),
  }
}

function normalizeLaserDmxShowDirectorComponentConfig(raw: unknown): LaserDmxShowDirectorFixtureSpecificConfig {
  const fallback = DEFAULT_LASER_DMX_SHOW_DIRECTOR_COMPONENT
  const value = showDirectorRecord(raw) ? raw : {}
  return {
    strobeRate:          Math.max(0, Math.min(30, showDirectorFinite(value.strobeRate, fallback.strobeRate))),
    ledCellCount:        showDirectorPositiveInt(value.ledCellCount, fallback.ledCellCount, 1, 64),
    ledDirection:        coerceShowDirectorLedDirection(value.ledDirection),
    movingHeadPanTiltStyle: coerceShowDirectorMovingHeadPanTiltStyle(value.movingHeadPanTiltStyle),
    hazeIntensity:       showDirectorUnit(value.hazeIntensity, fallback.hazeIntensity),
    co2BurstDurationMs:  showDirectorMs(value.co2BurstDurationMs, fallback.co2BurstDurationMs, 10000),
    videoWallBrightness: showDirectorUnit(value.videoWallBrightness, fallback.videoWallBrightness),
    videoWallSource:     coerceShowDirectorVideoWallSource(value.videoWallSource),
  }
}

function normalizeLaserDmxShowDirectorOpticsConfig(
  raw: unknown,
  kind: LaserDmxShowDirectorFixtureKind,
  beam: LaserDmxShowDirectorBeamConfig,
): LaserDmxShowDirectorOpticsConfig {
  const fallback = createDefaultLaserDmxShowDirectorFixture(kind, 'optics-fallback', 0).optics
  const value = showDirectorRecord(raw) ? raw : {}
  const prism = showDirectorPositiveInt(value.prismFacets, fallback.prismFacets, 1, 5)
  return {
    primitiveType: coerceShowDirectorOpticalPrimitiveType(value.primitiveType),
    rayCount: showDirectorPositiveInt(value.rayCount, fallback.rayCount, 1, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS),
    fanWidth: Math.max(0, Math.min(180, showDirectorFinite(value.fanWidth, beam.beamSpread || fallback.fanWidth))),
    opticalSoftness: showDirectorUnit(value.opticalSoftness, fallback.opticalSoftness),
    sourceIntensity: showDirectorUnit(value.sourceIntensity, fallback.sourceIntensity),
    atmosphereResponse: showDirectorUnit(value.atmosphereResponse, fallback.atmosphereResponse),
    zoom: showDirectorUnit(value.zoom, fallback.zoom),
    iris: showDirectorUnit(value.iris, fallback.iris),
    frost: showDirectorUnit(value.frost, fallback.frost),
    prismFacets: prism >= 5 ? 5 : prism >= 3 ? 3 : 1,
    goboAmount: showDirectorUnit(value.goboAmount, fallback.goboAmount),
    goboPattern: coerceShowDirectorGoboPattern(value.goboPattern),
    goboRotation: Math.max(-360, Math.min(360, showDirectorFinite(value.goboRotation, fallback.goboRotation))),
    prismRotation: Math.max(-360, Math.min(360, showDirectorFinite(value.prismRotation, fallback.prismRotation))),
    diffractionMode: coerceShowDirectorDiffractionMode(value.diffractionMode),
    diffractionCopies: showDirectorPositiveInt(value.diffractionCopies, fallback.diffractionCopies, 1, 25),
    spectralSeparation: Math.max(0, Math.min(1.2, showDirectorFinite(value.spectralSeparation, fallback.spectralSeparation))),
    apertureCount: showDirectorPositiveInt(value.apertureCount, fallback.apertureCount, 1, 8),
    apertureSpacing: Math.max(0, Math.min(0.08, showDirectorFinite(value.apertureSpacing, fallback.apertureSpacing))),
  }
}


function coerceShowDirectorScannerPatternType(value: unknown): LaserDmxShowDirectorScannerPatternType {
  return value === 'lineSweep' || value === 'fanSweep' || value === 'circle' || value === 'arc'
    || value === 'triangle' || value === 'polygon' || value === 'wave' || value === 'tunnel'
    || value === 'mirroredCorridor' || value === 'gridScan' || value === 'customPath'
    || value === 'diffractionLine' || value === 'diffractionGrid' || value === 'diffractionBurst'
    ? value
    : 'holdBeam'
}

function coerceShowDirectorScannerRepeatMode(value: unknown): LaserDmxShowDirectorScannerRepeatMode {
  return value === 'pingPong' || value === 'once' ? value : 'loop'
}

function coerceShowDirectorScannerDirection(value: unknown): LaserDmxShowDirectorScannerDirection {
  return value === 'reverse' || value === 'alternating' ? value : 'forward'
}

function coerceShowDirectorScannerInterpolation(value: unknown): LaserDmxShowDirectorScannerInterpolation {
  return value === 'arc' || value === 'bezier' ? value : 'linear'
}

function coerceShowDirectorScannerOpticalMode(value: unknown): LaserDmxShowDirectorScannerOpticalMode {
  return value === 'prism' || value === 'lineDiffraction' || value === 'gridDiffraction' || value === 'burstDiffraction'
    ? value
    : 'normal'
}

function coerceShowDirectorScannerSwitchBoundary(value: unknown): LaserDmxShowDirectorScannerSwitchBoundary {
  return value === 'beat' || value === 'bar' || value === 'phrase' || value === 'section' ? value : 'immediate'
}

function normalizeLaserDmxShowDirectorScannerConfig(raw: unknown, fixtureId: string): LaserDmxShowDirectorScannerConfig | undefined {
  if (!showDirectorRecord(raw)) return undefined
  const rawPath = showDirectorRecord(raw.path) ? raw.path : {}
  const rawOptics = showDirectorRecord(raw.optics) ? raw.optics : {}
  const rawAdvanced = showDirectorRecord(raw.advanced) ? raw.advanced : {}
  const rawMigration = showDirectorRecord(raw.migration) ? raw.migration : {}
  const points = Array.isArray(rawPath.points)
    ? rawPath.points.slice(0, 256).flatMap((candidate, index): LaserDmxShowDirectorScannerPathPoint[] => {
      if (!showDirectorRecord(candidate)) return []
      return [{
        id: showDirectorTargetId(candidate.id, `${fixtureId}-scan-point-${index + 1}`),
        x: showDirectorFinite(candidate.x, 0),
        y: showDirectorFinite(candidate.y, 0),
        ...(candidate.z == null ? {} : { z: Math.max(-1, Math.min(1, showDirectorFinite(candidate.z, 0))) }),
        ...(candidate.depthLayer == null ? {} : { depthLayer: coerceLaserDmxShowDirectorDepthLayer(candidate.depthLayer) }),
        blanked: showDirectorBoolean(candidate.blanked, false),
        dwellMicros: Math.max(0, Math.min(1_000_000, showDirectorFinite(candidate.dwellMicros, 0))),
        ...(candidate.cornerDwellMicros == null ? {} : { cornerDwellMicros: Math.max(0, Math.min(1_000_000, showDirectorFinite(candidate.cornerDwellMicros, 64))) }),
        ...(candidate.intensity == null ? {} : { intensity: showDirectorUnit(candidate.intensity, 1) }),
        ...(typeof candidate.color === 'string' && candidate.color.trim() ? { color: candidate.color.trim() } : {}),
      }]
    })
    : []
  const status: LaserDmxShowDirectorScannerMigrationStatus = rawMigration.status === 'legacy'
    || rawMigration.status === 'previewed'
    || rawMigration.status === 'migrated'
    ? rawMigration.status
    : 'native'
  const backupPrimaryCandidate = Array.isArray(rawMigration.backupTargets) && showDirectorRecord(rawMigration.backupTargets[0])
    ? rawMigration.backupTargets[0]
    : null
  const backupTargets = Array.isArray(rawMigration.backupTargets)
    ? normalizeLaserDmxShowDirectorBeamTargets(rawMigration.backupTargets, {
      x: showDirectorFinite(backupPrimaryCandidate?.x, 0),
      y: showDirectorFinite(backupPrimaryCandidate?.y, 0),
      ...(backupPrimaryCandidate?.z == null ? {} : { z: showDirectorFinite(backupPrimaryCandidate.z, 0) }),
      ...(backupPrimaryCandidate?.depthLayer == null ? {} : { depthLayer: coerceLaserDmxShowDirectorDepthLayer(backupPrimaryCandidate.depthLayer) }),
    }, `${fixtureId}-scanner-backup`)
    : undefined
  return {
    schemaVersion: 1,
    enabled: showDirectorBoolean(raw.enabled, true),
    patternType: coerceShowDirectorScannerPatternType(raw.patternType),
    scanRatePps: Math.max(10, Math.min(100_000, showDirectorFinite(raw.scanRatePps, 24_000))),
    durationBeats: Math.max(0.0625, Math.min(128, showDirectorFinite(raw.durationBeats, 1))),
    direction: coerceShowDirectorScannerDirection(raw.direction),
    reversePath: showDirectorBoolean(raw.reversePath, false),
    phase: showDirectorUnit(raw.phase, 0),
    size: showDirectorUnit(raw.size, 0.5),
    fanWidth: Math.max(0, Math.min(180, showDirectorFinite(raw.fanWidth, 52))),
    radius: showDirectorUnit(raw.radius, 0.24),
    depthLayer: coerceLaserDmxShowDirectorDepthLayer(raw.depthLayer),
    switchBoundary: coerceShowDirectorScannerSwitchBoundary(raw.switchBoundary),
    shutterClosed: showDirectorBoolean(raw.shutterClosed, false),
    pathResetToken: Math.max(0, Math.round(showDirectorFinite(raw.pathResetToken, 0))),
    path: {
      points,
      closed: showDirectorBoolean(rawPath.closed, false),
      repeatMode: coerceShowDirectorScannerRepeatMode(rawPath.repeatMode),
      interpolation: coerceShowDirectorScannerInterpolation(rawPath.interpolation),
      retraceBlanking: showDirectorBoolean(rawPath.retraceBlanking, true),
      blankingDelayMicros: Math.max(0, Math.min(100_000, showDirectorFinite(rawPath.blankingDelayMicros, 18))),
      pointDwellMicros: Math.max(0, Math.min(1_000_000, showDirectorFinite(rawPath.pointDwellMicros, 24))),
      cornerDwellMicros: Math.max(0, Math.min(1_000_000, showDirectorFinite(rawPath.cornerDwellMicros, 64))),
    },
    optics: {
      mode: coerceShowDirectorScannerOpticalMode(rawOptics.mode),
      copyCount: showDirectorPositiveInt(rawOptics.copyCount, 1, 1, 25),
      spreadDeg: Math.max(0, Math.min(90, showDirectorFinite(rawOptics.spreadDeg, 8))),
      apertureCount: showDirectorPositiveInt(rawOptics.apertureCount, 1, 1, 8),
    },
    advanced: {
      maximumVelocity: Math.max(1, Math.min(100_000, showDirectorFinite(rawAdvanced.maximumVelocity, 18_000))),
      maximumAcceleration: Math.max(1, Math.min(10_000_000, showDirectorFinite(rawAdvanced.maximumAcceleration, 1_200_000))),
      shutterExposureSeconds: Math.max(1 / 240, Math.min(1 / 12, showDirectorFinite(rawAdvanced.shutterExposureSeconds, 1 / 60))),
      calibrationProfileId: typeof rawAdvanced.calibrationProfileId === 'string' && rawAdvanced.calibrationProfileId.trim()
        ? rawAdvanced.calibrationProfileId.trim().slice(0, 96)
        : 'default',
    },
    migration: {
      status,
      version: Math.max(0, Math.round(showDirectorFinite(rawMigration.version, status === 'native' ? 0 : 1))),
      sourceTargetIds: showDirectorStringArray(rawMigration.sourceTargetIds).slice(0, 256),
      ambiguous: showDirectorBoolean(rawMigration.ambiguous, false),
      warnings: showDirectorStringArray(rawMigration.warnings).slice(0, 64),
      ...(backupTargets?.length ? { backupTargets } : {}),
    },
  }
}

export function normalizeLaserDmxShowDirectorFixture(raw: unknown, index = 0): LaserDmxShowDirectorFixture {
  const value = showDirectorRecord(raw) ? raw : {}
  const kind = isLaserDmxShowDirectorFixtureKind(value.kind) ? value.kind : 'laser'
  const fallback = createDefaultLaserDmxShowDirectorFixture(kind, `show-director-recovered-${index + 1}`, index)
  const id = showDirectorString(value.id, fallback.id)
  const x = showDirectorFinite(value.x, fallback.x)
  const y = showDirectorFinite(value.y, fallback.y)
  const rotation = Math.max(-360, Math.min(360, showDirectorFinite(value.rotation, fallback.rotation)))
  const beamValue = showDirectorRecord(value.beam) ? value.beam : {}
  const normalizedBeam = normalizeLaserDmxShowDirectorBeamConfig(value.beam, kind)
  const defaultEndpoint = createDefaultLaserDmxShowDirectorBeamEndpoint(kind, x, y, rotation)
  // targetZ existed as a legacy zero-valued field before depth layers. Treat
  // zero as the 2D default; explicit Mid Air is available when zero depth is intended.
  const hasAuthoredTargetZ = beamValue.targetZ != null && Math.abs(normalizedBeam.targetZ ?? 0) > 1e-6
  const primaryEndpoint = {
    x: beamValue.targetX == null ? defaultEndpoint.targetX : showDirectorFinite(normalizedBeam.targetX, defaultEndpoint.targetX),
    y: beamValue.targetY == null ? defaultEndpoint.targetY : showDirectorFinite(normalizedBeam.targetY, defaultEndpoint.targetY),
    ...(hasAuthoredTargetZ ? { z: normalizedBeam.targetZ } : {}),
    ...(beamValue.targetDepthLayer == null ? {} : { depthLayer: normalizedBeam.targetDepthLayer }),
  }
  const targets = normalizeLaserDmxShowDirectorBeamTargets(beamValue.targets, primaryEndpoint, id)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    id,
    semanticKey: showDirectorSafeSemanticKey(value.semanticKey ?? value.label, `${kind}-${index + 1}`),
    kind,
    label:      showDirectorString(value.label, fallback.label),
    enabled:    showDirectorBoolean(value.enabled, fallback.enabled),
    x,
    y,
    z:          Math.max(-1, Math.min(1, showDirectorFinite(value.z, fallback.z))),
    depthLayer: coerceLaserDmxShowDirectorDepthLayer(value.depthLayer),
    rotation,
    groupId:    typeof value.groupId === 'string' && value.groupId.trim().length > 0 ? value.groupId : null,
    linkedPairId: typeof value.linkedPairId === 'string' && value.linkedPairId.trim().length > 0 ? value.linkedPairId.trim() : null,
    mirrorAxis: coerceShowDirectorMirrorAxis(value.mirrorAxis),
    color:      showDirectorString(value.color, fallback.color),
    colorMode:  coerceShowDirectorColorMode(value.colorMode),
    brightness: showDirectorUnit(value.brightness, fallback.brightness),
    beam:       {
      ...normalizedBeam,
      targetX: targets[0]?.x ?? primaryEndpoint.x,
      targetY: targets[0]?.y ?? primaryEndpoint.y,
      targets,
    },
    trigger:    normalizeLaserDmxShowDirectorTriggerConfig(value.trigger, kind),
    component:  normalizeLaserDmxShowDirectorComponentConfig(value.component),
    optics:     normalizeLaserDmxShowDirectorOpticsConfig(value.optics, kind, normalizedBeam),
    ...(kind === 'laser' && value.scanner != null
      ? { scanner: normalizeLaserDmxShowDirectorScannerConfig(value.scanner, id) }
      : {}),
  }
}

function clampShowDirectorGridCoordinate(value: number | undefined, max: number): number {
  return Math.max(0, Math.min(max, typeof value === 'number' && Number.isFinite(value) ? value : 0))
}

function clampLaserDmxShowDirectorFixtureToSettings(
  fixture: LaserDmxShowDirectorFixture,
  settings: LaserDmxShowDirectorSettings,
): LaserDmxShowDirectorFixture {
  const maxX = Math.max(0, Math.round(settings.gridSize.columns) - 1)
  const maxY = Math.max(0, Math.round(settings.gridSize.rows) - 1)
  return {
    ...fixture,
    x: clampShowDirectorGridCoordinate(fixture.x, maxX),
    y: clampShowDirectorGridCoordinate(fixture.y, maxY),
    beam: {
      ...fixture.beam,
      targetX: fixture.beam.targetX == null ? fixture.beam.targetX : clampShowDirectorGridCoordinate(fixture.beam.targetX, maxX),
      targetY: fixture.beam.targetY == null ? fixture.beam.targetY : clampShowDirectorGridCoordinate(fixture.beam.targetY, maxY),
      targets: (fixture.beam.targets ?? []).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map((target, index) => ({
        ...target,
        id: showDirectorTargetId(target.id, `${fixture.id}-target-${index + 1}`),
        x:  clampShowDirectorGridCoordinate(target.x, maxX),
        y:  clampShowDirectorGridCoordinate(target.y, maxY),
        ...(target.z == null ? {} : { z: Math.max(-1, Math.min(1, showDirectorFinite(target.z, 0))) }),
        ...(target.depthLayer == null ? {} : { depthLayer: coerceLaserDmxShowDirectorDepthLayer(target.depthLayer) }),
      })),
    },
  }
}

export function normalizeLaserDmxShowDirectorState(raw: unknown): LaserDmxShowDirectorState {
  if (!showDirectorRecord(raw)) return createDefaultLaserDmxShowDirectorState()
  const settings = normalizeLaserDmxShowDirectorSettings(raw.settings)
  const rawFixtures = Array.isArray(raw.fixtures)
    ? raw.fixtures
      .map((fixture, index) => normalizeLaserDmxShowDirectorFixture(fixture, index))
      .map(fixture => clampLaserDmxShowDirectorFixtureToSettings(fixture, settings))
    : []

  const groupsById = new Map<string, LaserDmxShowDirectorGroup>()
  const labelLookup = new Map<string, string>()

  const reserveGroup = (group: LaserDmxShowDirectorGroup): string => {
    let id = group.id
    let suffix = 2
    while (groupsById.has(id)) {
      id = `${group.id}-${suffix}`
      suffix += 1
    }
    const normalizedGroup = { ...group, id }
    groupsById.set(id, normalizedGroup)
    labelLookup.set(normalizedGroup.label.trim().toLowerCase(), id)
    return id
  }

  if (Array.isArray(raw.groups)) {
    raw.groups
      .map((group, index) => normalizeLaserDmxShowDirectorGroup(group, index))
      .forEach(reserveGroup)
  }

  const resolveGroupId = (groupId: string | null): string | null => {
    const trimmed = typeof groupId === 'string' ? groupId.trim() : ''
    if (!trimmed) return null
    if (groupsById.has(trimmed)) return trimmed
    const existingByLabel = labelLookup.get(trimmed.toLowerCase())
    if (existingByLabel) return existingByLabel
    return reserveGroup({
      schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
      id: createShowDirectorGroupIdFromLabel(trimmed, groupsById.size),
      label: showDirectorGroupLabel(trimmed, `Group ${groupsById.size + 1}`),
    })
  }

  const fixturePairCounts = rawFixtures.reduce((counts, fixture) => {
    if (fixture.linkedPairId && fixture.mirrorAxis) counts.set(fixture.linkedPairId, (counts.get(fixture.linkedPairId) ?? 0) + 1)
    return counts
  }, new Map<string, number>())

  const usedFixtureSemanticKeys = new Set<string>()
  const fixtures = rawFixtures.map((fixture, index) => {
    const hasValidPair = Boolean(fixture.linkedPairId && fixture.mirrorAxis && (fixturePairCounts.get(fixture.linkedPairId) ?? 0) >= 2)
    const semanticBase = showDirectorSafeSemanticKey(fixture.semanticKey ?? fixture.label, `${fixture.kind}-${index + 1}`)
    return {
      ...fixture,
      semanticKey: reserveShowDirectorSemanticKey(semanticBase, usedFixtureSemanticKeys),
      groupId: resolveGroupId(fixture.groupId),
      linkedPairId: hasValidPair ? fixture.linkedPairId ?? null : null,
      mirrorAxis: hasValidPair ? fixture.mirrorAxis ?? null : null,
    }
  })
  const referencedGroupIds = new Set(fixtures.flatMap(fixture => fixture.groupId ? [fixture.groupId] : []))
  const usedGroupSemanticKeys = new Set<string>()
  const groups = Array.from(groupsById.values())
    .filter(group => referencedGroupIds.has(group.id))
    .map((group, index) => ({
      ...group,
      semanticKey: reserveShowDirectorSemanticKey(
        showDirectorSafeSemanticKey(group.semanticKey ?? group.label, `group-${index + 1}`),
        usedGroupSemanticKeys,
      ),
    }))

  const ids = new Set(fixtures.map(fixture => fixture.id))
  const rawSelectedFixtureIds = showDirectorStringArray(raw.selectedFixtureIds)
  const selectedFixtureIds = Array.from(new Set(rawSelectedFixtureIds.filter(id => ids.has(id))))
  const rawPrimaryId = typeof raw.selectedFixtureId === 'string' && ids.has(raw.selectedFixtureId)
    ? raw.selectedFixtureId
    : null
  const selectedFixtureId = rawPrimaryId ?? selectedFixtureIds[0] ?? null
  const normalizedSelectedFixtureIds = selectedFixtureId
    ? [selectedFixtureId, ...selectedFixtureIds.filter(id => id !== selectedFixtureId)]
    : selectedFixtureIds
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    sourceTemplateId: typeof raw.sourceTemplateId === 'string' && raw.sourceTemplateId.trim().length > 0
      ? raw.sourceTemplateId.trim()
      : null,
    groups,
    fixtures,
    selectedFixtureId,
    selectedFixtureIds: normalizedSelectedFixtureIds,
    settings,
  }
}

export interface LaserDmxFixture {
  /** Versioned on persistence; omitted legacy fixtures are normalized on load. */
  schemaVersion?: number
  /** Generalized production kind. Legacy fixtures resolve this from their profile. */
  fixtureKind?: ProductionFixtureKind
  /** Optional capability overrides layered over the selected profile declaration. */
  capabilityOverrides?: ProductionFixtureCapabilityOverride
  /** Compatibility diagnostics preserve invalid/unknown legacy profile information. */
  compatibility?: {
    source: 'legacyLaserDmxRig' | 'productionRig'
    sourceSchemaVersion?: number
    validationErrors?: string[]
    migrationNotes?: string[]
  }
  /** Canonical metre-based transform. Missing legacy values are derived from position. */
  stageTransform?: ProductionStageTransform
  /** Explicit shared target; null/undefined keeps the legacy per-fixture aim point. */
  targetId?: string | null
  /** Capability-gated moving-head state. Omitted for laser projectors and static fixtures. */
  movingHead?: ProductionMovingHeadSettings
  /** Production color policy keeps white/fixed-color accents intentional. */
  colorPolicy?: ProductionFixtureColorPolicy
  /** Typed pattern engine used by strobes, blinders, and optional fixture flashes. */
  flashPattern?: ProductionFlashPatternSettings
  /** Region/atmosphere illumination controls for moving and static washes. */
  wash?: ProductionWashSettings
  /** Whole-bar and bounded segmented rendering controls. */
  ledBar?: ProductionLedBarSettings
  /** Persistent haze output or cue-triggered fog / virtual CO₂-style plume controls. */
  atmospheric?: ProductionAtmosphericFixtureSettings

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
  /** Legacy LaserDMX rig persistence schema. Missing values normalize to v1. */
  schemaVersion?: number
  rigId?: string
  rigName?: string
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
  visualComfort?: ProductionVisualComfortSettings
  atmosphere?: ProductionAtmosphereSettings
  /** Non-persisted virtual-effects commands. */
  runtime?: { atmosphereClearRequestId?: number; [key: string]: unknown }
  fixtures: LaserDmxFixture[]
  /** Shared metre-based stage, venue, camera, guide, and safety-zone document. */
  productionStage?: ProductionStageModel
  /** Production-rig scaffolding shared by future fixture workspaces. */
  productionGroups?: ProductionFixtureGroup[]
  productionTargets?: ProductionTarget[]
  productionLooks?: ProductionLook[]
  activeProductionLookId?: string | null
  productionLookTransitionDefaults?: ProductionLookTransitionSettings
  productionCues?: ProductionCompoundCue[]
  /** Layered automatic choreography driven only by canonical Music Intelligence frames. */
  choreography?: ProductionChoreographySettings
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
    flash?: {
      pattern: ProductionFlashPatternSettings['pattern']
      intensity: number
      whiteAccent: boolean
      blackout: boolean
      comfortLimited: boolean
      effectiveHz: number
      warning: boolean
    }
    wash?: {
      worldTarget: ProductionStageTransform['position']
      spread: number
      softness: number
      atmosphericIntensity: number
    }
    ledBar?: {
      mode: ProductionLedBarSettings['mode']
      pattern: ProductionLedBarSettings['pattern']
      segmentColors: string[]
      segmentIntensities: number[]
    }
    movingHead?: {
      panDeg: number
      tiltDeg: number
      movementComplete: boolean
      targetAvailable: boolean
      worldTarget: ProductionStageTransform['position']
      zoom: number
      focus: number
      iris: number
      frost: number
      goboIndex: number
      goboRotation: number
      prismFacets: number
      prismRotation: number
      colorWheelSlot: number
    }
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
    schemaVersion: 5,
    rigId: 'laser-dmx-legacy-rig',
    rigName: 'LaserDMX Legacy Rig',
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
    visualComfort: { disableStrobe: false, maxFlashHz: 12, warningThresholdHz: 7, maxContinuousFlashSec: 4 },
    atmosphere: {
      persistentHaze: { enabled: true, baseDensity: 0.45, heightDistribution: 0.62, turbulence: 0.25, diffusion: 0.68, driftSpeed: 0.12, driftDirectionDeg: 18, ventilation: 0.18, beamScatter: 0.72 },
      qualityTier: 'medium', maxParticleBudget: 180, retainBaseHazeOnClear: true,
    },
    fixtures: [leftFan, rightFan, centerAccent],
    productionStage: createDefaultProductionStageModel(),
    productionGroups: [],
    productionTargets: [],
    productionLooks: [],
    activeProductionLookId: null,
    productionLookTransitionDefaults: {
      mode: 'easedFade',
      durationMs: 600,
      easing: 'easeInOut',
      switchPoint: 0.5,
      blackoutHoldMs: 120,
      revealOutput: true,
      fixtureFamilyDurationsMs: {},
    },
    productionCues: [],
    choreography: {
      enabled: true, profileId: 'openFormat', intensity: 0.65,
      fixtureFamilyParticipation: { laserProjector: true, movingHeadBeam: true, movingHeadSpot: true, movingHeadWash: true, staticWash: true, strobe: true, blinder: true, ledBar: true, hazer: true, fogger: true, cryoJet: true },
      automaticLookChanges: true, automaticMovementChanges: true, impactSensitivity: 0.55, blackoutFrequency: 0.2, whiteImpactIntensity: 0.9,
      allowStrobe: false, allowAtmospherics: false, manualOverridePrecedence: 'authoredFirst', manualOverrideHoldMs: 1200,
      seed: 1, variationMode: 'locked', variationAmount: 0.25,
    },
  }
}

// ── Beam Matrix workspace ─────────────────────────────────────────────────────

export type LaserDmxWorkspaceMode = 'beamMatrix'
export type LaserDmxBeamMatrixAuthoringMode = 'manual' | 'showDirector'

/** LaserDMX is locked to Beam Matrix. Legacy workspace values hydrate as Beam Matrix. */
export const LOCKED_LASER_DMX_WORKSPACE_MODE: LaserDmxWorkspaceMode = 'beamMatrix'
export const DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE: LaserDmxBeamMatrixAuthoringMode = 'manual'

export function coerceLaserDmxBeamMatrixAuthoringMode(mode: unknown): LaserDmxBeamMatrixAuthoringMode {
  return mode === 'showDirector' ? 'showDirector' : DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE
}
export const LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID = 'preset-laser-dmx-beam-matrix'

export const RETIRED_LASER_DMX_PRESET_IDS = new Set<string>([
  'preset-laser-dmx-default',
  'preset-laser-dmx-fan-sweep',
  'preset-laser-dmx-drop-cage',
  'preset-laser-dmx-constellation',
  'preset-laser-dmx-build-tunnel',
  'preset-laser-dmx-vocal-skywriter',
  'preset-red-club-crossfire',
])

export function coerceLaserDmxWorkspaceMode(_mode: unknown): LaserDmxWorkspaceMode {
  return LOCKED_LASER_DMX_WORKSPACE_MODE
}

export function isRetiredLaserDmxPreset(
  preset: { id: string; engine: ReactEngineId; laserDmxWorkspace?: unknown },
): boolean {
  if (preset.engine !== 'laserDmx') return false
  return RETIRED_LASER_DMX_PRESET_IDS.has(preset.id)
    || (preset.laserDmxWorkspace != null && preset.laserDmxWorkspace !== LOCKED_LASER_DMX_WORKSPACE_MODE)
}

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

export interface LaserDmxBeamMotion {
  mode:           LaserDmxBeamTravelMode
  beatsPerTravel: number   // 0.25–16 beats for a full path traversal
  phaseOffset:    number   // 0–1 phase shift (delays beat alignment per beam)
  /** Beam travel always progresses from the fixture origin toward its target. */
  direction:      'forward'
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
  /** Minimum beats between successive launches (0 = no beat cooldown). */
  cooldownBeats: number
  /** Optional musical-bar cooldown. When positive, this takes precedence over cooldownBeats. */
  cooldownBars?: number
  /** 0–1 minimum mi.energy.instant value before a launch fires */
  minimumEnergy: number
}

export const DEFAULT_LAUNCH_SETTINGS: LaserDmxLaunchSettings = {
  trigger:       'none',
  threshold:     0.4,
  cooldownBeats: 0,
  cooldownBars:  0,
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

export type LaserDmxMatrixBeamVisualRole = 'hero' | 'primary' | 'secondary' | 'texture' | 'impact'

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
  /** Optional transient visual hierarchy. Not required for persisted legacy beams. */
  visualRole?: LaserDmxMatrixBeamVisualRole

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

  /** Optional fade envelope for gate cues. Omitted cues stay hard-gated for backward compatibility. */
  fadeInMs?:  number
  fadeOutMs?: number
}

export interface LaserDmxBeamMatrixSettings {
  schemaVersion?: number
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
    schemaVersion: 2,
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

export type ReactSectionEnergyShape = 'rising' | 'falling' | 'stable' | 'arched' | 'volatile'
export type ReactSectionDensityCategory = 'sparse' | 'moderate' | 'dense'
export type ReactSectionRhythmicCharacter = 'sparse' | 'steady' | 'driving' | 'fill-heavy'
export type ReactSectionHarmonicCharacter = 'stable' | 'evolving' | 'changing' | 'unavailable'
export type ReactSectionTransitionCharacter = 'impact' | 'lift' | 'release' | 'cut' | 'continuous'

export interface ReactSectionLabelAlternative {
  type: ReactSectionType
  confidence: number
}

export interface ReactDropAnchorDiagnostics {
  entryImpact: number
  energyIncrease: number
  bassIncrease: number
  transientIncrease: number
  postEntryStability: number
  preEntryReduction: number
  precedingRise: number
  repeatedHighEnergySimilarity: number
  structuralBoundarySupport: number
}

export interface ReactSectionClassificationDiagnostics {
  scores: Partial<Record<ReactSectionType, number>>
  evidence: string[]
  sourceRegionIds: string[]
  dropAnchor?: ReactDropAnchorDiagnostics
}

export interface ReactSectionInterpretationMetadata {
  startBar?: number | null
  endBar?: number | null
  durationBars?: number | null
  energyShape?: ReactSectionEnergyShape
  densityCategory?: ReactSectionDensityCategory
  rhythmicCharacter?: ReactSectionRhythmicCharacter
  harmonicCharacter?: ReactSectionHarmonicCharacter
  entryImpact?: number
  exitTransition?: ReactSectionTransitionCharacter
  familyId?: string
  occurrenceIndex?: number
  familySimilarity?: number
  relatedSectionIds?: string[]
  isVariation?: boolean
  alternativeLabels?: ReactSectionLabelAlternative[]
  boundaryRefinementReason?: string
  analysisSource?: 'bar_self_similarity' | 'time_domain_fallback'
  gridSource?: 'locked_user' | 'imported' | 'manual_correction' | 'automatic' | 'legacy_fallback'
  fallbackStatus?: 'none' | 'grid_derived' | 'time_domain_fallback'
  startBoundaryReason?: string
  endBoundaryReason?: string
  classificationDiagnostics?: ReactSectionClassificationDiagnostics
}

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

export type ReactTrackSectionSource =
  | 'manual'
  | 'auto'
  | 'mock'
  | 'user-edited-auto'
  | 'user-created'
  | 'imported'
  | 'fallback'

export type ReactTrackSectionAuthority =
  | 'locked_user'
  | 'user_created'
  | 'manual_replacement'
  | 'imported'
  | 'automatic'
  | 'fallback'

export interface ReactTrackSectionProvenance {
  authority: ReactTrackSectionAuthority
  originalId: string
  analysisSource?: 'manual' | 'analysis' | 'inferred' | 'rekordbox'
  splitIndex?: number
}

export interface ReactTrackSection {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
  intensity: number
  engineId?: ReactEngineId
  source?: ReactTrackSectionSource
  /** User/import locks survive automatic reanalysis and boundary rebuilding. */
  locked?: boolean
  /** Canonical authority/provenance retained after conflict resolution and splitting. */
  provenance?: ReactTrackSectionProvenance
  confidence?: number
  /** Confidence that the section's start/end boundaries are musically placed. */
  boundaryConfidence?: number
  /** Confidence in the semantic role independently of boundary placement. */
  labelConfidence?: number
  /** Confidence in the beat/downbeat/bar grid supporting the section. */
  gridConfidence?: number
  /** Combined compatibility score; mirrored to confidence for older consumers. */
  analysisConfidence?: number
  /** Contextual Drop-entry confidence. Zero/absent does not imply low energy. */
  dropConfidence?: number
  /** Optional analysis-v3 interpretation data. Manual sections may omit it. */
  interpretation?: ReactSectionInterpretationMetadata
}

export interface ReactSectionMapping {
  sectionType: ReactSectionType
  sceneId: string
}

export interface ReactPixGridDeckPresetMetadata {
  deckId: string
  deckRevision: number
  firstEnabledItemId: string | null
  thumbnailFingerprint: string
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
  /** LaserDMX compatibility marker. New LaserDMX presets are always Beam Matrix. */
  laserDmxWorkspace?: LaserDmxWorkspaceMode
  /** Curated production-language metadata used by the preset browser and compatibility layer. */
  productionPreset?: ProductionPresetMetadata
  /** Normalized Cinematic Worlds configuration. Present on cinematicPortal presets after migration. */
  cinematicConfig?: CinematicWorldConfig
  /** PixGrid-only compact matrix and baseline-art settings. */
  pixGridSettings?: PixGridPresetSettings
  /** Lightweight linkage for an explicitly generated project Deck Preset. */
  pixGridDeck?: ReactPixGridDeckPresetMetadata
}

export function resolveReactPresetLaserDmxWorkspace(
  preset: Pick<ReactPreset, 'engine' | 'laserDmxWorkspace' | 'laserDmxSettings'>,
): LaserDmxWorkspaceMode | null {
  return preset.engine === 'laserDmx' ? LOCKED_LASER_DMX_WORKSPACE_MODE : null
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

const PALETTE_PRISM_TRACE: ReactPalette = {
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
    name: 'Prism Transit',
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

  // Cinematic Worlds: Reactive Constellation curated library
  ...REACTIVE_CONSTELLATION_CURATED_PRESETS,

  // Backward-compatible Reactive Constellation presets from Patches 2–8
  {
    id: 'preset-crystal-synapse',
    name: 'Crystal Synapse',
    description: 'A clustered cyan-violet neural field of mixed faceted crystals with bright connected hubs.',
    engine: 'cinematicPortal',
    palette: { primary: '#4ac7db', secondary: '#7857ff', accent: '#d8f7ff', background: '#01050d', highlight: '#61d6aa', text: DVYDRM_WHITE },
    params: { intensity: 0.72, motion: 0.56, glow: 0.78, bassReactivity: 0.68 },
    renderSettings: { trailDecay: 0.05, fogDensity: 0.24, particleDensity: 0.36 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'custom', nodeCount: 48, topologyStyle: 'cluster', polyhedronStyle: 'mixed', networkSpread: 1.28,
      depthSpread: 0.78, neighborCount: 4, nodeScale: 0.115, nodeScaleVariation: 0.54,
      faceOpacity: 0.82, facetContrast: 1.22, internalGlow: 0.82, rimIntensity: 1.12,
      wireframeAmount: 0.34, colorVariation: 0.78, nodeSpin: 0.42,
      backgroundCurtains: 0.34, curtainDensity: 11, depthFade: 0.58,
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
      visualDnaProfile: 'custom', nodeCount: 38, topologyStyle: 'chain', polyhedronStyle: 'irregularCrystal', networkSpread: 1.02,
      depthSpread: 1.05, neighborCount: 2, nodeScale: 0.14, nodeScaleVariation: 0.72,
      faceOpacity: 0.7, facetContrast: 1.42, internalGlow: 0.56, rimIntensity: 0.96,
      wireframeAmount: 0.16, colorVariation: 0.55, nodeSpin: -0.22,
      backgroundCurtains: 0.18, curtainDensity: 7, depthFade: 0.72,
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
      visualDnaProfile: 'custom', nodeCount: 72, topologyStyle: 'starburst', polyhedronStyle: 'icosahedron', networkSpread: 1.62,
      depthSpread: 1.18, neighborCount: 6, nodeScale: 0.09, nodeScaleVariation: 0.36,
      faceOpacity: 0.9, facetContrast: 1.72, internalGlow: 1.12, rimIntensity: 1.48,
      wireframeAmount: 0.62, colorVariation: 0.92, nodeSpin: 0.92,
      backgroundCurtains: 0.7, curtainDensity: 18, depthFade: 0.44,
      beamWidth: 3, beamCoreBrightness: 3.8, beamGlow: 1.6, edgeOpacity: 0.92, trailSamples: 18, trailDecay: 0.84, trailSpacing: 0.022, beamFanAmount: 1.35,
      centralGravity: 0.3, cameraOrbit: 0.54, springStrength: 1.08, damping: 0.42, driftAmount: 0.18, turbulence: 0.46, orbitAmount: 0.72, elasticity: 0.86, topologyStability: 0.54, collapseAmount: 0.14, burstStrength: 1.08, reseedEveryBars: 8,
    }, {
      cameraRig: 'autoDirector', seed: 48003, qualityTier: 'high',
      environment: { depth: 0.86, architecture: 0.04, fog: 0.14, debris: 0.1, stars: 0.72, atmosphere: 0.42 },
      material: { distortion: 0.06, refraction: 0.03, bloom: 0.92, chromaticAberration: 0.085, feedback: 0, glow: 1 },
    }),
    scenes: makeScenes('rcs3', 'cinematicPortal'), sectionMappings: makeMappings('rcs3'),
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
    name: 'Prism Text Trace',
    description: 'Purple-cyan waveform trace with high glow — text-style oscilloscope aesthetics.',
    engine: 'oscilloscope',
    palette: PALETTE_PRISM_TRACE,
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
    palette: PALETTE_PRISM_TRACE,
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

  // ── LaserDMX Beam Matrix launcher ─────────────────────────────────────────
  ...PIX_GRID_PRESETS,

  {
    id: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
    name: 'Beam Matrix',
    description: 'LaserDMX Beam Matrix launcher. Keeps authored matrix presets, beams, groups, fog, and modulation in the Beam Matrix workspace.',
    engine: 'laserDmx',
    laserDmxWorkspace: 'beamMatrix',
    palette: PALETTE_LASER_DMX,
    params: { intensity: 0.85, motion: 0.5, glow: 0.72, bassReactivity: 0.8 },
    renderSettings: { trailDecay: 0.08, fogDensity: 0.35, particleDensity: 0.5 },
    scenes: makeScenes('ldx-bm', 'laserDmx'),
    sectionMappings: makeMappings('ldx-bm'),
  },
]
// ── Default performance pads ──────────────────────────────────────────────────

export const DEFAULT_PERFORMANCE_PADS: ReactPerformancePad[] = [
  // Row 1 — Mixed live-performance presets
  { id: 'pad-1',  presetId: 'preset-bass-triangle-reactor',  label: 'Reactor',   color: DVYDRM_GOLD,    keyBinding: '1', transitionTimeMs: 500 },
  { id: 'pad-2',  presetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,    label: 'Drop Cage', color: DVYDRM_CYAN,    keyBinding: '2', transitionTimeMs: 400 },
  { id: 'pad-3',  presetId: 'preset-infinity-signal',        label: 'Infinity',  color: DVYDRM_EMERALD, keyBinding: '3', transitionTimeMs: 600 },
  { id: 'pad-4',  presetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID, label: 'Tunnel',    color: '#ff8c42',      keyBinding: '4', transitionTimeMs: 300 },
  { id: 'pad-17', presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: '5', transitionTimeMs: 600 },
  // Row 2 — Cinematic / open slots
  { id: 'pad-5',  presetId: 'preset-singularity-crown',       label: 'Crown',    color: DVYDRM_CYAN,    keyBinding: 'q', transitionTimeMs: 800 },
  { id: 'pad-6',  presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: 'w', transitionTimeMs: 400 },
  { id: 'pad-7',  presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: 'e', transitionTimeMs: 700 },
  { id: 'pad-8',  presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: 'r', transitionTimeMs: 200 },
  { id: 'pad-18', presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: 't', transitionTimeMs: 300 },
  // Row 3 — Sound Drawing
  { id: 'pad-9',  presetId: 'preset-xy-cyan-scope',          label: 'XY Scope', color: DVYDRM_CYAN,    keyBinding: 'a', transitionTimeMs: 300 },
  { id: 'pad-10', presetId: 'preset-lissajous-flower',       label: 'Lissajous',color: DVYDRM_EMERALD, keyBinding: 's', transitionTimeMs: 400 },
  { id: 'pad-11', presetId: 'preset-spiral-signal',          label: 'Spiral',   color: DVYDRM_GOLD,    keyBinding: 'd', transitionTimeMs: 350 },
  { id: 'pad-12', presetId: 'preset-radial-voice',           label: 'Radial',   color: DVYDRM_WHITE,   keyBinding: 'f', transitionTimeMs: 450 },
  { id: 'pad-19', presetId: 'preset-bass-triangle-reactor',  label: 'Triangle', color: DVYDRM_CRIMSON, keyBinding: 'g', transitionTimeMs: 250 },
  // Row 4 — Peak / enhanced visuals
  { id: 'pad-13', presetId: null,                            label: 'Empty',    color: '#3a4650',      keyBinding: 'z', transitionTimeMs: 200 },
  { id: 'pad-14', presetId: 'preset-drmvyz-text-trace',      label: 'DRMVYZ',   color: '#b84fc9',      keyBinding: 'x', transitionTimeMs: 400 },
  { id: 'pad-15', presetId: 'preset-star-drop-burst',        label: 'StarBurst',color: DVYDRM_GOLD,    keyBinding: 'c', transitionTimeMs: 250 },
  { id: 'pad-16', presetId: 'preset-glyph-circle-pulse',     label: 'Circle',   color: DVYDRM_CYAN,    keyBinding: 'v', transitionTimeMs: 400 },
  { id: 'pad-20', presetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,      label: 'Laser Fan',color: '#00ffdc',      keyBinding: 'b', transitionTimeMs: 300 },
]
