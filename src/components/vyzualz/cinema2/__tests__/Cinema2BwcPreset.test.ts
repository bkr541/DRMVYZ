import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_BWC_PATTERN_IDS } from '../modules/bwc/Cinema2BwcPatternEngine'
import { createCinema2BwcNativeModuleDefinition, CINEMA2_BWC_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BwcNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_BWC_MUSICAL_CUE_ID, CINEMA2_BWC_PARAMETER_IDS, CINEMA2_BWC_PRESET_ID, CINEMA2_BWC_PRESET_MANIFEST } from '../presets/Cinema2BwcPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'

describe('Cinema 2.0 BWC preset', () => {
  it('registers as a compilable keeper that passes the authoring conventions', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_BWC_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_BWC_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_BWC_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    expect(compileCinema2NativePreset(CINEMA2_BWC_PRESET_MANIFEST, { availableCapabilities: new Set(['render.webgl2']) }).ok).toBe(true)
    expect(CINEMA2_BWC_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_BWC_PARAMETER_IDS.portalScale)).toMatchObject({ label: 'Portal Scale', designParentGroup: 'design' })
  })

  describe('the four Design parent groups', () => {
    const parameters = CINEMA2_BWC_PRESET_MANIFEST.parameters ?? []
    const design = parameters.filter(parameter => parameter.id !== CINEMA2_QUALITY_MODE_PARAMETER_ID && parameter.exposure !== 'hidden')
    const inGroup = (group: string) => design.filter(parameter => parameter.designParentGroup === group)

    it('puts every user-facing Design parameter under exactly one of Master Controls, Design, Effects and Palette, and fills each', () => {
      for (const parameter of design) expect(['master-controls', 'design', 'effects', 'palette'], parameter.id).toContain(parameter.designParentGroup)
      for (const group of ['master-controls', 'design', 'effects', 'palette']) expect(inGroup(group).length, group).toBeGreaterThan(0)
    })

    it('has Master Intensity, BPM Sync and Conveyor Speed under Master Controls, with BPM Sync a primary boolean', () => {
      const master = inGroup('master-controls').map(parameter => parameter.label)
      expect(master).toEqual(expect.arrayContaining(['Master Intensity', 'Auto Performance', 'BPM Sync', 'Conveyor Speed', 'Light Reactivity']))
      expect(design.find(parameter => parameter.id === CINEMA2_BWC_PARAMETER_IDS.bpmSync)).toMatchObject({ type: 'boolean', exposure: 'primary', designParentGroup: 'master-controls' })
    })

    it('exposes Pattern, Pattern Change and Trigger together under Design, in that order', () => {
      const lighting = inGroup('design').filter(parameter => parameter.group === 'Lighting').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      expect(lighting.map(parameter => parameter.label)).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
      const [pattern, patternChange, trigger] = lighting as [typeof lighting[0], typeof lighting[0], typeof lighting[0]]
      expect(pattern).toMatchObject({ type: 'enum', defaultValue: 'flow' })
      expect(pattern.options?.map(option => option.value)).toEqual([...CINEMA2_BWC_PATTERN_IDS])
      expect((pattern.options ?? []).length).toBeGreaterThanOrEqual(6)
      expect(patternChange).toMatchObject({ type: 'boolean', defaultValue: false })
      expect(trigger).toMatchObject({ type: 'enum', defaultValue: 'bar4' })
      expect(trigger.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
      expect(trigger.options).toHaveLength(11)
      expect(trigger.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: CINEMA2_BWC_PARAMETER_IDS.patternChange, value: true }])
    })

    it('has five independent colours under Palette, each bound to its own module value', () => {
      const colours = inGroup('palette')
      expect(colours.map(parameter => parameter.label)).toEqual(['Reactor', 'Pipes', 'Wall LEDs', 'Ceiling Lights', 'Machine Structure'])
      for (const parameter of colours) expect(parameter.type).toBe('color')
      const bindings = CINEMA2_BWC_PRESET_MANIFEST.modules![0]!.parameterBindings ?? {}
      const keys = Object.entries(bindings).filter(([, ref]) => colours.some(parameter => parameter.id === ref.$ref)).map(([key]) => key)
      expect(keys.sort()).toEqual(['ceilingColor', 'pipeColor', 'reactorColor', 'structureColor', 'wallColor'])
    })

    it('has a real module value behind every bound control, and a default for each', () => {
      const module = CINEMA2_BWC_PRESET_MANIFEST.modules![0]!
      for (const [key, ref] of Object.entries(module.parameterBindings ?? {})) {
        const parameter = parameters.find(candidate => candidate.id === ref.$ref)
        expect(parameter, key).toBeDefined()
        expect(module.parameters?.[key], key).toEqual(parameter!.defaultValue)
      }
    })
  })

  describe('choreography and Auto Performance', () => {
    const rules = CINEMA2_BWC_PRESET_MANIFEST.choreography?.rules ?? []

    it('delivers the nine shared musical cues through a hidden runtime-only trigger bound to the module', () => {
      const cue = CINEMA2_BWC_PRESET_MANIFEST.parameters!.find(parameter => parameter.id === CINEMA2_BWC_MUSICAL_CUE_ID)!
      expect(cue).toMatchObject({ type: 'trigger', exposure: 'hidden', persistence: 'runtime-only', reset: 'none' })
      expect(CINEMA2_BWC_PRESET_MANIFEST.modules![0]!.actionBindings).toEqual({ musicalCue: { $ref: CINEMA2_BWC_MUSICAL_CUE_ID } })
      expect(rules.map(rule => rule.source.signal)).toEqual(['kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section-change', 'drop'])
      for (const rule of rules) {
        expect(rule.actions).toHaveLength(1)
        expect(rule.actions[0]).toMatchObject({ target: { kind: 'parameter', ref: { $ref: CINEMA2_BWC_MUSICAL_CUE_ID } }, operation: 'spawn' })
      }
    })

    it('names each action the way the shared music adapter recognises a delivery', () => {
      // The runtime delivers `<event id>:<action id>`, and the adapter accepts only `:mainframe-<kind>-cue`.
      for (const rule of rules) {
        const kind = (rule.actions[0]!.value as { kind: string }).kind
        expect(rule.actions[0]!.id).toBe(`mainframe-${kind === 'fourBeat' ? 'four-beat' : kind}-cue`)
      }
    })

    it('declares a capability for every signal a rule reads', () => {
      const declared = new Set((CINEMA2_BWC_PRESET_MANIFEST.capabilities ?? []).map(capability => capability.id))
      for (const rule of rules) expect(declared.has(rule.source.capability!), rule.id).toBe(true)
    })

    it('has Auto Performance on by default under Master Controls, and leaves Pattern, Pattern Change and Trigger independent of it', () => {
      const parameters = CINEMA2_BWC_PRESET_MANIFEST.parameters!
      expect(parameters.find(parameter => parameter.id === CINEMA2_BWC_PARAMETER_IDS.autoPerformance)).toMatchObject({ type: 'boolean', defaultValue: true, designParentGroup: 'master-controls' })
      // Pattern edits must not switch Auto Performance off, and Pattern Change must not either: they are distinct controls.
      for (const id of [CINEMA2_BWC_PARAMETER_IDS.pattern, CINEMA2_BWC_PARAMETER_IDS.patternChange, CINEMA2_BWC_PARAMETER_IDS.trigger]) {
        expect(parameters.find(parameter => parameter.id === id)?.metadata?.userEditSetParameters, id).toBeUndefined()
      }
    })
  })

  describe('effects', () => {
    it('chains the scene into bloom and then the finish, through float targets', () => {
      const render = CINEMA2_BWC_PRESET_MANIFEST.render!
      expect(render.passes?.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen'])
      expect(render.outputPass).toEqual(render.passes![2]!.id ? { $ref: render.passes![2]!.id } : null)
      expect(CINEMA2_BWC_PRESET_MANIFEST.effects?.map(effect => effect.typeId)).toEqual([CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID])
      for (const target of render.targets ?? []) expect(target.descriptor).toMatchObject({ colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' })
    })

    it('binds Bloom to the bloom intensity and Cinematic Finish to the finish mix', () => {
      const [bloom, finish] = CINEMA2_BWC_PRESET_MANIFEST.effects!
      expect(bloom!.parameterBindings).toEqual({ intensity: { $ref: CINEMA2_BWC_PARAMETER_IDS.bloom } })
      expect(finish!.parameterBindings).toEqual({ mix: { $ref: CINEMA2_BWC_PARAMETER_IDS.finish } })
      // The picture is already tone-mapped, so the finish keeps the scene's own curve.
      expect(finish!.parameters).toMatchObject({ toneMap: 0 })
    })
  })

  it('passes authored static geometry and palette values to the renderer', () => {
    const moduleManifest = CINEMA2_BWC_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    values.set('portalScale', 1.2)
    values.set('canScale', 0.8)
    values.set('conveyorWidth', 1.15)
    values.set('ledStrength', 1.25)
    const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
    const draw = vi.fn()
    const renderer = { draw, dispose: vi.fn(), estimateGpuBytes: () => 16384 }
    const definition = createCinema2BwcNativeModuleDefinition({ createRenderer: () => renderer })
    const resources = { acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer) => create({} as WebGL2RenderingContext), reportGpuBytes: vi.fn(), getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 16384 }) }
    const instance = definition.create({ module: moduleManifest, parameters, targets: {}, media: {}, resources, randomness: { sample: () => 0.5 } } as unknown as Cinema2ModuleCreateContext)
    instance.render!.providers[0]!.execute({ target: null, width: 1280, height: 720, frame: { elapsedTimeSec: 2 } } as never)
    expect(draw.mock.calls[0]![0]).toMatchObject({ width: 1280, height: 720, portalScale: 1.2, canScale: 0.8, conveyorWidth: 1.15, ledStrength: 1.25 })
    expect(resources.reportGpuBytes).toHaveBeenCalledWith(16384)
  })
})
