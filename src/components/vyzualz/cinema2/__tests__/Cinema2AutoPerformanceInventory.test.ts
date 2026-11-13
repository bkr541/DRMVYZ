import { describe, expect, it } from 'vitest'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat',
  'music.downbeat', 'music.bar', 'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop', 'visual-director.significance',
  'media.image', 'media.video', 'media.svg',
] as const

const userFacing = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(declaration => !declaration.manifest.metadata.tags?.includes('internal'))
const isAutoPerformance = (parameter: { id: string; label: string }) => /auto.?performance/i.test(`${parameter.id} ${parameter.label}`)

/** Presets that gained the toggle with this work. Every other user-facing preset already had one, and keeps its own implementation. */
const ADDED = [
  'electric-storm', 'reactor', 'threshold', 'go-to', 'reliquary', 'war-of-worlds', 'mainframe', 'backstreet',
  'user-model-form', 'user-model-shatter', 'user-model-dust', 'user-model-hologram', 'user-model-slices', 'user-model-voxel',
] as const

describe('Auto Performance across the Cinema 2.0 catalog', () => {
  it('is present exactly once, as a boolean under Design > Master Controls, on every user-facing preset', () => {
    expect(userFacing.length).toBeGreaterThan(40)
    for (const { manifest } of userFacing) {
      const matches = (manifest.parameters ?? []).filter(isAutoPerformance)
      expect(matches, manifest.id).toHaveLength(1)
      expect(matches[0], manifest.id).toMatchObject({ label: 'Auto Performance', type: 'boolean', designParentGroup: 'master-controls' })
    }
  })

  it('leaves out only the hidden runtime foundations and diagnostics', () => {
    const without = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(({ manifest }) => !(manifest.parameters ?? []).some(isAutoPerformance))
    expect(without.map(({ manifest }) => manifest.id.replace('drmvyz.cinema2.', '')).sort()).toEqual(['foundation', 'reference-visual', 'spatial-reference', 'three-model-reference'])
    for (const { manifest } of without) expect(manifest.metadata.tags, manifest.id).toContain('internal')
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
