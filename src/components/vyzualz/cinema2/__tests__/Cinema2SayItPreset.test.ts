import { describe, expect, it } from 'vitest'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_SAY_IT_MODULE_TYPE_ID } from '../modules/Cinema2SayItNativeModule'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import {
  CINEMA2_SAY_IT_LINE_ONE_TEXT_ID,
  CINEMA2_SAY_IT_LINE_TWO_TEXT_ID,
  CINEMA2_SAY_IT_MOTION_PROGRAM_ID,
  CINEMA2_SAY_IT_MOTION_SAFETY_ID,
  CINEMA2_SAY_IT_PRESET_ID,
  CINEMA2_SAY_IT_PRESET_MANIFEST,
} from '../presets/Cinema2SayItPreset'

describe('Cinema 2.0 SAY IT preset', () => {
  it('is a first-party keeper named exactly SAY IT', () => {
    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.metadata.name).toBe('SAY IT')
    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.revision).toBe(5)
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'keeper', manifest: expect.objectContaining({ id: CINEMA2_SAY_IT_PRESET_ID }) }),
    ]))
  })

  it('passes the keeper authoring gate and native compiler', () => {
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_SAY_IT_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compilation = compileCinema2NativePreset(CINEMA2_SAY_IT_PRESET_MANIFEST, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat'],
    })
    expect(compilation.ok, compilation.diagnostics.map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('registers the dedicated native module and gives every visible control a consumer', () => {
    expect(cinema2NativeModuleRegistry.get(CINEMA2_SAY_IT_MODULE_TYPE_ID, 1)).not.toBeNull()
    const bindings = new Set([
      ...Object.keys(CINEMA2_SAY_IT_PRESET_MANIFEST.modules?.[0]?.parameterBindings ?? {}),
      ...(CINEMA2_SAY_IT_PRESET_MANIFEST.effects ?? []).flatMap(effect => Object.keys(effect.parameterBindings ?? {})),
      ...Object.keys(CINEMA2_SAY_IT_PRESET_MANIFEST.environment?.controls ?? {}),
    ])
    expect(bindings).toEqual(new Set([
      'line1Text', 'line2Text', 'lineMode', 'alignment', 'tracking', 'lineSpacing', 'glyphScale',
      'motionAmount', 'motionProgram', 'motionDirection', 'motionSafety', 'glyphDelay', 'axisX', 'axisY', 'axisZ', 'randomSeed',
      'bpmSync', 'cycleSeconds', 'spread', 'materialStyle', 'roughness', 'environmentIntensity', 'highlightSweep', 'color',
      'intensity', 'mix', 'backgroundColor',
    ]))
  })

  it('authors the Step 4 motion vocabulary, performance choreography and post stack', () => {
    const program = CINEMA2_SAY_IT_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_SAY_IT_MOTION_PROGRAM_ID)
    const safety = CINEMA2_SAY_IT_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_SAY_IT_MOTION_SAFETY_ID)
    expect(program).toMatchObject({ type: 'enum', defaultValue: 'tumble' })
    expect(program && 'options' in program ? program.options?.map(option => option.value) : []).toEqual(['flip', 'tumble', 'wave', 'scatter', 'hinge'])
    expect(safety && 'options' in safety ? safety.options?.map(option => option.value) : []).toEqual(['full', 'reduced', 'lockoff'])

    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.choreography?.rules.map(rule => rule.source.signal)).toEqual(expect.arrayContaining([
      'beat', 'downbeat', 'phrase', 'continuous', 'drop',
    ]))
    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.effects?.map(effect => effect.typeId)).toEqual([
      'feedback-trails', 'depth-of-field', 'bloom', 'cinematic-finish',
    ])
    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.render?.passes).toHaveLength(5)
  })

  it('exposes Line 1 and Line 2 as separate single-line text inputs', () => {
    const line1 = CINEMA2_SAY_IT_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_SAY_IT_LINE_ONE_TEXT_ID)
    const line2 = CINEMA2_SAY_IT_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_SAY_IT_LINE_TWO_TEXT_ID)
    expect(line1).toMatchObject({ label: 'Line 1', type: 'string', defaultValue: 'SAY IT' })
    expect(line2).toMatchObject({ label: 'Line 2', type: 'string', defaultValue: '' })
  })
})
