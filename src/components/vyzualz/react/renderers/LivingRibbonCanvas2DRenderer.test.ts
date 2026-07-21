import { afterEach, describe, expect, it, vi } from 'vitest'
import { LivingRibbonSimulation } from '../../../../features/visualSimulation'
import type { ReactPreset } from '../ReactTypes'
import type {
  SoundDrawingResolvedPerformanceFrame,
  SoundDrawingResolvedPerformanceLayer,
} from '../soundDrawing/SoundDrawingPerformanceTypes'
import type { ReactFrameContext } from './reactRenderUtils'
import {
  disposeLivingRibbonCanvasRuntimes,
  getLivingRibbonCanvasDiagnosticsForTests,
  LIVING_RIBBON_AUTO_STEP_DOWN_FRAMES,
  LIVING_RIBBON_MAX_FAILURE_RECORDS,
  LIVING_RIBBON_MAX_RECENT_IMPULSES,
  prepareLivingRibbonCanvasFrame,
  renderLivingRibbonCanvasLayer,
  resetLivingRibbonCanvasRuntimes,
  resolveLivingRibbonCanvasQualityBudget,
  setLivingRibbonSimulationFactoryForTests,
  usesLivingRibbonCanvasRenderer,
} from './LivingRibbonCanvas2DRenderer'

interface MockContext extends CanvasRenderingContext2D {
  recordedStrokeStyles: string[]
  recordedCompositeOperations: string[]
}

function createMockContext(): MockContext {
  const context: Partial<MockContext> & Record<string, unknown> = {
    canvas: { width: 640, height: 360 } as unknown as HTMLCanvasElement,
    recordedStrokeStyles: [],
    recordedCompositeOperations: [],
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    strokeStyle: '#000000',
    fillStyle: '#000000',
    shadowBlur: 0,
    shadowColor: '#000000',
    lineCap: 'butt',
    lineJoin: 'miter',
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {
      context.recordedStrokeStyles?.push(String(context.strokeStyle))
      context.recordedCompositeOperations?.push(String(context.globalCompositeOperation))
    },
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    setLineDash() {},
  }
  return context as unknown as MockContext
}

const PRESET = {
  id: 'living-ribbon-test',
  name: 'Living Ribbon Test',
  engine: 'oscilloscope',
  palette: {
    background: '#03070d',
    primary: '#00c8ff',
    secondary: '#00a66a',
    accent: '#3df0b0',
    highlight: '#c9fff1',
  },
  params: { intensity: 1, motion: 1, glow: 1, bassReactivity: 1 },
  sectionMappings: [],
  scenes: [],
} as unknown as ReactPreset

function frame(patch: Partial<ReactFrameContext> = {}): ReactFrameContext {
  return {
    W: 640,
    H: 360,
    dpr: 1,
    t: 60,
    elapsedTimeSec: 1,
    deltaTimeSec: 1 / 60,
    timeSec: 1,
    audioTime: 1,
    trackKey: 'track-a',
    bpm: 120,
    beatPhase: 0.1,
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0.7, mid: 0.45, high: 0.5, volume: 0.65 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: null,
    ...patch,
  }
}

function livingLayer(patch: Partial<SoundDrawingResolvedPerformanceLayer> = {}): SoundDrawingResolvedPerformanceLayer {
  return {
    id: 'living-primary',
    role: 'primaryMotif',
    enabled: true,
    generator: 'livingRibbon',
    source: { kind: 'generated', identity: 'generated:livingRibbon', generator: 'livingRibbon' },
    identityProfile: 'abstract',
    treatment: 'controlledReactive',
    preserveIdentity: false,
    blendMode: 'lighter',
    opacity: 0.92,
    strokeWidth: 0.8,
    traceCount: 1,
    symmetry: 1,
    scale: 0.88,
    x: 0,
    y: 0,
    rotation: 0,
    phaseOffset: 0,
    trailPersistence: 0.72,
    feedbackAmount: 0.14,
    glow: 0.8,
    colorRole: 'primary',
    topologyVariant: 0,
    renderMode: 'line',
    classicMode: 'waveform',
    shape: 'line',
    audioDisplacement: 0.5,
    jitter: 0.08,
    particleCount: 0,
    contourBudget: 1,
    requestedContourDeformation: 0.5,
    appliedContourDeformation: 0.5,
    readabilityClamped: false,
    contourScale: 1,
    allowCharacterDeformation: false,
    allowTextWaveform: false,
    wholeObjectMotion: 0.6,
    contourReactivity: 0.5,
    echoStrength: 0.1,
    sourceTrailStrength: 0.7,
    supportingVisualReactivity: 0.75,
    sourceFailure: null,
    livingRibbonControls: {
      drive: 0.42,
      turbulence: 0.18,
      tension: 0.67,
      damping: 0.61,
      spread: 0.58,
      centerAttraction: 0.35,
      widthTarget: 0.54,
      twist: 0.08,
      radialPressure: 0.03,
      collapseAmount: 0.02,
      releaseAmount: 0.1,
      directionalDrift: -0.04,
      heatDecay: 0.55,
    },
    livingRibbonImpulses: [],
    modulationRoutes: [],
    eventBindings: [],
    ...patch,
  } as SoundDrawingResolvedPerformanceLayer
}

