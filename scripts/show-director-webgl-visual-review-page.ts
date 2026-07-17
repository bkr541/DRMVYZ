import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../src/components/vyzualz/react/LaserDmxShowDirectorPerformancePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  resolveShowDirectorVisualValidationFrame,
  type ShowDirectorVisualValidationFrameId,
} from '../src/components/vyzualz/react/LaserDmxShowDirectorVisualValidation'
import {
  LaserDmxWebGLRuntime,
  type LaserDmxWebGLDiagnostics,
} from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxWebGLRuntime'
import type { LaserDmxSceneBeam, LaserDmxSceneFrame } from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxSceneFrame'
import {
  createLaserDmxScannerDiagnostics,
  solveLaserDmxScannerExposure,
  type LaserDmxScanPoint,
  type LaserDmxScannerOpticalCopy,
} from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxScannerDomain'
import { createLaserDmxOpticalCopies, type LaserDmxOpticalDistribution } from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxFixtureOptics'
import { auditLaserDmxPhysicalRealism, type LaserDmxPhysicalRealismMetrics } from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxPhysicalRealismAudit'
import {
  LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE,
  missingLaserDmxWebGLReferenceScenes,
  type LaserDmxWebGLReferenceSceneId,
} from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxWebGLVisualReferenceManifest'
import { selectLaserDmxBeamsForQuality } from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxWebGLBeamPlan'
import {
  beginAutomaticLaserDmxWebGLRetry,
  beginManualLaserDmxWebGLRetry,
  canAutomaticallyRetryLaserDmxWebGL,
  createLaserDmxWebGLRecoveryState,
  recordLaserDmxWebGLFailure,
} from '../src/components/vyzualz/react/renderers/laserDmx/LaserDmxWebGLRecovery'
import type { LaserDmxShowDirectorWebGLQuality } from '../src/components/vyzualz/react/ReactTypes'

interface WebGLCapabilityReport {
  available: boolean
  vendor: string | null
  renderer: string | null
  version: string | null
  shadingLanguageVersion: string | null
  maxTextureSize: number | null
}

interface WebGLPixelMetrics {
  deterministicReplayChecked: boolean
  meanLuminance: number
  meanSaturation: number
  blackFrameRatio: number
  litPixelRatio: number
  connectedLitPixelRatio: number
  isolatedLitPixelRatio: number
  highlightPixelRatio: number
  washedBrightPixelRatio: number
  leftRightDifference: number
  deterministicMeanAbsoluteDifference: number
  fingerprint: string
}

type WebGLReviewScenario =
  | 'baseline'
  | 'depth-crossing'
  | 'foreground-haze-veil'
  | 'co2-partial-attenuation'
  | 'laser-only-history'
  | 'moving-head-gobo'
  | 'moving-head-prism'
  | 'moving-head-zoom'
  | 'moving-head-iris'
  | 'moving-head-frost'
  | 'moving-head-focus'
  | 'moving-head-gobo-rotation'
  | 'led-pixel-chase'
  | 'video-wall-emissive'
  | 'strobe-blinder-distinction'
  | 'high-hero-fan'
  | 'ultra-hero-fan'
  | 'budget-hero-preservation'
  | 'auto-support-degradation'
  | 'high-mirror-corridor'
  | 'reference-held-beam'
  | 'reference-line-sweep'
  | 'reference-circle'
  | 'reference-triangle'
  | 'reference-polygon'
  | 'reference-wave'
  | 'reference-diffraction-grid'
  | 'reference-diffraction-burst'
  | 'reference-multiple-apertures'

interface WebGLQualityMetrics {
  requestedBeamCount: number
  selectedBeamCount: number
  requestedMaxSourceRayCount: number
  selectedMaxSourceRayCount: number
  requestedHeroRayCount: number
  selectedHeroRayCount: number
  requestedSupportRayCount: number
  selectedSupportRayCount: number
  requestedTextureRayCount: number
  selectedTextureRayCount: number
  selectedLeftRayCount: number
  selectedRightRayCount: number
}

interface WebGLPhysicalMetrics extends LaserDmxPhysicalRealismMetrics {
  blackFloorRatio: number
  hazeOccupancyRatio: number
  coreToEnvelopeRatio: number
  sourceApertureBrightness: number
  pathContinuityRatio: number
  scannerProgressionRatio: number
  radialSpokeViolationCount: number
  targetNetworkCageViolationCount: number
  symmetryDifference: number
  colorSaturation: number
  linearLightEnergyRatio: number
  exposureRecoveryChecked: boolean
  co2LifetimePassed: boolean
  fixtureRoleSignature: string
  editorOverlayCount: number
  canvas2dFallbackDetected: boolean
}

interface WebGLRecoveryReport {
  automaticCooldownValidated: boolean
  manualRetryClearedFailure: boolean
  permanentFallbackValidated: boolean
  contextLossExtensionSupported: boolean
  contextLossObserved: boolean
  contextRestoreObserved: boolean
  postRestoreRenderSucceeded: boolean
  supportedSkipReason: string | null
}

interface WebGLReviewFrame {
  key: string
  scenario: WebGLReviewScenario
  canvasId: string
  presetId: string
  presetName: string
  frameId: ShowDirectorVisualValidationFrameId
  section: string
  presentationMode: string
  requestedRenderer: string
  diagnostics: LaserDmxWebGLDiagnostics
  referenceSceneIds: LaserDmxWebGLReferenceSceneId[]
  validationStatus: 'passed' | 'failed'
  validationFailures: string[]
  pixelMetrics: WebGLPixelMetrics
  physicalMetrics: WebGLPhysicalMetrics
  activeFixtureKinds: string[]
  overlayElementCount: number
  qualityMetrics: WebGLQualityMetrics
}

interface WebGLReviewReport {
  ready: boolean
  status: 'pass' | 'unsupported' | 'failure'
  reason: string | null
  capability: WebGLCapabilityReport
  width: number
  height: number
  rendererHost: 'production-laser-dmx-webgl-runtime'
  frames: WebGLReviewFrame[]
  missingReferenceSceneIds: LaserDmxWebGLReferenceSceneId[]
  recovery: WebGLRecoveryReport | null
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__?: WebGLReviewReport
  }
}

const WEBGL_REVIEW_SIZE = Object.freeze({ width: 480, height: 270 })
const deterministicReplayKeys = new Set([
  'prism-cathedral/drop-1-body',
  'cyan-mirror-cage/drop-1-body',
  'moving-head-sweep-performance/build',
  'cardinal-fan-reactor/drop-2-body',
])

