import type { OscillatorSettings } from '../ReactTypes'
import {
  soundDrawingPerformanceShowGenerators,
  soundDrawingPerformanceShowUsesGenerator,
} from './SoundDrawingPerformanceShows'
import type {
  SoundDrawingGeneratorFamily,
  SoundDrawingPerformanceSettings,
  SoundDrawingPerformanceShowId,
} from './SoundDrawingPerformanceTypes'

const POINT_PATH_GENERATORS = new Set<SoundDrawingGeneratorFamily>([
  'circularBassMembrane',
  'kaleidoscopicTrace',
  'particleSpline',
])

const VISUAL_SIZE_GENERATORS = new Set<SoundDrawingGeneratorFamily>([
  ...POINT_PATH_GENERATORS,
  'harmonicRibbon',
  'stackedWaveformBands',
  'professionalScope',
])

const MASTER_MOTION_GENERATORS = new Set<SoundDrawingGeneratorFamily>([
  ...POINT_PATH_GENERATORS,
  'polarWaveform',
  'vectorFieldStreamlines',
])

const MASTER_GLOW_GENERATORS = new Set<SoundDrawingGeneratorFamily>([
  ...POINT_PATH_GENERATORS,
  'livingRibbon',
  'professionalScope',
])

export interface SoundDrawingControlCapabilities {
  visualSize: boolean
  masterMotion: boolean
  masterGlow: boolean
  masterBassReactivity: boolean
  trailDecay: boolean
  renderMode: boolean
  duplicateTraces: boolean
  rotationSpeed: boolean
  mirror: boolean
  audioDisplacement: boolean
  audioDisplaceMode: boolean
  bassScale: boolean
  midTwist: boolean
  altTwist: boolean
  highJitter: boolean
  beatBloom: boolean
  textLetterMotion: boolean
  textWaveformMode: boolean
  textWaveformDetails: boolean
  svgReactPalette: boolean
  pathResolution: boolean
}

export interface SoundDrawingControlCapabilityInput {
  oscillator: OscillatorSettings
  performanceSettings: SoundDrawingPerformanceSettings
  isSvgOriginalArtwork: boolean
}

function hasAnyGenerator(
  activeGenerators: ReadonlySet<SoundDrawingGeneratorFamily>,
  supportedGenerators: ReadonlySet<SoundDrawingGeneratorFamily>,
): boolean {
  for (const generator of activeGenerators) {
    if (supportedGenerators.has(generator)) return true
  }
  return false
}

function resolvePerformanceShowCapabilities(showId: SoundDrawingPerformanceShowId): SoundDrawingControlCapabilities {
  const activeGenerators = new Set(soundDrawingPerformanceShowGenerators(showId))
  const usesPointPath = hasAnyGenerator(activeGenerators, POINT_PATH_GENERATORS)
  return {
    visualSize: hasAnyGenerator(activeGenerators, VISUAL_SIZE_GENERATORS),
    masterMotion: hasAnyGenerator(activeGenerators, MASTER_MOTION_GENERATORS),
    masterGlow: hasAnyGenerator(activeGenerators, MASTER_GLOW_GENERATORS),
    masterBassReactivity: [...activeGenerators].some((generator) => generator !== 'livingRibbon'),
    trailDecay: true,
    // Authored performance builds these values from layer/show state before the
    // selected generator is dispatched, so the persisted manual values are not
    // consumers for an active Performance Show.
    renderMode: false,
    duplicateTraces: false,
    rotationSpeed: false,
    mirror: false,
    audioDisplacement: false,
    audioDisplaceMode: usesPointPath,
    bassScale: usesPointPath,
    midTwist: usesPointPath,
    altTwist: usesPointPath,
    highJitter: false,
    beatBloom: usesPointPath,
    textLetterMotion: false,
    textWaveformMode: false,
    textWaveformDetails: false,
    svgReactPalette: false,
    pathResolution: false,
  }
}

function resolveManualCapabilities(
  oscillator: OscillatorSettings,
  isSvgOriginalArtwork: boolean,
): SoundDrawingControlCapabilities {
  const isClassic = oscillator.sourceType === 'classic'
  const isProfessionalScope =
    isClassic &&
    !oscillator.autoSectionMode &&
    oscillator.classicMode === 'professionalScope'
  const canReachSpiralScope =
    isClassic &&
    (oscillator.autoSectionMode || oscillator.classicMode === 'sectionAuto' || oscillator.classicMode === 'spiralScope')
  const isOriginalArtwork = !isClassic && isSvgOriginalArtwork
  const usesPointPath = !isClassic && !isOriginalArtwork
  const isTextPath = usesPointPath && oscillator.sourceType === 'text'
  const textWaveformActive = isTextPath && oscillator.textWaveformMode !== 'off'
  const usesGenericDisplacement = usesPointPath && !textWaveformActive
  const usesPathFrequencyResponse = usesPointPath || isOriginalArtwork

  return {
    visualSize: usesPointPath || isOriginalArtwork || isProfessionalScope,
    masterMotion: usesPointPath || isOriginalArtwork || canReachSpiralScope,
    masterGlow: usesPointPath || isProfessionalScope,
    masterBassReactivity: true,
    trailDecay: true,
    renderMode: usesPointPath,
    duplicateTraces: usesPointPath || isOriginalArtwork,
    rotationSpeed: usesPointPath || isOriginalArtwork,
    mirror: usesPointPath,
    audioDisplacement: isOriginalArtwork || usesGenericDisplacement,
    audioDisplaceMode: usesGenericDisplacement,
    bassScale: usesPathFrequencyResponse,
    midTwist: usesPathFrequencyResponse,
    altTwist: usesPathFrequencyResponse,
    highJitter: usesPathFrequencyResponse,
    beatBloom: usesPathFrequencyResponse,
    textLetterMotion: isTextPath,
    textWaveformMode: isTextPath,
    textWaveformDetails: textWaveformActive,
    svgReactPalette: isOriginalArtwork,
    pathResolution: usesPointPath,
  }
}

/**
 * Canonical UI capability contract for Sound Drawing's persisted manual controls.
 * It describes whether the active production branch can read each value; values
 * remain in state when a capability is false so switching modes/presets is lossless.
 */
export function resolveSoundDrawingControlCapabilities(
  input: SoundDrawingControlCapabilityInput,
): SoundDrawingControlCapabilities {
  const showId = input.performanceSettings.selectedShowId
  if (showId != null) return resolvePerformanceShowCapabilities(showId)
  return resolveManualCapabilities(input.oscillator, input.isSvgOriginalArtwork)
}

export function shouldShowLivingRibbonControls(settings: SoundDrawingPerformanceSettings): boolean {
  return settings.selectedShowId != null && soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'livingRibbon')
}
