import { describe, expect, it } from 'vitest'
import {
  CINEMA2_MAINFRAME_DRIFT_BEATS_PER_CYCLE, CINEMA2_MAINFRAME_DRIFT_HZ, CINEMA2_MAINFRAME_MAX_DRIFT_PITCH_DEGREES, CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES,
  CINEMA2_MAINFRAME_MAX_PUSH, isIdentityCinema2MainframeView, resolveCinema2MainframeView,
} from '../modules/mainframe/Cinema2MainframeView'
import { resolveCinema2MainframeStaticFrame, CINEMA2_MAINFRAME_GLOW_GAIN_MAX, CINEMA2_MAINFRAME_GLOW_GAIN_MIN } from '../modules/Cinema2MainframeNativeModule'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'

const input = (over: Partial<Parameters<typeof resolveCinema2MainframeView>[0]> = {}) => ({ zoom: 0, drift: 0, timeSec: 5, bpm: 120, bpmSync: false, ...over })
const deg = (radians: number) => radians * 180 / Math.PI

describe('Mainframe view motion', () => {
  it('is exactly no motion at zoom 0 and drift 0, whatever the time or tempo, so the authored framing is untouched', () => {
    for (const timeSec of [0, 3.3, 1000]) expect(isIdentityCinema2MainframeView(resolveCinema2MainframeView(input({ timeSec })))).toBe(true)
    expect(isIdentityCinema2MainframeView(resolveCinema2MainframeView(input({ zoom: 0.01 })))).toBe(false)
  })

  it('pushes toward the lens in proportion to Camera Zoom, up to the bound, and never sways on zoom alone', () => {
    expect(resolveCinema2MainframeView(input({ zoom: 0.5 })).offset[2]).toBeCloseTo(CINEMA2_MAINFRAME_MAX_PUSH / 2)
    const full = resolveCinema2MainframeView(input({ zoom: 1 }))
    expect(full.offset[0]).toBeCloseTo(0, 12)
    expect(full.offset[1]).toBeCloseTo(0, 12)
    expect(full.offset[2]).toBe(CINEMA2_MAINFRAME_MAX_PUSH)
    for (const angle of full.rotationRadians) expect(angle).toBeCloseTo(0, 12)
    expect(resolveCinema2MainframeView(input({ zoom: 7 })).offset[2]).toBe(CINEMA2_MAINFRAME_MAX_PUSH)
    expect(resolveCinema2MainframeView(input({ zoom: -3, drift: 0 }))).toEqual(resolveCinema2MainframeView(input()))
  })

  it('sways within a few degrees at full Camera Drift over a whole cycle, and not at all at half the amount beyond half the bound', () => {
    let maxYaw = 0, maxPitch = 0, halfYaw = 0
    for (let timeSec = 0; timeSec < 60; timeSec += 0.1) {
      const full = resolveCinema2MainframeView(input({ drift: 1, timeSec }))
      const half = resolveCinema2MainframeView(input({ drift: 0.5, timeSec }))
      maxYaw = Math.max(maxYaw, Math.abs(deg(full.rotationRadians[1])))
      maxPitch = Math.max(maxPitch, Math.abs(deg(full.rotationRadians[0])))
      halfYaw = Math.max(halfYaw, Math.abs(deg(half.rotationRadians[1])))
      expect(full.offset[2]).toBe(0)
    }
    expect(maxYaw).toBeLessThanOrEqual(CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES + 1e-9)
    expect(maxYaw).toBeGreaterThan(CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES * 0.9)
    expect(maxPitch).toBeLessThanOrEqual(CINEMA2_MAINFRAME_MAX_DRIFT_PITCH_DEGREES + 1e-9)
    expect(halfYaw).toBeLessThanOrEqual(CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES / 2 + 1e-9)
  })

  it('is deterministic: the same time gives the same pose, and a paused (frozen) time holds it', () => {
    expect(resolveCinema2MainframeView(input({ drift: 0.7, timeSec: 12.34 }))).toEqual(resolveCinema2MainframeView(input({ drift: 0.7, timeSec: 12.34 })))
  })

  it('free-runs at its own rate without BPM Sync, and locks one sway cycle to sixteen beats of the track with it', () => {
    const free = (t: number) => resolveCinema2MainframeView(input({ drift: 1, timeSec: t, bpmSync: false }))
    const period = 1 / CINEMA2_MAINFRAME_DRIFT_HZ
    expect(free(period * 0.25).rotationRadians[1]).toBeCloseTo(free(period * 1.25).rotationRadians[1], 9)
    const synced = (t: number, bpm: number) => resolveCinema2MainframeView(input({ drift: 1, timeSec: t, bpm, bpmSync: true }))
    const cycleSec = CINEMA2_MAINFRAME_DRIFT_BEATS_PER_CYCLE * 60 / 120
    expect(synced(cycleSec * 0.25, 120).rotationRadians[1]).toBeCloseTo(synced(cycleSec * 1.25, 120).rotationRadians[1], 9)
    // The same musical position gives the same sway at a different tempo.
    expect(synced(cycleSec * 0.25, 120).rotationRadians[1]).toBeCloseTo(synced(cycleSec * 0.25 * 120 / 90, 90).rotationRadians[1], 9)
    // With no usable tempo it falls back to the free-running rate rather than freezing.
    expect(resolveCinema2MainframeView(input({ drift: 1, timeSec: 3, bpm: null, bpmSync: true }))).toEqual(free(3))
  })
})

describe('Mainframe Board Glow', () => {
  const facet = (values: Record<string, unknown>): Cinema2ModuleParameterReadFacet => ({ get: (name: string) => values[name] }) as unknown as Cinema2ModuleParameterReadFacet
  const emissive = (frame: ReturnType<typeof resolveCinema2MainframeStaticFrame>) => frame.overrides.parts!.circuitCores!.emissiveIntensity as number

  it('is the authored look at 0.5 (gain 1), dimmer below and stronger above', () => {
    const base = resolveCinema2MainframeStaticFrame(facet({}))
    expect(base.boardGlow).toBe(0.5)
    expect(base.glowGain).toBeCloseTo(1, 9)
    expect(emissive(base)).toBeCloseTo(0.3 * 0.8, 9)
    const off = resolveCinema2MainframeStaticFrame(facet({ boardGlow: 0 })), full = resolveCinema2MainframeStaticFrame(facet({ boardGlow: 1 }))
    expect(off.glowGain).toBeCloseTo(CINEMA2_MAINFRAME_GLOW_GAIN_MIN, 9)
    expect(full.glowGain).toBeCloseTo(CINEMA2_MAINFRAME_GLOW_GAIN_MAX, 9)
    expect(emissive(off)).toBeLessThan(emissive(base))
    expect(emissive(full)).toBeGreaterThan(emissive(base))
  })

  it('carries Camera Zoom and Camera Drift through, clamped to their range, defaulting to 0', () => {
    expect(resolveCinema2MainframeStaticFrame(facet({}))).toMatchObject({ cameraZoom: 0, cameraDrift: 0 })
    expect(resolveCinema2MainframeStaticFrame(facet({ cameraZoom: 5, cameraDrift: -2 }))).toMatchObject({ cameraZoom: 1, cameraDrift: 0 })
  })
})
