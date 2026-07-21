import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactPreset } from '../ReactTypes'
import type { SoundDrawingResolvedPerformanceFrame } from '../soundDrawing/SoundDrawingPerformanceTypes'
import { DEFAULT_REACT_RENDER_PARAMS, type ReactFrameContext } from './reactRenderUtils'

const mocks = vi.hoisted(() => ({
  resolvePerformanceFrame: vi.fn(),
  prepareLivingRibbon: vi.fn(),
  renderLivingRibbon: vi.fn(),
  disposeLivingRibbon: vi.fn(),
  pauseLivingRibbon: vi.fn(),
  publishDiagnostics: vi.fn(),
  clearDiagnostics: vi.fn(),
}))

vi.mock('../soundDrawing/SoundDrawingPerformanceEngine', () => ({
  resolveSoundDrawingPerformanceFrame: mocks.resolvePerformanceFrame,
}))

vi.mock('./LivingRibbonCanvas2DRenderer', () => ({
  disposeLivingRibbonCanvasRuntimes: mocks.disposeLivingRibbon,
  pauseLivingRibbonCanvasRuntimes: mocks.pauseLivingRibbon,
  prepareLivingRibbonCanvasFrame: mocks.prepareLivingRibbon,
  renderLivingRibbonCanvasLayer: mocks.renderLivingRibbon,
  resolveLivingRibbonCanvasQualityBudget: vi.fn(() => ({
    requested: 'auto',
    resolved: 'medium',
    pointCount: 96,
    splineSubdivisions: 2,
    glowPasses: 2,
    sparkCount: 4,
    accentStride: 3,
    trailDetail: 0.72,
  })),
  usesLivingRibbonCanvasRenderer: vi.fn((layer: { generator?: string }) => layer.generator === 'livingRibbon'),
}))

vi.mock('../SharedPerformanceDiagnosticsStore', () => ({
  publishSharedPerformanceDiagnostics: mocks.publishDiagnostics,
  clearSharedPerformanceDiagnostics: mocks.clearDiagnostics,
}))

vi.mock('../../../../features/performanceCore', () => ({
  createSharedPerformanceDiagnostics: vi.fn((_context: unknown, diagnostics: unknown) => diagnostics),
}))

import { disposeSoundDrawingRenderer, renderSoundDrawing } from './SoundDrawingRenderer'

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
    stroke: vi.fn(),
  }
  return context as unknown as RecordingContext
}

function resolvedPerformance(): SoundDrawingResolvedPerformanceFrame {
  return {
    showId: 'livingRibbonSystem',
    showName: 'Living Ribbon System',
    sceneId: 'lrs-drop',
    context: {
      trackIdentity: 'track-a',
      trackReplacementDetected: false,
      seekDetected: false,
      loopWrapDetected: false,
      performanceFourBarBlockIndex: 0,
    },
    layers: [{
      id: 'living-primary',
      role: 'primaryMotif',
      enabled: true,
      opacity: 1,
      generator: 'livingRibbon',
      source: { kind: 'generated', identity: 'generated:livingRibbon', generator: 'livingRibbon' },
      identityProfile: 'abstract',
      treatment: 'controlledReactive',
      preserveIdentity: false,
      blendMode: 'lighter',
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
      modulationRoutes: [],
      eventBindings: [],
    }],
    global: {
      trailPersistence: 0.72,
      feedbackAmount: 0.1,
      cameraScale: 1,
      cameraRotation: 0,
      cameraX: 0,
      cameraY: 0,
      backgroundFade: 1,
    },
    fallbackUsed: false,
    deterministicIdentity: 'living-fallback-test',
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

let offscreenContext: RecordingContext

const PRESET = {
  id: 'living-fallback',
  name: 'Living Fallback',
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
  mocks.resolvePerformanceFrame.mockReturnValue(resolvedPerformance())
  mocks.prepareLivingRibbon.mockReturnValue({ activeRuntimeKeys: new Set(['livingRibbonSystem:living-primary']), clearTrail: false, diagnostics: [] })
  mocks.renderLivingRibbon.mockReturnValue({
    rendered: false,
    fallbackReason: 'Living Ribbon rendering failed: invalid simulation output',
    runtimeKey: 'livingRibbonSystem:living-primary',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sound Drawing Living Ribbon renderer integration', () => {
  it('dispatches Living Ribbon and draws the existing waveform fallback instead of leaving a blank canvas', () => {
    const context = recordingContext()
    renderSoundDrawing(context, FRAME, PRESET, {
      ...DEFAULT_REACT_RENDER_PARAMS,
      soundDrawingPerformanceSettings: {
        ...DEFAULT_REACT_RENDER_PARAMS.soundDrawingPerformanceSettings,
        selectedShowId: 'livingRibbonSystem',
        autoPerformance: true,
      },
    }, 'drop')

    expect(mocks.prepareLivingRibbon).toHaveBeenCalledTimes(1)
    expect(mocks.renderLivingRibbon).toHaveBeenCalledTimes(1)
    expect(offscreenContext.stroke).toHaveBeenCalled()
    expect(context.drawImage).toHaveBeenCalled()
    expect(mocks.publishDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      fallbackState: expect.stringContaining('invalid simulation output'),
    }))

    disposeSoundDrawingRenderer(context)
  })
})
