import { describe, expect, it } from 'vitest'
import type { Cinema2NativePresetManifest, Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'
import { readCinema2MoodPolicy } from '../../conductor/Cinema2MoodPolicy'
import { resolveCinema2LiveValues } from '../../../react/Cinema2LiveValues'
import { moodStage, moodTwin } from './MoodMigrationHarness'

export type MoodDrive = readonly [entity: string, property: string]
export interface MoodMigrationCase {
  name: string
  manifest: Readonly<Cinema2NativePresetManifest>
  /** The preset's Auto Performance toggle id. */
  auto: string
  /** Its own reactivity or intensity control, which scales the drives. */
  strength: string
  /** Rise at a high-energy peak. */
  up: readonly MoodDrive[]
  /** Fall below the authored value in a calm passage. */
  down: readonly MoodDrive[]
  /** Rise on a drop's impact and settle afterwards. */
  shock: readonly MoodDrive[]
  /** How many controls must show a live value at a peak (3 unless the preset's authority model allows fewer). */
  minLive?: number
}
const asId = (value: string) => value as Cinema2ParameterId

/**
 * The checks every migrated preset without patterns must pass (Auto Performance toggle tag only): tags and gating, drives bound to controls, peak and calm,
 * a drop, identical with Auto Performance off and at zero reactivity, quiet in a silent stop, saved values untouched, and live values shown.
 */
export function describeMoodMigration(batch: string, cases: readonly MoodMigrationCase[]) {
  describe.each(cases)(`${batch}: $name with the shared Mood Conductor`, ({ name, manifest, auto, strength, up, down, shock, minLive = 3 }) => {
  it('tags its Auto Performance toggle alone (it has no patterns), compiles, and gates every mood rule by that toggle and its reactivity control', () => {
    const tagged = manifest.parameters!.filter(p => readCinema2MoodPolicy(p.metadata) != null)
    expect(tagged.map(p => [String(p.id), readCinema2MoodPolicy(p.metadata)])).toEqual([[auto, 'autoPerformance']])
    const rules = manifest.choreography!.rules.filter(rule => String(rule.id).includes('-mood-'))
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) { expect(rule.enabledParameter).toEqual({ $ref: auto }); expect(rule.strengthParameter).toEqual({ $ref: strength }) }
    expect(() => moodStage(manifest)).not.toThrow()
  })

  it('binds every drive to a user-facing control, so the inspector can show its live value', () => {
    const stage = moodStage(manifest)
    for (const rule of manifest.choreography!.rules.filter(r => String(r.id).includes('-mood-'))) {
      for (const action of rule.actions) {
        const t = action.target as { ref: { $ref: string }; property: string }
        const found = stage.plan.targets.targets.find(x => x.channel === 'value' && String(x.entityId).endsWith(`/${String(t.ref.$ref)}`) && x.property === t.property)
        expect(found?.parameterId, `${rule.id} -> ${t.ref.$ref}.${t.property}`).toBeTruthy()
      }
    }
  })

  it('rises at a high-energy peak and settles below the authored value in a calm passage, around the authored values', () => {
    const peak = moodTwin(manifest, asId(auto)); peak.play(6, { energy: 0.95, tension: 0.6, section: 'drop' })
    for (const [entity, property] of up) expect(peak.on.read(entity, property), `${name} ${entity}.${property}`).toBeGreaterThan(peak.off.read(entity, property))
    const calm = moodTwin(manifest, asId(auto)); calm.play(6, { energy: 0.1, section: 'breakdown' })
    for (const [entity, property] of down) expect(calm.on.read(entity, property), `${name} ${entity}.${property}`).toBeLessThan(calm.off.read(entity, property))
  })

  it('lands a drop as a brief extra, which falls back', () => {
    const t = moodTwin(manifest, asId(auto)); t.play(4, { energy: 0.5, section: 'verse' })
    const before = shock.map(([e, p]) => t.on.read(e, p) - t.off.read(e, p))
    t.once({ energy: 0.5, event: 'drop', eventId: 9, section: 'verse' }); t.play(1 / 30, { energy: 0.5, section: 'verse' })
    shock.forEach(([e, p], i) => expect(t.on.read(e, p) - t.off.read(e, p), `${name} ${e}.${p}`).toBeGreaterThan(before[i]!))
    t.play(10, { energy: 0.5, section: 'verse' })
    shock.forEach(([e, p], i) => expect(Math.abs(t.on.read(e, p) - t.off.read(e, p) - before[i]!), `${name} ${e}.${p} settles`).toBeLessThan(Math.max(0.05, Math.abs(before[i]!) * 0.5 + 0.05)))
  })

  it('does nothing with Auto Performance off (identical to the preset without the mood rules), and nothing at zero reactivity', () => {
    const t = moodTwin(manifest, asId(auto)); t.play(6, { energy: 0.95, tension: 0.6, section: 'drop' })
    for (const [entity, property] of [...up, ...down, ...shock]) expect(t.off.read(entity, property), `${name} ${entity}.${property}`).toBeCloseTo(t.stripped.read(entity, property), 9)
    const zero = moodTwin(manifest, asId(auto), asId(strength), 0); zero.play(6, { energy: 0.95, tension: 0.6, section: 'drop' })
    for (const [entity, property] of up) expect(zero.on.read(entity, property), `${name} ${entity}.${property}`).toBeCloseTo(zero.off.read(entity, property), 6)
  })

  it('quiets in a silent stop: the drives are pulled out', () => {
    const t = moodTwin(manifest, asId(auto)); t.play(6, { energy: 0.95, section: 'drop' })
    const loud = up.map(([e, p]) => t.on.read(e, p) - t.off.read(e, p))
    t.silent(4)
    up.forEach(([e, p], i) => expect(t.on.read(e, p) - t.off.read(e, p), `${name} ${e}.${p}`).toBeLessThan(loud[i]! * 0.5))
  })

  it('never rewrites a saved value, and shows the drives as live values in the inspector', () => {
    const t = moodTwin(manifest, asId(auto)); t.play(6, { energy: 0.95, tension: 0.6, section: 'drop' })
    // A fresh preset with only the toggle turned on (whatever its default) holds exactly the saved values the music-driven one does.
    const fresh = moodStage(manifest)
    fresh.state.setPersistentValue(asId(auto), true)
    const saved = t.on.state.getSnapshot().persistentValues
    expect(JSON.stringify(saved)).toBe(JSON.stringify(fresh.state.getSnapshot().persistentValues))
    const ranges = new Map<string, readonly [number, number]>()
    for (const p of manifest.parameters!) if ((p.type === 'float' || p.type === 'integer') && typeof p.min === 'number' && typeof p.max === 'number') ranges.set(String(p.id), [p.min, p.max])
    const live = resolveCinema2LiveValues(t.on.plan, t.on.resolver, saved, ranges)
    expect(live.size).toBeGreaterThanOrEqual(minLive)
    for (const [parameterId, value] of live) expect(value).not.toBe(Number(saved[parameterId]))
  })
  })
}
