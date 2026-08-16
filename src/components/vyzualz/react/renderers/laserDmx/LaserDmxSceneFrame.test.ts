import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { createLaserDmxSceneFrame, resolveLaserDmxSceneFrameOutput } from './LaserDmxSceneFrame'

describe('LaserDMX engine-neutral scene frame', () => {
  it('preserves continuous fixture and target coordinates before Beam Matrix quantization', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'continuous-laser', 0)
    fixture.x = 4.25
    fixture.y = 2.75
    fixture.z = 0.35
    fixture.beam.targetMode = 'fixed'
    fixture.beam.targetX = 10.6
    fixture.beam.targetY = 7.2
    fixture.beam.targetZ = -0.4
    fixture.beam.targets = [{ id: 'continuous-target', x: 10.6, y: 7.2 }]
    showDirector.fixtures = [fixture]

    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 12.5,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'track-a',
      bpm: 150,
    })

    expect(frame.fixtures[0]?.position.x * 14).toBeCloseTo(4.25, 8)
    expect(frame.fixtures[0]?.position.y * 9).toBeCloseTo(2.75, 8)
    expect(frame.fixtures[0]?.position.z).toBeCloseTo(0.35, 8)
    expect(frame.beams[0]?.target.x * 14).toBeCloseTo(10.6, 8)
    expect(frame.beams[0]?.target.y * 9).toBeCloseTo(7.2, 8)
    expect(frame.beams[0]?.target.z).toBeCloseTo(-0.4, 8)

    const matrix = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(matrix.beams[0]?.origin.column).toBe(Math.round((4.25 / 14) * 14) + 1)
    expect(frame.fixtures[0]?.position.x * 14).not.toBe(Math.round(4.25))
  })

  it('layers evaluated cue, fog, color, and blackout authority onto unchanged scene geometry', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'resolved-laser', 0)
    fixture.x = 3.4
    fixture.y = 1.8
    fixture.beam.targetX = 11.2
    fixture.beam.targetY = 8.1
    fixture.beam.targets = [{ id: 'resolved-target', x: 11.2, y: 8.1 }]
    showDirector.fixtures = [fixture]

    const baseMatrix = createDefaultLaserDmxBeamMatrixSettings()
    const baseFrame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: baseMatrix,
      audioTimeSec: 4,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: null,
      bpm: 140,
    })
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: baseMatrix })
    compiled.output = { ...compiled.output, masterDimmer: 0.5, blackout: true }
    compiled.fog = { ...compiled.fog, enabled: true, density: 0.4, opacity: 0.3, beamScatter: 0.6 }

    const resolved = resolveLaserDmxSceneFrameOutput(baseFrame, compiled)
    expect(resolved.fixtures[0]?.position).toEqual(baseFrame.fixtures[0]?.position)
    expect(resolved.beams[0]?.target).toEqual(baseFrame.beams[0]?.target)
    expect(resolved.output.blackout).toBe(true)
    expect(resolved.fixtures[0]?.intensity).toBe(0)
    expect(resolved.beams[0]?.enabled).toBe(false)
    expect(resolved.atmosphere).toMatchObject({ enabled: true, density: 0.4, opacity: 0.3, beamScatter: 0.6 })
  })

  it('does not mutate or destabilize deterministic Show Director compilation', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const fixture = createDefaultLaserDmxShowDirectorFixture('movingHead', 'deterministic-head', 2)
    fixture.x = 6.3
    fixture.y = 2.2
    fixture.beam.targetX = 9.7
    fixture.beam.targetY = 8.4
    fixture.beam.targets = [{ id: 'deterministic-target', x: 9.7, y: 8.4 }]
    showDirector.fixtures = [fixture]
    const before = structuredClone(showDirector)
    const base = createDefaultLaserDmxBeamMatrixSettings()

    createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: base,
      audioTimeSec: 32,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'deterministic-track',
      bpm: 150,
      beatIndex: 80,
      barIndex: 20,
      phraseIndex: 2,
    })

    const first = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: base })
    const second = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: base })
    expect(showDirector).toEqual(before)
    expect(first).toEqual(second)
  })

  it('generates complete optical beam data and keeps Canvas2D compilation compatible', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'optical-laser', 0)
    fixture.x = 2.375
    fixture.y = 1.625
    fixture.brightness = 0.94
    fixture.beam.targetMode = 'fan'
    fixture.beam.beamSpread = 45
    fixture.beam.focus = 0.92
    fixture.runtimeBeamAppearance = { width: 0.8, divergence: 0.16, glow: 0.78 }
    showDirector.fixtures = [fixture]
    showDirector.settings.rendererMode = 'canvas2d'
    const base = createDefaultLaserDmxBeamMatrixSettings()

    const before = structuredClone(showDirector)
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: base,
      audioTimeSec: 1,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: null,
      bpm: 150,
    })
    const matrix = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: base })

    expect(frame.beams[0]).toMatchObject({
      sourceId: 'optical-laser-emitter',
      fixtureKind: 'laser',
      visualRole: 'primary',
      enabled: true,
    })
    expect(frame.beams[0]?.width).toBeGreaterThan(0)
    expect(frame.beams[0]?.coreIntensity).toBeGreaterThan(0)
    expect(frame.beams[0]?.scatterEnvelopeWidth).toBeGreaterThan(frame.beams[0]?.width ?? 0)
    expect(frame.beams.every(beam => beam.pattern.rayCount === frame.beams.length)).toBe(true)
    expect(matrix.beams).toHaveLength(frame.beams.length)
    expect(showDirector).toEqual(before)
  })

  it('caps scene and compatibility output at the same deterministic beam budget', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    showDirector.settings.webglQuality = 'ultra'
    showDirector.fixtures = Array.from({ length: 40 }, (_, index) => {
      const fixture = createDefaultLaserDmxShowDirectorFixture('laser', `budget-fan-${index}`, index)
      fixture.enabled = true
      fixture.brightness = 1
      fixture.beam.targetMode = 'fan'
      fixture.beam.beamSpread = 81
      fixture.optics.primitiveType = 'fan'
      fixture.optics.rayCount = 24
      return fixture
    })
    const base = createDefaultLaserDmxBeamMatrixSettings()
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: base,
      audioTimeSec: 4,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'budget-track',
      bpm: 150,
    })
    const matrix = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: base })

    expect(frame.beams).toHaveLength(300)
    expect(matrix.beams).toHaveLength(300)
    const sceneCounts = showDirector.fixtures.map(fixture => (
      frame.beams.filter(beam => beam.fixtureId === fixture.id).length
    ))
    const matrixCounts = showDirector.fixtures.map(fixture => (
      matrix.beams.filter(beam => beam.id.startsWith(`sd-${fixture.id}-`)).length
    ))
    expect(matrixCounts).toEqual(sceneCounts)
    expect(sceneCounts.reduce((sum, count) => sum + count, 0)).toBe(300)
    expect(sceneCounts.every(count => count >= 0 && count <= 20)).toBe(true)
    expect(sceneCounts.filter(count => count > 0)).toHaveLength(15)
  })

  it('emits deterministic strobe and blinder transients for the photographic post stack', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const strobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'transient-strobe', 0)
    strobe.brightness = 0.9
    strobe.component.strobeRate = 1
    const blinder = createDefaultLaserDmxShowDirectorFixture('blinder', 'transient-blinder', 1)
    blinder.brightness = 0.8
    showDirector.fixtures = [strobe, blinder]
    const evaluated = createDefaultLaserDmxBeamMatrixSettings()
    evaluated.output.globalStrobeRate = 0.25

    const visible = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: evaluated,
      audioTimeSec: 0,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'transient-track',
      bpm: 142,
    })
    const hidden = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: evaluated,
      audioTimeSec: 0.08,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'transient-track',
      bpm: 142,
    })

    expect(visible.output.globalStrobeRate).toBe(0.25)
    expect(visible.fixtures.find(fixture => fixture.kind === 'strobe')?.strobeRate).toBeCloseTo(1 / 30)
    expect(visible.transientEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'strobe', strength: 0.9 }),
      expect.objectContaining({ kind: 'blinder', strength: 0.8 }),
    ]))
    expect(hidden.transientEvents.some(event => event.kind === 'strobe')).toBe(false)
    expect(hidden.transientEvents.some(event => event.kind === 'blinder')).toBe(true)
  })


})
