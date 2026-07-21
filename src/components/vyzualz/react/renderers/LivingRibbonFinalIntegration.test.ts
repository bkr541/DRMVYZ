import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { normalizeSoundDrawingPerformanceSettings } from '../../../../stores/reactStore'
import { DEFAULT_OSCILLATOR_SETTINGS, type ReactPreset, type ReactTrackSection } from '../ReactTypes'
import {
  resolveSoundDrawingPerformanceFrame,
} from '../soundDrawing/SoundDrawingPerformanceEngine'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  type SoundDrawingResolvedPerformanceFrame,
} from '../soundDrawing/SoundDrawingPerformanceTypes'
import {
  disposeLivingRibbonCanvasRuntimes,
  getLivingRibbonCanvasDiagnosticsForTests,
  prepareLivingRibbonCanvasFrame,
  renderLivingRibbonCanvasLayer,
  usesLivingRibbonCanvasRenderer,
} from './LivingRibbonCanvas2DRenderer'
import type { ReactFrameContext } from './reactRenderUtils'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.92 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 16, intensity: 0.5, source: 'auto', confidence: 0.9 },
  { id: 'build', label: 'Build', type: 'build', startSec: 16, endSec: 24, intensity: 0.72, source: 'auto', confidence: 0.91 },
  { id: 'pre-drop', label: 'Pre-Drop', type: 'preDrop', startSec: 24, endSec: 28, intensity: 0.45, source: 'auto', confidence: 0.94 },
  {
    id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 28, endSec: 68, intensity: 0.95,
    source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 },
  },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 68, endSec: 84, intensity: 0.28, source: 'auto', confidence: 0.9 },
  {
    id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 84, endSec: 124, intensity: 1,
    source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 },
  },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 124, endSec: 140, intensity: 0.2, source: 'auto', confidence: 0.88 },
]

const PRESET = {
  id: 'living-ribbon-final-integration',
  name: 'Living Ribbon Final Integration',
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

function mockContext(): CanvasRenderingContext2D {
  const context: Partial<CanvasRenderingContext2D> & Record<string, unknown> = {
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
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    setLineDash() {},
  }
  return context as unknown as CanvasRenderingContext2D
}

function intelligenceFrame(
  timeSec: number,
  events: readonly ('kick' | 'snare' | 'hat' | 'downbeat')[] = [],
  confidence = 0.92,
  trackId = 'track-a',
  advancedCapabilities = true,
): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const eventSet = new Set(events)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.floor(timeSec * 60)),
    trackId,
    sourceId: trackId,
    analysisRevision: 'analysis-final-r1',
    timelineRevision: 'timeline-final-r1',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.72,
      mid: 0.48,
      high: 0.56,
      volume: 0.68,
      normalizedBass: 0.72,
      normalizedMid: 0.48,
      normalizedHigh: 0.56,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: confidence,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: events.length > 0,
      downbeatHit: eventSet.has('downbeat'),
      kickHit: eventSet.has('kick'),
      kickStrength: eventSet.has('kick') ? 0.95 : 0,
      snareHit: eventSet.has('snare'),
      snareStrength: eventSet.has('snare') ? 0.9 : 0,
      hatHit: eventSet.has('hat'),
      hatStrength: eventSet.has('hat') ? 0.82 : 0,
      transient: events.length ? 0.88 : 0,
      transientConfidence: confidence,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.68,
      shortTerm: 0.66,
      longTerm: 0.6,
      percentile: 0.74,
      spectralFlux: 0.52,
      tension: 0.61,
      complexity: 0.58,
      buildProgress: timeSec >= 16 && timeSec < 24 ? (timeSec - 16) / 8 : 0,
      dropImpact: eventSet.has('downbeat') ? 0.9 : 0,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: timeSec >= 8 && timeSec < 16 ? 0.7 : 0.15 },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: advancedCapabilities,
      sections: advancedCapabilities,
      trackEnergyCurve: advancedCapabilities,
      stemCurves: advancedCapabilities,
      lyrics: advancedCapabilities,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: confidence,
      rhythm: confidence,
      section: confidence,
    },
  }
}

