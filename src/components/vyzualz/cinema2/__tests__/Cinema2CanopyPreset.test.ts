import { describe, expect, it } from 'vitest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CANOPY_PATTERN_IDS } from '../modules/canopy/Cinema2CanopyDomain'
import { CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2CanopyNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_CANOPY_MUSICAL_CUE_ID, CINEMA2_CANOPY_PARAMETER_IDS, CINEMA2_CANOPY_PRESET_ID, CINEMA2_CANOPY_PRESET_MANIFEST } from '../presets/Cinema2CanopyPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_SHARED_LIGHT_LIMIT } from '../contracts/Cinema2NativePresetManifest'

const P = CINEMA2_CANOPY_PARAMETER_IDS
const manifest = CINEMA2_CANOPY_PRESET_MANIFEST
const parameters = manifest.parameters ?? []
const design = parameters.filter(parameter => parameter.id !== CINEMA2_QUALITY_MODE_PARAMETER_ID && parameter.exposure !== 'hidden')
const inGroup = (group: string) => design.filter(parameter => parameter.designParentGroup === group)
const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0)

describe('Cinema 2.0 CANOPY preset', () => {
  it('registers once as a compilable keeper that passes the authoring conventions', () => {
    const declarations = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.filter(candidate => candidate.manifest.id === CINEMA2_CANOPY_PRESET_ID)
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ role: 'keeper' })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: new Set(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world']) })
    expect(compiled.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
    expect(compiled.ok).toBe(true)
  })

  it('keeps unique preset and parameter ids', () => {
    expect(new Set(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.map(candidate => candidate.manifest.id)).size).toBe(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.length)
    expect(new Set(parameters.map(parameter => parameter.id)).size).toBe(parameters.length)
  })

  describe('the four Design parent groups', () => {
    it('puts every user-facing parameter under exactly one of Master Controls, Design, Effects and Palette, and fills each', () => {
      for (const parameter of design) expect(['master-controls', 'design', 'effects', 'palette'], parameter.id).toContain(parameter.designParentGroup)
      for (const group of ['master-controls', 'design', 'effects', 'palette']) expect(inGroup(group).length, group).toBeGreaterThan(0)
    })

    it('lays the Inspector out as the plan describes', () => {
      const labels = (group: string) => inGroup(group).sort(byOrder).map(parameter => `${parameter.group}: ${parameter.label}`)
      expect(labels('master-controls')).toEqual(['Output: Master Intensity', 'Timing: BPM Sync', 'Performance: Auto Performance'])
      expect(labels('design')).toEqual([
        'Pattern: Pattern', 'Pattern: Pattern Change', 'Pattern: Trigger',
        'Structure: Rows', 'Structure: Columns', 'Structure: Row Spacing', 'Structure: Column Spacing', 'Structure: Rod Length', 'Structure: Length Variation',
        'Motion: Motion Amount', 'Motion: Motion Speed', 'Motion: Height Range', 'Motion: Symmetry',
      ])
      expect(labels('effects')).toEqual(['Light: Idle Glow', 'Light: Accent Strength', 'Light: Bloom Amount', 'Camera: Camera Motion'])
      expect(labels('palette')).toEqual(['Roles: Background', 'Roles: Primary Rods', 'Roles: Secondary Rods', 'Roles: Accent Hits', 'Roles: Mounting Structure'])
    })
  })

  describe('the mandatory shared controls', () => {
    it('has BPM Sync as a primary boolean under Master Controls, on by default', () => {
      expect(design.find(parameter => parameter.id === P.bpmSync)).toMatchObject({ type: 'boolean', exposure: 'primary', designParentGroup: 'master-controls', defaultValue: true })
    })

    it('exposes Pattern, Pattern Change and Trigger together under Design, in that order', () => {
      const pattern = inGroup('design').filter(parameter => parameter.group === 'Pattern').sort(byOrder)
      expect(pattern.map(parameter => parameter.label)).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
      const [patternControl, patternChange, trigger] = pattern as [typeof pattern[0], typeof pattern[0], typeof pattern[0]]
      expect(patternControl).toMatchObject({ type: 'enum', defaultValue: 'waterfall' })
      expect(patternControl.options?.map(option => option.value)).toEqual([...CANOPY_PATTERN_IDS])
      expect(patternControl.options?.map(option => option.label)).toEqual(['Waterfall', 'Crosswave', 'Crown', 'Split Wings', 'Checker Lift', 'Downpour'])
      expect(patternChange).toMatchObject({ type: 'boolean', defaultValue: false })
      expect(trigger).toMatchObject({ type: 'enum', defaultValue: 'bar4' })
    })

    it('uses exactly the 11 canonical Trigger options, visible only while Pattern Change is on, and keeps the value when hidden', () => {
      const trigger = parameters.find(parameter => parameter.id === P.trigger)!
      expect(trigger.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
      expect(trigger.options).toHaveLength(11)
      expect(trigger.visibleWhen).toEqual([{ kind: 'parameter-equals', parameterId: P.patternChange, value: true }])
      expect(trigger.persistence).toBe('preset')
    })

    it('does not tie Pattern edits or Pattern Change to Auto Performance', () => {
      for (const id of [P.pattern, P.patternChange, P.trigger]) expect(parameters.find(parameter => parameter.id === id)?.metadata?.userEditSetParameters, id).toBeUndefined()
      expect(parameters.find(parameter => parameter.id === P.autoPerformance)).toMatchObject({ type: 'boolean', defaultValue: false })
    })

    it('has five independent colours under Palette, each bound to its own module value', () => {
      const colours = inGroup('palette').sort(byOrder)
      expect(colours.every(parameter => parameter.type === 'color')).toBe(true)
      const bindings = manifest.modules![0]!.parameterBindings ?? {}
      const bound = colours.filter(colour => Object.values(bindings).some(ref => ref.$ref === colour.id)).map(colour => colour.label)
      expect(bound).toEqual(['Primary Rods', 'Secondary Rods', 'Accent Hits', 'Mounting Structure'])
      // Background is not a module value: it drives the engine's environment.
      expect(manifest.environment?.controls?.backgroundColor).toEqual({ $ref: P.background })
      const defaults = colours.map(colour => JSON.stringify(colour.defaultValue))
      expect(new Set(defaults).size).toBe(5)
    })
  })

  describe('wiring', () => {
    it('gives every bound control a real module value with the same default', () => {
      const module = manifest.modules![0]!
      for (const [key, ref] of Object.entries(module.parameterBindings ?? {})) {
        const parameter = parameters.find(candidate => candidate.id === ref.$ref)
        expect(parameter, key).toBeDefined()
        expect(module.parameters?.[key], key).toEqual(parameter!.defaultValue)
      }
    })

    it('gives every user-facing control exactly one consumer: module, environment, bloom effect or camera', () => {
      const module = manifest.modules![0]!
      const consumers = new Set<string>([
        ...Object.values(module.parameterBindings ?? {}).map(ref => ref.$ref),
        manifest.environment!.controls!.backgroundColor!.$ref,
        ...manifest.effects!.flatMap(effect => Object.values(effect.parameterBindings ?? {}).map(ref => ref.$ref)),
        ...manifest.cameras!.flatMap(camera => Object.values(camera.controls ?? {}).map(ref => ref.$ref)),
      ])
      for (const parameter of design) expect(consumers.has(parameter.id), parameter.label).toBe(true)
    })

    it('binds Bloom Amount to the bloom intensity and Camera Motion to the camera motion amount', () => {
      const [bloom] = manifest.effects!
      expect(bloom!.typeId).toBe(CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID)
      expect(bloom!.parameterBindings).toEqual({ intensity: { $ref: P.bloom } })
      expect(manifest.cameras![0]!.controls).toEqual({ motionAmount: { $ref: P.cameraMotion } })
      expect(parameters.find(parameter => parameter.id === P.cameraMotion)).toMatchObject({ defaultValue: 0, min: 0, max: 1 })
    })

    it('keeps the camera fixed at default and every rod light inside the shader', () => {
      expect(manifest.lighting?.lights ?? []).toHaveLength(0)
      expect(CINEMA2_SHARED_LIGHT_LIMIT).toBeGreaterThanOrEqual(0)
      expect(manifest.cameras![0]!.rig).toEqual({ kind: 'static' })
    })

    it('chains a depth-bearing scene pass into bloom and then the finish', () => {
      const render = manifest.render!
      expect(render.passes?.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen'])
      expect(render.targets![0]!.descriptor).toMatchObject({ depthFormat: 'depth24', colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' })
      expect(manifest.effects?.map(effect => effect.typeId)).toEqual([CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID])
      expect(manifest.layers![0]).toMatchObject({ role: 'world', depthPolicy: 'read-write' })
    })
  })

  describe('choreography', () => {
    const rules = manifest.choreography?.rules ?? []
    const cueRules = rules.filter(rule => rule.actions[0]!.operation === 'spawn')

    it('delivers the nine shared musical cues through a hidden runtime-only trigger bound to the module', () => {
      const cue = parameters.find(parameter => parameter.id === CINEMA2_CANOPY_MUSICAL_CUE_ID)!
      expect(cue).toMatchObject({ type: 'trigger', exposure: 'hidden', persistence: 'runtime-only', reset: 'none' })
      expect(manifest.modules![0]!.actionBindings).toEqual({ musicalCue: { $ref: CINEMA2_CANOPY_MUSICAL_CUE_ID } })
      expect(cueRules.map(rule => rule.source.signal)).toEqual(['kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section-change', 'drop'])
    })

    it('names each action the way the shared music adapter recognises a delivery', () => {
      for (const rule of cueRules) {
        const kind = (rule.actions[0]!.value as { kind: string }).kind
        expect(rule.actions[0]!.id).toBe(`mainframe-${kind === 'fourBeat' ? 'four-beat' : kind}-cue`)
      }
    })

    it('declares a capability for every signal a rule reads', () => {
      const declared = new Set((manifest.capabilities ?? []).map(capability => capability.id))
      for (const rule of rules) expect(declared.has(rule.source.capability!), rule.id).toBe(true)
    })

    it('limits Auto Performance\'s bloom swell to a multiplication, so a Bloom Amount of 0 can never be lit by it', () => {
      const swell = rules.find(rule => rule.actions[0]!.operation === 'envelope')!
      expect(swell.enabledParameter).toEqual({ $ref: P.autoPerformance })
      expect(swell.actions[0]).toMatchObject({ composition: 'multiply', target: { kind: 'effect', property: 'intensity' } })
      expect(swell.actions[0]!.value as number).toBeLessThanOrEqual(1.6)
    })
  })

  it('declares only capabilities the preset actually uses', () => {
    const ids = (manifest.capabilities ?? []).map(capability => capability.id)
    for (const required of ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world']) expect(ids).toContain(required)
    expect(manifest.capabilities!.filter(capability => capability.requirement === 'required').map(capability => capability.id)).toEqual(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'])
  })
})
