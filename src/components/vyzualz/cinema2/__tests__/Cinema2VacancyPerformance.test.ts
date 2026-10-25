import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2PresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_VACANCY_PRESET_MANIFEST, CINEMA2_VACANCY_PARAMETER_IDS as P } from '../presets/Cinema2VacancyPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { Cinema2VacancyPerformance, VACANCY_NEUTRAL_PERFORMANCE, vacancyScreenLevel } from '../modules/vacancy/Cinema2VacancyPerformance'
import { readVacancyControls, VACANCY_PATTERNS, type VacancyPlacement } from '../modules/vacancy/Cinema2VacancyDomain'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'

function harness() {
  let sequence = 0, time = 0, timestamp = 0, edit = 0
  let upstream = nightshiftMusicFixture({ timeSec: 0, frameId: 1 })
  const values: Record<string, Cinema2JsonValue> = {}
  const parameters: Cinema2ModuleParameterReadFacet = { get: key => values[key], getAuthored: key => values[key], resolve: () => null, getEditRevision: () => edit }
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publisherId: 'vacancy-test', kind: 'frame', publishedAtMs: 0 }) })
  const director = new Cinema2VisualDirector(), performance = new Cinema2VacancyPerformance()
  const frame = (o: Partial<NightshiftFixtureOptions> = {}, state: { paused?: boolean; absent?: boolean; bpm?: number; seek?: number; track?: string } = {}) => {
    sequence += 1; timestamp += .1; time = state.seek ?? time + (state.paused ? 0 : .1)
    upstream = nightshiftMusicFixture({ timeSec: time, frameId: sequence, trackId: state.track ?? 'vacancy-test-track', ...o })
    const audio = state.absent ? null : bridge.capture(sequence)
    const input: Cinema2ModuleFrameReadContext = { frameId: sequence, timestampMs: timestamp * 1000, elapsedTimeSec: timestamp, deltaTimeSec: .1,
      viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio, director: audio ? director.capture(audio) : null,
      transport: { sourcePresent: !state.absent, playing: !state.paused && !state.absent, paused: !!state.paused, analysisActive: !state.absent,
        animationActive: !state.paused, trackId: upstream.trackId, timeSec: time, bpm: state.bpm ?? 120, bpmSync: false } }
    return performance.update(input, readVacancyControls(parameters), parameters)
  }
  return { values, frame, edit: () => { edit += 1 }, tick: (n: number) => { let result = frame(); for (let i = 1; i < n; i += 1) result = frame(); return result } }
}

const placements: VacancyPlacement[] = Array.from({ length: 10 }, (_, index) => ({ tv: 'tv-set', tier: index < 4 ? 0 : index < 7 ? 1 : index < 9 ? 2 : 3,
  index: index % 4, x: (index % 4) * .6 - .9, y: Math.floor(index / 4) * .48, z: 0, yaw: 0 }))

