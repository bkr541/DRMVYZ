import type { ReactSectionType } from '../ReactTypes'

export const PIX_GRID_STATE_VERSION = 16 as const
export const PIX_GRID_CONFIGURATION_METADATA_VERSION = 2 as const
export const PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION = 5 as const
export const PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION = 2 as const
export const PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION = 2 as const
export const PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION = 5 as const
export const PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION = 3 as const

export type PixGridQualityTier = 'draft' | 'low' | 'high' | 'ultra'
export type PixGridQualityMode = 'adaptive' | 'fixed'
export type PixGridBackgroundMode = 'preset' | 'black' | 'custom'
export type PixGridEditorTool = 'select' | 'pan' | 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'rectangle' | 'line' | 'marquee' | 'move'
export type PixGridPatternId = 'bassBeacon' | 'geometricReactor' | 'pixelParade'
export type PixGridPerformanceProgramId =
  | 'pix-grid-bass-beacon-performance'
  | 'pix-grid-geometric-reactor-performance'
  | 'pix-grid-pixel-parade-performance'
export type PixGridBlendMode = 'normal' | 'add' | 'multiply'
export type PixGridStoppedBehavior = 'baseline' | 'blackout'
export type PixGridRendererPath = 'webgl2' | 'canvas2d-fallback'
export type PixGridContextState = 'ready' | 'lost' | 'restoring' | 'unavailable'
export type PixGridAssetCategory = 'typography' | 'symbol' | 'pattern' | 'geometry' | 'character' | 'motion'
export type PixGridAssetKind = 'static' | 'procedural' | 'frameBased'
export type PixGridPaletteRole = 'primary' | 'secondary' | 'accent' | 'highlight' | 'background'
export type PixGridClipMode = 'clip' | 'wrap'
export type PixGridAnimationBoundary = 'wrap' | 'clamp' | 'bounce'
export type PixGridContinuousAudioSource =
  | 'sub' | 'bass' | 'lowMid' | 'mid' | 'high' | 'air' | 'volume'
  | 'energy' | 'trackRelativeEnergy' | 'spectralFlux' | 'spectralBrightness'
  | 'tension' | 'complexity' | 'buildProgress' | 'sectionProgress' | 'phraseProgress'
  | 'barProgress' | 'beatPhase' | 'sectionRelativeEnergy' | 'sectionConfidence' | 'phraseConfidence'
  | 'vocalEnergy' | 'vocalActivity' | 'drumActivity' | 'bassStemActivity' | 'melodyActivity'
  | 'semanticMomentStrength'
export type PixGridDiscreteAudioSource =
  | 'beat' | 'downbeat' | 'kick' | 'snare' | 'hat' | 'transient'
  | 'barEntry' | 'fourBarBoundary' | 'eightBarBoundary' | 'sixteenBarBoundary' | 'phraseEntry'
  | 'sectionEntry' | 'sectionExit' | 'dropImpact' | 'dropOccurrenceChange'
  | 'semanticMoment' | 'trackMapCueEvent'
export type PixGridReactionSource = PixGridContinuousAudioSource | PixGridDiscreteAudioSource
export type PixGridAudioSourceCategory =
  | 'frequency' | 'level' | 'development' | 'progress' | 'confidence' | 'stem' | 'semantic' | 'rhythm' | 'boundary' | 'cue'
export type PixGridAudioSourceKind = 'continuousNormalized' | 'continuousSigned' | 'progress' | 'discreteEvent' | 'musicalBoundary' | 'sectionEvent' | 'semanticEvent'
/** Backward-compatible layer animation source union. */
export type PixGridAudioSource = PixGridReactionSource
export type PixGridAnimationMode =
  | 'static'
  | 'pulse'
  | 'bounce'
  | 'horizontalScroll'
  | 'verticalScroll'
  | 'pingPong'
  | 'rotate'
  | 'paletteCycle'
  | 'blink'
  | 'revealRow'
  | 'revealColumn'
  | 'checkerAlternate'
  | 'frameCycle'
  | 'audioAmplitudeScale'
  | 'beatStepMovement'