const cases: ReadonlyArray<{ presetId: string; frameId: ShowDirectorVisualValidationFrameId; scenario?: WebGLReviewScenario; quality?: LaserDmxShowDirectorWebGLQuality }> = [
  { presetId: 'prism-cathedral', frameId: 'intro' },
  { presetId: 'prism-cathedral', frameId: 'build' },
  { presetId: 'prism-cathedral', frameId: 'drop-1-body' },
  { presetId: 'prism-cathedral', frameId: 'breakdown' },
  { presetId: 'prism-cathedral', frameId: 'drop-2-body' },
  { presetId: 'prism-cathedral', frameId: 'outro' },
  { presetId: 'cyan-mirror-cage', frameId: 'drop-1-body' },
  { presetId: 'cardinal-fan-reactor', frameId: 'pre-drop' },
  { presetId: 'cardinal-fan-reactor', frameId: 'drop-2-body' },
  { presetId: 'cyan-mirror-cage', frameId: 'pre-drop' },
  { presetId: 'dubstep-drop-lasers-performance', frameId: 'drop-1-body' },
  { presetId: 'emerald-tunnel-relay', frameId: 'drop-2-body' },
  { presetId: 'prismatic-pulse-matrix', frameId: 'drop-2-body' },
  { presetId: 'moving-head-sweep-performance', frameId: 'build' },
  { presetId: 'strobe-blinder-hits-performance', frameId: 'drop-2-impact' },
  { presetId: 'haze-co2-drops-performance', frameId: 'drop-2-impact' },
  { presetId: 'led-bar-grid-performance', frameId: 'drop-1-body' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body' },
  { presetId: 'prism-cathedral', frameId: 'drop-1-body', scenario: 'depth-crossing' },
  { presetId: 'haze-co2-drops-performance', frameId: 'breakdown', scenario: 'foreground-haze-veil' },
  { presetId: 'haze-co2-drops-performance', frameId: 'drop-2-impact', scenario: 'co2-partial-attenuation' },
  { presetId: 'prism-cathedral', frameId: 'build', scenario: 'laser-only-history' },
  { presetId: 'moving-head-sweep-performance', frameId: 'build', scenario: 'moving-head-gobo' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-2-body', scenario: 'moving-head-prism' },
  { presetId: 'led-bar-grid-performance', frameId: 'drop-1-body', scenario: 'led-pixel-chase' },
  { presetId: 'festival-front-beams-performance', frameId: 'breakdown', scenario: 'video-wall-emissive' },
  { presetId: 'strobe-blinder-hits-performance', frameId: 'drop-2-impact', scenario: 'strobe-blinder-distinction' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'high-hero-fan', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'ultra-hero-fan', quality: 'ultra' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'budget-hero-preservation', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'auto-support-degradation', quality: 'auto' },
  { presetId: 'cyan-mirror-cage', frameId: 'drop-1-body', scenario: 'high-mirror-corridor', quality: 'high' },
  { presetId: 'prism-cathedral', frameId: 'verse' },
  { presetId: 'aurora-canopy-drift', frameId: 'drop-1-body' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'reference-held-beam', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'reference-line-sweep', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'reference-circle', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'reference-triangle', quality: 'high' },
  { presetId: 'white-vector-interlock', frameId: 'drop-1-body', scenario: 'reference-polygon', quality: 'high' },
  { presetId: 'cyan-mirror-cage', frameId: 'drop-2-body', scenario: 'reference-wave', quality: 'high' },
  { presetId: 'prism-cathedral', frameId: 'drop-1-body', scenario: 'reference-diffraction-grid', quality: 'high' },
  { presetId: 'prism-cathedral', frameId: 'drop-1-body', scenario: 'reference-diffraction-burst', quality: 'high' },
  { presetId: 'festival-front-beams-performance', frameId: 'drop-2-body', scenario: 'reference-multiple-apertures', quality: 'high' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-1-body', scenario: 'moving-head-zoom' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-1-body', scenario: 'moving-head-iris' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-1-body', scenario: 'moving-head-frost' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-1-body', scenario: 'moving-head-focus' },
  { presetId: 'moving-head-sweep-performance', frameId: 'drop-1-body', scenario: 'moving-head-gobo-rotation' },
  { presetId: 'led-bar-grid-performance', frameId: 'verse' },
]

function capabilityReport(): WebGLCapabilityReport {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) {
    return { available: false, vendor: null, renderer: null, version: null, shadingLanguageVersion: null, maxTextureSize: null }
  }
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    available: true,
    vendor: String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR)),
    renderer: String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
    version: String(gl.getParameter(gl.VERSION)),
    shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
  }
}


function scannerReferencePoints(
  scenario: WebGLReviewScenario,
  color: LaserDmxScanPoint['color'],
): { points: LaserDmxScanPoint[]; closed: boolean; pattern: NonNullable<LaserDmxSceneFrame['scanPaths'][number]['authoringPatternType']> } | null {
  const make = (index: number, x: number, y: number, z = 0): LaserDmxScanPoint => ({
    id: `reference-point-${index + 1}`,
    position: { x, y, z },
    blanked: false,
    dwellMicros: scenario === 'reference-held-beam' ? 1_200 : 28,
    cornerDwellMicros: 72,
    intensity: 1,
    color: { ...color },
    cornerBehavior: 'dwell',
  })
  if (scenario === 'reference-held-beam') {
    return { points: [make(0, 0.5, 0.42, -0.08)], closed: false, pattern: 'holdBeam' }
  }
  if (scenario === 'reference-line-sweep') {
    return { points: [make(0, 0.16, 0.58), make(1, 0.84, 0.36)], closed: false, pattern: 'lineSweep' }
  }
  if (scenario === 'reference-circle') {
    return {
      points: Array.from({ length: 24 }, (_, index) => {
        const angle = index / 24 * Math.PI * 2
        return make(index, 0.5 + Math.cos(angle) * 0.24, 0.48 + Math.sin(angle) * 0.24, -0.04)
      }),
      closed: true,
      pattern: 'circle',
    }
  }
  if (scenario === 'reference-triangle') {
    return {
      points: [make(0, 0.5, 0.2), make(1, 0.22, 0.72), make(2, 0.78, 0.72)],
      closed: true,
      pattern: 'triangle',
    }
  }
  if (scenario === 'reference-polygon') {
    return {
      points: Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + index / 6 * Math.PI * 2
        return make(index, 0.5 + Math.cos(angle) * 0.25, 0.48 + Math.sin(angle) * 0.25)
      }),
      closed: true,
      pattern: 'polygon',
    }
  }
  if (scenario === 'reference-wave') {
    return {
      points: Array.from({ length: 20 }, (_, index) => {
        const t = index / 19
        return make(index, 0.12 + t * 0.76, 0.5 + Math.sin(t * Math.PI * 3) * 0.18, -0.12 + t * 0.2)
      }),
      closed: false,
      pattern: 'wave',
    }
  }
  return null
}