function performance(
  patch: Partial<SoundDrawingResolvedPerformanceFrame> = {},
  contextPatch: Record<string, unknown> = {},
): SoundDrawingResolvedPerformanceFrame {
  return {
    showId: 'livingRibbonSystem',
    showName: 'Living Ribbon System',
    sceneId: 'living-drop',
    context: {
      trackIdentity: 'track-a',
      sectionType: 'drop',
      sectionProgress: 0.25,
      sectionPhase: 'body',
      dropImpact: 0.65,
      energy: 0.76,
      bass: 0.72,
      mid: 0.48,
      high: 0.56,
      energyTrend: 0.18,
      seekDetected: false,
      loopWrapDetected: false,
      trackReplacementDetected: false,
      seekIdentity: 'seek-0',
      loopIdentity: 'loop-0',
      trackChangeIdentity: 'track-change-0',
      timingDiscontinuityIdentity: 'timing-0',
      kick: false,
      kickStrength: 0,
      snare: false,
      snareStrength: 0,
      hat: false,
      hatStrength: 0,
      beatIndex: 8,
      intelligence: { rhythm: { downbeatHit: false } },
      ...contextPatch,
    } as SoundDrawingResolvedPerformanceFrame['context'],
    layers: [livingLayer()],
    global: {
      trailPersistence: 0.72,
      feedbackAmount: 0.12,
      cameraScale: 1,
      cameraRotation: 0,
      cameraX: 0,
      cameraY: 0,
      backgroundFade: 1,
    },
    fallbackUsed: false,
    deterministicIdentity: 'living-test',
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
    ...patch,
  }
}

afterEach(() => {
  setLivingRibbonSimulationFactoryForTests(null)
})

