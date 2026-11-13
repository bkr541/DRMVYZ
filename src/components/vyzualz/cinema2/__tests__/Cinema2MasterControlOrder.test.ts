import { describe, expect, it } from 'vitest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const presets = cinema2NativePresetRegistry.list().filter(preset => !preset.metadata.tags?.includes('internal'))

describe('Cinema 2.0 Master Controls placement', () => {
  it('audits the entire user-facing catalog', () => {
    const audit = presets.map(preset => ({
      name: preset.metadata.name,
      toggles: (preset.parameters ?? []).filter(p => p.type === 'boolean' && ['BPM Sync', 'Auto Performance'].includes(p.label)).map(p => ({ label: p.label, parent: p.designParentGroup })),
    }))
    expect(presets.length).toBeGreaterThan(40)
    expect(audit.filter(p => p.toggles.length !== 2).map(p => p.name)).toEqual(['War Of Worlds'])
    for (const preset of audit) {
      expect(preset.toggles, preset.name).toHaveLength(preset.name === 'War Of Worlds' ? 1 : 2)
      expect(preset.toggles.every(toggle => toggle.parent === 'master-controls'), preset.name).toBe(true)
    }
  })

  it.each(presets.map(preset => [preset.metadata.name, preset.id] as const))('%s places its standard permission toggles last', (_name, id) => {
    const compiled = cinema2NativePresetRegistry.compile(id)
    if (!compiled.ok) throw new Error(`Cannot compile ${id}`)
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const master = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(group => group.id === 'master-controls')!
    const expected = id === 'drmvyz.cinema2.war-of-worlds' ? ['Auto Performance'] : ['BPM Sync', 'Auto Performance']
    expect(master.controls.slice(-expected.length).map(control => control.definition.label)).toEqual(expected)
    const other = master.controls.slice(0, -expected.length)
    expect(other.some(control => ['BPM Sync', 'Auto Performance'].includes(control.definition.label))).toBe(false)
  })
})
