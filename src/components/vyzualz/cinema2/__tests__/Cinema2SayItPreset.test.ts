import { describe, expect, it } from 'vitest'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_SAY_IT_MODULE_TYPE_ID } from '../modules/Cinema2SayItNativeModule'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_SAY_IT_PRESET_ID, CINEMA2_SAY_IT_PRESET_MANIFEST } from '../presets/Cinema2SayItPreset'

describe('Cinema 2.0 SAY IT preset', () => {
  it('is a first-party keeper named exactly SAY IT', () => {
    expect(CINEMA2_SAY_IT_PRESET_MANIFEST.metadata.name).toBe('SAY IT')
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
      ...Object.keys(CINEMA2_SAY_IT_PRESET_MANIFEST.effects?.[0]?.parameterBindings ?? {}),
      ...Object.keys(CINEMA2_SAY_IT_PRESET_MANIFEST.effects?.[1]?.parameterBindings ?? {}),
      ...Object.keys(CINEMA2_SAY_IT_PRESET_MANIFEST.environment?.controls ?? {}),
    ])
    expect(bindings).toEqual(new Set([
      'text', 'lineMode', 'alignment', 'tracking', 'lineSpacing', 'glyphScale',
      'motionAmount', 'bpmSync', 'cycleSeconds', 'spread', 'roughness', 'environmentIntensity', 'highlightSweep', 'color',
      'intensity', 'mix', 'backgroundColor',
    ]))
  })
})
