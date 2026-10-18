import { describe, expect, it } from 'vitest'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2MarqueeNativeModule'
import {
  CINEMA2_MARQUEE_PATTERN_IDS,
  CINEMA2_MARQUEE_ZERO_IMPULSES,
  CINEMA2_MARQUEE_ZERO_SIGNALS,
  Cinema2MarqueePatternController,
  createCinema2MarqueePatternCycle,
  evaluateCinema2MarqueeFixture,
} from '../modules/marquee/Cinema2MarqueeDomain'
import { displayCinema2MarqueeText, estimateCinema2MarqueeFontSize } from '../modules/marquee/Cinema2MarqueeSceneController'
import { CINEMA2_MARQUEE_ASSET_ID, cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { CINEMA2_MARQUEE_PARAMETER_IDS, CINEMA2_MARQUEE_PRESET_ID, CINEMA2_MARQUEE_PRESET_MANIFEST } from '../presets/Cinema2MarqueePreset'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const manifest = CINEMA2_MARQUEE_PRESET_MANIFEST
const P = CINEMA2_MARQUEE_PARAMETER_IDS
const capabilities = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const

function compileMarquee() {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: capabilities })
  expect(result.ok, result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  if (!result.ok) throw new Error('Expected MARQUEE to compile')
  return result.plan
}

describe('MARQUEE Cinema 2.0 preset', () => {
  it('registers as a visible first-party keeper with the production model and native renderer', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(item => item.manifest.id === CINEMA2_MARQUEE_PRESET_ID)?.role).toBe('keeper')
    expect(manifest.metadata.name).toBe('MARQUEE')
    expect(cinema2ThreeAssetRegistry.has(CINEMA2_MARQUEE_ASSET_ID)).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    expect(compileMarquee().render.passes.map(pass => pass.kind)).toEqual(['scene', 'fullscreen', 'fullscreen', 'fullscreen', 'fullscreen'])
  })

  it('uses exactly the four canonical Inspector parents and puts Pattern, Pattern Change, Trigger first in Design', () => {
    const visible = (manifest.parameters ?? []).filter(parameter => parameter.exposure === 'primary' && parameter.section === 'Design')
    expect(new Set(visible.map(parameter => parameter.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    const design = visible.filter(parameter => parameter.designParentGroup === 'design').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    expect(design.slice(0, 3).map(parameter => parameter.label)).toEqual(['Pattern', 'Pattern Change', 'Trigger'])
    expect(manifest.parameters?.find(parameter => parameter.id === P.trigger)).toMatchObject({ options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS })
    expect(visible.filter(parameter => parameter.designParentGroup === 'palette' && parameter.type === 'color')).toHaveLength(5)
  })

  it('persists independent marquee text, supports blank copy, and restores authored defaults', () => {
    const state = new Cinema2ParameterState(compileMarquee().parameters)
    expect(state.setPersistentValue(P.frontText, '')).toMatchObject({ ok: true })
    expect(state.setPersistentValue(P.leftText, 'TONIGHT')).toMatchObject({ ok: true })
    const restored = new Cinema2ParameterState(compileMarquee().parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(P.frontText)).toBe('')
    expect(restored.getValue(P.leftText)).toBe('TONIGHT')
    expect(restored.reset(P.frontText)).toMatchObject({ ok: true })
    expect(restored.getValue(P.frontText)).toBe('DVYDRM PRESENTS')
    expect(displayCinema2MarqueeText('  A   VERY\nLONG SHOW  ')).toBe('A VERY LONG SHOW')
    expect(estimateCinema2MarqueeFontSize('A VERY LONG SHOW')).toBeLessThan(estimateCinema2MarqueeFontSize('SHOW'))
  })

  it('ships seven spatially distinct lighting programs', () => {
    const addresses = [
      { kind: 'marquee-front' as const, progress: 0.2, row: 0.2 }, { kind: 'marquee-left' as const, progress: 0.7, row: 0.7 },
      { kind: 'canopy' as const, progress: 0.4, row: 0.8 }, { kind: 'tower-right' as const, progress: 0.6, row: 0.25 },
      { kind: 'led-left' as const, progress: 0.8, row: 0.6 }, { kind: 'neon-blue' as const, progress: 0.5, row: 0.5 },
    ]
    const signatures = CINEMA2_MARQUEE_PATTERN_IDS.map(pattern => addresses.map(address => evaluateCinema2MarqueeFixture(address, {
      pattern, beats: 5.25, patternBeats: 5.25,
      signals: { ...CINEMA2_MARQUEE_ZERO_SIGNALS, overall: 0.62, bass: 0.7, mid: 0.42, high: 0.55, build: 0.78 },
      impulses: { ...CINEMA2_MARQUEE_ZERO_IMPULSES, beat: 0.4, kick: 0.6, snare: 0.3 },
    })).map(value => value.toFixed(3)).join(','))
    expect(new Set(signatures).size).toBe(CINEMA2_MARQUEE_PATTERN_IDS.length)
  })

  it('keeps authored pattern authority, advances only on fresh events, and restores after temporary auto overrides', () => {
    const controller = new Cinema2MarqueePatternController(createCinema2MarqueePatternCycle(() => 0.25))
    const base = { authoredPattern: 'opening-night' as const, patternChange: true, trigger: 'bar4' as const, triggerEventId: null, absoluteBeat: 0, autoPerformance: true, build: 0, dropEventId: null }
    expect(controller.update(base).activePattern).toBe('opening-night')
    const changed = controller.update({ ...base, triggerEventId: 'bar-4', absoluteBeat: 4 })
    expect(changed.activePattern).not.toBe('opening-night')
    expect(controller.update({ ...base, triggerEventId: 'bar-4', absoluteBeat: 5 }).activePattern).toBe(changed.activePattern)
    expect(controller.update({ ...base, triggerEventId: 'bar-4', absoluteBeat: 6, dropEventId: 'drop-1' }).activePattern).toBe('premiere-burst')
    expect(controller.update({ ...base, triggerEventId: 'bar-4', absoluteBeat: 11, dropEventId: 'drop-1' }).activePattern).toBe(changed.basePattern)
  })
})
