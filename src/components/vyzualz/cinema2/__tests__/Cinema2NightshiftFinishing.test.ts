import { describe, expect, it } from 'vitest'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST as manifest, CINEMA2_NIGHTSHIFT_PARAMETER_IDS as P } from '../presets/Cinema2NightshiftPreset'
import { NIGHTSHIFT_EFFECT_DEFAULTS, NIGHTSHIFT_EFFECT_IDS } from '../presets/Cinema2NightshiftFinishing'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'

const frame: Cinema2ModuleFrameReadContext = { frameId: 1, timestampMs: 0, elapsedTimeSec: 0, deltaTimeSec: 0,
  viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio: null, director: null }

describe('NIGHTSHIFT shared finishing', () => {
  it('registers shared effects and preserves original scene depth through reflection and haze passes', () => {
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects!).diagnostics).toEqual([])
    const [scene, reflection, haze, bloom, output] = manifest.render!.passes
    expect(manifest.effects!.map(e => e.typeId)).toEqual(['reflective-floor', 'volumetric-atmosphere', 'hdr-bloom'])
    for (const pass of [reflection, haze]) expect(pass.inputs?.find(i => i.attachment === 'depth')?.source.pass.$ref).toBe(scene.id)
    expect(bloom.inputs).toHaveLength(1)
    expect(output.inputs![0].source.pass.$ref).toBe(bloom.id)
    expect(manifest.effects![0].parameters?.floorY).toBeLessThan(-.1)
    expect(manifest.effects![1].parameters?.reactivity).toBe(0)
  })

  it('resolves independent OFF/default/max controls and authoritative gates without audio, including at zero delta', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    const state = new Cinema2ParameterState(result.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(result.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : undefined })
    const choreography = new Cinema2ChoreographyRuntime(result.plan, state, resolver)
    const value = (name: keyof typeof NIGHTSHIFT_EFFECT_IDS) => {
      choreography.update(frame)
      const target = result.plan.targets.targets.find(t => t.kind === 'effect' && t.ownerId === NIGHTSHIFT_EFFECT_IDS[name] && t.property === 'mix')!
      return resolver.resolve(target.id).value as number
    }
    for (const name of ['bloom', 'haze', 'reflections'] as const) {
      const definition = result.plan.parameters.definitions.find(p => p.id === P[name])!
      expect(definition.designParentGroup).toBe('effects')
      expect(value(name)).toBeCloseTo(NIGHTSHIFT_EFFECT_DEFAULTS[name])
      state.setPersistentValue(P[name], 0); expect(value(name)).toBe(0)
      state.setPersistentValue(P[name], 1); expect(value(name)).toBe(1)
    }
    state.setPersistentValue(P.master, 0)
    for (const name of ['bloom', 'haze', 'reflections'] as const) expect(value(name)).toBe(0)
    state.setPersistentValue(P.master, .34)
    expect(value('haze')).toBeCloseTo(.4)
    state.setPersistentValue(P.master, .85)
    state.setPersistentValue(P.floor, 0); expect(value('reflections')).toBe(0)
    expect(value('bloom')).toBe(1)
    state.setPersistentValue(P.floor, .8); state.setPersistentValue(P.coverage, 0)
    expect(value('reflections')).toBe(0)
    expect(state.getValue(P.reflections)).toBe(1)
    expect(choreography.getSnapshot().diagnostics).toEqual([])
  })

  it('raises physical ground-fog density along with opacity and uses drifting billows above the floor', () => {
    const result = compileCinema2NativePreset(manifest)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    const state = new Cinema2ParameterState(result.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(result.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : undefined })
    for (const amount of [0, .35, .7, 1]) {
      state.setPersistentValue(P.haze, amount)
      for (const property of ['mistAmount', 'mix']) {
        const target = result.plan.targets.targets.find(t => t.kind === 'effect' && t.ownerId === NIGHTSHIFT_EFFECT_IDS.haze && t.property === property)!
        expect(resolver.resolve(target.id).value).toBeCloseTo(amount)
      }
    }
    const fog = manifest.effects!.find(e => e.id === NIGHTSHIFT_EFFECT_IDS.haze)!.parameters!
    expect(fog.smokeTexture).toBe(CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID)
    expect(fog.mistFloor).toBeGreaterThan(fog.floorY as number)
    expect(fog.mistHeight).toBeGreaterThanOrEqual(1.5)
    expect(fog.ambientHaze).toBeGreaterThanOrEqual(.5)
    expect(fog.noiseStrength).toBe(1)
    expect(fog.drift).toBeGreaterThan(.1)
  })
})
