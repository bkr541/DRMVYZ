import { describe, expect, it } from 'vitest'
import { createCinema2DesignParentGroupModel, resolveCinema2AutoPerformanceLock, CINEMA2_AUTO_PERFORMANCE_LOCK_REASON, type Cinema2InspectorControlModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import type { Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { readCinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'
import { CINEMA2_BACKSTREET_PRESET_MANIFEST } from '../presets/Cinema2BackstreetPreset'
import { CINEMA2_DEPTH_PRESET_MANIFEST } from '../presets/Cinema2DepthPreset'
import { CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST } from '../presets/Cinema2ElectricStormPreset'
import { CINEMA2_IFRIT_PRESET_MANIFEST } from '../presets/Cinema2IfritPreset'
import { CINEMA2_MAINFRAME_PRESET_MANIFEST } from '../presets/Cinema2MainframePreset'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from '../presets/Cinema2ReactorPreset'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { MOOD_CAPABILITIES } from './support/MoodMigrationHarness'

const compile = (manifest: Readonly<Cinema2NativePresetManifest>) => {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: MOOD_CAPABILITIES })
  if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('; '))
  return result.plan
}
const all = (groups: ReturnType<typeof createCinema2DesignParentGroupModel>) => groups.map(parent => ({
  id: parent.id, controls: [...parent.controls, ...parent.groups.flatMap(group => group.controls)] as Readonly<Cinema2InspectorControlModel>[],
}))
const autoId = (manifest: Readonly<Cinema2NativePresetManifest>) => String(manifest.parameters!.find(p => readCinema2MoodPolicy(p.metadata) === 'autoPerformance')!.id)

const TAGGED = [
  ['Ifrit', CINEMA2_IFRIT_PRESET_MANIFEST], ['Depth', CINEMA2_DEPTH_PRESET_MANIFEST], ['Mainframe', CINEMA2_MAINFRAME_PRESET_MANIFEST],
  ['Electric Storm', CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST], ['Reactor', CINEMA2_REACTOR_PRESET_MANIFEST], ['Threshold', CINEMA2_THRESHOLD_PRESET_MANIFEST],
] as const

describe.each(TAGGED)('the Auto Performance lock: %s', (_name, manifest) => {
  const plan = compile(manifest)
  const model = (on: boolean) => {
    const state = new Cinema2ParameterState(plan.parameters)
    state.setPersistentValue(autoId(manifest) as never, on)
    return createCinema2DesignParentGroupModel(plan, state.getSnapshot())
  }

  it('locks nothing with Auto Performance off', () => {
    for (const { controls } of all(model(false))) for (const control of controls) expect(control.locked, control.definition.id).toBeUndefined()
  })

  it('with it on, disables every control in Master Controls, Design and Effects except the toggle and BPM Sync, and leaves Palette editable', () => {
    const groups = all(model(true))
    const toggle = autoId(manifest)
    const exempt = new Set([toggle, ...groups.flatMap(g => g.controls).filter(c => c.definition.label === 'BPM Sync').map(c => c.definition.id)])
    let locked = 0
    for (const { id, controls } of groups) {
      for (const control of controls) {
        const label = `${id}/${control.definition.label}`
        if (id === 'palette' || exempt.has(control.definition.id)) { expect(control.locked, label).toBeUndefined(); expect(control.enabled, label).toBe(true); continue }
        expect(control.locked, label).toBe(true)
        expect(control.enabled, label).toBe(false)
        expect(control.lockReason, label).toBe(CINEMA2_AUTO_PERFORMANCE_LOCK_REASON)
        // No visible text is added, so locking changes no size.
        expect(control.disabledReason, label).toBeNull()
        locked++
      }
    }
    expect(locked).toBeGreaterThan(4)
    expect(groups.find(g => g.id === 'palette')!.controls.length).toBeGreaterThan(0)
    expect(exempt.has(toggle)).toBe(true)
  })

  it('shows the same saved values locked or not, and turning Auto Performance off restores every control exactly', () => {
    const off = all(model(false)), on = all(model(true)), again = all(model(false))
    const valuesOf = (groups: ReturnType<typeof all>) => groups.flatMap(g => g.controls).filter(c => c.definition.id !== autoId(manifest)).map(c => [c.definition.id, JSON.stringify(c.value)])
    expect(valuesOf(on)).toEqual(valuesOf(off))
    expect(JSON.stringify(again)).toBe(JSON.stringify(off))
    // The same controls are present in the same order (locking adds, removes and reorders nothing).
    expect(on.map(g => g.controls.map(c => c.definition.id))).toEqual(off.map(g => g.controls.map(c => c.definition.id)))
  })
})

describe('the Auto Performance lock: opt-in and identification', () => {
  it('does not apply to a preset that has not tagged its Auto Performance toggle', () => {
    // Every preset will be migrated eventually, so this builds an untagged preset by removing the shared policy tags from a migrated one.
    const untagged = { ...CINEMA2_BACKSTREET_PRESET_MANIFEST, parameters: CINEMA2_BACKSTREET_PRESET_MANIFEST.parameters!.map(p => ({ ...p, metadata: undefined })) } as typeof CINEMA2_BACKSTREET_PRESET_MANIFEST
    const plan = compile(untagged)
    expect(resolveCinema2AutoPerformanceLock(plan, { [String(untagged.parameters!.find(p => p.label === 'Auto Performance')!.id)]: true })).toMatchObject({ active: false, autoParameterId: null })
  })

  it('finds BPM Sync by the declared tempo-sync parameter (Ifrit), else by the standard control (Reactor), and never exempts anything else', () => {
    for (const [manifest, expectedLabelCount] of [[CINEMA2_IFRIT_PRESET_MANIFEST, 2], [CINEMA2_REACTOR_PRESET_MANIFEST, 2]] as const) {
      const plan = compile(manifest)
      const lock = resolveCinema2AutoPerformanceLock(plan, { [autoId(manifest)]: true })
      expect(lock.active).toBe(true)
      expect(lock.exempt.size).toBe(expectedLabelCount)
      const labels = [...lock.exempt].map(id => plan.parameters.definitions.find(d => d.id === id)!.label).sort()
      expect(labels).toEqual(['Auto Performance', 'BPM Sync'])
    }
  })

  it('is inactive until the toggle is on', () => {
    const plan = compile(CINEMA2_REACTOR_PRESET_MANIFEST)
    expect(resolveCinema2AutoPerformanceLock(plan, {}).active).toBe(false)
    expect(resolveCinema2AutoPerformanceLock(plan, { [autoId(CINEMA2_REACTOR_PRESET_MANIFEST)]: false }).active).toBe(false)
  })
})