describe('Living Ribbon Canvas2D renderer ownership and quality', () => {
  it('keeps manual quality fixed and bounds conservative Auto budgets', () => {
    expect(resolveLivingRibbonCanvasQualityBudget('low', 'live')).toMatchObject({ resolved: 'low', pointCount: 48 })
    expect(resolveLivingRibbonCanvasQualityBudget('medium', 'live')).toMatchObject({ resolved: 'medium', pointCount: 96 })
    expect(resolveLivingRibbonCanvasQualityBudget('high', 'live')).toMatchObject({ resolved: 'high', pointCount: 160 })
    expect(resolveLivingRibbonCanvasQualityBudget('auto', 'live')).toMatchObject({ resolved: 'medium', pointCount: 96 })
    expect(resolveLivingRibbonCanvasQualityBudget('auto', 'thumbnail')).toMatchObject({ resolved: 'low', pointCount: 48 })
    expect(resolveLivingRibbonCanvasQualityBudget('high', 'preview')).toMatchObject({ resolved: 'high', pointCount: 128, sparkCount: 7 })
    expect(resolveLivingRibbonCanvasQualityBudget('high', 'thumbnail')).toMatchObject({ resolved: 'high', pointCount: 64, sparkCount: 3 })
    for (const tier of ['auto', 'low', 'medium', 'high'] as const) {
      const budget = resolveLivingRibbonCanvasQualityBudget(tier, 'preview')
      expect(budget.pointCount).toBeGreaterThanOrEqual(8)
      expect(budget.pointCount).toBeLessThanOrEqual(256)
      expect(budget.splineSubdivisions).toBeLessThanOrEqual(3)
      expect(budget.glowPasses).toBeLessThanOrEqual(3)
      expect(budget.sparkCount).toBeLessThanOrEqual(8)
    }
  })

  it('changes Auto quality only after sustained frame pressure and uses hysteresis to recover', () => {
    const owner = createMockContext()
    const resolved = performance()
    const prepare = (deltaTimeSec: number) => prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ deltaTimeSec }),
      performance: resolved,
      quality: 'auto',
      mode: 'live',
    })

    prepare(1 / 60)
    prepare(1 / 15)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).autoQuality.resolvedQuality).toBe('medium')
    for (let index = 0; index < LIVING_RIBBON_AUTO_STEP_DOWN_FRAMES + 60; index += 1) prepare(1 / 15)
    const degraded = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(degraded.autoQuality.resolvedQuality).toBe('low')
    expect(degraded.runtimes[0].pointCount).toBe(48)

    for (let index = 0; index < 320; index += 1) prepare(1 / 120)
    const recovered = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(recovered.autoQuality.resolvedQuality).toBe('medium')
    expect(recovered.autoQuality.transitionCount).toBe(2)
    expect(recovered.runtimes[0].pointCount).toBe(96)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('dispatches only enabled generated Living Ribbon layers to the dedicated renderer', () => {
    expect(usesLivingRibbonCanvasRenderer(livingLayer())).toBe(true)
    expect(usesLivingRibbonCanvasRenderer(livingLayer({ enabled: false }))).toBe(false)
    expect(usesLivingRibbonCanvasRenderer(livingLayer({ opacity: 0 }))).toBe(false)
    expect(usesLivingRibbonCanvasRenderer(livingLayer({
      generator: 'harmonicRibbon',
      source: { kind: 'generated', identity: 'generated:harmonicRibbon', generator: 'harmonicRibbon' },
    }))).toBe(false)
  })

  it('creates a renderer-owned runtime and draws palette-driven controlled passes', () => {
    const owner = createMockContext()
    const target = createMockContext()
    const resolved = performance()
    const prepared = prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame(),
      performance: resolved,
      quality: 'high',
      mode: 'live',
    })
    expect(prepared.diagnostics).toEqual([])
    const result = renderLivingRibbonCanvasLayer({
      ownerContext: owner,
      targetContext: target,
      frame: frame(),
      preset: PRESET,
      performance: resolved,
      layer: resolved.layers[0],
      intensity: 1,
      glow: 1,
    })
    expect(result).toMatchObject({ rendered: true, fallbackReason: null })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner)).toMatchObject({ runtimeCount: 1, failureCount: 0 })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].pointCount).toBe(160)
    expect(target.recordedStrokeStyles.length).toBeGreaterThanOrEqual(5)
    expect(target.recordedStrokeStyles.some(style => style.includes('0,179,163') || style.includes('44,212,252'))).toBe(true)
    expect(target.recordedCompositeOperations.every(operation => operation === 'lighter')).toBe(true)
    disposeLivingRibbonCanvasRuntimes(owner)
  })


  it('consumes only normalized physical controls, de-duplicates impulses, and resets deterministically', () => {
    const owner = createMockContext()
    const target = createMockContext()
    const layer = livingLayer({
      livingRibbonControls: {
        ...livingLayer().livingRibbonControls,
        drive: 0.36,
        turbulence: 0.23,
        centerAttraction: 0.71,
        directionalDrift: -0.18,
      },
      livingRibbonImpulses: [
        {
          kind: 'radialImpact',
          identity: 'kick:track-a:beat-8',
          strength: 0.78,
          direction: [1, 0, 0],
        },
      ],
    })
    const resolved = performance({ layers: [layer] })
    prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audio: { bass: 0, mid: 0, high: 0, volume: 0 } }),
      performance: resolved,
      quality: 'medium',
      mode: 'live',
      pointDensity: 0.4,
      sparkAmount: 0.3,
    })
    renderLivingRibbonCanvasLayer({
      ownerContext: owner,
      targetContext: target,
      frame: frame({ audio: { bass: 0, mid: 0, high: 0, volume: 0 } }),
      preset: PRESET,
      performance: resolved,
      layer,
      intensity: 1,
      glow: 1,
    })
    renderLivingRibbonCanvasLayer({
      ownerContext: owner,
      targetContext: target,
      frame: frame({ t: 61, elapsedTimeSec: 1 + 1 / 60, audioTime: 1 + 1 / 60, audio: { bass: 1, mid: 1, high: 1, volume: 1 } }),
      preset: PRESET,
      performance: resolved,
      layer,
      intensity: 1,
      glow: 1,
    })

    const beforeReset = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(beforeReset.runtimes[0].normalizedControls).toMatchObject({
      drive: 0.36,
      turbulence: 0.23,
      centerAttraction: 0.71,
      directionalDrift: -0.18,
    })
    expect(beforeReset.runtimes[0].recentImpulses).toHaveLength(1)
    expect(resetLivingRibbonCanvasRuntimes(owner, 'manual-reset-1')).toBe(1)
    const afterReset = getLivingRibbonCanvasDiagnosticsForTests(owner)
    expect(afterReset).toMatchObject({ runtimeCount: 1, resetCount: 1, failureCount: 0 })
    expect(afterReset.runtimes[0].recentImpulses).toEqual([])
    expect(afterReset.runtimes[0].normalizedControls).toEqual(beforeReset.runtimes[0].normalizedControls)
    expect(afterReset.runtimes[0].structuralSignature).toBe(beforeReset.runtimes[0].structuralSignature)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('isolates live, preview, thumbnail, and separate canvas runtimes', () => {
    const live = createMockContext()
    const preview = createMockContext()
    const thumbnail = createMockContext()
    const resolved = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: live, frame: frame(), performance: resolved, quality: 'auto', mode: 'live' })
    prepareLivingRibbonCanvasFrame({ ownerContext: preview, frame: frame(), performance: resolved, quality: 'auto', mode: 'preview' })
    prepareLivingRibbonCanvasFrame({ ownerContext: thumbnail, frame: frame(), performance: resolved, quality: 'auto', mode: 'thumbnail' })

    expect(getLivingRibbonCanvasDiagnosticsForTests(live).runtimes[0].identity).toContain('|live')
    expect(getLivingRibbonCanvasDiagnosticsForTests(preview).runtimes[0].identity).toContain('|preview')
    expect(getLivingRibbonCanvasDiagnosticsForTests(thumbnail).runtimes[0].identity).toContain('|thumbnail')
    expect(getLivingRibbonCanvasDiagnosticsForTests(live).runtimes[0].pointCount).toBe(96)
    expect(getLivingRibbonCanvasDiagnosticsForTests(thumbnail).runtimes[0].pointCount).toBe(48)

    disposeLivingRibbonCanvasRuntimes(preview)
    expect(getLivingRibbonCanvasDiagnosticsForTests(live).runtimeCount).toBe(1)
    expect(getLivingRibbonCanvasDiagnosticsForTests(thumbnail).runtimeCount).toBe(1)
    disposeLivingRibbonCanvasRuntimes(live)
    disposeLivingRibbonCanvasRuntimes(thumbnail)
  })

  it('replaces renderer-owned state on show and source changes and disposes it fully', () => {
    const owner = createMockContext()
    const initial = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: initial, quality: 'medium', mode: 'live' })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner)).toMatchObject({ runtimeCount: 1, failureCount: 0 })

    const showChanged = performance({
      showId: 'harmonicRibbonReactor',
      showName: 'Harmonic Ribbon Reactor',
    })
    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame(),
      performance: showChanged,
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].identity).toContain('harmonicRibbonReactor')

    const sourceChanged = performance({
      showId: 'harmonicRibbonReactor',
      showName: 'Harmonic Ribbon Reactor',
      layers: [livingLayer({
        source: { kind: 'generated', identity: 'generated:livingRibbon:replacement', generator: 'livingRibbon' },
      })],
    })
    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame(),
      performance: sourceChanged,
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].identity).toContain('generated:livingRibbon:replacement')

    disposeLivingRibbonCanvasRuntimes(owner)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner)).toMatchObject({ runtimeCount: 0, failureCount: 0 })
  })

  it('cleans up for generator changes and resets on seek, loop wrap, track replacement, and timing discontinuities', () => {
    const owner = createMockContext()
    const base = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: base, quality: 'medium', mode: 'live' })

    const forwardSeek = prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audioTime: 4 }),
      performance: performance({}, { seekDetected: true, seekIdentity: 'seek-forward' }),
      quality: 'medium',
      mode: 'live',
    })
    expect(forwardSeek.clearTrail).toBe(true)

    const backwardSeek = prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audioTime: 0.5 }),
      performance: performance({}, { seekDetected: true, seekIdentity: 'seek-backward' }),
      quality: 'medium',
      mode: 'live',
    })
    expect(backwardSeek.clearTrail).toBe(true)

    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audioTime: 0.1 }),
      performance: performance({}, { loopWrapDetected: true, loopIdentity: 'loop-1' }),
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)

    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ trackKey: 'track-b' }),
      performance: performance({}, {
        trackIdentity: 'track-b',
        trackReplacementDetected: true,
        trackChangeIdentity: 'track-change-1',
      }),
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)

    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ timingDiscontinuity: true }),
      performance: performance({}, { timingDiscontinuityIdentity: 'timing-1' }),
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)

    const changedGenerator = performance({
      layers: [livingLayer({
        generator: 'harmonicRibbon',
        source: { kind: 'generated', identity: 'generated:harmonicRibbon', generator: 'harmonicRibbon' },
      })],
    })
    expect(prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame(),
      performance: changedGenerator,
      quality: 'medium',
      mode: 'live',
    }).clearTrail).toBe(true)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimeCount).toBe(0)
  })

  it('reconstructs an identical renderer state when seeking to the same target after divergent history', () => {
    const owner = createMockContext()
    const target = createMockContext()
    const resolved = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: resolved, quality: 'medium', mode: 'live' })
    renderLivingRibbonCanvasLayer({ ownerContext: owner, targetContext: target, frame: frame(), preset: PRESET, performance: resolved, layer: resolved.layers[0], intensity: 1, glow: 1 })

    prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audioTime: 24 }),
      performance: performance({}, { seekDetected: true, seekIdentity: 'target-first' }),
      quality: 'medium',
      mode: 'live',
    })
    const firstTarget = getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0]

    for (let index = 0; index < 30; index += 1) {
      renderLivingRibbonCanvasLayer({
        ownerContext: owner,
        targetContext: target,
        frame: frame({ audioTime: 25 + index / 60 }),
        preset: PRESET,
        performance: performance({ layers: [livingLayer({
          livingRibbonImpulses: [{ kind: 'releaseBurst', identity: `future-${index}`, strength: 0.7 }],
        })] }),
        layer: livingLayer({ livingRibbonImpulses: [{ kind: 'releaseBurst', identity: `future-${index}`, strength: 0.7 }] }),
        intensity: 1,
        glow: 1,
      })
    }
    prepareLivingRibbonCanvasFrame({
      ownerContext: owner,
      frame: frame({ audioTime: 24 }),
      performance: performance({}, { seekDetected: true, seekIdentity: 'target-second' }),
      quality: 'medium',
      mode: 'live',
    })
    const secondTarget = getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0]
    expect(secondTarget.stateFingerprint).toBe(firstTarget.stateFingerprint)
    expect(secondTarget.rememberedImpulseCount).toBe(0)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('repairs non-finite simulation values without discarding the renderer runtime', () => {
    const owner = createMockContext()
    const target = createMockContext()
    let captured: LivingRibbonSimulation | null = null
    setLivingRibbonSimulationFactoryForTests(() => {
      captured = new LivingRibbonSimulation()
      return captured
    })
    const resolved = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: resolved, quality: 'medium', mode: 'live' })
    const internals = captured as unknown as { positions: Float32Array; velocities: Float32Array }
    internals.positions[0] = Number.NaN
    internals.velocities[1] = Number.POSITIVE_INFINITY
    const rendered = renderLivingRibbonCanvasLayer({
      ownerContext: owner,
      targetContext: target,
      frame: frame(),
      preset: PRESET,
      performance: resolved,
      layer: resolved.layers[0],
      intensity: 1,
      glow: 1,
    })
    expect(rendered.rendered).toBe(true)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner)).toMatchObject({ runtimeCount: 1, failureCount: 0 })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).finiteRecoveryCount).toBeGreaterThan(0)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('holds pause state and resumes without a giant physics step', () => {
    const owner = createMockContext()
    const target = createMockContext()
    const resolved = performance()
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: resolved, quality: 'medium', mode: 'live' })
    renderLivingRibbonCanvasLayer({ ownerContext: owner, targetContext: target, frame: frame(), preset: PRESET, performance: resolved, layer: resolved.layers[0], intensity: 1, glow: 1 })
    const beforePause = getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].simulationTimeSec

    const pausedFrame = frame({ isPlaying: false, isPaused: true, deltaTimeSec: 30 })
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: pausedFrame, performance: resolved, quality: 'medium', mode: 'live' })
    renderLivingRibbonCanvasLayer({ ownerContext: owner, targetContext: target, frame: pausedFrame, preset: PRESET, performance: resolved, layer: resolved.layers[0], intensity: 1, glow: 1 })
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].simulationTimeSec).toBe(beforePause)

    const resumedFrame = frame({ audioTime: 31, deltaTimeSec: 30, timingDiscontinuity: true })
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: resumedFrame, performance: performance({}, { timingDiscontinuityIdentity: 'resume' }), quality: 'medium', mode: 'live' })
    renderLivingRibbonCanvasLayer({ ownerContext: owner, targetContext: target, frame: resumedFrame, preset: PRESET, performance: resolved, layer: resolved.layers[0], intensity: 1, glow: 1 })
    const afterResume = getLivingRibbonCanvasDiagnosticsForTests(owner).runtimes[0].simulationTimeSec
    expect(afterResume).toBeGreaterThanOrEqual(31)
    expect(afterResume).toBeLessThan(31.2)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('reports runtime creation failures so the caller can render its safe fallback', () => {
    const owner = createMockContext()
    const target = createMockContext()
    const factory = vi.fn(() => { throw new Error('factory exploded') })
    setLivingRibbonSimulationFactoryForTests(factory)
    const resolved = performance()
    const prepared = prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: resolved, quality: 'medium', mode: 'live' })
    expect(prepared.diagnostics[0]).toContain('factory exploded')
    const result = renderLivingRibbonCanvasLayer({
      ownerContext: owner,
      targetContext: target,
      frame: frame(),
      preset: PRESET,
      performance: resolved,
      layer: resolved.layers[0],
      intensity: 1,
      glow: 1,
    })
    expect(result.rendered).toBe(false)
    expect(result.fallbackReason).toContain('factory exploded')
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner)).toMatchObject({ runtimeCount: 0, failureCount: 1 })
    prepareLivingRibbonCanvasFrame({ ownerContext: owner, frame: frame(), performance: resolved, quality: 'medium', mode: 'live' })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(getLivingRibbonCanvasDiagnosticsForTests(owner).failureCount).toBeLessThanOrEqual(LIVING_RIBBON_MAX_FAILURE_RECORDS)
    disposeLivingRibbonCanvasRuntimes(owner)
  })

  it('keeps thumbnail work isolated, bounded, deterministic, and disposable', () => {
    const fingerprints: string[] = []
    for (let index = 0; index < 20; index += 1) {
      const thumbnail = createMockContext()
      prepareLivingRibbonCanvasFrame({
        ownerContext: thumbnail,
        frame: frame({ audioTime: 12 }),
        performance: performance(),
        quality: 'high',
        mode: 'thumbnail',
      })
      const diagnostics = getLivingRibbonCanvasDiagnosticsForTests(thumbnail)
      expect(diagnostics.runtimes[0]).toMatchObject({ pointCapacity: 64, sparkCapacity: 3 })
      expect(diagnostics.runtimes[0].recentImpulses.length).toBeLessThanOrEqual(LIVING_RIBBON_MAX_RECENT_IMPULSES)
      fingerprints.push(diagnostics.runtimes[0].stateFingerprint)
      disposeLivingRibbonCanvasRuntimes(thumbnail)
      expect(getLivingRibbonCanvasDiagnosticsForTests(thumbnail).runtimeCount).toBe(0)
    }
    expect(new Set(fingerprints).size).toBe(1)
  })
})
