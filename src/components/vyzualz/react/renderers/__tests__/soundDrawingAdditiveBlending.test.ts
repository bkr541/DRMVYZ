import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactPreset } from '../../ReactTypes'
import type { SoundDrawingResolvedPerformanceFrame } from '../../soundDrawing/SoundDrawingPerformanceTypes'
import { DEFAULT_REACT_RENDER_PARAMS, type ReactFrameContext } from '../reactRenderUtils'

const mocks = vi.hoisted(() => ({
  resolvePerformanceFrame: vi.fn(),
  publishDiagnostics: vi.fn(),
  clearDiagnostics: vi.fn(),
}))

vi.mock('../../soundDrawing/SoundDrawingPerformanceEngine', () => ({
  resolveSoundDrawingPerformanceFrame: mocks.resolvePerformanceFrame,
}))

vi.mock('../LivingRibbonCanvas2DRenderer', () => ({
  disposeLivingRibbonCanvasRuntimes: vi.fn(),
  pauseLivingRibbonCanvasRuntimes: vi.fn(),
  resetLivingRibbonCanvasRuntimes: vi.fn(),
  getLivingRibbonCanvasDiagnostics: vi.fn(() => ({
    runtimeCount: 0, failureCount: 0, paused: false, resetCount: 0, finiteRecoveryCount: 0, runtimes: [],
  })),
  prepareLivingRibbonCanvasFrame: vi.fn(() => ({
    activeRuntimeKeys: new Set(), clearTrail: false, diagnostics: [],
    qualityBudget: {
      requested: 'auto', resolved: 'medium', pointCount: 96, splineSubdivisions: 2,
      glowPasses: 2, sparkCount: 4, accentStride: 3, trailDetail: 0.72,
    },
  })),
  renderLivingRibbonCanvasLayer: vi.fn(),
  resolveLivingRibbonCanvasQualityBudget: vi.fn(),
  usesLivingRibbonCanvasRenderer: vi.fn(() => false),
}))

vi.mock('../../SharedPerformanceDiagnosticsStore', () => ({
  publishSharedPerformanceDiagnostics: mocks.publishDiagnostics,
  clearSharedPerformanceDiagnostics: mocks.clearDiagnostics,
}))

vi.mock('../../../../../features/performanceCore', () => ({
  createSharedPerformanceDiagnostics: vi.fn((_context: unknown, diagnostics: unknown) => diagnostics),
}))

import { disposeSoundDrawingRenderer, renderSoundDrawing } from '../SoundDrawingRenderer'

interface RecordingContext extends CanvasRenderingContext2D {
  stroke: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
}

function recordingContext(): RecordingContext {
  const context: Partial<RecordingContext> & Record<string, unknown> = {
    canvas: { width: 640, height: 360 } as HTMLCanvasElement,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    shadowColor: '#000000',
    shadowBlur: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    filter: 'none',
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  }
  return context as unknown as RecordingContext
}

const FRAME: ReactFrameContext = {
  W: 640,
  H: 360,
  dpr: 1,
  t: 1000,
  elapsedTimeSec: 1,
  deltaTimeSec: 1 / 60,
  timeSec: 1,
  audioTime: 1,
  trackKey: 'track-a',
  timingDiscontinuity: false,
  bpm: 120,
  beatPhase: 0.25,
  beatHit: false,
  isPlaying: true,
  isPaused: false,
  audio: { bass: 0.6, mid: 0.4, high: 0.3, volume: 0.5 },
  freqData: null,
  timeDomainData: null,
  musicIntelligence: null,
}

const PRESET = {
  id: 'blend-test',
  name: 'Blend Test',
  engine: 'oscilloscope',
  palette: {
    background: '#02060b',
    primary: '#00c8ff',
    secondary: '#00a66a',
    accent: '#3df0b0',
    highlight: '#e8fff7',
  },
  params: { intensity: 1, motion: 1, glow: 1, bassReactivity: 1 },
  scenes: [],
  sectionMappings: [],
} as unknown as ReactPreset