export type PixGridBuiltInAssetId =
  | 'pix-bass-word'
  | 'pix-bass-letter-b'
  | 'pix-bass-letter-a'
  | 'pix-bass-letter-s'
  | 'pix-five-point-star'
  | 'pix-multi-star-field'
  | 'pix-equalizer-bars'
  | 'pix-concentric-rings'
  | 'pix-checkerboard'
  | 'pix-diagonal-chevrons'
  | 'pix-cross'
  | 'pix-diamond'
  | 'pix-spiral'
  | 'pix-wave-line'
  | 'pix-mascot-face'
  | 'pix-orbiting-dots'
  | 'pix-pixel-burst'
  | 'pix-geometric-tunnel'

export type PixGridPixelOverrideMode = 0 | 1
/** Compact sparse tuple. Mode 0 forces the cell off; mode 1 paints color at opacity. Legacy v4 tuples are accepted by normalization. */
export type PixGridPixelOverride = readonly [x: number, y: number, mode: PixGridPixelOverrideMode, color: string, opacity: number] | readonly [x: number, y: number, color: string, opacity: number]

export interface PixGridCellRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PixGridScene {
  id: string
  name: string
  layerIds: string[]
  pixelOverrides: PixGridPixelOverride[]
}

export interface PixGridEditorSettings {
  hasEnteredAuthoring: boolean
  guidesVisible: boolean
  zoom: number
  panX: number
  panY: number
  paintColor: string
  paintOpacity: number
  eraserMode: 'off' | 'restore'
  selectedLayerId: string | null
  selectedGroupId: string | null
  previewReactionAssignmentId: string | null
  selection: PixGridCellRect | null
}

export interface PixGridBuiltInAssetManifestEntry {
  id: PixGridBuiltInAssetId
  name: string
  category: PixGridAssetCategory
  nativeSize: Readonly<{ width: number; height: number }>
  aspectRatio: number
  kind: PixGridAssetKind
  defaultPaletteRoles: readonly PixGridPaletteRole[]
  defaultGroups?: readonly string[]
  animationCapabilities: readonly PixGridAnimationMode[]
  frameCount?: number
}

export interface PixGridLayerAnimation {
  mode: PixGridAnimationMode
  /** Selects the authoritative musical clock used by frame sequences and motion. */
  clock?: 'time' | 'beat' | 'bar' | 'cue'
  speed: number
  amount: number
  phase: number
  boundary: PixGridAnimationBoundary
  axis?: 'x' | 'y'
  revealFrom?: 'start' | 'end' | 'center'
  stepped?: boolean
  audioSource?: PixGridAudioSource
}

export interface PixGridLayerAudioReactivity {
  brightnessSource?: PixGridAudioSource
  brightnessAmount?: number
  scaleSource?: PixGridAudioSource
  scaleAmount?: number
  beatImpact?: number
}

export interface PixGridLayer {
  id: string
  name: string
  assetId: PixGridBuiltInAssetId
  /** Media layers keep their library reference without embedding blobs. */
  mediaId?: string | null
  locked?: boolean
  visible: boolean
  opacity: number
  position: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
  flipX: boolean
  flipY: boolean
  blendMode: PixGridBlendMode
  paletteMap: Partial<Record<PixGridPaletteRole, PixGridPaletteRole>>
  zIndex: number
  clipMode: PixGridClipMode
  maskAssetId: PixGridBuiltInAssetId | null
  animations: PixGridLayerAnimation[]
  audioReactivity?: PixGridLayerAudioReactivity
  densityRank: number
  seed: number
}

export interface PixGridSceneSettings {
  density: number
  motionMultiplier: number
  paletteOffset: number
  hiddenLayerIds?: string[]
  layerOpacity?: Record<string, number>
}

export type PixGridCellRun = readonly [row: number, startColumn: number, length: number]
export type PixGridGroupSource =
  | 'manualSelection' | 'layerAlpha' | 'foregroundBackground' | 'colorRange' | 'luminanceRange'
  | 'connectedRegion' | 'border' | 'center' | 'leftRight' | 'topBottom' | 'quadrant'
  | 'horizontalBands' | 'verticalBands' | 'alternatingRows' | 'alternatingColumns'
  | 'checkerboard' | 'diagonalBands' | 'radialRings' | 'deterministicClusters' | 'svgMetadata'