function opticalReferencePlan(
  scenario: WebGLReviewScenario,
  headId: string,
  fixtureId: string,
): { direct: ReturnType<typeof createLaserDmxOpticalCopies>[number]; copies: LaserDmxScannerOpticalCopy[]; apertureCount: number } | null {
  let distribution: LaserDmxOpticalDistribution | null = null
  let copyCount = 1
  let spreadDeg = 0
  if (scenario === 'reference-diffraction-grid') {
    distribution = 'grid'
    copyCount = 9
    spreadDeg = 15
  } else if (scenario === 'reference-diffraction-burst') {
    distribution = 'burst'
    copyCount = 9
    spreadDeg = 13
  } else if (scenario === 'reference-multiple-apertures') {
    distribution = 'multiAperture'
    copyCount = 3
  }
  if (!distribution) return null
  const descriptors = createLaserDmxOpticalCopies({
    distribution,
    copyCount,
    spreadDeg,
    totalEnergy: 1,
    apertureSpacing: 0.026,
  })
  const direct = descriptors[0]!
  return {
    direct,
    apertureCount: distribution === 'multiAperture' ? copyCount : 1,
    copies: descriptors.slice(1).map((descriptor, index) => ({
      id: `${headId}-reference-copy-${index + 1}`,
      fixtureId,
      scannerHeadId: headId,
      opticalCopyIndex: index + 1,
      kind: distribution === 'multiAperture' ? 'multiEmitter' : 'diffraction',
      rotationDeg: descriptor.angularOffsetDeg.yaw,
      pitchDeg: descriptor.angularOffsetDeg.pitch,
      originOffset: { ...descriptor.originOffset },
      spectralChannel: descriptor.spectralChannel,
      intensityScale: descriptor.intensityScale,
    })),
  }
}

function applyReferenceScannerScenario(frame: LaserDmxSceneFrame, scenario: WebGLReviewScenario): LaserDmxSceneFrame | null {
  const sourceHead = frame.scannerHeads[0]
  const sourcePath = sourceHead ? frame.scanPaths.find(path => path.scannerHeadId === sourceHead.id) : null
  const fixture = sourceHead ? frame.fixtures.find(candidate => candidate.id === sourceHead.fixtureId) : null
  if (!sourceHead || !sourcePath || !fixture) return null
  const color = frame.exposureSamples.find(sample => sample.scannerHeadId === sourceHead.id)?.color ?? fixture.color
  const pathReference = scannerReferencePoints(scenario, color)
  const opticalReference = opticalReferencePlan(scenario, sourceHead.id, sourceHead.fixtureId)
  if (!pathReference && !opticalReference) return null

  const head = {
    ...sourceHead,
    physicalApertureCount: opticalReference?.apertureCount ?? 1,
    directIntensityScale: opticalReference?.direct.intensityScale ?? 1,
    directRotationDeg: opticalReference?.direct.angularOffsetDeg.yaw ?? 0,
    directPitchDeg: opticalReference?.direct.angularOffsetDeg.pitch ?? 0,
    directOriginOffset: opticalReference ? { ...opticalReference.direct.originOffset } : { x: 0, y: 0, z: 0 },
    directSpectralChannel: opticalReference?.direct.spectralChannel ?? 'full',
    retraceBlanking: true,
  }
  const path = pathReference
    ? {
        ...sourcePath,
        points: pathReference.points,
        closed: pathReference.closed,
        interpolation: pathReference.pattern === 'circle' ? 'arc' as const : pathReference.pattern === 'wave' ? 'bezier' as const : 'linear' as const,
        repeatMode: pathReference.closed || pathReference.pattern === 'holdBeam' ? 'loop' as const : 'pingPong' as const,
        conversionKind: 'native' as const,
        compatibilityMode: 'native' as const,
        validationErrors: [],
        migrationWarnings: [],
        authoringPatternType: pathReference.pattern,
        migrationStatus: 'native' as const,
      }
    : { ...sourcePath, compatibilityMode: 'native' as const, migrationStatus: 'native' as const }
  const opticalCopies = opticalReference?.copies ?? []
  const solved = solveLaserDmxScannerExposure({
    heads: [head],
    paths: [path],
    opticalCopies,
    originByFixtureId: new Map([[fixture.id, fixture.position]]),
    audioTimeSec: frame.transport.audioTimeSec,
    bpm: frame.musicalState.bpm,
    quality: frame.quality.qualityTier,
  })
  return {
    ...frame,
    scannerHeads: [head],
    scanPaths: [path],
    opticalCopies,
    scannerInstantaneousRays: solved.instantaneousRays,
    exposureSamples: solved.exposureSamples,
    scannerDiagnostics: createLaserDmxScannerDiagnostics({
      heads: [head],
      paths: [path],
      opticalCopies,
      exposureSamples: solved.exposureSamples,
      blankedSampleCount: solved.blankedSampleCount,
    }),
  }
}

