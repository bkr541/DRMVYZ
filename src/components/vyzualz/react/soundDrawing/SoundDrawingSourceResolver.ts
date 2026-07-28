import type { OscillatorSettings } from '../ReactTypes'
import { resolveUnifiedSvgSource } from '../svgSourceLifecycle'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_SVG_DUPLICATES,
  MAX_SOUND_DRAWING_TEXT_DUPLICATES,
  type SoundDrawingGeneratorFamily,
  type SoundDrawingIdentityProfile,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingResolvedPerformanceLayer,
  type SoundDrawingResolvedPerformanceSource,
  type SoundDrawingSourceTreatment,
  type SoundDrawingSourceUsePolicy,
} from './SoundDrawingPerformanceTypes'

export interface SoundDrawingSourceResolution {
  layers: SoundDrawingResolvedPerformanceLayer[]
  activeSourceKind: SoundDrawingResolvedPerformanceSource['kind']
  activeIdentityProfile: SoundDrawingIdentityProfile
  activeTreatment: SoundDrawingSourceTreatment
  preserveIdentity: boolean
  sourceRole: SoundDrawingSourceUsePolicy | 'generatedOnly'
  contourBudget: number
  requestedContourDeformation: number
  appliedContourDeformation: number
  readabilityClampApplied: boolean
  supportingGeneratedLayers: string[]
  sourceFallbackState: string | null
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value, min)))
}

function clamp01(value: unknown): number {
  return clamp(finite(value), 0, 1)
}

function generatedSource(generator: SoundDrawingGeneratorFamily, identity: string): SoundDrawingResolvedPerformanceSource {
  return { kind: 'generated', generator, identity }
}

function profileForSvg(renderMode: 'original-artwork' | 'traced-path'): SoundDrawingIdentityProfile {
  return renderMode === 'original-artwork' ? 'originalArtwork' : 'logo'
}

function resolveRequestedSource(
  oscillator: OscillatorSettings,
  settings: SoundDrawingPerformanceSettings,
): {
  source: SoundDrawingResolvedPerformanceSource | null
  profile: SoundDrawingIdentityProfile
  fallback: string | null
} {
  const textMode = oscillator.textSource ?? 'static'
  const textSource = oscillator.sourceType === 'text'
    && (oscillator.text.trim().length > 0 || textMode !== 'static')
    ? {
        kind: 'text' as const,
        identity: `text:${oscillator.textFontId ?? 'canvas'}:${textMode}:${textMode === 'static' ? oscillator.text : oscillator.lyricFallbackText}`,
        textId: oscillator.textFontId ?? undefined,
        preserveReadability: settings.preserveIdentity,
      }
    : null

  const svg = resolveUnifiedSvgSource(oscillator)
  const svgSource = svg?.mediaId
    ? {
        kind: 'svg' as const,
        identity: `svg:${svg.mediaId}:${svg.renderMode}`,
        svgId: svg.mediaId,
        renderMode: (svg.renderMode === 'reactivePath' ? 'traced-path' : 'original-artwork') as 'original-artwork' | 'traced-path',
        preserveIdentity: settings.preserveIdentity,
      }
    : null

  const activeUserSource = oscillator.sourceType === 'builtinShape'
    || (oscillator.sourceType === 'svgGlyph' && !svg?.mediaId)
    ? { kind: 'active-user-source' as const, identity: `active:${oscillator.sourceType}:${oscillator.builtinShape}:${oscillator.selectedGlyphId ?? 'none'}` }
    : null

  switch (settings.performanceSource) {
    case 'generatedVisual':
      return { source: null, profile: 'abstract', fallback: null }
    case 'activeText':
      return textSource
        ? { source: textSource, profile: 'readableText', fallback: null }
        : { source: null, profile: 'abstract', fallback: 'Active Text was requested but no text source is selected.' }
    case 'activeSvg':
      return svgSource
        ? { source: svgSource, profile: profileForSvg(svgSource.renderMode), fallback: null }
        : { source: null, profile: 'abstract', fallback: 'Active SVG was requested but no valid SVG source is selected.' }
    case 'activeUserSource':
      if (textSource) return { source: textSource, profile: 'readableText', fallback: null }
      if (svgSource) return { source: svgSource, profile: profileForSvg(svgSource.renderMode), fallback: null }
      if (activeUserSource) return { source: activeUserSource, profile: 'abstract', fallback: null }
      if (oscillator.sourceType === 'text') {
        return { source: null, profile: 'abstract', fallback: 'The active user text source is empty.' }
      }
      if (svg) {
        return { source: null, profile: 'abstract', fallback: 'The active user SVG source is unavailable.' }
      }
      return { source: null, profile: 'abstract', fallback: null }
  }
}

