import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2NightshiftAudio, NIGHTSHIFT_MUSIC_TARGET_DEFAULTS as neutral, resolveNightshiftMusic, selectNightshiftAudio, resolveNightshiftPatternEvent, readNightshiftAudioChannels } from '../modules/nightshift/Cinema2NightshiftAudio'
import { shadeNightshiftMusicCell } from '../modules/nightshift/Cinema2NightshiftSceneController'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST } from '../presets/Cinema2NightshiftPreset'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { CINEMA2_NIGHTSHIFT_PATTERNS, NightshiftPatternTransition } from '../modules/nightshift/Cinema2NightshiftDomain'

function harness() {
  const compiled = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST, { availableCapabilities: CINEMA2_NIGHTSHIFT_PRESET_MANIFEST.capabilities!.map(c => c.id) })
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets)
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
  const target = (name: string) => compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === name)!
  const parameters = { get: (name: string) => resolver.resolve(target(name).id).value,
    getAuthored: () => undefined, resolve: (name: string) => resolver.resolve(target(name).id) }
  let upstream = nightshiftMusicFixture({ timeSec: 0, frameId: 1 })
  let sequence = 1, frameId = 1
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publisherId: 'nightshift-test', kind: 'frame', publishedAtMs: 0 }),
  })
  const adapter = new Cinema2NightshiftAudio()
  let previousTime: number | null = null
  const publish = (o: Partial<NightshiftFixtureOptions> = {}, paused = false, amount = 1) => {
    upstream = nightshiftMusicFixture({ timeSec: .1 * sequence, frameId: sequence + 1, ...o })
    sequence++
    const frame: Cinema2ModuleFrameReadContext = { frameId: frameId++, timestampMs: upstream.timeSec * 1000,
      elapsedTimeSec: upstream.timeSec, deltaTimeSec: paused ? 0 : Math.max(0, Math.min(.1, upstream.timeSec - (previousTime ?? upstream.timeSec))), viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1,
      audio: bridge.capture(frameId), director: null,
      transport: { sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: 'nightshift-audio-fixture', timeSec: upstream.timeSec },
    }
    choreography.update(frame)
    const channels = readNightshiftAudioChannels(parameters)
    const value = adapter.update(frame, amount, previousTime, frame.audio!.discontinuity.occurred, channels)
    previousTime = upstream.timeSec
    return { value, frame, channels, choreography: choreography.getSnapshot() }
  }
  return { adapter, publish }
}