function referenceSceneIdsForCase(
  presetId: string,
  frameId: ShowDirectorVisualValidationFrameId,
  scenario: WebGLReviewScenario,
): LaserDmxWebGLReferenceSceneId[] {
  const scenes = new Set<LaserDmxWebGLReferenceSceneId>()
  const musicalByFrame: Partial<Record<ShowDirectorVisualValidationFrameId, LaserDmxWebGLReferenceSceneId>> = {
    intro: 'musical-intro',
    verse: 'musical-verse',
    build: 'musical-build',
    'pre-drop': 'musical-pre-drop',
    'drop-1-impact': 'musical-drop-1',
    'drop-1-body': 'musical-drop-1',
    breakdown: 'musical-breakdown',
    'drop-2-impact': 'musical-drop-2',
    'drop-2-body': 'musical-drop-2',
    outro: 'musical-outro',
  }
  if (scenario === 'baseline') {
    const musical = musicalByFrame[frameId]
    if (musical) scenes.add(musical)
  }
  const scenarioScenes: Partial<Record<WebGLReviewScenario, LaserDmxWebGLReferenceSceneId[]>> = {
    'reference-held-beam': ['laser-held-beam'],
    'reference-line-sweep': ['laser-line-sweep'],
    'reference-circle': ['laser-sequential-circle'],
    'reference-triangle': ['laser-triangle-perimeter'],
    'reference-polygon': ['laser-polygon-perimeter'],
    'reference-wave': ['laser-progressive-wave'],
    'reference-diffraction-grid': ['laser-grid-diffraction'],
    'reference-diffraction-burst': ['laser-burst-diffraction'],
    'reference-multiple-apertures': ['laser-multiple-physical-apertures'],
    'high-hero-fan': ['laser-fan-sweep', 'laser-front-air-rake'],
    'ultra-hero-fan': ['laser-fan-sweep'],
    'high-mirror-corridor': ['laser-mirrored-fan', 'laser-corridor', 'laser-multiple-scanner-heads'],
    'moving-head-gobo': ['nonlaser-moving-head-cone', 'nonlaser-gobo-projection'],
    'moving-head-prism': ['nonlaser-moving-head-prism'],
    'moving-head-zoom': ['nonlaser-zoom'],
    'moving-head-iris': ['nonlaser-iris'],
    'moving-head-frost': ['nonlaser-frost'],
    'moving-head-focus': ['nonlaser-focus'],
    'moving-head-gobo-rotation': ['nonlaser-gobo-rotation'],
    'led-pixel-chase': ['nonlaser-led-pixel-chase'],
    'foreground-haze-veil': ['nonlaser-haze-source'],
    'co2-partial-attenuation': ['nonlaser-co2-burst'],
    'strobe-blinder-distinction': ['nonlaser-strobe-pulse', 'nonlaser-blinder-impact'],
    'video-wall-emissive': ['nonlaser-video-surface-fallback'],
  }
  for (const scene of scenarioScenes[scenario] ?? []) scenes.add(scene)
  if (presetId === 'prism-cathedral') {
    scenes.add('laser-prism-copies')
    scenes.add('laser-line-diffraction')
  }
  if (presetId === 'cardinal-fan-reactor') scenes.add('laser-fan-sweep')
  if (presetId === 'cyan-mirror-cage') {
    scenes.add('laser-sequential-arc')
    scenes.add('laser-mirrored-fan')
    scenes.add('laser-corridor')
    scenes.add('laser-multiple-scanner-heads')
  }
  if (presetId === 'emerald-tunnel-relay') scenes.add('laser-tunnel')
  if (presetId === 'aurora-canopy-drift') {
    scenes.add('laser-sequential-arc')
    scenes.add('laser-upper-air-canopy')
  }
  if (presetId === 'moving-head-sweep-performance' && scenario === 'baseline') {
    scenes.add('nonlaser-moving-head-cone')
    scenes.add('nonlaser-wash-field')
    scenes.add('nonlaser-par-field')
  }
  if (presetId === 'festival-front-beams-performance') scenes.add('nonlaser-par-field')
  if (presetId === 'led-bar-grid-performance' && frameId === 'verse') scenes.add('nonlaser-led-tube')
  if (presetId === 'haze-co2-drops-performance') {
    scenes.add('nonlaser-haze-source')
    if (frameId.includes('drop')) scenes.add('nonlaser-co2-burst')
  }
  return [...scenes]
}