export type PixGridGeometricGroupPattern =
  | 'border' | 'center' | 'left' | 'right' | 'top' | 'bottom'
  | 'quadrantTopLeft' | 'quadrantTopRight' | 'quadrantBottomLeft' | 'quadrantBottomRight'
  | 'horizontalBands' | 'verticalBands' | 'alternatingRowsA' | 'alternatingRowsB'
  | 'alternatingColumnsA' | 'alternatingColumnsB' | 'checkerboardA' | 'checkerboardB'
  | 'diagonalBands' | 'radialRings' | 'deterministicClusters'
export type PixGridGroupOverlapBehavior = 'stack' | 'exclusive' | 'replace'
export type PixGridReactionTargetScope =
  | 'output' | 'scene' | 'layer' | 'group' | 'pixels' | 'background' | 'transition' | 'animation' | 'palette'
export type PixGridReactionTarget =
  | 'brightness' | 'opacity' | 'globalIntensity' | 'glow' | 'contrast' | 'saturation' | 'threshold'
  | 'paletteRole' | 'paletteIndex' | 'paletteCycle' | 'hueOffset' | 'invert' | 'posterize'
  | 'highlightColor' | 'backgroundColor' | 'backgroundIntensity' | 'color'
  | 'positionX' | 'positionY' | 'scale' | 'discreteRotation' | 'direction'
  | 'animationSpeed' | 'frameIndex' | 'frameAdvance' | 'bounceAmount' | 'scrollRate' | 'pixelDisplacement'
  | 'reveal' | 'hide' | 'blink' | 'dissolveThreshold' | 'sparkle' | 'sparkleDensity'
  | 'outlineFlash' | 'outlineIntensity' | 'checkerAlternation' | 'rowRecruitment' | 'columnRecruitment'
  | 'pixelScatter' | 'maskExpansion' | 'maskContraction'
  | 'layerRecruitment' | 'groupRecruitment' | 'density' | 'freeze' | 'reverse'
  | 'directionReverse' | 'sceneEmphasis' | 'transitionStrength'
export type PixGridReactionRetrigger = 'restart' | 'extend' | 'ignoreWhileActive'
export type PixGridReactionDecayCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'exponential' | 'overshoot' | 'step' | 'stepped'
export type PixGridReactionCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'exponential' | 'logarithmic' | 'smoothstep' | 'stepped' | 'gate' | 'inverse'
export type PixGridReactionPolarity = 'positive' | 'negative' | 'bipolar'
export type PixGridReactionBlend = 'add' | 'multiply' | 'replace' | 'max'
export type PixGridReactionCapabilityFallback = 'disable' | 'zero' | 'energy' | 'beat' | 'midHighActivity' | 'transient'
export type PixGridReactionQuantization = 'none' | 'beat' | 'bar' | 'fourBars' | 'eightBars' | 'sixteenBars'
export type PixGridPhraseSegment = 'entry' | 'early' | 'middle' | 'late' | 'exit'

export interface PixGridReactionConditions {
  includeSectionTypes?: ReactSectionType[]
  excludeSectionTypes?: ReactSectionType[]
  sectionPhases?: Array<'entry' | 'body' | 'exit'>
  sectionOccurrences?: number[]
  dropOccurrences?: number[]
  phraseSegments?: PixGridPhraseSegment[]
  minimumEnergy?: number
  maximumEnergy?: number
  autoPerformanceOnly?: boolean
  activeLayerId?: string | null
  activeGroupId?: string | null
}

export interface PixGridReactionAssignment {
  id: string
  name: string
  enabled: boolean
  source: PixGridReactionSource
  target: PixGridReactionTarget
  targetScope?: PixGridReactionTargetScope
  targetId?: string | null
  amount: number
  polarity?: PixGridReactionPolarity
  invert: boolean
  inputRange?: readonly [number, number]
  outputRange?: readonly [number, number]
  curve?: PixGridReactionCurve
  threshold: number
  /** Optional off-threshold distance used to prevent gate chatter. */
  hysteresis?: number
  attack: number
  hold: number
  release: number
  /** Minimum seconds before a discrete route may accept another trigger. */
  cooldown?: number
  /** When false, bass-sensitive routes use the unscaled source value. */
  bassReactivityEnabled?: boolean
  /** Built-in-only perceptual calibration. Custom routes default to neutral values. */
  perceptualGain?: number
  /** Minimum material output reached progressively as the source becomes active. */
  minimumEffectiveStrength?: number
  /** 0..1 blend toward coverage-aware gain for small or large group masks. */
  maskSizeCompensation?: number
  decayCurve?: PixGridReactionDecayCurve
  smoothing: number
  quantization: PixGridReactionQuantization
  retrigger: PixGridReactionRetrigger
  maximumStacking?: number
  eventPriority?: number
  minimumConfidence: number
  capabilityFallback: PixGridReactionCapabilityFallback
  conditions?: PixGridReactionConditions
  priority?: number
  clamp: readonly [number, number]
  blend: PixGridReactionBlend
  paletteRole?: PixGridPaletteRole
  color?: string
  seedOffset?: number
}

