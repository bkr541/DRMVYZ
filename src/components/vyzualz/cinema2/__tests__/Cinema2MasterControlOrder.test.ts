import { describe, expect, it } from 'vitest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const presets = cinema2NativePresetRegistry.list().filter(preset => !preset.metadata.tags?.includes('internal'))
const cameraPerformancePreviews = new Set(['drmvyz.cinema2.war-of-worlds', 'drmvyz.cinema2.open-decks'])
const expectedToggles = ({ id, metadata }: (typeof presets)[number]) => {
  if (metadata.tags?.includes('reference') && metadata.tags.includes('static')) return []
  if (cameraPerformancePreviews.has(id)) return ['Auto Performance']
  return ['BPM Sync', 'Auto Performance']
}

describe('Cinema 2.0 Master Controls placement', () => {
  it('audits the entire user-facing catalog', () => {
    const audit = presets.map(preset => ({
      name: preset.metadata.name,
      expected: expectedToggles(preset),
      toggles: (preset.parameters ?? []).filter(p => p.type === 'boolean' && ['BPM Sync', 'Auto Performance'].includes(p.label)).map(p => ({ label: p.label, parent: p.designParentGroup })),
    }))
    expect(presets.length).toBeGreaterThan(40)
    for (const preset of audit) {
      expect(preset.toggles.map(toggle => toggle.label).sort(), preset.name).toEqual([...preset.expected].sort())
      expect(preset.toggles.every(toggle => toggle.parent === 'master-controls'), preset.name).toBe(true)
    }
  })

  it.each(presets.map(preset => [preset.metadata.name, preset] as const))('%s places its standard permission toggles last', (_name, preset) => {
    const compiled = cinema2NativePresetRegistry.compile(preset.id)
    if (!compiled.ok) throw new Error(`Cannot compile ${preset.id}`)
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const master = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(group => group.id === 'master-controls')!
    const expected = expectedToggles(preset)
    const firstToggle = master.controls.length - expected.length
    expect(master.controls.slice(firstToggle).map(control => control.definition.label)).toEqual(expected)
    const other = master.controls.slice(0, firstToggle)
    expect(other.some(control => ['BPM Sync', 'Auto Performance'].includes(control.definition.label))).toBe(false)
  })
})