function applyScenario(
  frame: LaserDmxSceneFrame,
  scenario: WebGLReviewScenario,
  index: number,
): LaserDmxSceneFrame {
  if (scenario === 'baseline') return frame
  const referenceFrame = applyReferenceScannerScenario(frame, scenario)
  if (referenceFrame) return referenceFrame
  if (scenario === 'depth-crossing') {
    let changed = false
    return {
      ...frame,
      beams: frame.beams.map(beam => {
        if (changed || beam.fixtureKind !== 'laser') return beam
        changed = true
        return {
          ...beam,
          origin: { ...beam.origin, z: 0.72 },
          target: { ...beam.target, z: -0.72 },
          startDepth: 0.72,
          endDepth: -0.72,
          depthRange: { minZ: -0.72, maxZ: 0.72 },
          sortDepth: 0,
        }
      }),
    }
  }
  if (scenario === 'foreground-haze-veil') {
    return {
      ...frame,
      atmosphere: { ...frame.atmosphere, foregroundVeil: 0.92, opacity: Math.max(0.72, frame.atmosphere.opacity) },
      atmosphereSources: frame.atmosphereSources.map(source => source.kind === 'haze'
        ? { ...source, position: { ...source.position, z: 0.62 }, density: Math.max(0.72, source.density), spread: Math.max(0.38, source.spread), enabled: true }
        : source),
    }
  }
  if (scenario === 'co2-partial-attenuation') {
    return {
      ...frame,
      atmosphereSources: frame.atmosphereSources.map(source => source.kind === 'co2'
        ? { ...source, position: { x: 0.5, y: 0.52, z: 0.05 }, density: 0.95, ageSec: 0.2, lifetimeSec: 0.8, expansion: 0.72, turbulence: 0.8, enabled: true }
        : source),
    }
  }
  if (scenario === 'laser-only-history') {
    const sweep = (index - 1.5) * 0.055
    return {
      ...frame,
      musicalState: {
        ...frame.musicalState,
        energy: Math.max(0.72, frame.musicalState.energy),
        snareHit: false,
        snareStrength: 0,
      },
      output: {
        ...frame.output,
        blackout: false,
        globalStrobeRate: 0,
        beamPersistence: Math.max(0.32, frame.output.beamPersistence),
      },
      fixtures: frame.fixtures.map(fixture => ({ ...fixture, strobeRate: 0 })),
      transientEvents: frame.transientEvents.filter(event => event.kind !== 'strobe'),
      beams: frame.beams.map(beam => beam.fixtureKind === 'laser'
        ? { ...beam, target: { ...beam.target, x: beam.target.x + sweep } }
        : beam),
    }
  }
  if (scenario.startsWith('moving-head-')) {
    return {
      ...frame,
      fixtures: frame.fixtures.map(fixture => fixture.kind === 'movingHead'
        ? {
            ...fixture,
            optics: {
              ...fixture.optics,
              goboAmount: scenario === 'moving-head-gobo' || scenario === 'moving-head-gobo-rotation' ? 0.96 : 0.38,
              goboPattern: scenario === 'moving-head-gobo' || scenario === 'moving-head-gobo-rotation' ? 'star' : 'radial',
              goboRotation: scenario === 'moving-head-gobo-rotation' ? index * 46 : 38,
              prismFacets: scenario === 'moving-head-prism' ? 5 : 1,
              prismRotation: 24,
              zoom: scenario === 'moving-head-zoom' ? 0.92 : scenario === 'moving-head-prism' ? 0.5 : 0.34,
              iris: scenario === 'moving-head-iris' ? 0.2 : 0.74,
              frost: scenario === 'moving-head-frost' ? 0.88 : scenario === 'moving-head-gobo' ? 0.05 : 0.12,
            },
          }
        : fixture),
      beams: frame.beams.map(beam => beam.fixtureKind === 'movingHead' && scenario === 'moving-head-focus'
        ? { ...beam, focus: 0.96, width: Math.max(0.002, beam.width * 0.45), scatterEnvelopeWidth: beam.scatterEnvelopeWidth * 0.35 }
        : beam),
    }
  }
  if (scenario === 'led-pixel-chase') {
    return {
      ...frame,
      fixtures: frame.fixtures.map(fixture => fixture.kind === 'ledBar' || fixture.kind === 'ledTube'
        ? {
            ...fixture,
            rotationDeg: fixture.kind === 'ledTube' ? 90 : fixture.rotationDeg,
            component: { ...fixture.component, ledCellCount: Math.max(12, fixture.component.ledCellCount), ledDirection: 'chase' },
          }
        : fixture),
    }
  }
  if (scenario === 'video-wall-emissive') {
    const fixtureTemplate = frame.fixtures[0]
    const emitterTemplate = frame.emitters[0]
    if (!fixtureTemplate || !emitterTemplate) return frame
    const fixtureId = 'visual-regression-video-wall'
    const position = { x: 0.5, y: 0.46, z: -0.18 }
    return {
      ...frame,
      fixtures: [
        ...frame.fixtures,
        {
          ...fixtureTemplate,
          id: fixtureId,
          semanticKey: fixtureId,
          kind: 'videoWall',
          position,
          rotationDeg: -4,
          intensity: 0.9,
          component: { ...fixtureTemplate.component, videoWallBrightness: 0.92, videoWallSource: 'reactVisual' },
          optics: { ...fixtureTemplate.optics, sourceIntensity: 0.88, opticalSoftness: 0.12 },
        },
      ],
      emitters: [
        ...frame.emitters,
        {
          ...emitterTemplate,
          id: `${fixtureId}-emitter`,
          fixtureId,
          position,
          sortDepth: -0.18,
          intensity: 0.9,
          activeRayCount: 1,
          totalActiveEnergy: 0.9,
          peakRayIntensity: 0.9,
        },
      ],
    }
  }
  if (scenario === 'strobe-blinder-distinction') {
    return {
      ...frame,
      fixtures: frame.fixtures.map(fixture => fixture.kind === 'strobe'
        ? { ...fixture, color: { r: 1, g: 1, b: 1, a: 1 }, intensity: 1, strobeRate: 18 }
        : fixture.kind === 'blinder'
          ? { ...fixture, color: { r: 1, g: 0.58, b: 0.22, a: 1 }, intensity: 0.88 }
          : fixture),
    }
  }
  if (scenario === 'budget-hero-preservation' || scenario === 'auto-support-degradation') {
    const template = frame.beams.find(beam => beam.fixtureKind === 'laser')
    if (!template) return frame
    const makeGroup = (
      prefix: string,
      groupCount: number,
      raysPerGroup: number,
      visualRole: LaserDmxSceneBeam['visualRole'],
      priority: number,
    ): LaserDmxSceneBeam[] => Array.from({ length: groupCount * raysPerGroup }, (_, beamIndex) => {
      const groupIndex = Math.floor(beamIndex / raysPerGroup)
      const rayIndex = beamIndex % raysPerGroup
      const centered = raysPerGroup <= 1 ? 0 : rayIndex / (raysPerGroup - 1) - 0.5
      return {
        ...template,
        id: `${prefix}-${groupIndex}-${rayIndex}`,
        sourceId: `${prefix}-source-${groupIndex}`,
        visualRole,
        priority,
        intensity: Math.min(template.intensity, visualRole === 'texture' ? 0.07 : 0.12),
        coreIntensity: Math.min(template.coreIntensity, visualRole === 'texture' ? 0.16 : 0.24),
        opacity: Math.min(template.opacity, visualRole === 'texture' ? 0.22 : 0.32),
        scatterEnvelopeWidth: Math.min(template.scatterEnvelopeWidth, 0.008),
        target: {
          ...template.target,
          // Budget-stress embellishments intentionally overlap. The test still
          // requests more than 300 rays without turning black-floor validation
          // into an artificial full-frame wall of haze.
          x: Math.max(0.02, Math.min(0.98, template.target.x + centered * 0.09 + ((groupIndex % 5) - 2) * 0.006)),
          y: Math.max(0.02, Math.min(0.98, template.target.y + ((groupIndex % 3) - 1) * 0.009)),
        },
        pattern: {
          ...template.pattern,
          rayIndex,
          rayCount: raysPerGroup,
          spacingT: centered,
        },
      }
    })
    const synthetic = scenario === 'budget-hero-preservation'
      ? makeGroup('budget-texture', 30, 12, 'texture', 4)
      : [
          ...makeGroup('auto-support', 18, 16, 'secondary', 3),
          ...makeGroup('auto-texture', 24, 16, 'texture', 4),
        ]
    return { ...frame, beams: [...frame.beams, ...synthetic] }
  }
  return frame
}

function stableFrame(
  frame: LaserDmxSceneFrame,
  index: number,
  scenario: WebGLReviewScenario,
): LaserDmxSceneFrame {
  const delta = 1 / 60
  const qualityTier: LaserDmxShowDirectorWebGLQuality = scenario === 'ultra-hero-fan'
    ? 'ultra'
    : scenario === 'high-hero-fan' || scenario === 'budget-hero-preservation' || scenario === 'high-mirror-corridor'
      ? 'high'
      : scenario === 'auto-support-degradation'
        ? 'auto'
        : 'medium'
  const stable = {
    ...frame,
    timestamp: frame.timestamp + index * delta,
    deltaTime: delta,
    quality: { ...frame.quality, qualityTier, renderScale: 1 },
    atmosphere: { ...frame.atmosphere, qualityTier },
    transport: {
      ...frame.transport,
      audioTimeSec: frame.transport.audioTimeSec + index * delta,
      deltaTimeSec: delta,
      timingDiscontinuity: index === 0,
    },
  }
  return applyScenario(stable, scenario, index)
}

