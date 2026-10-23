import { describe, expect, it } from 'vitest'
import { Cinema2BlockshiftPerformance, CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS, type Cinema2BlockshiftPerformanceCue } from '../modules/blockshift/Cinema2BlockshiftPerformance'
import { Cinema2BlockshiftAudioRuntime, CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, type Cinema2BlockshiftAudioChannels } from '../modules/blockshift/Cinema2BlockshiftAudio'
import { buildCinema2BlockshiftLayout, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'

const input = { director: { ...CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS }, cues: [] as Cinema2BlockshiftPerformanceCue[], active: true, reset: false, enabled: true, manualEdited: false, deltaBeats: 0.25, motionAmount: 1, reactivity: 1 }
function armed() { const performance = new Cinema2BlockshiftPerformance(); performance.update(input); return performance }

describe('BLOCKSHIFT P6 Visual Director and Auto Performance authority', () => {
  it('uses fresh events for bounded four-beat build / two-beat drop overlays, gives drops priority and expires to the current base', () => {
    const p = armed(), cue = { kind: 'build' as const, id: 'build-1' }
    p.update({ ...input, cues: [cue] }); expect(p.getWeight()).toBe(0)
    p.update(input); expect(p.getWeight()).toBe(0.25)
    for (let i = 0; i < 15; i++) p.update({ ...input, cues: [cue] })
    expect(p.hasOverlay()).toBe(false); expect(p.inspect().accepted).toBe(1)
    p.update({ ...input, cues: [{ kind: 'build', id: 'build-2' }, { kind: 'drop', id: 'drop-1' }] })
    p.update(input); expect(p.inspect().overlay).toMatchObject({ kind: 'drop', duration: 2, weight: 0.35 })
    const current = buildCinema2BlockshiftLayout({ pattern: 'wave', phase: 0.4 })
    expect(p.apply(current, 1, 45, 1)).not.toEqual(current)
    for (let i = 0; i < 7; i++) p.update(input)
    expect(p.apply(current, 1, 45, 1)).toBe(current)
  })

  it('gives same-frame manual edits priority, suppresses the old cue beyond cooldown and only accepts a later independent event', () => {
    const p = armed(), build = { kind: 'build' as const, id: 'b' }, drop = { kind: 'drop' as const, id: 'd' }
    p.update({ ...input, cues: [build] }); p.update(input)
    p.update({ ...input, manualEdited: true, cues: [drop] })
    expect(p.inspect()).toMatchObject({ overlay: null, cooldown: 2, accepted: 1 })
    for (let i = 0; i < 9; i++) p.update({ ...input, cues: [build, drop] })
    expect(p.inspect()).toMatchObject({ overlay: null, cooldown: 0, accepted: 1 })
    p.update({ ...input, cues: [{ ...drop, id: 'd-new' }] })
    expect(p.inspect().overlay?.kind).toBe('drop')
    expect(p.inspect().accepted).toBe(2)
  })

  it('does not replay OFF/activation/pause/zero events and honors audio zero, disabled Auto and resets', () => {
    const p = new Cinema2BlockshiftPerformance(), cue = { kind: 'build' as const, id: 'entry' }
    p.update({ ...input, cues: [cue] }); expect(p.hasOverlay()).toBe(false)
    p.update({ ...input, enabled: false, cues: [{ ...cue, id: 'off' }] })
    p.update({ ...input, cues: [{ ...cue, id: 'off' }] }); expect(p.hasOverlay()).toBe(false)
    p.update({ ...input, cues: [{ ...cue, id: 'fresh' }] }); p.update(input)
    const held = p.inspect().overlay
    p.update({ ...input, active: false, cues: [{ kind: 'drop', id: 'paused' }] })
    expect(p.inspect().overlay).toEqual(held)
    p.update({ ...input, cues: [{ kind: 'drop', id: 'paused' }] })
    expect(p.inspect().overlay?.kind).toBe('build')
    const beforeZero = p.inspect()
    p.update({ ...input, motionAmount: 0, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 }, cues: [{ kind: 'drop', id: 'zero' }] })
    expect(p.inspect()).toEqual(beforeZero)
    p.update({ ...input, reactivity: 0 }); expect(p.hasOverlay()).toBe(false)
    p.update({ ...input, cues: [{ kind: 'drop', id: 'new' }] }); p.update({ ...input, enabled: false })
    expect(p.hasOverlay()).toBe(false)
    p.update({ ...input, reset: true, cues: [{ kind: 'drop', id: 'reset' }] })
    expect(p.inspect()).toMatchObject({ overlay: null, accepted: 0, cooldown: 0 })
    for (let i = 0; i < 25; i++) p.update({ ...input, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 } })
    expect(p.hasOverlay()).toBe(false) // Persistent Director build context is not a new musical event.
  })

  it('only scales approved audio channels with Director gain at most 1.25 and never bypasses audio zero or intensity ceiling', () => {
    const audio = new Cinema2BlockshiftAudioRuntime(), p = armed(), base = buildCinema2BlockshiftLayout()
    audio.update({ channels: { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, bassPressure: 1 }, cues: [], active: true, reset: false, deltaSeconds: 0.1, motionAmount: 1, reactivity: 1, sectionType: 'verse' })
    const neutral = audio.apply(base, 1, 45)
    p.update({ ...input, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 } })
    expect(p.inspect().directorGain).toBe(1.25)
    const directed = audio.apply(base, 1, 45, { director: p.getDirector() })
    expect(directed.pose).not.toEqual(neutral.pose)
    expect(directed.emission.every(value => value <= 1)).toBe(true)
    expect(audio.apply(base, 0, 45, { director: p.getDirector() }).pose).toBe(base)
    audio.update({ channels: { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS }, cues: [], active: true, reset: false, deltaSeconds: 0.1, motionAmount: 1, reactivity: 1, sectionType: 'verse' })
    expect(audio.apply(base, 1, 45, { director: p.getDirector() }).pose.map(b => b.position)).toEqual(base.map(b => b.position))
  })

  it('keeps combined maximal Director/audio/Auto transforms safe at size/spread extrema through all six live patterns', () => {
    const audio = new Cinema2BlockshiftAudioRuntime(), p = armed()
    audio.update({ channels: Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS).map(k => [k, 1])) as Cinema2BlockshiftAudioChannels, cues: [], active: true, reset: false, deltaSeconds: 0.1, motionAmount: 1, reactivity: 1, sectionType: 'drop' })
    p.update({ ...input, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 }, cues: [{ kind: 'drop', id: 'maximum' }] }); p.update({ ...input, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 } })
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const phase of [0, 0.25, 0.5, 0.75]) for (const blockSize of [1.05, 1.35, 3]) for (const spread of [0.5, 3]) {
      const base = buildCinema2BlockshiftLayout({ pattern, phase, blockSize, spread, depth: 1, rotationRange: 45 })
      const result = audio.apply(base, 1, 45, { director: p.getDirector(), overlay: (pose, attenuation) => p.apply(pose, 1, 45, attenuation) })
      expect(result.pose.map(b => b.id)).toEqual(base.map(b => b.id))
      expect(result.pose.map(b => b.size)).toEqual(base.map(b => b.size))
      for (const b of result.pose) {
        expect(Math.hypot(...b.position) + b.size * Math.sqrt(3) / 2).toBeLessThanOrEqual(300)
        expect(Math.hypot(...b.position) - b.size * Math.sqrt(3) / 2).toBeGreaterThanOrEqual(2.5 - 1e-8)
        for (const other of result.pose.slice(0, b.index)) expect(b.position.some((n, a) => Math.abs(n - other.position[a]!) >= cinema2BlockshiftHalfExtents(b)[a]! + cinema2BlockshiftHalfExtents(other)[a]! + 1.5 - 1e-8)).toBe(true)
      }
    }
  })
})
