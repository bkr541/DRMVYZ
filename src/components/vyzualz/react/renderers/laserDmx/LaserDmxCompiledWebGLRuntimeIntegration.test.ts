import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
} from '../../ReactTypes'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
} from '../LaserDmxBeamMatrixCompiler'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { resolveStrobeVisible } from '../LaserDmxModulationEngine'
import { buildLaserDmxDedicatedFixtureRenderPlan } from './LaserDmxDedicatedFixturePlan'
import { buildLaserDmxScannerExposurePlan } from './LaserDmxScannerWebGLPlan'
import {
  createLaserDmxSceneFrame,
  resolveLaserDmxSceneFrameOutput,
  type LaserDmxSceneFrame,
} from './LaserDmxSceneFrame'

const WIDTH = 1280
const HEIGHT = 720
const VIEWPORT = {
  backingWidth: WIDTH,
  backingHeight: HEIGHT,
  cssWidth: WIDTH,
  cssHeight: HEIGHT,
}

function musicFrame(input: {
  timeSec: number
  beatPhase?: number
  kickHit?: boolean
  kickStrength?: number
  snareHit?: boolean
  snareStrength?: number
  normalizedBass?: number
  normalizedHigh?: number
  energy?: number
}): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: input.timeSec,
    frameId: Math.max(1, Math.round(input.timeSec * 1000) + 1),
    sourceId: 'compiled-webgl-test',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedBass: input.normalizedBass ?? 0,
      normalizedHigh: input.normalizedHigh ?? 0,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatPhase: input.beatPhase ?? 0,
      kickHit: input.kickHit ?? false,
      kickStrength: input.kickStrength ?? 0,
      snareHit: input.snareHit ?? false,
      snareStrength: input.snareStrength ?? 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: input.energy ?? 0,
      shortTerm: input.energy ?? 0,
      longTerm: input.energy ?? 0,
      percentile: input.energy ?? 0,
    },
  }
}

function resolveWebGLScene(
  showDirector: ReturnType<typeof createDefaultLaserDmxShowDirectorState>,
  mi: MusicIntelligenceFrame,
): { unresolved: LaserDmxSceneFrame; resolved: LaserDmxSceneFrame } {
  const base = createDefaultLaserDmxBeamMatrixSettings()
  const matrix = compileLaserDmxShowDirectorToBeamMatrix({
    showDirector,
    beamMatrix: base,
  })
  const unresolved = createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: base,
    audioTimeSec: mi.timeSec,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'compiled-webgl-test',
    bpm: 120,
    beatIndex: mi.rhythm.beatIndex,
    beatPhase: mi.rhythm.beatPhase,
    beatHit: mi.rhythm.beatHit,
    downbeat: mi.rhythm.downbeatHit,
    barIndex: mi.rhythm.barIndex,
    kickHit: mi.rhythm.kickHit,
    kickStrength: mi.rhythm.kickStrength,
    snareHit: mi.rhythm.snareHit,
    snareStrength: mi.rhythm.snareStrength,
    energy: mi.energy.instant,
  })
  const compiled = compileLaserDmxBeamMatrix({
    settings: matrix,
    mi,
    timeSec: mi.timeSec,
    canvasWidth: WIDTH,
    canvasHeight: HEIGHT,
  })
  return {
    unresolved,
    resolved: resolveLaserDmxSceneFrameOutput(unresolved, matrix, {
      compiled,
      canvasWidth: WIDTH,
      canvasHeight: HEIGHT,
    }),
  }
}

