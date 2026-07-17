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
  | 'led-pixel-chase'
  | 'video-wall-emissive'
  | 'strobe-blinder-distinction'
  | 'high-hero-fan'
  | 'ultra-hero-fan'
  | 'budget-hero-preservation'
  | 'auto-support-degradation'
  | 'high-mirror-corridor'

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
  pixelMetrics: WebGLPixelMetrics
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
])

const cases: ReadonlyArray<{ presetId: string; frameId: ShowDirectorVisualValidationFrameId; scenario?: WebGLReviewScenario; quality?: LaserDmxShowDirectorWebGLQuality }> = [
  { presetId: 'prism-cathedral', frameId: 'intro' },
  { presetId: 'prism-cathedral', frameId: 'build' },
  { presetId: 'prism-cathedral', frameId: 'drop-1-body' },
  { presetId: 'prism-cathedral', frameId: 'breakdown' },
  { presetId: 'prism-cathedral', frameId: 'drop-2-body' },
  { presetId: 'prism-cathedral', frameId: 'outro' },
  { presetId: 'cyan-mirror-cage', frameId: 'drop-1-body' },
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

function applyScenario(
  frame: LaserDmxSceneFrame,
  scenario: WebGLReviewScenario,
  index: number,
): LaserDmxSceneFrame {
  if (scenario === 'baseline') return frame
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
  if (scenario === 'moving-head-gobo' || scenario === 'moving-head-prism') {
    return {
      ...frame,
      fixtures: frame.fixtures.map(fixture => fixture.kind === 'movingHead'
        ? {
            ...fixture,
            optics: {
              ...fixture.optics,
              goboAmount: scenario === 'moving-head-gobo' ? 0.96 : 0.38,
              goboPattern: scenario === 'moving-head-gobo' ? 'star' : 'radial',
              goboRotation: 38,
              prismFacets: scenario === 'moving-head-prism' ? 5 : 1,
              prismRotation: 24,
              zoom: scenario === 'moving-head-prism' ? 0.5 : 0.34,
              iris: 0.74,
              frost: scenario === 'moving-head-gobo' ? 0.05 : 0.12,
            },
          }
        : fixture),
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
        pixelMetrics: measurePixels(first.image, second.image, replayChecked),
        activeFixtureKinds: [...new Set(scenarioFrame.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.kind))].sort(),
        overlayElementCount: document.querySelectorAll('[data-laser-dmx-authoring-overlay], .laser-dmx-stage-grid, .laser-dmx-beam-handle').length,
        qualityMetrics: qualityMetrics(scenarioFrame),
      })
    }
    const recoveryPreset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === 'festival-front-beams-performance')!
    const recoveryDefinition = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.find(candidate => candidate.id === 'drop-2-body')!
    const recoveryResolution = resolveShowDirectorVisualValidationFrame(recoveryPreset, recoveryDefinition, undefined, 'high')
    const recovery = await validateRecovery(created.runtime, recoveryResolution.sceneFrame)
    window.__SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__ = {
      ready: true,
      status: 'pass',
      reason: null,
      capability,
      width: output.width,
      height: output.height,
      rendererHost: 'production-laser-dmx-webgl-runtime',
      frames: summaries,
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
      recovery: null,
    }
  } finally {
    created.runtime.dispose()
    document.documentElement.dataset.webglVisualReviewReady = 'true'
  }
}

void main()