function treatmentBudget(
  profile: SoundDrawingIdentityProfile,
  treatment: SoundDrawingSourceTreatment,
  contourReactivity: number,
  preserveIdentity: boolean,
): number {
  if (profile === 'originalArtwork' || treatment === 'preserveIdentity') return 0
  const profileCeiling = profile === 'readableText'
    ? 0.03
    : profile === 'logo'
      ? 0.05
      : profile === 'illustration'
        ? 0.08
        : 0.25
  const treatmentScale = treatment === 'controlledReactive'
    ? 0.72
    : treatment === 'liquidContour'
      ? 1.65
      : 4
  const absoluteCeiling = profile === 'readableText'
    ? (treatment === 'liquidContour' ? 0.06 : treatment === 'abstractDeformation' ? 0.25 : 0.03)
    : profile === 'logo'
      ? (treatment === 'liquidContour' ? 0.085 : treatment === 'abstractDeformation' ? 0.25 : 0.05)
      : profile === 'illustration'
        ? (treatment === 'liquidContour' ? 0.12 : treatment === 'abstractDeformation' ? 0.25 : 0.08)
        : 0.25
  const requestedBudget = clamp(profileCeiling * treatmentScale * (0.35 + clamp01(contourReactivity) * 0.65), 0, absoluteCeiling)
  if (!preserveIdentity) return requestedBudget
  const preservationCeiling = profile === 'readableText'
    ? 0.03
    : profile === 'logo'
      ? 0.05
      : profile === 'illustration'
        ? 0.08
        : 0.08
  return Math.min(requestedBudget, preservationCeiling)
}

export function computeCombinedContourBudget(input: {
  profile: SoundDrawingIdentityProfile
  treatment: SoundDrawingSourceTreatment
  contourReactivity: number
  waveform: number
  twist: number
  jitter: number
  character: number
  section: number
  event: number
  preserveIdentity?: boolean
}): { budget: number; requested: number; applied: number; scale: number; clamped: boolean } {
  const budget = treatmentBudget(input.profile, input.treatment, input.contourReactivity, input.preserveIdentity === true)
  const requested = Math.max(0,
    finite(input.waveform) + finite(input.twist) + finite(input.jitter) +
    finite(input.character) + finite(input.section) + finite(input.event),
  )
  if (requested <= 0 || budget <= 0) {
    return { budget, requested, applied: 0, scale: 0, clamped: requested > 0 }
  }
  const scale = Math.min(1, budget / requested)
  return { budget, requested, applied: requested * scale, scale, clamped: scale < 0.999999 }
}

function estimateRequestedContour(layer: SoundDrawingResolvedPerformanceLayer, oscillator: OscillatorSettings): number {
  const waveform = oscillator.sourceType === 'text' && oscillator.textWaveformMode !== 'off'
    ? clamp01(oscillator.textWaveformAmount)
    : layer.audioDisplacement
  const twist = clamp01(oscillator.midTwist) * 0.08
  const jitter = layer.jitter
  const character = oscillator.sourceType === 'text' && oscillator.textLetterReactionMode !== 'uniform'
    ? 0.04
    : 0
  return waveform + twist + jitter + character
}

function supportingGeneratorForShow(showId: string, primary: SoundDrawingResolvedPerformanceLayer): SoundDrawingGeneratorFamily {
  if (showId === 'harmonicRibbonReactor') return 'harmonicRibbon'
  if (showId === 'livingRibbonSystem') return 'livingRibbon'
  if (showId === 'phaseKnotCathedral') return 'phaseScopeKnot'
  return primary.generator === 'circularBassMembrane' ? primary.generator : 'radialOscilloscope'
}

