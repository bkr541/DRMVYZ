import { describe, expect, it } from 'vitest'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_CHAMBER_PRESET_ID } from '../presets/Cinema2ChamberPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat',
  'music.downbeat', 'music.bar', 'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop', 'visual-director.significance',
  'media.image', 'media.video', 'media.svg',
] as const

const userFacing = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(declaration => !declaration.manifest.metadata.tags?.includes('internal'))
const staticReferences = userFacing.filter(({ role, manifest }) => role === 'reference' && manifest.metadata.tags?.includes('static'))
const performancePresets = userFacing.filter(declaration => !staticReferences.includes(declaration))
const isAutoPerformance = (parameter: { id: string; label: string }) => /auto.?performance/i.test(`${parameter.id} ${parameter.label}`)

/** Presets that gained the toggle with this work. Every other user-facing preset already had one, and keeps its own implementation. */
const ADDED = [
  'electric-storm', 'reactor', 'threshold', 'go-to', 'reliquary', 'war-of-worlds', 'mainframe', 'backstreet',
  'user-model-form', 'user-model-shatter', 'user-model-dust', 'user-model-hologram', 'user-model-slices', 'user-model-voxel',
] as const

describe('Auto Performance across the Cinema 2.0 catalog', () => {
  it('is present exactly once, as a boolean under Design > Master Controls, on every performance preset', () => {
    expect(performancePresets.length).toBeGreaterThan(40)
    for (const { manifest } of performancePresets) {
      const matches = (manifest.parameters ?? []).filter(isAutoPerformance)
      expect(matches, manifest.id).toHaveLength(1)
      expect(matches[0], manifest.id).toMatchObject({ label: 'Auto Performance', type: 'boolean', designParentGroup: 'master-controls' })
    }
  })

  it('omits the toggle for hidden diagnostics and static reference scenes', () => {
    const without = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(({ manifest }) => !(manifest.parameters ?? []).some(isAutoPerformance))
    expect(without).toEqual(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(declaration =>
      declaration.manifest.metadata.tags?.includes('internal') || staticReferences.includes(declaration),
    ))
  })

  it('registers CHAMBER as a visible scene preview with four empty Design groups', () => {
    const declaration = staticReferences.find(({ manifest }) => manifest.id === CINEMA2_CHAMBER_PRESET_ID)
    expect(declaration?.manifest.metadata).toMatchObject({ name: 'CHAMBER' })
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_CHAMBER_PRESET_ID, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const { manifest } = compiled.plan
    expect(manifest.parameters ?? []).toEqual([])
    expect(manifest.effects ?? []).toEqual([])
    expect(manifest.choreography).toBeUndefined()
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    expect(createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())).toEqual([
      { id: 'master-controls', label: 'Master Controls', controls: [], groups: [] },
      { id: 'design', label: 'Design', controls: [], groups: [] },
      { id: 'effects', label: 'Effects', controls: [], groups: [] },
      { id: 'palette', label: 'Palette', controls: [], groups: [] },
    ])
  })

  describe.each(ADDED)('%s', slug => {
    const manifest = cinema2NativePresetRegistry.get(`drmvyz.cinema2.${slug}` as never)!
    const autoId = manifest.parameters!.find(isAutoPerformance)!.id as Cinema2ParameterId
    const compiled = cinema2NativePresetRegistry.compile(manifest.id, { availableCapabilities: CAPABILITIES })

    it('compiles, starts off, and appears in the Design inspector under Master Controls and nowhere else', () => {
      expect(compiled.ok).toBe(true)
      const plan = compiled.plan!
      const state = new Cinema2ParameterState(plan.parameters)
      expect(state.getValue(autoId)).toBe(false)
      const parents = createCinema2DesignParentGroupModel(plan, state.getSnapshot())
      const owners = parents.filter(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)].some(control => control.definition.id === autoId))
      expect(owners.map(parent => parent.label)).toEqual(['Master Controls'])
      const control = owners[0]!.controls.find(candidate => candidate.definition.id === autoId)!
      expect(control).toMatchObject({ enabled: true, value: false })
      expect(control.definition).toMatchObject({ label: 'Auto Performance', type: 'boolean' })
    })

    it('persists when turned on, and Reset returns it to off', () => {
      const plan = compiled.plan!
      const state = new Cinema2ParameterState(plan.parameters)
      expect(state.setPersistentValue(autoId, true).ok).toBe(true)
      const restored = new Cinema2ParameterState(plan.parameters)
      expect(restored.restore(state.serialize()).ok).toBe(true)
      expect(restored.getValue(autoId)).toBe(true)
      expect(restored.reset(autoId).ok).toBe(true)
      expect(restored.getValue(autoId)).toBe(false)
    })
  })
})