function fingerprint(data: Uint8ClampedArray, width: number, height: number): string {
  const columns = 16
  const rows = 9
  const bins = new Array<number>(columns * rows).fill(0)
  const counts = new Array<number>(columns * rows).fill(0)
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4
      const luminance = 0.2126 * data[offset]! + 0.7152 * data[offset + 1]! + 0.0722 * data[offset + 2]!
      const bin = Math.min(rows - 1, Math.floor(y / height * rows)) * columns
        + Math.min(columns - 1, Math.floor(x / width * columns))
      bins[bin] += luminance
      counts[bin] += 1
    }
  }
  return bins.map((value, index) => Math.round(value / Math.max(1, counts[index]!) / 8).toString(36)).join('')
}

function measurePixels(
  first: ImageData,
  second: ImageData,
  deterministicReplayChecked: boolean,
): WebGLPixelMetrics {
  const { width, height, data } = first
  let luminanceSum = 0
  let saturationSum = 0
  let black = 0
  let lit = 0
  let highlight = 0
  let washed = 0
  const pixels = width * height
  const litMask = new Uint8Array(pixels)
  const columnEnergy = new Array<number>(width).fill(0)
  let replayDifference = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const r = data[offset]! / 255
      const g = data[offset + 1]! / 255
      const b = data[offset + 2]! / 255
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      luminanceSum += luminance
      saturationSum += max > 0 ? (max - min) / max : 0
      if (luminance < 0.006) black += 1
      if (luminance > 0.02) {
        lit += 1
        litMask[y * width + x] = 1
      }
      if (luminance > 0.82) highlight += 1
      if (r > 0.78 && g > 0.78 && b > 0.78) washed += 1
      replayDifference += (
        Math.abs(data[offset]! - second.data[offset]!)
        + Math.abs(data[offset + 1]! - second.data[offset + 1]!)
        + Math.abs(data[offset + 2]! - second.data[offset + 2]!)
      ) / (255 * 3)
      columnEnergy[x] += luminance
    }
  }
  let connectedLit = 0
  let isolatedLit = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (litMask[index] === 0) continue
      let connected = false
      for (let oy = -1; oy <= 1 && !connected; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue
          const nx = x + ox
          const ny = y + oy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          if (litMask[ny * width + nx] === 1) {
            connected = true
            break
          }
        }
      }
      if (connected) connectedLit += 1
      else isolatedLit += 1
    }
  }
  let mirroredDifference = 0
  let mirroredWeight = 0
  for (let x = 0; x < Math.floor(width / 2); x += 1) {
    const left = columnEnergy[x]!
    const right = columnEnergy[width - 1 - x]!
    mirroredDifference += Math.abs(left - right)
    mirroredWeight += Math.max(0.001, left, right)
  }
  return {
    deterministicReplayChecked,
    meanLuminance: luminanceSum / pixels,
    meanSaturation: saturationSum / pixels,
    blackFrameRatio: black / pixels,
    litPixelRatio: lit / pixels,
    connectedLitPixelRatio: connectedLit / Math.max(1, lit),
    isolatedLitPixelRatio: isolatedLit / Math.max(1, lit),
    highlightPixelRatio: highlight / pixels,
    washedBrightPixelRatio: washed / pixels,
    leftRightDifference: mirroredDifference / Math.max(1, mirroredWeight),
    deterministicMeanAbsoluteDifference: replayDifference / pixels,
    fingerprint: fingerprint(data, width, height),
  }
}

function rayRoleCounts(beams: readonly LaserDmxSceneBeam[]) {
  return beams.reduce((counts, beam) => {
    if (beam.visualRole === 'hero' || beam.visualRole === 'primary') counts.hero += 1
    else if (beam.visualRole === 'texture') counts.texture += 1
    else counts.support += 1
    return counts
  }, { hero: 0, support: 0, texture: 0 })
}

function maxSourceRayCount(beams: readonly LaserDmxSceneBeam[]): number {
  const counts = new Map<string, number>()
  for (const beam of beams) counts.set(beam.sourceId, (counts.get(beam.sourceId) ?? 0) + 1)
  return Math.max(0, ...counts.values())
}

function qualityMetrics(frame: LaserDmxSceneFrame): WebGLQualityMetrics {
  const selected = selectLaserDmxBeamsForQuality(frame.beams, frame.quality.qualityTier)
  const requestedRoles = rayRoleCounts(frame.beams)
  const selectedRoles = rayRoleCounts(selected)
  return {
    requestedBeamCount: frame.beams.length,
    selectedBeamCount: selected.length,
    requestedMaxSourceRayCount: maxSourceRayCount(frame.beams),
    selectedMaxSourceRayCount: maxSourceRayCount(selected),
    requestedHeroRayCount: requestedRoles.hero,
    selectedHeroRayCount: selectedRoles.hero,
    requestedSupportRayCount: requestedRoles.support,
    selectedSupportRayCount: selectedRoles.support,
    requestedTextureRayCount: requestedRoles.texture,
    selectedTextureRayCount: selectedRoles.texture,
    selectedLeftRayCount: selected.filter(beam => beam.origin.x < 0.5).length,
    selectedRightRayCount: selected.filter(beam => beam.origin.x > 0.5).length,
  }
}