function sourceAwareSectionAdjustments(
  layer: SoundDrawingResolvedPerformanceLayer,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): Partial<SoundDrawingResolvedPerformanceLayer> {
  const section = `${context.macroSectionType ?? context.sectionType ?? 'unknown'}`.toLowerCase()
  const fourBar = context.performanceFourBarBlockIndex ?? 0
  const eightBar = Math.floor(fourBar / 2)
  const sixteenBar = Math.floor(fourBar / 4)
  const kick = context.kick ? context.kickStrength : 0
  const snare = context.snare ? context.snareStrength : 0
  const hat = context.hat ? context.hatStrength : 0
  const downbeat = context.intelligence.rhythm.downbeatHit || context.downbeat
  const motion = settings.locks.wholeObjectMotion ? 0 : settings.wholeObjectMotion

  let scale = layer.scale
  let rotation = layer.rotation
  let x = layer.x
  let y = layer.y
  let opacity = layer.opacity
  let strokeWidth = layer.strokeWidth
  let glow = layer.glow
  let traceCount = layer.traceCount
  let sourceTrailStrength = layer.sourceTrailStrength
  let echoStrength = layer.echoStrength

  if (!settings.locks.scale) scale *= 1 + kick * 0.055 * settings.reactionIntensity
  if (!settings.locks.glow) glow += kick * 0.22 + snare * 0.18 + hat * 0.045
  strokeWidth += hat * 0.08
  if (!settings.locks.echoBehavior) echoStrength += snare * 0.32
  if (!settings.locks.rotation) rotation += snare * (fourBar % 2 === 0 ? 2.5 : -2.5) * motion
  if (!settings.locks.wholeObjectMotion) {
    x += Math.sin(context.absoluteBeat * Math.PI * 0.25 + fourBar) * 0.012 * motion
    y += Math.cos(context.absoluteBeat * Math.PI * 0.125 + eightBar) * 0.009 * motion
  }

  if (section.includes('intro')) {
    opacity *= 0.75 + context.sectionProgress * 0.25
    glow *= 0.65
    sourceTrailStrength *= 0.45
  } else if (section.includes('verse')) {
    rotation *= 0.35
    sourceTrailStrength *= 0.55
  } else if (section.includes('build')) {
    scale *= 0.96 - context.sectionProgress * 0.035
    glow += context.buildProgress * 0.22
    sourceTrailStrength *= 0.7
  } else if (section.includes('pre') && section.includes('drop')) {
    scale *= 0.91
    rotation *= 0.08
    x *= 0.25
    y *= 0.25
    sourceTrailStrength *= 0.25
    echoStrength *= 0.2
  } else if (section.includes('drop')) {
    scale *= 1.03 + (downbeat ? 0.07 : 0)
    glow += 0.16 + (downbeat ? 0.22 : 0)
    echoStrength += (fourBar % 2) * 0.08
    if (sixteenBar > 0) scale *= 1.035
  } else if (section.includes('break')) {
    rotation *= 0.15
    glow *= 0.7
    sourceTrailStrength = Math.min(sourceTrailStrength, 0.35)
    echoStrength = Math.min(echoStrength + 0.08, 0.42)
  } else if (section.includes('outro')) {
    opacity *= 1 - context.sectionProgress * 0.45
    glow *= 0.55
    sourceTrailStrength *= 0.35
  }

  if (downbeat && !settings.locks.wholeObjectMotion) {
    x += ((fourBar % 3) - 1) * 0.018 * motion
    y += (eightBar % 2 === 0 ? -1 : 1) * 0.012 * motion
  }

  return {
    scale: settings.locks.scale ? layer.scale : scale,
    rotation: settings.locks.rotation ? layer.rotation : rotation,
    x: settings.locks.wholeObjectMotion ? layer.x : x,
    y: settings.locks.wholeObjectMotion ? layer.y : y,
    opacity,
    strokeWidth,
    glow: settings.locks.glow ? layer.glow : glow,
    traceCount,
    sourceTrailStrength: settings.locks.trailBehavior ? layer.sourceTrailStrength : sourceTrailStrength,
    echoStrength: settings.locks.echoBehavior ? layer.echoStrength : echoStrength,
  }
}

function makeSelectedSourceLayer(
  primary: SoundDrawingResolvedPerformanceLayer,
  source: SoundDrawingResolvedPerformanceSource,
  profile: SoundDrawingIdentityProfile,
  settings: SoundDrawingPerformanceSettings,
  context: SharedPerformanceContext,
): SoundDrawingResolvedPerformanceLayer {
  const initial = {
    ...primary,
    id: `${primary.id}:selected-source`,
    role: 'primaryMotif' as const,
    source,
    identityProfile: profile,
    treatment: settings.sourceTreatment,
    preserveIdentity: settings.preserveIdentity,
    traceCount: 1,
    symmetry: 1,
    audioDisplacement: primary.audioDisplacement,
    jitter: primary.jitter,
    wholeObjectMotion: settings.wholeObjectMotion,
    contourReactivity: settings.contourReactivity,
    echoStrength: settings.echoStrength,
    sourceTrailStrength: settings.sourceTrailStrength,
    supportingVisualReactivity: settings.supportingVisualReactivity,
    allowCharacterDeformation: !settings.preserveIdentity
      && (settings.sourceTreatment === 'abstractDeformation' || settings.sourceTreatment === 'liquidContour'),
    allowTextWaveform: settings.sourceTreatment !== 'preserveIdentity',
    sourceFailure: null,
  }
  return { ...initial, ...sourceAwareSectionAdjustments(initial, context, settings) }
}