describe('VACANCY controls and native programs', () => {
  it('registers the complete preset with canonical triggers, media and five independent colors', () => {
    const result = new Cinema2PresetRegistry().register(CINEMA2_VACANCY_PRESET_MANIFEST)
    expect(result.diagnostics).toEqual([]); expect(result.ok).toBe(true)
    const definitions = CINEMA2_VACANCY_PRESET_MANIFEST.parameters!
    expect(definitions.filter(p => p.type === 'color')).toHaveLength(5)
    expect(definitions.find(p => p.id === P.trigger)?.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(definitions.find(p => p.id === P.trigger)?.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: P.patternChange, value: true }])
    expect(definitions.find(p => p.id === P.bpmSync)?.designParentGroup).toBe('master-controls')
    expect(definitions.find(p => p.id === P.media)?.mediaSlot).toBeDefined()
    for (const id of [P.pattern, P.patternChange, P.trigger]) expect(definitions.find(p => p.id === id)?.designParentGroup).toBe('design')
  })
  it('has eight different spatial/time programs and honors coverage zero even during a drop', () => {
    const signatures = VACANCY_PATTERNS.map(({ value }) => [1.3, 3.1].flatMap(beats => placements.map((p, i) => vacancyScreenLevel(p, i, 10,
      { ...VACANCY_NEUTRAL_PERFORMANCE, pattern: value, beats }))).map(n => n.toFixed(3)).join(','))
    expect(new Set(signatures).size).toBe(8)
    for (const { value } of VACANCY_PATTERNS) for (const [i, p] of placements.entries()) {
      expect(vacancyScreenLevel(p, i, 10, { ...VACANCY_NEUTRAL_PERFORMANCE, pattern: value, coverage: 0, drop: 1 })).toBe(0)
    }
    const covered = placements.filter((p, i) => vacancyScreenLevel(p, i, 10, { ...VACANCY_NEUTRAL_PERFORMANCE, coverage: .4 }) > 0)
    expect(covered).toHaveLength(4)
  })
  it('uses shared BPM independently of host Sync and freezes during pause; Sync OFF runs at 100 BPM', () => {
    const a = harness(), b = harness(); b.values.bpmSync = false
    a.frame(); b.frame()
    const synced = a.tick(10), free = b.tick(10)
    expect(synced.beats).toBeGreaterThan(free.beats)
    expect(synced.beats / free.beats).toBeCloseTo(1.2, 1)
    expect(a.frame({}, { paused: true }).beats).toBe(synced.beats)
    expect(a.frame().beats).toBeGreaterThan(synced.beats)
    expect(a.frame({}, { absent: true }).drop).toBe(0)
  })
  it('holds Pattern Change OFF and advances only on fresh selected events while ON', () => {
    const h = harness(); h.frame()
    expect(h.frame({ event: 'beat', eventId: 1 }).pattern).toBe('dead-air')
    h.values.patternChange = true; h.values.trigger = 'beat'; h.frame()
    expect(h.frame({ event: 'beat', eventId: 2 }).pattern).toBe('channel-hop')
    h.values.pattern = 'checker'; h.edit()
    expect(h.frame({ event: 'beat', eventId: 3 }).pattern).toBe('checker')
    expect(h.values.patternChange).toBe(true)
    expect(h.frame().pattern).toBe('checker')
    expect(h.frame({ event: 'beat', eventId: 4 }).pattern).toBe('vacancy')
    h.values.patternChange = false
    expect(h.frame().pattern).toBe('checker')
  })
  it('lets a same-value manual Pattern reselect reclaim the base from automatic progression', () => {
    const h = harness(); h.values.patternChange = true; h.values.trigger = 'beat'; h.frame()
    h.frame({ event: 'beat', eventId: 1 }); h.edit()
    expect(h.frame({ event: 'beat', eventId: 2 }).pattern).toBe('dead-air')
    expect(h.frame().pattern).toBe('dead-air')
    expect(h.frame({ event: 'beat', eventId: 3 }).pattern).toBe('channel-hop')
  })
  it('scopes Auto Performance to fresh builds/drops and restores the current base', () => {
    const h = harness(); h.values.autoPerformance = true; h.frame()
    expect(h.frame({ build: 1 }).override).toBe('build')
    expect(h.frame({ build: 1 }).pattern).toBe('vacancy')
    h.values.pattern = 'checker'; h.edit()
    expect(h.frame({ build: 1 }).pattern).toBe('checker')
    expect(h.frame({ build: 1 }).override).toBeNull()
    expect(h.frame({ event: 'drop', eventId: 8 }).override).toBe('drop')
    expect(h.tick(30).pattern).toBe('checker')
    expect(h.values.pattern).toBe('checker'); expect(h.values.autoPerformance).toBe(true)
  })
  it('has no musical response with missing/stale audio or a hard-off Music Response', () => {
    const h = harness(); Object.assign(h.values, { audioEnergy: 1, bassPressure: 1, kickAccent: 1, dropAccent: 1, buildPressure: 1, musicResponse: 0 })
    h.frame(); const off = h.frame({ build: 1 })
    expect(off).toMatchObject({ level: 1, grain: 1, kick: 0, build: 0, drop: 0 })
    h.values.musicResponse = 1
    expect(h.frame({ build: 1 }).build).toBeGreaterThan(0)
    expect(h.frame({}, { absent: true })).toMatchObject({ kick: 0, build: 0, drop: 0, level: 1 })
  })
  it('resets on seek and track change and accepts manual coverage changes while paused', () => {
    const h = harness(); h.values.patternChange = true; h.values.trigger = 'beat'; h.frame()
    expect(h.frame({ event: 'beat', eventId: 1 }).pattern).toBe('channel-hop')
    expect(h.frame({}, { seek: 0 }).pattern).toBe('dead-air')
    h.values.screensLit = 0; h.frame({}, { paused: true }); h.values.screensLit = 1
    expect(h.frame({}, { paused: true }).coverage).toBe(1)
    expect(h.frame({ event: 'drop', eventId: 2 }, { track: 'new-track' }).override).toBeNull()
  })
  it('maintains base progression under an override and restores the advanced base when it ends', () => {
    const h = harness(); Object.assign(h.values, { autoPerformance: true, patternChange: true, trigger: 'beat' })
    h.frame(); h.frame({ build: 1 })
    const during = h.frame({ build: 1, event: 'beat', eventId: 99 })
    expect(during).toMatchObject({ pattern: 'vacancy', basePattern: 'channel-hop', override: 'build' })
    expect(h.frame({ build: 0 })).toMatchObject({ pattern: 'channel-hop', override: null })
    expect(h.values.patternChange).toBe(true)
  })
  it('lets manual edits cancel an already-active drop flash and does not replay it', () => {
    const h = harness(); Object.assign(h.values, { autoPerformance: true, dropAccent: 1 })
    h.frame(); expect(h.frame({ event: 'drop', eventId: 10 }).drop).toBeGreaterThan(0)
    h.values.pattern = 'checker'; h.edit()
    expect(h.frame()).toMatchObject({ pattern: 'checker', override: null, drop: 0 })
    expect(h.frame().drop).toBe(0)
    expect(h.frame({ event: 'drop', eventId: 11 }).drop).toBeGreaterThan(0)
  })
  it('holds musical output on pause while honoring manual response and coverage limits', () => {
    const h = harness(); Object.assign(h.values, { musicResponse: 1, audioEnergy: 1, bassPressure: 1, kickAccent: 1 })
    h.frame(); const active = h.frame({ energy: 1, bass: 1 })
    const paused = h.frame({}, { paused: true })
    expect(paused.beats).toBe(active.beats); expect(paused.kick).toBe(active.kick); expect(paused.bass).toBe(active.bass)
    h.values.musicResponse = .5; h.values.screensLit = .5
    const edited = h.frame({}, { paused: true })
    expect(edited.kick).toBeCloseTo(active.kick / 2); expect(edited.coverage).toBeLessThanOrEqual(.5)
    h.values.musicResponse = 0
    expect(h.frame({}, { paused: true })).toMatchObject({ kick: 0, bass: 0, level: 1, drop: 0 })
  })

})