function validateReferenceFrame(
  frame: LaserDmxSceneFrame,
  diagnostics: LaserDmxWebGLDiagnostics,
  pixelMetrics: WebGLPixelMetrics,
  overlayElementCount: number,
): { status: 'passed' | 'failed'; failures: string[]; physicalMetrics: WebGLPhysicalMetrics } {
  const audit = auditLaserDmxPhysicalRealism(frame, { editorOverlayElementCount: overlayElementCount })
  const failures = audit.issues.map(issue => `${issue.code}: ${issue.detail}`)
  const envelope = LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE
  const requiresVisibleLight = diagnostics.activeBeamCount > 0
    || frame.fixtures.some(fixture => fixture.enabled && ['movingHead', 'parWash', 'strobe', 'blinder', 'ledBar', 'ledTube', 'videoWall'].includes(fixture.kind))
  if (pixelMetrics.blackFrameRatio < envelope.minimumBlackFloorRatio) failures.push('black-floor ratio is below the approved void-background envelope')
  if (requiresVisibleLight && pixelMetrics.blackFrameRatio >= envelope.maximumBlackFloorRatio) failures.push('reference scene is effectively black')
  if (requiresVisibleLight && pixelMetrics.litPixelRatio < envelope.minimumLitPixelRatio) failures.push('lit-pixel ratio is below the meaningful-output floor')
  if (requiresVisibleLight && pixelMetrics.connectedLitPixelRatio < envelope.minimumConnectedLitRatio) failures.push('path continuity is below the approved connected-light envelope')
  if (pixelMetrics.highlightPixelRatio > envelope.maximumHighlightRatio) failures.push('highlight ratio exceeds the approved exposure envelope')
  if (pixelMetrics.washedBrightPixelRatio > envelope.maximumWashedBrightRatio) failures.push('washed-bright ratio exceeds the approved black-floor envelope')
  if (pixelMetrics.meanSaturation > envelope.maximumColorSaturation) failures.push('mean color saturation exceeds the calibrated color envelope')
  if (pixelMetrics.deterministicReplayChecked && pixelMetrics.deterministicMeanAbsoluteDifference >= 0.02) failures.push('deterministic replay exceeded the approved perceptual difference')
  if (diagnostics.duplicateLaserInputCount > 0) failures.push('scanner and legacy laser inputs were rendered together')
  if (diagnostics.laserInputMode === 'legacy-only' && frame.scannerHeads.length > 0) failures.push('authoritative scanner scene fell back to legacy-only laser input')

  const uniqueScannerPoints = new Set(frame.exposureSamples.filter(sample => !sample.blanked && sample.exposureWeight > 0)
    .map(sample => `${sample.scannerHeadId}:${sample.pointIndex}`)).size
  const authoredPointCount = Math.max(1, frame.scanPaths.reduce((sum, path) => sum + path.points.length, 0))
  const sourceApertureBrightness = frame.emitters.length === 0
    ? 0
    : frame.emitters.reduce((sum, emitter) => sum + emitter.peakRayIntensity, 0) / frame.emitters.length
  const radialSpokeViolationCount = audit.issues.filter(issue => issue.code === 'scanner-simultaneous-ray-count').length
  const targetNetworkCageViolationCount = audit.metrics.duplicateLegacyFixtureCount
    + audit.issues.filter(issue => issue.code === 'invalid-ordered-path').length
  const physicalMetrics: WebGLPhysicalMetrics = {
    ...audit.metrics,
    blackFloorRatio: pixelMetrics.blackFrameRatio,
    hazeOccupancyRatio: frame.atmosphere.enabled ? pixelMetrics.litPixelRatio : 0,
    coreToEnvelopeRatio: pixelMetrics.litPixelRatio > 0 ? pixelMetrics.highlightPixelRatio / pixelMetrics.litPixelRatio : 0,
    sourceApertureBrightness,
    pathContinuityRatio: pixelMetrics.connectedLitPixelRatio,
    scannerProgressionRatio: Math.min(1, uniqueScannerPoints / authoredPointCount),
    radialSpokeViolationCount,
    targetNetworkCageViolationCount,
    symmetryDifference: pixelMetrics.leftRightDifference,
    colorSaturation: pixelMetrics.meanSaturation,
    linearLightEnergyRatio: audit.metrics.maximumOpticalEnergy,
    exposureRecoveryChecked: pixelMetrics.deterministicReplayChecked,
    co2LifetimePassed: audit.metrics.expiredCo2SourceCount === 0,
    fixtureRoleSignature: [...new Set(frame.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.kind))].sort().join('|'),
    editorOverlayCount: overlayElementCount,
    canvas2dFallbackDetected: false,
  }
  return { status: failures.length === 0 ? 'passed' : 'failed', failures, physicalMetrics }
}

function waitForCondition(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const started = performance.now()
  return new Promise(resolve => {
    const check = () => {
      if (predicate()) resolve(true)
      else if (performance.now() - started >= timeoutMs) resolve(false)
      else requestAnimationFrame(check)
    }
    check()
  })
}

async function validateRecovery(
  runtime: LaserDmxWebGLRuntime,
  frame: LaserDmxSceneFrame,
): Promise<WebGLRecoveryReport> {
  const initialFailure = recordLaserDmxWebGLFailure(createLaserDmxWebGLRecoveryState(), {
    code: 'gpu-resource-allocation-failed',
    nowMs: 1_000,
  })
  const automaticCooldownValidated = !canAutomaticallyRetryLaserDmxWebGL(initialFailure, initialFailure.nextRetryAtMs! - 1)
    && canAutomaticallyRetryLaserDmxWebGL(initialFailure, initialFailure.nextRetryAtMs!)
    && beginAutomaticLaserDmxWebGLRetry(initialFailure).retryCount === 1
  const manualRetryClearedFailure = beginManualLaserDmxWebGLRetry(initialFailure).failureCode == null
  const permanentFailure = recordLaserDmxWebGLFailure(createLaserDmxWebGLRecoveryState(), {
    code: 'webgl2-unavailable',
    nowMs: 1_000,
  })
  const permanentFallbackValidated = permanentFailure.nextRetryAtMs == null
    && permanentFailure.finalFallbackReason != null

  const gl = (runtime as unknown as { gl: WebGL2RenderingContext }).gl
  const extension = gl.getExtension('WEBGL_lose_context')
  if (!extension) {
    return {
      automaticCooldownValidated,
      manualRetryClearedFailure,
      permanentFallbackValidated,
      contextLossExtensionSupported: false,
      contextLossObserved: false,
      contextRestoreObserved: false,
      postRestoreRenderSucceeded: false,
      supportedSkipReason: 'WEBGL_lose_context is unavailable in this browser/GPU environment.',
    }
  }

  extension.loseContext()
  const contextLossObserved = await waitForCondition(() => runtime.contextLost, 2_000)
  const lostRender = runtime.render(stableFrame(frame, 0, 'high-hero-fan'))
  extension.restoreContext()
  const contextRestoreObserved = await waitForCondition(() => !runtime.contextLost, 3_000)
  const restoredRender = runtime.render(stableFrame(frame, 1, 'high-hero-fan'))
  return {
    automaticCooldownValidated,
    manualRetryClearedFailure,
    permanentFallbackValidated,
    contextLossExtensionSupported: true,
    contextLossObserved: contextLossObserved && !lostRender.ok && lostRender.failureCode === 'context-lost',
    contextRestoreObserved,
    postRestoreRenderSucceeded: restoredRender.ok,
    supportedSkipReason: null,
  }
}