export type PixGridGroupMaskDefinition =
  | { kind: 'runs'; runs: PixGridCellRun[] }
  | { kind: 'geometric'; pattern: PixGridGeometricGroupPattern; count?: number; index?: number; thickness?: number; seed?: number }
  | { kind: 'layerAlpha'; threshold: number; foreground: boolean }
  | { kind: 'colorRange'; color: string; tolerance: number }
  | { kind: 'luminanceRange'; min: number; max: number }
  | { kind: 'connectedRegion'; seedX: number; seedY: number; tolerance: number; alphaThreshold: number; maxCells: number }
  | { kind: 'svgMetadata'; elementId?: string; fillColor?: string }

export interface PixGridGroup {
  id: string
  name: string
  source: PixGridGroupSource
  mask: PixGridGroupMaskDefinition
  /** Materialized compact row runs retained for manual and prepared smart groups. */
  cellRuns: PixGridCellRun[]
  /** Backward-compatible single-layer scope. */
  layerId: string | null
  layerScope: string[] | null
  smartRuleId: string | null
  enabled: boolean
  visible: boolean
  /** Runtime content visibility. Unlike visible, this affects the rendered group mask. */
  contentVisible?: boolean
  priority: number
  overlapBehavior: PixGridGroupOverlapBehavior
  reactions: PixGridReactionAssignment[]
  displayColor: string | null
}

export type PixGridProgramTransitionOverride =
  | 'cut' | 'crossfade' | 'rowWipe' | 'columnWipe' | 'checkerWipe'
  | 'pixelDissolve' | 'radialReveal' | 'paletteFade' | 'powerOn' | 'powerOff'

export interface PixGridProgramRouteOverride {
  enabled?: boolean
  source?: PixGridReactionSource
  operation?: PixGridReactionTarget
  amount?: number
  priority?: number
  targetScope?: PixGridReactionTargetScope
  targetId?: string | null
  inputRange?: readonly [number, number]
  outputRange?: readonly [number, number]
  polarity?: PixGridReactionPolarity
  curve?: PixGridReactionCurve
  smoothing?: number
  threshold?: number
  hysteresis?: number
  attack?: number
  hold?: number
  release?: number
  cooldown?: number
  bassReactivityEnabled?: boolean
  perceptualGain?: number
  minimumEffectiveStrength?: number
  maskSizeCompensation?: number
  decayCurve?: PixGridReactionDecayCurve
  quantization?: PixGridReactionQuantization
  retrigger?: PixGridReactionRetrigger
  minimumConfidence?: number
  capabilityFallback?: PixGridReactionCapabilityFallback
  blend?: PixGridReactionBlend
  sectionTypes?: ReactSectionType[]
  excludeSectionTypes?: ReactSectionType[]
  sectionPhases?: Array<'entry' | 'body' | 'exit'>
  sectionOccurrences?: number[]
  dropOccurrences?: number[]
  minimumEnergy?: number
  maximumEnergy?: number
}

export interface PixGridProgramSectionOverride {
  enabled?: boolean
  density?: number
  motion?: number
  paletteIntensity?: number
  negativeSpace?: number
  fourBarEnabled?: boolean
  eightBarEnabled?: boolean
  sixteenBarEnabled?: boolean
  transitionIn?: PixGridProgramTransitionOverride
  transitionOut?: PixGridProgramTransitionOverride
}

export interface PixGridPerformanceProgramOverrides {
  routes: Record<string, PixGridProgramRouteOverride>
  sections: Record<string, PixGridProgramSectionOverride>
}

export interface PixGridPerformanceSettings {
  enabled: boolean
  intensity: number
  sharedPerformanceProgramId: PixGridPerformanceProgramId | null
  seed: number
  lockedRoutes: string[]
  programOverrides: PixGridPerformanceProgramOverrides
}

