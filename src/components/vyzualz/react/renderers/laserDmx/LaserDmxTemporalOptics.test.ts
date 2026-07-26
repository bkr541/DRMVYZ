import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorPresentationMode,
  type LaserDmxShowDirectorWebGLQuality,
} from '../../ReactTypes'
import { createLaserDmxSceneFrame, type LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  LaserDmxTemporalOpticsController,
  resolveLaserDmxAtmosphereFlutter,
  resolveLaserDmxBeamInstability,
  resolveLaserDmxInstabilityGroupKey,
  resolveLaserDmxTemporalQualityPolicy,
  resolveLaserDmxTemporalTargetSize,
} from './LaserDmxTemporalOptics'

function createFrame(input: {
  timeSec?: number
  historyIdentity?: string
  occurrenceSeed?: number
  quality?: LaserDmxShowDirectorWebGLQuality
  timingDiscontinuity?: boolean
  blackout?: boolean
  strobeRate?: number
  strobeVisible?: boolean
  presentationMode?: LaserDmxShowDirectorPresentationMode
} = {}): LaserDmxSceneFrame {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'temporal-laser-left', 0)
  fixture.semanticKey = 'scanner-bank-left'
  fixture.beam.targetMode = 'fixed'
  fixture.beam.targetX = 11
  fixture.beam.targetY = 7
  fixture.component.strobeRate = input.strobeRate ?? 0
  showDirector.fixtures = [fixture]
  showDirector.settings.webglQuality = input.quality ?? 'high'
  showDirector.settings.presentationMode = input.presentationMode ?? 'live'
  const matrix = createDefaultLaserDmxBeamMatrixSettings()
  matrix.output.beamPersistence = 0.82
  matrix.output.blackout = input.blackout ?? false
  const frame = createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: matrix,
    audioTimeSec: input.timeSec ?? 12,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: input.timingDiscontinuity ?? false,
    trackKey: 'temporal-track',
    historyIdentity: input.historyIdentity ?? 'temporal-track:preset-a:show-a',
    occurrenceSeed: input.occurrenceSeed ?? 42,
    bpm: 142,
    beatIndex: 32,
    beatPhase: 0.08,
    beatHit: true,
    downbeat: true,
    barIndex: 8,
    phraseIndex: 1,
    section: 'drop',
    sectionProgress: 0.35,
    energy: 0.88,
    kickHit: true,
    kickStrength: 0.9,
    snareHit: false,
    snareStrength: 0.1,
    hatHit: false,
    hatStrength: 0.2,
    transient: 0.8,
    fourBarBlockIndex: 2,
    eightBarBlockIndex: 1,
    sixteenBarBlockIndex: 0,
  })
  if (input.strobeVisible) {
    frame.transientEvents.push({ id: 'visible-strobe', kind: 'strobe', strength: 1 })
  }
  return frame
}

function moveFirstBeam(frame: LaserDmxSceneFrame, targetOffset: number): LaserDmxSceneFrame {
  const moved = structuredClone(frame)
  moved.transport.audioTimeSec += moved.transport.deltaTimeSec
  const beam = moved.beams[0]
  if (!beam) throw new Error('Expected a temporal test beam')
  beam.target.x += targetOffset
  const dx = beam.target.x - beam.origin.x
  const dy = beam.target.y - beam.origin.y
  const dz = beam.target.z - beam.origin.z
  const length = Math.max(1e-6, Math.hypot(dx, dy, dz))
  beam.direction = { x: dx / length, y: dy / length, z: dz / length }
  return moved
}

function moveScannerPath(frame: LaserDmxSceneFrame, targetOffset: number): LaserDmxSceneFrame {
  const moved = structuredClone(frame)
  moved.transport.audioTimeSec += moved.transport.deltaTimeSec
  const path = moved.scanPaths[0]
  if (!path) throw new Error('Expected a temporal scanner path')
  path.patternAnimationActive = true
  path.movementProgress = Math.min(1, (path.movementProgress ?? 0) + 0.1)
  for (const point of path.points) point.position.x += targetOffset
  return moved
}