function applyContourBudget(
  layer: SoundDrawingResolvedPerformanceLayer,
  oscillator: OscillatorSettings,
): SoundDrawingResolvedPerformanceLayer {
  const requested = estimateRequestedContour(layer, oscillator)
  if (layer.treatment === 'preserveIdentity' || layer.identityProfile === 'originalArtwork') {
    return {
      ...layer,
      contourBudget: 0,
      requestedContourDeformation: requested,
      appliedContourDeformation: 0,
      readabilityClamped: requested > 0,
      contourScale: 0,
      audioDisplacement: 0,
      jitter: 0,
    }
  }
  const budget = computeCombinedContourBudget({
    profile: layer.identityProfile,
    treatment: layer.treatment,
    contourReactivity: layer.contourReactivity,
    waveform: oscillator.sourceType === 'text' && oscillator.textWaveformMode !== 'off' ? oscillator.textWaveformAmount : layer.audioDisplacement,
    twist: oscillator.midTwist * 0.08,
    jitter: layer.jitter,
    character: oscillator.sourceType === 'text' && oscillator.textLetterReactionMode !== 'uniform' ? 0.04 : 0,
    section: 0,
    event: 0,
    preserveIdentity: layer.preserveIdentity,
  })
  return {
    ...layer,
    contourBudget: budget.budget,
    requestedContourDeformation: requested,
    appliedContourDeformation: budget.applied,
    readabilityClamped: budget.clamped,
    contourScale: budget.scale,
    audioDisplacement: layer.audioDisplacement * budget.scale,
    jitter: layer.jitter * budget.scale,
  }
}

