import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST } from '../presets/Cinema2NightshiftPreset'
import { Cinema2NightshiftAudio, readNightshiftAudioChannels, resolveNightshiftMusic } from '../modules/nightshift/Cinema2NightshiftAudio'
import { Cinema2NightshiftDirector } from '../modules/nightshift/Cinema2NightshiftDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'

function harness() {
  const compiled = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST, { availableCapabilities: CINEMA2_NIGHTSHIFT_PRESET_MANIFEST.capabilities!.map(c => c.id) })
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets)
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
  const target = (name: string) => compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === name)!
  const parameters = { get: (name: string) => resolver.resolve(target(name).id).value,
    getAuthored: () => undefined, resolve: (name: string) => resolver.resolve(target(name).id) }
  const targets = { getTarget: resolver.getTarget.bind(resolver), resolve: resolver.resolve.bind(resolver), dispatch: resolver.dispatch.bind(resolver) }
  let upstream = nightshiftMusicFixture({ timeSec: 0, frameId: 1 }), sequence = 1, previousTime = 0
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publisherId: 'nightshift-director-test', kind: 'frame', publishedAtMs: 0 }) })
  const director = new Cinema2VisualDirector(), delivery = new Cinema2NightshiftDirector(), audioDelivery = new Cinema2NightshiftAudio()
  const publish = (options: Partial<NightshiftFixtureOptions> = {}, paused = false, amount = 1, absent = false) => {
    upstream = nightshiftMusicFixture({ timeSec: sequence / 10, frameId: ++sequence, ...options })
    const audio = bridge.capture(sequence)
    const frame: Cinema2ModuleFrameReadContext = { frameId: sequence, timestampMs: upstream.timeSec * 1000,
      elapsedTimeSec: upstream.timeSec, deltaTimeSec: paused ? 0 : Math.max(0, Math.min(.1, upstream.timeSec - previousTime)),
      viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio, director: absent ? null : director.capture(audio),
      transport: { sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: upstream.trackId, timeSec: upstream.timeSec },
    }
    choreography.update(frame)
    const channels = readNightshiftAudioChannels(parameters)
    const base = audioDelivery.update(frame, amount, previousTime, audio.discontinuity.occurred, channels)
    const music = resolveNightshiftMusic(delivery.apply(frame, amount, base, channels, audio.discontinuity.occurred), parameters, targets)
    previousTime = upstream.timeSec
    return { frame, channels, base, music, choreography: choreography.getSnapshot(), saved: state.serialize() }
  }
  return { publish, delivery }
}

describe('NIGHTSHIFT Visual Director meaning', () => {
  it('changes lighting from structural intensity while holding raw audio energy constant', () => {
    const { publish } = harness()
    const low = publish({ energy: .5, sectionIntensity: 0 })
    let high = low
    for (let i = 0; i < 15; i++) high = publish({ energy: .5, sectionIntensity: 1 })
    expect(high.channels.audioEnergy).toBe(low.channels.audioEnergy)
    expect(high.channels.directorIntensity).toBeGreaterThan(low.channels.directorIntensity)
    expect(high.music.musicLevel).toBeGreaterThan(low.music.musicLevel)
    expect(high.music.musicCeiling).toBeGreaterThan(low.music.musicCeiling)
    expect(high.music.musicLevel).toBeLessThanOrEqual(high.base.musicLevel)
    expect(high.music.musicCeiling).toBeLessThanOrEqual(1)
    expect(high.saved).toBe(low.saved)
    expect(high.choreography.activeContributionCount).toBe(14)
  })

  it('uses momentum for bounded motion and section-build meaning without inventing raw build pressure', () => {
    const { publish } = harness()
    publish()
    let result = publish({ spectralFlux: 1, tension: 1, sectionBuild: true, sectionProgress: 1 })
    for (let i = 0; i < 15; i++) result = publish({ spectralFlux: 1, tension: 1, sectionBuild: true, sectionProgress: 1 })
    expect(result.base.musicBuild).toBe(0)
    expect(result.music.musicBuild).toBeGreaterThan(0)
    expect(result.music.musicMotion).toBeGreaterThan(1)
    expect(result.music.musicMotion).toBeLessThanOrEqual(1.15)
    expect(result.music.musicRotation).toBeLessThanOrEqual(1.25)
    for (let i = 0; i < 25; i++) result = publish()
    expect(result.music.musicBuild).toBeLessThan(.001)
    expect(result.music.musicMotion - 1).toBeLessThan(.001)
  })

  it('gives a major impact one bounded 700 ms accent, independent of the drop envelope', () => {
    const { publish } = harness()
    publish({ timeSec: .1 })
    const impact = publish({ timeSec: .2, event: 'impact', eventId: 7 })
    expect(impact.base.musicDrop).toBe(0)
    expect(impact.music.musicImpact).toBeCloseTo(.95)
    const repeated = publish({ timeSec: .3, event: 'impact', eventId: 7 })
    expect(repeated.music.musicImpact).toBeLessThan(impact.music.musicImpact)
    expect(publish({ timeSec: .91 }).music.musicImpact).toBe(0)
    const kick = publish({ timeSec: 1, event: 'kick' })
    expect(kick.music.musicImpact).toBe(0)
  })

  it('holds on pause, consumes held events, honors response OFF and clears on seek', () => {
    const { publish } = harness()
    publish({ timeSec: .1 })
    const impact = publish({ timeSec: .2, event: 'impact', eventId: 1 })
    expect(publish({ timeSec: .2 }, true).music).toEqual(impact.music)
    expect(publish({ timeSec: .2 }, true, 0).music.musicImpact).toBe(0)
    publish({ timeSec: .3, event: 'impact', eventId: 2 }, true)
    expect(publish({ timeSec: .31, event: 'impact', eventId: 2 }).music.musicImpact).toBe(0)
    expect(publish({ timeSec: .4, event: 'impact', eventId: 3 }).music.musicImpact).toBeGreaterThan(0)
    expect(publish({ timeSec: 0, event: 'impact', eventId: 4 }).music.musicImpact).toBe(0)
  })

  it('falls back to audio-only for unavailable or mismatched Director frames', () => {
    const { publish, delivery } = harness()
    const result = publish({}, false, 1, true)
    expect(result.music).toEqual(result.base)
    const valid = publish()
    const mismatched = { ...valid.frame, director: { ...valid.frame.director!, visualFrameId: -1 } }
    expect(delivery.apply(mismatched, 1, valid.base, valid.channels, false)).toEqual(valid.base)
  })
})
