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

import {
  disposeSoundDrawingRenderer,
  renderSoundDrawing,
  resolveSoundDrawingTemporalBlendMode,
} from '../SoundDrawingRenderer'

interface RecordingContext extends CanvasRenderingContext2D {
  stroke: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
  compositeOperations: GlobalCompositeOperation[]
}

function recordingContext(): RecordingContext {
  const compositeOperations: GlobalCompositeOperation[] = []
  let compositeOperation: GlobalCompositeOperation = 'source-over'
  const context: Partial<RecordingContext> & Record<string, unknown> = {
    canvas: { width: 640, height: 360 } as HTMLCanvasElement,
    globalAlpha: 1,
    compositeOperations,
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
  Object.defineProperty(context, 'globalCompositeOperation', {
    configurable: true,
    get: () => compositeOperation,
    set: (value: GlobalCompositeOperation) => {
      compositeOperation = value
      compositeOperations.push(value)
    },
  })
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

let offscreenContexts: RecordingContext[]

beforeEach(() => {
  vi.clearAllMocks()
  offscreenContexts = []
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const context = recordingContext()
      offscreenContexts.push(context)
      return {
        width: 1,
        height: 1,
        getContext: vi.fn(() => context),
      } as unknown as HTMLCanvasElement
    }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sound Drawing bounded temporal blending', () => {
  it('maps additive lighter requests to bounded screen blending', () => {
    expect(resolveSoundDrawingTemporalBlendMode('lighter')).toBe('screen')
    expect(resolveSoundDrawingTemporalBlendMode('screen')).toBe('screen')
    expect(resolveSoundDrawingTemporalBlendMode('source-over')).toBe('source-over')
  })

  it('renders manual current geometry with screen and commits history with source-over', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(null)
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, DEFAULT_REACT_RENDER_PARAMS, null)

    const operations = offscreenContexts.flatMap((candidate) => candidate.compositeOperations)
    expect(operations).toContain('screen')
    expect(operations).toContain('source-over')
    expect(operations).not.toContain('lighter')
    expect(document.createElement).toHaveBeenCalledTimes(2)
    disposeSoundDrawingRenderer(context)
  })

  it('allocates separate current-frame and history canvases for an authored layer', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(resolvedPerformance({ blendMode: 'screen' }))
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, {
      ...DEFAULT_REACT_RENDER_PARAMS,
      soundDrawingPerformanceSettings: {
        ...DEFAULT_REACT_RENDER_PARAMS.soundDrawingPerformanceSettings,
        autoPerformance: true,
      },
    }, null)

    expect(document.createElement).toHaveBeenCalledTimes(4)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
    disposeSoundDrawingRenderer(context)
  })

  it('never writes an explicitly additive authored layer into temporal history with lighter', () => {
    mocks.resolvePerformanceFrame.mockReturnValue(resolvedPerformance({ blendMode: 'lighter' }))
    const context = recordingContext()

    renderSoundDrawing(context, FRAME, PRESET, {
      ...DEFAULT_REACT_RENDER_PARAMS,
      soundDrawingPerformanceSettings: {
        ...DEFAULT_REACT_RENDER_PARAMS.soundDrawingPerformanceSettings,
        autoPerformance: true,
      },
    }, null)

    const operations = [context, ...offscreenContexts].flatMap((candidate) => candidate.compositeOperations)
    expect(operations).toContain('screen')
    expect(operations).not.toContain('lighter')
    disposeSoundDrawingRenderer(context)
  })
})
