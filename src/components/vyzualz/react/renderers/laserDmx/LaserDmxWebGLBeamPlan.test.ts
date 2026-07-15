import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { createLaserDmxSceneFrame, resolveLaserDmxSceneFrameOutput } from './LaserDmxSceneFrame'
import {
  buildLaserDmxWebGLBeamRenderPlan,
  selectLaserDmxBeamsForQuality,
} from './LaserDmxWebGLBeamPlan'

function createResolvedFanFrame() {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'fan-source', 0)
  fixture.x = 7.125
  fixture.y = 2.375
  fixture.brightness = 1
  fixture.beam.targetMode = 'fan'
  fixture.beam.beamSpread = 72
  fixture.beam.focus = 0.96
  fixture.runtimeBeamAppearance = { width: 0.9, divergence: 0.18, glow: 0.8 }
  showDirector.fixtures = [fixture]
  showDirector.settings.webglQuality = 'high'
  const base = createDefaultLaserDmxBeamMatrixSettings()
  const scene = createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: base,
    audioTimeSec: 8,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'fan-track',
    bpm: 150,
    devicePixelRatio: 2,
  })
  const matrix = compileLaserDmxShowDirectorToBeamMatrix({ showDirector, beamMatrix: base })
  return resolveLaserDmxSceneFrameOutput(scene, matrix)
}

describe('LaserDMX WebGL beam render plan', () => {
  it('groups all fan rays into one shared projector aperture with accumulated energy', () => {
    const frame = createResolvedFanFrame()
    expect(frame.beams).toHaveLength(8)
    expect(new Set(frame.beams.map(beam => beam.sourceId))).toEqual(new Set(['fan-source-emitter']))
    expect(frame.emitters).toHaveLength(1)
    expect(frame.emitters[0]).toMatchObject({ activeRayCount: 8 })
    expect(frame.emitters[0]?.totalActiveEnergy).toBeGreaterThan(6.5)

    const plan = buildLaserDmxWebGLBeamRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(plan.apertures).toHaveLength(1)
    expect(plan.apertures[0]?.id).toBe('fan-source-emitter')
    expect(plan.apertures[0]?.haloRadiusCssPx).toBeGreaterThan(plan.apertures[0]?.ringRadiusCssPx ?? 0)
    expect(plan.beams.every(beam => beam.whiteHotMix > 0)).toBe(true)
  })

  it('keeps deterministic ordering independent of incoming array order', () => {
    const frame = createResolvedFanFrame()
    const viewport = { backingWidth: 1280, backingHeight: 720, cssWidth: 1280, cssHeight: 720 }
    const first = buildLaserDmxWebGLBeamRenderPlan(frame, viewport)
    const second = buildLaserDmxWebGLBeamRenderPlan({ ...frame, beams: [...frame.beams].reverse() }, viewport)
    expect(second.beams.map(beam => beam.id)).toEqual(first.beams.map(beam => beam.id))
  })

  it('preserves hero beams and source identity before thinning support rays', () => {
    const frame = createResolvedFanFrame()
    const source = frame.beams[0]!
    const beams = Array.from({ length: 12 }, (_, index) => ({
      ...source,
      id: `beam-${index}`,
      sourceId: `source-${index % 4}`,
      visualRole: index === 11 ? 'hero' as const : 'texture' as const,
      priority: index === 11 ? 0 : 4,
      pattern: { ...source.pattern, rayIndex: index, rayCount: 12 },
    }))
    const selected = selectLaserDmxBeamsForQuality(beams, 'low', 5)
    expect(selected).toHaveLength(5)
    expect(selected.some(beam => beam.id === 'beam-11')).toBe(true)
    expect(new Set(selected.map(beam => beam.sourceId)).size).toBe(4)
    expect(selectLaserDmxBeamsForQuality([...beams].reverse(), 'low', 5).map(beam => beam.id))
      .toEqual(selected.map(beam => beam.id))
  })

  it('keeps CSS-space beam widths stable across DPR and render-scale backing sizes', () => {
    const frame = createResolvedFanFrame()
    const oneX = buildLaserDmxWebGLBeamRenderPlan(frame, {
      backingWidth: 960,
      backingHeight: 540,
      cssWidth: 960,
      cssHeight: 540,
    })
    const twoX = buildLaserDmxWebGLBeamRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(twoX.beams[0]?.bodyStartWidthCssPx).toBeCloseTo(oneX.beams[0]?.bodyStartWidthCssPx ?? 0, 8)
    expect(twoX.beams[0]?.envelopeEndWidthCssPx).toBeCloseTo(oneX.beams[0]?.envelopeEndWidthCssPx ?? 0, 8)
  })
})