export type PixGridFitMode = 'contain' | 'cover' | 'stretch'
export type PixGridSamplingMode = 'crisp' | 'smooth'
export type PixGridColorMode = 'original' | 'hybrid' | 'brand' | 'preset'
export type PixGridDitherMode = 'none' | 'ordered-bayer' | 'atkinson'
export type PixGridBackgroundHandling = 'transparent' | 'solid' | 'remove-dark'

export interface PixGridConversionSettings {
  selectedMediaId: string | null
  fitMode: PixGridFitMode
  positionX: number
  positionY: number
  scale: number
  sampling: PixGridSamplingMode
  colorMode: PixGridColorMode
  paletteSize: number
  ditherMode: PixGridDitherMode
  alphaThreshold: number
  preserveAlpha: boolean
  contrast: number
  brightness: number
  saturation: number
  edgeEnhancement: number
  backgroundHandling: PixGridBackgroundHandling
  backgroundColor: string
  brandStrength: number
  preserveBlack: boolean
  preserveWhite: boolean
}


export type PixGridStateOrigin = 'builtInPreset' | 'custom'
export type PixGridPresetLineage =
  | 'current-canonical-built-in'
  | 'untouched-legacy-built-in'
  | 'legacy-built-in-minor-customization'
  | 'legacy-built-in-custom-overlays'
  | 'fully-custom'
  | 'unknown'

export interface PixGridMigrationDiagnostics {
  applied: boolean
  fromStateVersion: number
  toStateVersion: number
  fromPresetConfigurationVersion: number
  toPresetConfigurationVersion: number
  groupsAdded: number
  groupsPreserved: number
  groupsUpgraded: number
  assignmentsAdded: number
  assignmentsPreserved: number
  assignmentsUpgraded: number
  layersAdded: number
  scenesAdded: number
  fallbackRoutesActive: boolean
  originalBuiltInPresetId?: string | null
  programsUpgraded?: number
  customizationsPreserved?: boolean
  conflicts?: readonly string[]
  skippedUpgrades?: readonly string[]
  fallbackRoutingInstalled?: boolean
  detectedPresetLineage?: PixGridPresetLineage
  fromLayerGraphVersion?: number
  toLayerGraphVersion?: number
  fromSmartGroupConfigurationVersion?: number
  toSmartGroupConfigurationVersion?: number
  fromAudioRouteConfigurationVersion?: number
  toAudioRouteConfigurationVersion?: number
  fromPerformanceProgramConfigurationVersion?: number
  toPerformanceProgramConfigurationVersion?: number
  canonicalLayersAdded?: readonly string[]
  legacyLayersMapped?: readonly string[]
  legacyLayersPreservedAsOverlays?: readonly string[]
  obsoleteOfficialLayersRemoved?: readonly string[]
  sceneReferencesRepaired?: number
  groupsRepaired?: readonly string[]
  emptyGroups?: readonly string[]
  missingLayerGroups?: readonly string[]
  assignmentsRepaired?: readonly string[]
  ineffectiveAssignments?: readonly string[]
  effectiveLiveRouteCount?: number
  migrationCompleted?: boolean
  safeRecoveryUsed?: boolean
}

export interface PixGridCanonicalSignatures {
  groups: Record<string, string>
  assignments: Record<string, string>
  layerAnimations: Record<string, string>
}

export interface PixGridConfigurationMetadata {
  metadataVersion: number
  origin: PixGridStateOrigin
  sourcePresetId: string | null
  presetConfigurationVersion: number
  layerGraphVersion: number
  smartGroupConfigurationVersion: number
  audioRouteConfigurationVersion: number
  performanceProgramConfigurationVersion: number
  musicReactiveConfigurationVersion: number
  userCustomized: boolean
  legacyOfficialLayerGraph: boolean
  genuineUserLayers: boolean
  canonicalMigrationCompleted: boolean
  canonicalSignatures: PixGridCanonicalSignatures
  lastMigration: PixGridMigrationDiagnostics | null
}

export interface PixGridRuntimeDiagnosticsSettings {
  showFps: boolean
  showMatrixBounds: boolean
  logLifecycle: boolean
  /** Advanced authoring diagnostics remain opt-in during normal playback. */
  showAudioReactionInspector?: boolean
}