function baseResolvedLayer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'layer-a',
    role: 'primaryMotif',
    enabled: true,
    opacity: 1,
    generator: 'audioReactiveAttractor', // not livingRibbon, not in performanceLayerUsesPath's generator list
    source: { kind: 'generated', identity: 'generated:audioReactiveAttractor' },
    identityProfile: 'abstract',
    treatment: 'controlledReactive',
    preserveIdentity: false,
    blendMode: 'screen',
    strokeWidth: 1,
    traceCount: 1,
    symmetry: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
    phaseOffset: 0,
    trailPersistence: 0.72,
    feedbackAmount: 0.1,
    glow: 0.8,
    colorRole: 'primary',
    topologyVariant: 0,
    renderMode: 'ribbon',
    classicMode: 'waveform',
    shape: 'line',
    audioDisplacement: 0.5,
    jitter: 0.05,
    particleCount: 0,
    contourBudget: 1,
    requestedContourDeformation: 0,
    appliedContourDeformation: 0,
    readabilityClamped: false,
    contourScale: 1,
    allowCharacterDeformation: false,
    allowTextWaveform: false,
    wholeObjectMotion: 0.5,
    contourReactivity: 0.5,
    echoStrength: 0,
    sourceTrailStrength: 0.7,
    supportingVisualReactivity: 0.7,
    sourceFailure: null,
    livingRibbonControls: {
      drive: 0.6, turbulence: 0.3, tension: 0.55, damping: 0.45, spread: 0.8,
      centerAttraction: 0.2, widthTarget: 0.7, twist: 0.15, radialPressure: 0.2,
      collapseAmount: 0, releaseAmount: 0.3, directionalDrift: 0.12, heatDecay: 0.3,
    },
    livingRibbonImpulses: [],
    modulationRoutes: [],
    eventBindings: [],
    ...overrides,
  }
}

function resolvedPerformance(layerOverrides: Partial<Record<string, unknown>> = {}): SoundDrawingResolvedPerformanceFrame {
  return {
    showId: 'radialPressureSystem',
    showName: 'Radial Pressure System',
    sceneId: 'rps-drop',
    context: {
      trackIdentity: 'track-a',
      trackReplacementDetected: false,
      seekDetected: false,
      loopWrapDetected: false,
      performanceFourBarBlockIndex: 0,
      capabilities: {
        liveBands: true, rhythmEvents: true, beatGrid: true, sections: true,
        trackEnergyCurve: true, stemCurves: false, lyrics: false,
      },
    },
    layers: [baseResolvedLayer(layerOverrides)],
    global: {
      trailPersistence: 0.72, feedbackAmount: 0.1, cameraScale: 1, cameraRotation: 0,
      cameraX: 0, cameraY: 0, backgroundFade: 1,
    },
    fallbackUsed: false,
    deterministicIdentity: 'blend-test',
    appliedActionReasons: [],
    activeSourceKind: 'generated',
    activeIdentityProfile: 'abstract',
    activeTreatment: 'controlledReactive',
    preserveIdentity: false,
    sourceRole: 'generatedOnly',
    contourBudget: 1,
    requestedContourDeformation: 0,
    appliedContourDeformation: 0,
    readabilityClampApplied: false,
    supportingGeneratedLayers: [],
    sourceFallbackState: null,
  } as unknown as SoundDrawingResolvedPerformanceFrame
}

let offscreenContext: RecordingContext

beforeEach(() => {
  vi.clearAllMocks()
  offscreenContext = recordingContext()
  const offscreenCanvas = {
    width: 1,
    height: 1,
    getContext: vi.fn(() => offscreenContext),
  } as unknown as HTMLCanvasElement
  vi.stubGlobal('document', {
    createElement: vi.fn(() => offscreenCanvas),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sound Drawing additive blending', () => {
  it('defaults trace blend mode to "lighter" on the legacy/manual render path (no authored performance active)', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(null)
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, DEFAULT_REACT_RENDER_PARAMS, null)

    expect(offscreenContext.globalCompositeOperation).toBe('lighter')
    disposeSoundDrawingRenderer(context)
  })

  it('honors an authored performance layer\'s own resolved blendMode instead of forcing "lighter" or "screen"', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(resolvedPerformance({ blendMode: 'screen' }))
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, {
      ...DEFAULT_REACT_RENDER_PARAMS,
      soundDrawingPerformanceSettings: {
        ...DEFAULT_REACT_RENDER_PARAMS.soundDrawingPerformanceSettings,
        autoPerformance: true,
      },
    }, null)

    expect(offscreenContext.globalCompositeOperation).toBe('screen')
    disposeSoundDrawingRenderer(context)
  })

  it('a different resolved layer blendMode ("source-over") is also honored, proving it is read, not hardcoded', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(resolvedPerformance({ blendMode: 'source-over' }))
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, {
      ...DEFAULT_REACT_RENDER_PARAMS,
      soundDrawingPerformanceSettings: {
        ...DEFAULT_REACT_RENDER_PARAMS.soundDrawingPerformanceSettings,
        autoPerformance: true,
      },
    }, null)

    expect(offscreenContext.globalCompositeOperation).toBe('source-over')
    disposeSoundDrawingRenderer(context)
  })
})
