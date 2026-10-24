import { describe, expect, it } from 'vitest'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { CINEMA2_NIGHTSHIFT_PRESET_ID, CINEMA2_NIGHTSHIFT_PRESET_MANIFEST, CINEMA2_NIGHTSHIFT_PARAMETER_IDS as P } from '../presets/Cinema2NightshiftPreset'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_NIGHTSHIFT_PATTERNS, evaluateNightshiftCell, NightshiftPatternController } from '../modules/nightshift/Cinema2NightshiftDomain'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { cinema2ThreeEnvironmentRegistry } from '../modules/three/Cinema2ThreeEnvironmentRegistry'

describe('NIGHTSHIFT authorship and motion', () => {
  it('compiles on the native production path with registered geometry, reflection environment and depth', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST, { availableCapabilities: ['render.webgl2'] })
    expect(compiled.diagnostics.every(d => d.code === 'CINEMA2_PRESET_OPTIONAL_CAPABILITY_UNAVAILABLE' && d.severity === 'warning')).toBe(true)
    expect(compiled.ok).toBe(true)
    expect(cinema2NativeModuleRegistry.validateModules(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST.modules!).ok).toBe(true)
    expect(cinema2ThreeAssetRegistry.has('cinema2-nightshift-static')).toBe(true)
    expect(cinema2ThreeEnvironmentRegistry.has('cinema2-nightshift-room')).toBe(true)
    expect(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST.render!.targets![0].descriptor.depthFormat).toBe('depth24')
  })

  it('places functional manual controls in canonical parents and conditionally exposes the shared Trigger list', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const groups = () => createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())
    const controls = (parent: string) => {
      const p = groups().find(g => g.id === parent)!
      return [...p.controls, ...p.groups.flatMap(g => g.controls)].map(c => c.definition)
    }
    expect(controls('master-controls').find(c => c.id === P.bpmSync)?.type).toBe('boolean')
    expect(controls('master-controls').find(c => c.id === P.autoPerformance)?.defaultValue).toBe(false)
    expect(controls('palette').filter(c => c.type === 'color')).toHaveLength(7)
    expect(controls('design').some(c => c.id === P.trigger)).toBe(false)
    state.setPersistentValue(P.patternChange, true)
    expect(controls('design').find(c => c.id === P.trigger)?.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(controls('design').filter(c => [P.pattern, P.patternChange, P.trigger].includes(c.id as typeof P.pattern)).map(c => c.label)).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
    const revision = state.getEditRevision(P.pattern)
    state.setPersistentValue(P.pattern, 'nightshift')
    expect(state.getEditRevision(P.pattern)).toBe(revision + 1)
    state.reset(P.pattern)
    expect(state.getEditRevision(P.pattern)).toBe(revision + 2)
    state.setPersistentValue(P.pattern, 'missing-pattern')
    expect(state.getEditRevision(P.pattern)).toBe(revision + 2)
    expect(state.getValue(P.patternChange)).toBe(true)
    state.setPersistentValue(P.autoPerformance, true)
    state.setPersistentValue(P.pattern, 'nightshift')
    expect(state.getValue(P.autoPerformance)).toBe(true)
    expect(state.getValue(P.patternChange)).toBe(true)
    expect(state.serialize()).not.toContain('editRevision')
  })

  it('groups Signs under Design and conditionally shows the locked NIGHTSHIFT input', () => {
    const result = compileCinema2NativePreset(CINEMA2_NIGHTSHIFT_PRESET_MANIFEST)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    const state = new Cinema2ParameterState(result.plan.parameters)
    const groups = () => createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
    const signs = () => groups().find(g => g.id === 'design')!.groups.find(g => g.label === 'Signs')!
    expect(signs().controls.map(c => c.definition.id)).toEqual([P.signs])
    expect(state.getValue(P.signs)).toBe(false)
    state.setPersistentValue(P.signs, true)
    expect(signs().controls.map(c => c.definition.label)).toEqual(['Enable Signs', 'Sign Text', 'Sign Size'])
    const text = signs().controls[1]
    expect(text.value).toBe('NIGHTSHIFT')
    expect(text.enabled).toBe(false)
    expect(text.definition.type).toBe('string')
    expect(state.setPersistentValue(P.signText, 'EDIT')).toMatchObject({ ok: false })
    expect(signs().controls[2].enabled).toBe(true)
    expect(signs().controls[2].value).toBe(1)
    state.setPersistentValue(P.signSize, 1.5)
    state.setPersistentValue(P.signColor, [1, .2, .3, 1])
    const restored = new Cinema2ParameterState(result.plan.parameters)
    restored.restore(state.serialize())
    expect(restored.getValue(P.signs)).toBe(true)
    expect(restored.getValue(P.signSize)).toBe(1.5)
    expect(restored.getValue(P.signColor)).toEqual([1, .2, .3, 1])
  })

  it('has eight spatially distinct native programs and a hard zero coverage state', () => {
    const cells = Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i / 10), column: i % 10, paletteIndex: i % 4, level: i % 3 }))
    const signatures = CINEMA2_NIGHTSHIFT_PATTERNS.map(p => JSON.stringify(cells.map(c => evaluateNightshiftCell(c, p.value, 2.5, .75))))
    expect(new Set(signatures).size).toBe(8)
    for (const p of CINEMA2_NIGHTSHIFT_PATTERNS) expect(cells.every(c => evaluateNightshiftCell(c, p.value, 2.5, 0).gain === 0)).toBe(true)
  })

  it('keeps the default program visibly travelling after opening accents have expired', () => {
    const cells = Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i / 10), column: i % 10, paletteIndex: i % 4, level: 2 }))
    for (const phase of [0, 120, 240, 480]) {
      const before = cells.map(c => evaluateNightshiftCell(c, 'nightshift', phase, 1).gain)
      const after = cells.map(c => evaluateNightshiftCell(c, 'nightshift', phase + 1, 1).gain)
      expect(before.some(gain => gain < .08)).toBe(true)
      expect(before.some(gain => gain > .9)).toBe(true)
      expect(after.reduce((sum, gain, i) => sum + Math.abs(gain - before[i]), 0) / cells.length).toBeGreaterThan(.25)
    }
  })

  it('suppresses stale/duplicate events and honors same-value manual selection without disabling Pattern Change', () => {
    const controller = new NightshiftPatternController()
    const update = (event: string | null, edit = 0, reset = false) => controller.update('nightshift', true, 'beat', event, edit, reset)
    expect(update('beat0')).toBe('nightshift')
    expect(update('beat1')).toBe('crossfade-checker')
    expect(update(null)).toBe('crossfade-checker')
    expect(update('beat1')).toBe('crossfade-checker')
    expect(update('beat1', 1)).toBe('nightshift')
    expect(update('beat1', 1)).toBe('nightshift')
    expect(update('beat2', 1)).toBe('crossfade-checker')
    expect(update('beat2', 1, true)).toBe('nightshift')
  })

  it('registers the accepted keeper with functional controls and bounded shared automation', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(p => p.manifest.id === CINEMA2_NIGHTSHIFT_PRESET_ID)!
    expect(declaration.role).toBe('keeper')
    expect(declaration.manifest.metadata.name).toBe('NIGHTSHIFT')
    expect(declaration.manifest.metadata.tags).not.toContain('internal')
    expect(declaration.manifest.metadata.tags).toContain('keeper')
    expect(declaration.manifest.metadata.tags).not.toContain('preview')
    expect(validateCinema2PresetAuthoringConventions(declaration).diagnostics).toEqual([])
    expect(declaration.manifest.choreography?.rules).toHaveLength(14)
    expect(declaration.manifest.choreography?.rules.filter(rule => rule.source.path?.startsWith('director.'))).toHaveLength(4)
    expect(declaration.manifest.choreography?.rules.filter(rule => rule.source.signal !== 'parameter').every(rule => rule.source.signal === 'continuous' && rule.actions.every(a => a.target.kind === 'module'))).toBe(true)
    expect(declaration.manifest.effects).toHaveLength(3)
    expect(declaration.manifest.cameras![0].rig!.kind).toBe('static')
  })
})