export interface PixGridPresetSettings {
  /** Version of the authored first-party preset configuration. */
  authoredConfigurationVersion?: number
  pattern: PixGridPatternId
  quality?: PixGridQualityTier
  backgroundMode?: PixGridBackgroundMode
  backgroundColor?: string
  backgroundBrightness?: number
  cellGap?: number
  cellRoundness?: number
  cellBrightness?: number
  globalIntensity?: number
  glowAmount?: number
  diffusion?: number
  rgbSubpixelMode?: boolean
  selectedSceneId?: string | null
  layers?: PixGridLayer[]
  groups?: PixGridGroup[]
  /** Editable authored routes that are not owned by a specific smart group. */
  audioAssignments?: PixGridReactionAssignment[]
  performanceProgramId?: PixGridPerformanceProgramId
  sceneSettings?: Record<string, PixGridSceneSettings>
}

export interface PixGridState {
  version: typeof PIX_GRID_STATE_VERSION
  configuration: PixGridConfigurationMetadata
  quality: PixGridQualityTier
  qualityMode: PixGridQualityMode
  matrixWidth: number
  matrixHeight: number
  backgroundMode: PixGridBackgroundMode
  backgroundColor: string
  backgroundBrightness: number
  cellGap: number
  cellRoundness: number
  cellBrightness: number
  globalIntensity: number
  glowAmount: number
  diffusion: number
  rgbSubpixelMode: boolean
  stoppedBehavior: PixGridStoppedBehavior
  selectedPresetId: string | null
  selectedSceneId: string | null
  authoringOverlayVisible: boolean
  editorTool: PixGridEditorTool
  editor: PixGridEditorSettings
  scenes: PixGridScene[]
  layers: PixGridLayer[]
  groups: PixGridGroup[]
  /** Versioned authored routes outside a specific group. Group-local routes remain on PixGridGroup.reactions. */
  audioAssignments: PixGridReactionAssignment[]
  pixelOverrides: PixGridPixelOverride[]
  performance: PixGridPerformanceSettings
  conversion: PixGridConversionSettings
  diagnostics: PixGridRuntimeDiagnosticsSettings
}

export interface PixGridAudioFrame {
  audioTime: number
  bass: number
  mid: number
  high: number
  volume: number
  beatHit: boolean
  beatPhase: number
  isPlaying: boolean
  sub?: number
  lowMid?: number
  air?: number
  energy?: number
  trackRelativeEnergy?: number
  spectralFlux?: number
  spectralBrightness?: number
  tension?: number
  complexity?: number
  buildProgress?: number
  sectionProgress?: number
  phraseProgress?: number
  barProgress?: number
  sectionRelativeEnergy?: number
  sectionConfidence?: number
  phraseConfidence?: number
  vocalEnergy?: number
  vocalActivity?: number
  drumActivity?: number
  bassStemActivity?: number
  melodyActivity?: number
  semanticMomentStrength?: number
  downbeatHit?: boolean
  kickHit?: boolean
  snareHit?: boolean
  hatHit?: boolean
  transientHit?: boolean
  barEntry?: boolean
  fourBarBoundary?: boolean
  eightBarBoundary?: boolean
  sixteenBarBoundary?: boolean
  phraseEntry?: boolean
  sectionEntry?: boolean
  sectionExit?: boolean
  dropImpactHit?: boolean
  dropOccurrenceChange?: boolean
  semanticMomentHit?: boolean
  trackMapCueEvent?: boolean
  trackMapCueIdentity?: string | null
  beatIndex?: number
  barIndex?: number
  phraseIndex?: number
  sectionOccurrence?: number
  dropOccurrence?: number
  sectionType?: ReactSectionType | null
  sectionPhase?: 'none' | 'entry' | 'body' | 'exit'
  phraseSegment?: PixGridPhraseSegment
  autoPerformanceEnabled?: boolean
  deltaTimeSec?: number
  timingDiscontinuity?: boolean
  trackIdentity?: string | null
  sourceValues?: Partial<Record<PixGridReactionSource, number>>
  /** Source values before PixGrid-local Bass Reactivity is applied. */
  unscaledSourceValues?: Partial<Record<PixGridReactionSource, number>>
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>
  confidence?: Partial<Record<PixGridReactionSource, number>>
  eventIdentities?: Partial<Record<PixGridDiscreteAudioSource, string>>
  /** PixGrid-local master gain applied before route evaluation. */
  bassReactivityGain?: number
  /** PixGrid-local autonomous animation multiplier. */
  motionMultiplier?: number
  /** Integrated motion clocks prevent live Motion changes from jumping phase. */
  motionClockTime?: number
  motionClockBeat?: number
  motionClockBar?: number
  transportState?: 'playing' | 'paused' | 'stopped'
  inputSource?: 'analyser' | 'shared-bus' | 'neutral' | 'editor-preview'
  analyserConnected?: boolean
  analyserActive?: boolean
  sharedPerformanceCoreAvailable?: boolean
  inputFrameAgeMs?: number | null
  inputSourceId?: string | null
  aggregateSourceConfidence?: number
  stemAvailability?: readonly PixGridReactionSource[]
}