export function resolveSoundDrawingPerformanceSources(input: {
  showId: string
  layers: readonly SoundDrawingResolvedPerformanceLayer[]
  oscillator: OscillatorSettings
  settings: SoundDrawingPerformanceSettings
  context: SharedPerformanceContext
}): SoundDrawingSourceResolution {
  const sourceResolution = resolveRequestedSource(input.oscillator, input.settings)
  const authored = input.layers.map(layer => ({
    ...layer,
    source: generatedSource(layer.generator, `generated:${input.showId}:${layer.id}`),
    identityProfile: 'abstract' as const,
    treatment: 'abstractDeformation' as const,
    preserveIdentity: false,
    contourBudget: 0.25,
    requestedContourDeformation: layer.audioDisplacement + layer.jitter,
    appliedContourDeformation: layer.audioDisplacement + layer.jitter,
    readabilityClamped: false,
    contourScale: 1,
    allowCharacterDeformation: true,
    allowTextWaveform: true,
    wholeObjectMotion: input.settings.wholeObjectMotion,
    contourReactivity: input.settings.contourReactivity,
    echoStrength: input.settings.echoStrength,
    sourceTrailStrength: input.settings.sourceTrailStrength,
    supportingVisualReactivity: input.settings.supportingVisualReactivity,
    sourceFailure: null,
  }))

  // A genuine scope is a signal generator, not a replaceable artwork slot.
  // User text/SVG integration may replace another primary motif, but never the
  // synchronized measurement layer declared by the show.
  const primary =
    authored.find(layer => layer.role === 'primaryMotif' && layer.generator !== 'professionalScope') ??
    authored.find(layer => layer.generator !== 'professionalScope') ??
    authored.find(layer => layer.role === 'primaryMotif') ??
    authored[0]
  if (!primary || !sourceResolution.source || input.settings.performanceSource === 'generatedVisual') {
    return {
      layers: authored.slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS),
      activeSourceKind: 'generated',
      activeIdentityProfile: 'abstract',
      activeTreatment: 'abstractDeformation',
      preserveIdentity: false,
      sourceRole: 'generatedOnly',
      contourBudget: 0.25,
      requestedContourDeformation: authored.reduce((sum, layer) => sum + layer.requestedContourDeformation, 0),
      appliedContourDeformation: authored.reduce((sum, layer) => sum + layer.appliedContourDeformation, 0),
      readabilityClampApplied: false,
      supportingGeneratedLayers: authored.filter(layer => layer.role !== 'primaryMotif').map(layer => layer.id),
      sourceFallbackState: sourceResolution.fallback,
    }
  }

  let selected = applyContourBudget(
    makeSelectedSourceLayer(primary, sourceResolution.source, sourceResolution.profile, input.settings, input.context),
    input.oscillator,
  )
  const scopeOnlyPrimary = primary.generator === 'professionalScope'
  if (scopeOnlyPrimary) {
    selected = {
      ...selected,
      generator: 'horizontalOscilloscope',
      classicMode: 'waveform',
      professionalScope: null,
    }
  }
  const supportGenerator = supportingGeneratorForShow(input.showId, primary)
  const generatedPrimarySupport: SoundDrawingResolvedPerformanceLayer = scopeOnlyPrimary ? {
    ...primary,
    role: 'harmonicLayer',
  } : {
    ...primary,
    id: `${primary.id}:generated-support`,
    role: 'harmonicLayer',
    generator: supportGenerator,
    source: generatedSource(supportGenerator, `generated:${input.showId}:${primary.id}:support`),
    opacity: primary.opacity * (0.38 + input.settings.supportingVisualReactivity * 0.32),
    scale: primary.scale * (1.12 + input.context.performanceFourBarBlockIndex * 0.012),
    audioDisplacement: primary.audioDisplacement * input.settings.supportingVisualReactivity,
    jitter: primary.jitter * input.settings.supportingVisualReactivity,
    traceCount: Math.min(primary.traceCount, 3),
    identityProfile: 'abstract',
    treatment: 'abstractDeformation',
    preserveIdentity: false,
    sourceFailure: null,
  }

  let layers: SoundDrawingResolvedPerformanceLayer[]
  if (input.settings.useSourceAs === 'supportingLayer') {
    const selectedSupport = {
      ...selected,
      id: `${selected.id}:support`,
      role: 'echoLayer' as const,
      opacity: selected.opacity * 0.62,
      scale: selected.scale * 0.88,
      echoStrength: Math.min(selected.echoStrength, 0.35),
    }
    layers = [primary, selectedSupport, ...authored.filter(layer => layer.id !== primary.id)]
  } else {
    const selectedEcho = input.settings.useSourceAs === 'both'
      ? [{
          ...selected,
          id: `${selected.id}:echo`,
          role: 'echoLayer' as const,
          opacity: selected.opacity * clamp(input.settings.echoStrength, 0.08, 0.45),
          scale: selected.scale * 1.035,
          rotation: selected.rotation * 0.35,
          traceCount: 1,
        }]
      : []
    layers = [
      selected,
      generatedPrimarySupport,
      ...selectedEcho,
      ...authored.filter(layer => layer.id !== primary.id),
    ]
  }

  const sourceDuplicateLimit = selected.source.kind === 'text'
    ? MAX_SOUND_DRAWING_TEXT_DUPLICATES
    : MAX_SOUND_DRAWING_SVG_DUPLICATES
  let sourceCopies = 0
  layers = layers
    .filter(layer => {
      if (layer.source.kind !== selected.source.kind || layer.source.identity !== selected.source.identity) return true
      sourceCopies += 1
      return sourceCopies <= sourceDuplicateLimit
    })
    .slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)

  const activeSourceLayer = layers.find(layer => layer.source.identity === selected.source.identity) ?? selected
  return {
    layers,
    activeSourceKind: selected.source.kind,
    activeIdentityProfile: sourceResolution.profile,
    activeTreatment: input.settings.sourceTreatment,
    preserveIdentity: input.settings.preserveIdentity,
    sourceRole: input.settings.useSourceAs,
    contourBudget: activeSourceLayer.contourBudget,
    requestedContourDeformation: activeSourceLayer.requestedContourDeformation,
    appliedContourDeformation: activeSourceLayer.appliedContourDeformation,
    readabilityClampApplied: activeSourceLayer.readabilityClamped,
    supportingGeneratedLayers: layers.filter(layer => layer.source.kind === 'generated').map(layer => layer.id),
    sourceFallbackState: sourceResolution.fallback,
  }
}