describe('LaserDMX compiled Beam Matrix → WebGL scene integration', () => {
  beforeEach(() => {
    resetBeamMatrixCompilerState()
  })

  it('uses compiled trigger gates for dedicated WebGL strobe output', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const strobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'webgl-trigger-strobe', 0)
    strobe.brightness = 1
    strobe.component.strobeRate = 15
    strobe.trigger = {
      ...strobe.trigger,
      mode: 'snareTransient',
      quantize: 'none',
      retrigger: 'allow',
      audioBand: 'highMid',
      audioThreshold: 0.58,
      fadeInMs: 0,
      fadeOutMs: 120,
    }
    showDirector.fixtures = [strobe]

    const idle = resolveWebGLScene(showDirector, musicFrame({ timeSec: 0 }))
    expect(idle.resolved.fixtures[0]).toMatchObject({ enabled: false, intensity: 0 })
    expect(buildLaserDmxDedicatedFixtureRenderPlan(idle.resolved, VIEWPORT).flashes).toHaveLength(0)

    const hit = resolveWebGLScene(showDirector, musicFrame({
      timeSec: 0.001,
      snareHit: true,
      snareStrength: 1,
    }))
    const resolvedStrobe = hit.resolved.fixtures[0]
    expect(resolvedStrobe?.enabled).toBe(true)
    expect(resolvedStrobe?.intensity).toBeGreaterThan(0)
    expect(resolvedStrobe?.strobeRate).toBeCloseTo(0.5, 8)
    expect(buildLaserDmxDedicatedFixtureRenderPlan(hit.resolved, VIEWPORT).flashes.some(
      flash => flash.kind === 'strobe',
    )).toBe(true)
  })

  it('honors Beam Enabled for LED Bar and Strobe in the dedicated WebGL plan', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const led = createDefaultLaserDmxShowDirectorFixture('ledBar', 'disabled-led', 0)
    const strobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'disabled-strobe', 1)
    led.brightness = 1
    strobe.brightness = 1
    strobe.component.strobeRate = 15
    led.beam.beamEnabled = false
    strobe.beam.beamEnabled = false
    showDirector.fixtures = [led, strobe]

    const { resolved } = resolveWebGLScene(showDirector, musicFrame({ timeSec: 0 }))
    expect(resolved.fixtures.map(fixture => [fixture.id, fixture.enabled, fixture.intensity])).toEqual([
      ['disabled-led', false, 0],
      ['disabled-strobe', false, 0],
    ])

    const plan = buildLaserDmxDedicatedFixtureRenderPlan(resolved, VIEWPORT)
    expect(plan.leds).toHaveLength(0)
    expect(plan.flashes).toHaveLength(0)
  })

  it('carries compiled Moving Head target modulation into the WebGL cone plan', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const head = createDefaultLaserDmxShowDirectorFixture('movingHead', 'sweeping-head', 0)
    head.brightness = 1
    head.trigger = { ...head.trigger, mode: 'alwaysOn', quantize: 'none' }
    head.component.movingHeadPanTiltStyle = 'smoothSweep'
    head.beam.targetMode = 'fixed'
    head.beam.targetX = 10
    head.beam.targetY = 7
    head.beam.targets = [{ id: 'sweeping-head-target', x: 10, y: 7 }]
    head.optics.prismFacets = 1
    showDirector.fixtures = [head]

    const { unresolved, resolved } = resolveWebGLScene(
      showDirector,
      musicFrame({ timeSec: 1, beatPhase: 0.5 }),
    )
    expect(resolved.beams[0]?.target.x).not.toBeCloseTo(unresolved.beams[0]?.target.x ?? 0, 6)

    const unresolvedPlan = buildLaserDmxDedicatedFixtureRenderPlan(unresolved, VIEWPORT)
    const resolvedPlan = buildLaserDmxDedicatedFixtureRenderPlan(resolved, VIEWPORT)
    expect(resolvedPlan.movingHeads).toHaveLength(1)
    expect(resolvedPlan.movingHeads[0]?.target.x).not.toBeCloseTo(
      unresolvedPlan.movingHeads[0]?.target.x ?? 0,
      6,
    )
  })

  it('carries compiled Laser target modulation into physical scanner exposure samples', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const laser = createDefaultLaserDmxShowDirectorFixture('laser', 'sweeping-laser', 0)
    laser.brightness = 1
    laser.trigger = { ...laser.trigger, mode: 'alwaysOn', quantize: 'none' }
    laser.beam.targetMode = 'sweep'
    showDirector.fixtures = [laser]

    const { unresolved, resolved } = resolveWebGLScene(
      showDirector,
      musicFrame({ timeSec: 1, beatPhase: 0.5 }),
    )
    const unresolvedSample = unresolved.exposureSamples.find(sample => sample.fixtureId === laser.id)
    const resolvedSample = resolved.exposureSamples.find(sample => sample.fixtureId === laser.id)
    expect(unresolvedSample).toBeDefined()
    expect(resolvedSample).toBeDefined()
    expect(resolvedSample?.targetOrDirection.x).not.toBeCloseTo(
      unresolvedSample?.targetOrDirection.x ?? 0,
      6,
    )

    const scannerPlan = buildLaserDmxScannerExposurePlan(resolved)
    expect(scannerPlan.validation.authoritativeFixtureIds).toContain(laser.id)
    expect(scannerPlan.segments.length).toBeGreaterThan(0)
  })

  it('maps normalized strobe values linearly to the authored 0-30 Hz contract', () => {
    expect(resolveStrobeVisible(0, 100)).toBe(true)

    // 1 Hz = 1/30. First half of the one-second cycle is visible.
    expect(resolveStrobeVisible(1 / 30, 0.49)).toBe(true)
    expect(resolveStrobeVisible(1 / 30, 0.51)).toBe(false)

    // 15 Hz = 0.5. Half-cycle boundary is 1/30 second.
    expect(resolveStrobeVisible(0.5, 0.0328)).toBe(true)
    expect(resolveStrobeVisible(0.5, 0.0335)).toBe(false)

    // 30 Hz = 1. Half-cycle boundary is 1/60 second.
    expect(resolveStrobeVisible(1, 0.0165)).toBe(true)
    expect(resolveStrobeVisible(1, 0.0168)).toBe(false)
  })
})