describe('NIGHTSHIFT shared audio delivery', () => {
  it('uses continuous energy for coverage, bass for rotation and supported vocals for restraint', () => {
    const { publish } = harness()
    const quiet = publish({ energy: .05 }).value
    const loud = publish({ energy: .95, bass: 1, high: 1 }).value
    expect(loud.musicCoverage).toBeGreaterThan(quiet.musicCoverage)
    expect(loud.musicRotation).toBeGreaterThan(1)
    expect(loud.musicRotation).toBeLessThanOrEqual(1.25)
    expect(loud.musicGlintRate).toBeGreaterThan(0)
    for (let i = 0; i < 10; i++) publish({ energy: .95, bass: 1, high: 1 })
    const settled = publish({ energy: .95, bass: 1, high: 1 }).value
    const vocal = publish({ energy: .95, bass: 1, high: 1, vocal: 1 }).value
    expect(vocal.musicCoverage).toBeLessThan(settled.musicCoverage)
    expect(loud.musicCoverage).toBeLessThanOrEqual(1)
  })

  it('latches activation events, deduplicates repeats and releases kick/snare envelopes', () => {
    const { publish } = harness()
    expect(publish({ event: 'kick', frameId: 1, timeSec: .1 }).value.musicKick).toBe(0)
    const hit = publish({ event: 'kick', frameId: 2, timeSec: .2 }).value
    expect(hit.musicKick).toBe(1)
    expect(publish({ event: 'kick', frameId: 2, timeSec: .3 }).value.musicKick).toBeLessThan(1)
    expect(publish({ event: 'snare', timeSec: .4 }).value.musicSnare).toBe(1)
    expect(publish({ timeSec: .7 }).value.musicKick).toBe(0)
    expect(publish({ timeSec: .7 }).value.musicSnare).toBe(0)
  })

  it('holds during pause, honors response zero immediately, and does not replay paused events', () => {
    const { publish } = harness()
    publish({ timeSec: .1 })
    const hit = publish({ event: 'kick', timeSec: .2 }).value
    expect(publish({ event: 'kick', timeSec: .2 }, true).value).toEqual(hit)
    expect(publish({ timeSec: .2 }, true, 0).value).toEqual(neutral)
    const paused = publish({ event: 'snare', frameId: 99, timeSec: .3 }, true)
    expect(paused.value.musicSnare).toBe(0)
    expect(publish({ event: 'snare', frameId: 99, timeSec: .3 }).value.musicSnare).toBe(0)
  })

  it('uses shared build/drop facts for spatial change and clears impulses on seek', () => {
    const { publish } = harness()
    publish({ timeSec: .1 })
    const build = publish({ build: .85, timeSec: .2 }).value.musicBuild
    expect(build).toBeGreaterThan(0)
    expect(build).toBeLessThan(.85)
    const drop = publish({ event: 'drop', timeSec: .3 }).value
    expect(drop.musicDrop).toBe(1)
    const cells = [0, 3, 5, 9].map(row => ({ row, column: 5, paletteIndex: 0, level: 1 }))
    const gains = cells.map(cell => shadeNightshiftMusicCell(cell, .2, 1, drop))
    expect(new Set(gains.map(v => v.toFixed(5))).size).toBeGreaterThan(1)
    expect(publish({ timeSec: .05 }).value.musicDrop).toBe(0)
  })

  it('rejects mismatched/stale audio and preserves authored output when data is unavailable', () => {
    const { publish, adapter } = harness()
    const { frame, channels } = publish({ featuresAvailable: false })
    expect(adapter.update({ ...frame, audio: null }, 1, 0, true, channels)).toEqual(neutral)
    expect(selectNightshiftAudio({ ...frame, transport: { ...frame.transport!, timeSec: 5 } })).toBeNull()
    expect(selectNightshiftAudio({ ...frame, transport: { ...frame.transport!, trackId: 'different-track' } })).toBeNull()
    expect(publish({ featuresAvailable: false }).value.musicCoverage).toBe(1)
    const hit = publish({ event: 'beat', timeSec: .4 }).frame
    expect(resolveNightshiftPatternEvent(hit, 'beat', .3)).toBe(hit.audio!.rhythm.beat!.id)
    const stale = { ...hit, audio: { ...hit.audio!, rhythm: { ...hit.audio!.rhythm, beat: { ...hit.audio!.rhythm.beat!, timeSec: 0 } } } }
    expect(resolveNightshiftPatternEvent(stale, 'beat', .3)).toBeNull()
  })

  it('smooths shared continuous targets on elapsed frames, holds at zero delta, and releases without touching authored state', () => {
    const { publish } = harness()
    publish({ energy: 0, timeSec: 0 })
    expect(publish({ energy: 1, timeSec: 0 }).channels.audioEnergy).toBe(0)
    const rise = publish({ energy: 1, timeSec: .1 })
    expect(rise.channels.audioEnergy).toBeGreaterThan(.3)
    expect(rise.channels.audioEnergy).toBeLessThan(.6)
    expect(rise.choreography.activeContributionCount).toBe(10)
    expect(rise.choreography.diagnostics).toEqual([])
    expect(publish({ energy: 0, timeSec: .1 }, true).channels.audioEnergy).toBe(rise.channels.audioEnergy)
    const fall = publish({ energy: 0, timeSec: .2 }).channels.audioEnergy
    expect(fall).toBeLessThan(rise.channels.audioEnergy)
    for (let i = 3; i <= 20; i++) publish({ energy: 0, timeSec: i / 10 })
    expect(publish({ energy: 0, timeSec: 2.1 }).channels.audioEnergy).toBeLessThan(.001)
    expect(publish({ energy: 1, timeSec: 0 }).channels.audioEnergy).toBe(1)
  })

  it('uses eight distinct spatial accent programs and caps every pattern at user coverage', () => {
    const cells = Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i / 10), column: i % 10, paletteIndex: 0, level: 1 }))
    for (const kind of ['musicKick', 'musicDrop'] as const) {
      const music = { ...neutral, [kind]: 1, musicKickTravel: .4, musicDropTravel: .4 }
      const signatures = CINEMA2_NIGHTSHIFT_PATTERNS.map(p => cells.map(cell => shadeNightshiftMusicCell(cell, 0, 1, music, p.value, 2).toFixed(5)).join(','))
      expect(new Set(signatures).size).toBe(8)
      for (const pattern of CINEMA2_NIGHTSHIFT_PATTERNS) for (const cell of cells) {
        expect(shadeNightshiftMusicCell(cell, 0, 0, music, pattern.value, 2)).toBe(0)
        expect(shadeNightshiftMusicCell(cell, 1, 1, music, pattern.value, 2)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('blends automatic pattern changes for 300 ms and lets manual edits cancel immediately', () => {
    const transition = new NightshiftPatternTransition()
    transition.update('nightshift', 0, false, true)
    expect(transition.update('runway', 1, false, false)).toEqual({ outgoingPattern: 'nightshift', blend: 0 })
    expect(transition.update('runway', 1.15, false, false).blend).toBeCloseTo(.5)
    expect(transition.update('runway', 1.15, false, false).blend).toBeCloseTo(.5)
    expect(transition.update('runway', 1.31, false, false)).toEqual({ outgoingPattern: null, blend: 1 })
    transition.update('diamond-ripple', 2, false, false)
    expect(transition.update('runway', 2.05, true, false)).toEqual({ outgoingPattern: null, blend: 1 })
    expect(transition.update('nightshift', 0, false, true)).toEqual({ outgoingPattern: null, blend: 1 })
  })

  it('resolves response channels through canonical targets and enforces numeric bounds', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets)
    const target = (name: string) => compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === name)!
    const parameters = { get: () => undefined, getAuthored: () => undefined,
      resolve: (name: string) => resolver.resolve(target(name).id) }
    const music = resolveNightshiftMusic({ ...neutral, musicCoverage: 9, musicRotation: 7, musicMotion: 7, musicCeiling: 7, musicImpact: -2, musicKick: -2 }, parameters,
      { getTarget: id => resolver.getTarget(id), resolve: (id, values) => resolver.resolve(id, values), dispatch: (id, values) => resolver.dispatch(id, values) })
    expect(music.musicCoverage).toBe(1)
    expect(music.musicRotation).toBe(1.25)
    expect(music.musicMotion).toBe(1.15)
    expect(music.musicCeiling).toBe(1)
    expect(music.musicImpact).toBe(0)
    expect(music.musicKick).toBe(0)
    for (const row of [0, 5, 9]) expect(shadeNightshiftMusicCell({ row, column: 5, paletteIndex: 0, level: 1 }, 0, 0, { ...music, musicDrop: 1 })).toBe(0)
  })
})