export interface PixGridRendererDiagnostics {
  path: PixGridRendererPath
  logicalWidth: number
  logicalHeight: number
  presentationWidth: number
  presentationHeight: number
  fps: number
  logicalFramebufferAllocated: boolean
  logicalAllocationCount: number
  contextState: PixGridContextState
  fallbackReason: string | null
  approximateGpuResourceCount: number
  requestedQuality?: PixGridQualityTier
  effectiveQuality?: PixGridQualityTier
  adaptiveStage?: number
  adaptiveReason?: string
  preparedMediaCacheEntries?: number
  preparedMediaCacheBytes?: number
  enabledGroupCount?: number
  activeGroupMaskCount?: number
  activeContinuousAssignmentCount?: number
  activeDiscreteAssignmentCount?: number
  activeEventEnvelopeCount?: number
  activePerformanceActionCount?: number
  activeCueActionCount?: number
  activeTransitionCount?: number
  manualOverrideCount?: number
  degradedSignalCount?: number
  totalGroupCount?: number
  programGeneratedRouteCount?: number
  userAuthoredRouteCount?: number
  missingTargetCount?: number
  assignmentCompilerWarningCount?: number
  rendererWarningCount?: number
  groupMaskUploadCount?: number
  groupMaskApproximateBytes?: number
  stateSchemaVersion?: number
  presetConfigurationVersion?: number
  layerGraphVersion?: number
  canonicalMigrationCompleted?: boolean
  migrationApplied?: boolean
  migrationDetectedPresetLineage?: string
  migrationCanonicalLayersAdded?: number
  migrationLegacyLayersMapped?: number
  migrationSceneReferencesRepaired?: number
  migrationEmptyGroupCount?: number
  migrationMissingLayerGroupCount?: number
  migrationIneffectiveAssignmentCount?: number
  migrationEffectiveLiveRouteCount?: number
  migrationSafeRecoveryUsed?: boolean
  migrationGroupsAdded?: number
  migrationGroupsPreserved?: number
  migrationGroupsUpgraded?: number
  migrationAssignmentsAdded?: number
  migrationAssignmentsPreserved?: number
  migrationAssignmentsUpgraded?: number
  activeAudioSourceCount?: number
  activeAssignmentCount?: number
  fallbackRoutesActive?: boolean
  effectiveBassReactivityGain?: number
  effectiveMotionMultiplier?: number
  affectedGroupCount?: number
  affectedCellCount?: number
  activeAffectedGroupIds?: readonly string[]
  activeRouteCount?: number
  activeEnvelopePhase?: string
  audioInputStatus?: string
  analyserActive?: boolean
  sharedPerformanceCoreAvailable?: boolean
  validationErrorCount?: number
  validationWarningCount?: number
  migrationProgramsUpgraded?: number
  migrationCustomizationsPreserved?: boolean
  migrationConflictCount?: number
  migrationSkippedUpgradeCount?: number
  perceptualSampleSequence?: number
  changedVisibleCellCount?: number
  changedVisibleCellPercentage?: number
  meanBrightnessDelta?: number
  peakBrightnessDelta?: number
  meanPerceptualColorDistance?: number
  localizedGroupChangePercentage?: number
  currentAudioOnsetStrength?: number
  recentOnsetToPixelCorrelation?: number
  silenceBaselineDifference?: number
  sceneTransitionActivity?: number
  perceptualVisibleCellCount?: number
  perceptualAffectedGroupCellCount?: number
  truthfulReactivityState?: string
  truthfulReactivityLabel?: string
  truthfulReactivityTone?: 'positive' | 'neutral' | 'warning' | 'error'
  truthfulReactivityMessage?: string
  truthfulReactivityFlags?: readonly string[]
}