function makeCard(titleText: string, key: string): { canvas: HTMLCanvasElement; canvasId: string } {
  const grid = document.getElementById('review-grid')
  if (!grid) throw new Error('Missing review grid')
  const article = document.createElement('article')
  const title = document.createElement('h2')
  title.textContent = titleText
  const canvas = document.createElement('canvas')
  const canvasId = `webgl-${key.replace(/[^a-z0-9]+/gi, '-')}`
  canvas.id = canvasId
  canvas.width = WEBGL_REVIEW_SIZE.width
  canvas.height = WEBGL_REVIEW_SIZE.height
  article.append(title, canvas)
  grid.append(article)
  return { canvas, canvasId }
}

function renderSequence(
  runtime: LaserDmxWebGLRuntime,
  context: CanvasRenderingContext2D,
  frame: LaserDmxSceneFrame,
  scenario: WebGLReviewScenario,
): { image: ImageData; diagnostics: LaserDmxWebGLDiagnostics } {
  runtime.reset()
  let diagnostics: LaserDmxWebGLDiagnostics | undefined
  for (let index = 0; index < 4; index += 1) {
    const result = runtime.render(stableFrame(frame, index, scenario))
    if (!result.ok || !result.diagnostics) throw new Error(result.error ?? 'LaserDMX WebGL frame failed')
    diagnostics = result.diagnostics
  }
  return {
    image: context.getImageData(0, 0, context.canvas.width, context.canvas.height),
    diagnostics: diagnostics!,
  }
}

async function main(): Promise<void> {
  const capability = capabilityReport()
  const output = document.createElement('canvas')
  output.width = WEBGL_REVIEW_SIZE.width
  output.height = WEBGL_REVIEW_SIZE.height
  const context = output.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) throw new Error('Canvas2D output context unavailable')
  const created = LaserDmxWebGLRuntime.createWithDiagnostics(context)
  if (!capability.available || !created.runtime) {
    window.__SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__ = {
      ready: true,
      status: 'unsupported',
      reason: created.error ?? 'WebGL2 context unavailable',
      capability,
      width: output.width,
      height: output.height,
      rendererHost: 'production-laser-dmx-webgl-runtime',
      frames: [],
      missingReferenceSceneIds: missingLaserDmxWebGLReferenceScenes([]),
      recovery: null,
    }
    document.documentElement.dataset.webglVisualReviewReady = 'true'
    return
  }

  const summaries: WebGLReviewFrame[] = []
  try {
    for (const item of cases) {
      const preset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === item.presetId)
      const frameDefinition = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.find(candidate => candidate.id === item.frameId)
      if (!preset || !frameDefinition) throw new Error(`Missing visual case ${item.presetId}/${item.frameId}`)
      const resolution = resolveShowDirectorVisualValidationFrame(preset, frameDefinition, undefined, item.quality ?? 'medium')
      const scenario = item.scenario ?? 'baseline'
      const key = scenario === 'baseline'
        ? `${item.presetId}/${item.frameId}`
        : `${item.presetId}/${item.frameId}/${scenario}`
      const scenarioFrame = stableFrame(resolution.sceneFrame, 3, scenario)
      const first = renderSequence(created.runtime, context, resolution.sceneFrame, scenario)
      const replayChecked = deterministicReplayKeys.has(key)
      const second = replayChecked
        ? renderSequence(created.runtime, context, resolution.sceneFrame, scenario)
        : first
      const { canvas, canvasId } = makeCard(`${preset.name} · ${item.frameId} · ${scenario}`, `${item.presetId}-${item.frameId}-${scenario}`)
      const snapshot = canvas.getContext('2d', { alpha: false })
      if (!snapshot) throw new Error('Snapshot context unavailable')
      snapshot.putImageData(first.image, 0, 0)
      const pixelMetrics = measurePixels(first.image, second.image, replayChecked)
      const overlayElementCount = document.querySelectorAll('[data-laser-dmx-authoring-overlay], .laser-dmx-stage-grid, .laser-dmx-beam-handle').length
      const validation = validateReferenceFrame(scenarioFrame, first.diagnostics, pixelMetrics, overlayElementCount)
      summaries.push({
        key,
        scenario,
        canvasId,
        presetId: item.presetId,
        presetName: preset.name,
        frameId: item.frameId,
        section: resolution.section,
        presentationMode: resolution.sceneFrame.presentationMode,
        requestedRenderer: 'webgl',
        diagnostics: first.diagnostics,
        referenceSceneIds: referenceSceneIdsForCase(item.presetId, item.frameId, scenario),
        validationStatus: validation.status,
        validationFailures: validation.failures,
        pixelMetrics,
        physicalMetrics: validation.physicalMetrics,
        activeFixtureKinds: [...new Set(scenarioFrame.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.kind))].sort(),
        overlayElementCount,
        qualityMetrics: qualityMetrics(scenarioFrame),
      })
    }
    const recoveryPreset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === 'festival-front-beams-performance')!
    const recoveryDefinition = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.find(candidate => candidate.id === 'drop-2-body')!
    const recoveryResolution = resolveShowDirectorVisualValidationFrame(recoveryPreset, recoveryDefinition, undefined, 'high')
    const recovery = await validateRecovery(created.runtime, recoveryResolution.sceneFrame)
    const missingReferenceSceneIds = missingLaserDmxWebGLReferenceScenes(summaries.flatMap(frame => frame.referenceSceneIds))
    const failedFrames = summaries.filter(frame => frame.validationStatus === 'failed')
    window.__SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__ = {
      ready: true,
      status: missingReferenceSceneIds.length === 0 && failedFrames.length === 0 ? 'pass' : 'failure',
      reason: missingReferenceSceneIds.length > 0
        ? `Missing required reference scenes: ${missingReferenceSceneIds.join(', ')}`
        : failedFrames.length > 0
          ? `${failedFrames.length} reference frames failed physical/perceptual validation.`
          : null,
      capability,
      width: output.width,
      height: output.height,
      rendererHost: 'production-laser-dmx-webgl-runtime',
      frames: summaries,
      missingReferenceSceneIds,
      recovery,
    }
  } catch (error) {
    window.__SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__ = {
      ready: true,
      status: 'failure',
      reason: error instanceof Error ? error.message : String(error),
      capability,
      width: output.width,
      height: output.height,
      rendererHost: 'production-laser-dmx-webgl-runtime',
      frames: summaries,
      missingReferenceSceneIds: missingLaserDmxWebGLReferenceScenes(summaries.flatMap(frame => frame.referenceSceneIds)),
      recovery: null,
    }
  } finally {
    created.runtime.dispose()
    document.documentElement.dataset.webglVisualReviewReady = 'true'
  }
}

void main()