describe('LaserDMX deterministic temporal optics', () => {
  it('resolves identical instability and haze flutter for the same transport position and occurrence', () => {
    const frame = createFrame()
    const beam = frame.beams[0]!
    const first = resolveLaserDmxBeamInstability(frame, beam, 'scanner-bank-left')
    const second = resolveLaserDmxBeamInstability(structuredClone(frame), structuredClone(beam), 'scanner-bank-left')
    const firstHaze = resolveLaserDmxAtmosphereFlutter(frame)
    const secondHaze = resolveLaserDmxAtmosphereFlutter(structuredClone(frame))

    expect(second).toEqual(first)
    expect(secondHaze).toEqual(firstHaze)

    const differentOccurrence = createFrame({ occurrenceSeed: 43 })
    expect(resolveLaserDmxBeamInstability(
      differentOccurrence,
      differentOccurrence.beams[0]!,
      'scanner-bank-left',
    )).not.toEqual(first)
  })

  it('keeps mirrored semantic groups related while preserving opposite angular signs', () => {
    expect(resolveLaserDmxInstabilityGroupKey('scanner-bank-left', 'left-id')).toEqual({
      key: 'scanner-bank-side',
      mirrorSign: -1,
    })
    expect(resolveLaserDmxInstabilityGroupKey('scanner-bank-right', 'right-id')).toEqual({
      key: 'scanner-bank-side',
      mirrorSign: 1,
    })
  })

  it('keeps stable scanned frames lightly integrated and shortens persistence as cue motion accelerates', () => {
    const controller = new LaserDmxTemporalOpticsController()
    const base = createFrame()
    expect(controller.update(base).history.clearReason).toBe('initialMount')

    const stationary = structuredClone(base)
    stationary.transport.audioTimeSec += stationary.transport.deltaTimeSec
    const stationaryPlan = controller.update(stationary)
    expect(stationaryPlan.motion.score).toBe(0)
    expect(stationaryPlan.history.enabled).toBe(true)
    expect(stationaryPlan.history.retention).toBeGreaterThan(0)

    const slow = moveScannerPath(stationary, 0.0005)
    const slowPlan = controller.update(slow)
    expect(slowPlan.motion.score).toBeGreaterThan(0)
    expect(slowPlan.history.retention).toBeGreaterThan(0)

    const fast = moveScannerPath(slow, 0.08)
    const fastPlan = controller.update(fast)
    expect(fastPlan.motion.score).toBeGreaterThan(slowPlan.motion.score)
    expect(fastPlan.history.retention).toBeLessThan(slowPlan.history.retention)
    expect(fastPlan.history.retention).toBeLessThanOrEqual(
      resolveLaserDmxTemporalQualityPolicy('high').maximumRetention,
    )
  })

  it('clears history on seek, loop wrap, preset/show identity changes, and capture entry', () => {
    const controller = new LaserDmxTemporalOpticsController()
    controller.update(createFrame())

    expect(controller.update(createFrame({ timeSec: 3, timingDiscontinuity: true })).history.clearReason)
      .toBe('timingDiscontinuity')

    controller.reset()
    controller.update(createFrame())
    expect(controller.update(createFrame({ historyIdentity: 'temporal-track:preset-b:show-b' })).history.clearReason)
      .toBe('identityChange')

    controller.reset()
    controller.update(createFrame({ presentationMode: 'live' }))
    expect(controller.update(createFrame({ presentationMode: 'capture' })).history.clearReason)
      .toBe('captureEntry')
  })

  it('does not clear for finite geometry motion but clears when scanner topology changes', () => {
    const controller = new LaserDmxTemporalOpticsController()
    const frame = createFrame()
    controller.update(frame)
    const animated = moveScannerPath(frame, 0.04)
    expect(controller.update(animated).history.clearReason).toBeNull()

    const topologyChanged = structuredClone(animated)
    topologyChanged.transport.audioTimeSec += topologyChanged.transport.deltaTimeSec
    const path = topologyChanged.scanPaths[0]
    if (!path) throw new Error('Expected a scanner path for topology reset testing')
    path.topologyRevision = (path.topologyRevision ?? 0) + 1
    expect(controller.update(topologyChanged).history.clearReason).toBe('scannerTopologyChange')
  })

  it('clears on blackout and dark strobe phases while segmenting visible strobe history', () => {
    const blackoutController = new LaserDmxTemporalOpticsController()
    blackoutController.update(createFrame())
    expect(blackoutController.update(createFrame({ blackout: true })).history.clearReason).toBe('blackout')

    const darkController = new LaserDmxTemporalOpticsController()
    darkController.update(createFrame({ strobeRate: 0.8, strobeVisible: true }))
    expect(darkController.update(createFrame({ timeSec: 12.01, strobeRate: 0.8 })).history.clearReason)
      .toBe('strobeDarkPhase')

    const visibleController = new LaserDmxTemporalOpticsController()
    const firstVisible = createFrame({ strobeRate: 0.8, strobeVisible: true })
    visibleController.update(firstVisible)
    const movingVisible = moveFirstBeam(firstVisible, 0.2)
    movingVisible.transientEvents.push({ id: 'visible-strobe-next', kind: 'strobe', strength: 1 })
    const visiblePlan = visibleController.update(movingVisible)
    expect(visiblePlan.history.clearReason).toBeNull()
    expect(visiblePlan.history.strobeSegmented).toBe(true)
  })

  it('scales history resolution and resets when temporal quality changes', () => {
    expect(resolveLaserDmxTemporalTargetSize(1920, 1080, 'low')).toEqual({ width: 883, height: 497 })
    expect(resolveLaserDmxTemporalTargetSize(1920, 1080, 'ultra')).toEqual({ width: 1920, height: 1080 })
    expect(resolveLaserDmxTemporalQualityPolicy('low').instabilityLayers)
      .toBeLessThan(resolveLaserDmxTemporalQualityPolicy('high').instabilityLayers)

    const controller = new LaserDmxTemporalOpticsController()
    controller.update(createFrame({ quality: 'high' }))
    expect(controller.update(createFrame({ quality: 'medium' })).history.clearReason).toBe('qualityChange')
  })

  it('makes disposal terminal and prevents history leakage into a later engine identity', () => {
    const controller = new LaserDmxTemporalOpticsController()
    const base = createFrame()
    controller.update(base)
    controller.update(moveFirstBeam(base, 0.2))
    const switched = controller.update(createFrame({ historyIdentity: 'different-engine-lifecycle' }))
    expect(switched.history.clearReason).toBe('identityChange')
    expect(switched.history.enabled).toBe(false)
    expect(switched.motion.score).toBe(0)

    controller.dispose()
    const disposed = controller.update(createFrame())
    expect(controller.isDisposed).toBe(true)
    expect(disposed.history).toMatchObject({ enabled: false, clearHistory: true, clearReason: 'dispose' })
  })
})