function frameAt(
  timeSec: number,
  options: {
    events?: readonly ('kick' | 'snare' | 'hat' | 'downbeat')[]
    confidence?: number
    trackKey?: string
    isPlaying?: boolean
    timingDiscontinuity?: boolean
    sections?: readonly ReactTrackSection[]
    advancedCapabilities?: boolean
  } = {},
): ReactFrameContext {
  const trackKey = options.trackKey ?? 'track-a'
  const intelligence = intelligenceFrame(
    timeSec,
    options.events,
    options.confidence,
    trackKey,
    options.advancedCapabilities,
  )
  return {
    W: 640,
    H: 360,
    dpr: 1,
    t: timeSec * 60,
    elapsedTimeSec: timeSec,
    deltaTimeSec: 1 / 60,
    timingDiscontinuity: options.timingDiscontinuity,
    timeSec,
    audioTime: timeSec,
    trackKey,
    bpm: 120,
    beatPhase: intelligence.rhythm.beatPhase,
    beatHit: intelligence.rhythm.beatHit,
    isPlaying: options.isPlaying ?? true,
    isPaused: options.isPlaying === false,
    audio: { bass: 0.72, mid: 0.48, high: 0.56, volume: 0.68 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: intelligence,
    trackSections: options.sections ?? SECTIONS,
  }
}

const SETTINGS = normalizeSoundDrawingPerformanceSettings({
  ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  selectedShowId: 'livingRibbonSystem',
  performanceSource: 'generatedVisual',
  autoPerformance: true,
  quality: 'auto',
  livingRibbon: {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon,
    quality: 'auto',
    pointDensity: 0.72,
    sparkAmount: 0.45,
  },
})

function resolveFrame(
  frame: ReactFrameContext,
  previousContext: SoundDrawingResolvedPerformanceFrame['context'] | null = null,
): SoundDrawingResolvedPerformanceFrame {
  const resolved = resolveSoundDrawingPerformanceFrame({
    frame,
    settings: SETTINGS,
    manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    previousContext,
  })
  expect(resolved).not.toBeNull()
  return resolved as SoundDrawingResolvedPerformanceFrame
}

function prepareAndRender(
  ownerContext: CanvasRenderingContext2D,
  targetContext: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  performance: SoundDrawingResolvedPerformanceFrame,
  mode: 'live' | 'preview' | 'thumbnail' = 'live',
): void {
  const preparation = prepareLivingRibbonCanvasFrame({
    ownerContext,
    frame,
    performance,
    quality: SETTINGS.livingRibbon.quality,
    mode,
    pointDensity: SETTINGS.livingRibbon.pointDensity,
    sparkAmount: SETTINGS.livingRibbon.sparkAmount,
  })
  expect(preparation.diagnostics).toEqual([])
  const layer = performance.layers.find(usesLivingRibbonCanvasRenderer)
  expect(layer).toBeDefined()
  const rendered = renderLivingRibbonCanvasLayer({
    ownerContext,
    targetContext,
    frame,
    preset: PRESET,
    performance,
    layer: layer!,
    intensity: 1,
    glow: 1,
  })
  expect(rendered).toMatchObject({ rendered: true, fallbackReason: null })
}

describe('Living Ribbon final production integration', () => {
  it('connects authored context, routing, physics, rendering, persistence, transport, isolation, and disposal', () => {
    const scenarios = [
      { name: 'intro', timeSec: 2 },
      { name: 'verse-vocals', timeSec: 10 },
      { name: 'build', timeSec: 20 },
      { name: 'pre-drop', timeSec: 25 },
      { name: 'drop-1', timeSec: 28.01, events: ['downbeat', 'kick'] as const },
      { name: 'breakdown', timeSec: 72 },
      { name: 'drop-2', timeSec: 84.01, events: ['downbeat', 'kick'] as const },
      { name: 'outro', timeSec: 132 },
    ]
    for (const scenario of scenarios) {
      const resolved = resolveFrame(frameAt(scenario.timeSec, { events: scenario.events }))
      const layer = resolved.layers.find(usesLivingRibbonCanvasRenderer)
      expect(layer, scenario.name).toBeDefined()
      expect(layer!.livingRibbonControls.drive, scenario.name).toBeGreaterThan(0)
      expect(layer!.modulationRoutes.length, scenario.name).toBeGreaterThan(0)
      expect(layer!.eventBindings.length, scenario.name).toBeGreaterThan(0)
    }

    const lowConfidenceSections = SECTIONS.map(section => ({ ...section, confidence: 0.08 }))
    const lowConfidence = resolveFrame(frameAt(31.01, {
      confidence: 0.08,
      sections: lowConfidenceSections,
      events: ['kick'],
    }))
    expect(lowConfidence.fallbackUsed).toBe(true)
    expect(lowConfidence.layers.find(usesLivingRibbonCanvasRenderer)?.opacity).toBeGreaterThan(0)

    const missingAdvanced = resolveFrame(frameAt(31.01, {
      advancedCapabilities: false,
      sections: [],
      events: ['kick'],
    }))
    expect(missingAdvanced.fallbackUsed).toBe(true)
    expect(missingAdvanced.layers.find(usesLivingRibbonCanvasRenderer)?.livingRibbonImpulses.length).toBeGreaterThan(0)

    const persistenceRoundTrip = normalizeSoundDrawingPerformanceSettings(
      JSON.parse(JSON.stringify(SETTINGS)),
    )
    expect(persistenceRoundTrip).toEqual(SETTINGS)

    const owner = mockContext()
    const target = mockContext()
    const dropFrame = frameAt(28.01, { events: ['downbeat', 'kick'] })
    const drop = resolveFrame(dropFrame)
    prepareAndRender(owner, target, dropFrame, drop)
    let diagnostics = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(diagnostics).toMatchObject({ runtimeCount: 1, failureCount: 0, paused: false })
    expect(diagnostics.runtimes[0]).toMatchObject({
      requestedQuality: 'auto',
      resolvedQuality: 'medium',
      maximumRememberedImpulses: 256,
      maximumSubsteps: 8,
    })
    expect(diagnostics.runtimes[0].pointCapacity).toBeLessThanOrEqual(256)
    expect(diagnostics.runtimes[0].sparkCapacity).toBeLessThanOrEqual(8)

    const pausedFrame = frameAt(29, { isPlaying: false })
    const paused = resolveFrame(pausedFrame, drop.context)
    prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: pausedFrame,
      performance: paused,
      quality: 'auto',
      mode: 'live',
    })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).paused).toBe(true)

    const resumeFrame = frameAt(29.1)
    const resumed = resolveFrame(resumeFrame, paused.context)
    prepareAndRender(owner, target, resumeFrame, resumed)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).paused).toBe(false)

    const futureFrame = frameAt(60, { timingDiscontinuity: true })
    const futureResolved = resolveFrame(futureFrame, resumed.context)
    const future = {
      ...futureResolved,
      context: {
        ...futureResolved.context,
        seekDetected: true,
        loopWrapDetected: false,
        seekIdentity: 'forward-seek-final',
      },
    }
    prepareAndRender(owner, target, futureFrame, future)
    const backwardFrame = frameAt(31, { timingDiscontinuity: true })
    const backwardResolved = resolveFrame(backwardFrame, future.context)
    const backward = {
      ...backwardResolved,
      context: {
        ...backwardResolved.context,
        seekDetected: true,
        loopWrapDetected: false,
        seekIdentity: 'backward-seek-final',
      },
    }
    prepareAndRender(owner, target, backwardFrame, backward)

    const loopSource = resolveFrame(frameAt(58), backward.context)
    const loopFrame = frameAt(31)
    const looped = resolveFrame(loopFrame, loopSource.context)
    expect(looped.context.loopWrapDetected).toBe(true)
    prepareAndRender(owner, target, loopFrame, looped)

    const replacementFrame = frameAt(31, { trackKey: 'track-b' })
    const replacement = resolveFrame(replacementFrame, looped.context)
    expect(replacement.context.trackReplacementDetected).toBe(true)
    prepareAndRender(owner, target, replacementFrame, replacement)

    diagnostics = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(diagnostics.runtimes[0].reconstructionCount).toBeGreaterThanOrEqual(4)
    expect(diagnostics.runtimes[0].lastReconstructionSteps).toBeLessThanOrEqual(30)
    expect(diagnostics.runtimes[0].lastReconstructionDurationSec).toBeLessThanOrEqual(0.25)

    const noLivingPerformance = { ...replacement, layers: [] }
    prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: replacementFrame,
      performance: noLivingPerformance,
      quality: 'auto',
      mode: 'live',
    })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimeCount).toBe(0)

    const thumbnailOwner = mockContext()
    const thumbnailTarget = mockContext()
    prepareAndRender(thumbnailOwner, thumbnailTarget, dropFrame, drop, 'thumbnail')
    const thumbnailDiagnostics = getLivingRibbonCanvasDiagnosticsForTests(thumbnailOwner)
    expect(thumbnailDiagnostics.runtimes[0]).toMatchObject({
      resolvedQuality: 'low',
    })
    expect(thumbnailDiagnostics.runtimes[0].pointCapacity).toBeLessThanOrEqual(64)
    expect(thumbnailDiagnostics.runtimes[0].sparkCapacity).toBeLessThanOrEqual(3)

    disposeLivingRibbonCanvasRuntimes(thumbnailOwner)
    disposeLivingRibbonCanvasRuntimes(owner)
    expect(getLivingRibbonCanvasDiagnosticsForTests(thumbnailOwner).runtimeCount).toBe(0)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimeCount).toBe(0)
  })
})
