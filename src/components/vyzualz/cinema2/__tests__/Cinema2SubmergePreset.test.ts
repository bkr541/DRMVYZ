import { describe, expect, it } from 'vitest'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_SUBMERGE_PRESET_ID, CINEMA2_SUBMERGE_PRESET_MANIFEST } from '../presets/Cinema2SubmergePreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_SUBMERGE_MODULE_TYPE_ID } from '../modules/Cinema2SubmergeNativeModule'
import { CINEMA2_SUBMERGE_PATTERNS, DEFAULT_SUBMERGE_STATE, resolveSubmergeGlyphPoses, submergePatternFromController, submergePatternToController } from '../modules/submerge/Cinema2SubmergeMotion'
import { createCinema2SubmergeNativeModuleDefinition } from '../modules/Cinema2SubmergeNativeModule'
import type { Cinema2SayItModuleInspection } from '../modules/Cinema2SayItNativeModule'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import { createTextDraft, textContentError, textLines, textParameters } from '../text/Cinema2TextConfiguration'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2SayItGlyphPose } from '../modules/sayIt/Cinema2SayItMotion'

const manifest = CINEMA2_SUBMERGE_PRESET_MANIFEST
const poses: readonly Cinema2SayItGlyphPose[] = [
  { id: 'a', character: 'A', mesh: 'glyph-A', position: [-1, 0.4, 0], rotation: [0, 0, 0], scale: 1 },
  { id: 'b', character: 'B', mesh: 'glyph-B', position: [1, -0.4, 0], rotation: [0, 0, 0], scale: 1 },
]

describe('Cinema 2.0 SUBMERGE', () => {
  it('compiles through the production registry and meets keeper authoring conventions', () => {
    expect(cinema2NativePresetRegistry.compile(CINEMA2_SUBMERGE_PRESET_ID).ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toEqual({ ok: true, diagnostics: [] })
    expect(cinema2NativeModuleRegistry.get(CINEMA2_SUBMERGE_MODULE_TYPE_ID, 1)).toBeTruthy()
    expect(new Set(manifest.parameters!.filter(parameter => parameter.designParentGroup != null).map(parameter => parameter.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(manifest.render!.passes.length).toBeGreaterThanOrEqual(4)
    expect(manifest.scene!.nodes.length).toBeGreaterThan(0)
  })

  it('uses six native geometric patterns with the standard change toggle and exact trigger options', () => {
    expect(manifest.parameters!.find(parameter => parameter.id === 'submerge-pattern')).toMatchObject({ defaultValue: 'suspension', options: CINEMA2_SUBMERGE_PATTERNS, designParentGroup: 'effects', group: 'Pattern' })
    expect(manifest.parameters!.find(parameter => parameter.id === 'submerge-pattern-change')).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(manifest.parameters!.find(parameter => parameter.id === 'submerge-trigger')).toMatchObject({ defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: 'submerge-pattern-change', value: true }] })
    const signatures = CINEMA2_SUBMERGE_PATTERNS.map(({ value }) => {
      expect(submergePatternFromController(submergePatternToController(value))).toBe(value)
      return JSON.stringify(resolveSubmergeGlyphPoses(poses, value, 4.3, DEFAULT_SUBMERGE_STATE))
    })
    expect(new Set(signatures).size).toBe(6)
  })

  it('bounds all glyph motion, honors Lock Off and responds geometrically to bass energy', () => {
    for (const { value } of CINEMA2_SUBMERGE_PATTERNS) {
      for (const beat of [0, 1, 4, 9, 60, 600]) {
        const moved = resolveSubmergeGlyphPoses(poses, value, beat, { ...DEFAULT_SUBMERGE_STATE, bass: 1, highs: 1, energy: 1, amount: 1, reach: 1.5 })
        for (let index = 0; index < poses.length; index += 1) {
          moved[index]!.position.forEach((coordinate, axis) => expect(Math.abs(coordinate - poses[index]!.position[axis]!)).toBeLessThan(0.7))
          expect(moved[index]!.rotation.every(Number.isFinite)).toBe(true)
        }
      }
      expect(resolveSubmergeGlyphPoses(poses, value, 8, { ...DEFAULT_SUBMERGE_STATE, safety: 'lockoff' })).toEqual(poses)
    }
    expect(resolveSubmergeGlyphPoses(poses, 'pressure-wave', 3, { ...DEFAULT_SUBMERGE_STATE, bass: 1 })).not.toEqual(resolveSubmergeGlyphPoses(poses, 'pressure-wave', 3, DEFAULT_SUBMERGE_STATE))
  })

  it('supports bounded two-line edits and per-preset saved Text Scenes', () => {
    const draft = createTextDraft('drmvyz.cinema2.submerge')
    expect(draft.setPersistentValues({ 'submerge-line-mode': 'two', 'submerge-text': 'DEEP', 'submerge-line-2-text': 'WATER', 'submerge-material-style': 'glass' }).ok).toBe(true)
    const parameters = textParameters('drmvyz.cinema2.submerge', draft)
    expect(textLines('drmvyz.cinema2.submerge', parameters)).toEqual(['DEEP', 'WATER'])
    expect(textContentError('drmvyz.cinema2.submerge', parameters)).toBeNull()
    expect(textContentError('drmvyz.cinema2.submerge', { ...parameters, 'submerge-text': 'A'.repeat(13) })).toContain('12 characters')
    expect(textContentError('drmvyz.cinema2.submerge', { ...parameters, 'submerge-text': '🫧' })).toContain('SUBMERGE')
  })

  it('updates the shared glyph lifecycle without loading GPU assets or mutating its manifest', () => {
    const source = manifest.modules![0]!
    const values = new Map(Object.entries(source.parameters!))
    values.set('line1Text', 'DEEP'); values.set('line2Text', 'WATER'); values.set('pattern', 'vortex')
    const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
    const instance = createCinema2SubmergeNativeModuleDefinition().create({ module: source, parameters, targets: {}, media: {}, resources: {}, randomness: {} } as unknown as Cinema2ModuleCreateContext)
    const frame: Cinema2ModuleFrameReadContext = { frameId: 1, timestampMs: 16, deltaTimeSec: 1 / 60, elapsedTimeSec: 1, viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio: null, director: null }
    instance.lifecycle.update({ frame, parameters, targets: {} as never })
    expect(instance.getDiagnostics?.()).toEqual([])
    values.set('line1Text', 'A'.repeat(20))
    instance.lifecycle.update({ frame: { ...frame, frameId: 2 }, parameters, targets: {} as never })
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CINEMA2_SUBMERGE_TEXT_TRUNCATED', message: expect.stringContaining('SUBMERGE') })]))
    values.set('line1Text', '')
    values.set('line2Text', '')
    instance.lifecycle.update({ frame: { ...frame, frameId: 3 }, parameters, targets: {} as never })
    expect((instance as typeof instance & { inspect(): Cinema2SayItModuleInspection }).inspect().text).toBe('SUBMERGE')
    expect(source.parameters!.line1Text).toBe('SUBMERGE')
    instance.lifecycle.dispose()
  })

  it('advances once per new kick, holds while paused, and returns to the authored pattern when disabled', () => {
    const module = manifest.modules![0]!
    const values = new Map(Object.entries(module.parameters!))
    values.set('pattern', 'suspension')
    values.set('patternChange', true)
    values.set('trigger', 'kick')
    const parameters = { get: (key: string) => values.get(key), getAuthored: (key: string) => values.get(key), resolve: () => null }
    const definition = createCinema2SubmergeNativeModuleDefinition()
    const instance = definition.create({ module, parameters, randomness: {} } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof definition.create> & { inspect(): Cinema2SayItModuleInspection }
    let tick = 0
    const update = (event: string | null, paused = false) => {
      const elapsed = ++tick / 60
      const audio = { upstream: { timeSec: elapsed, trackId: 'track' }, rhythm: { kick: event ? { id: event } : null }, bands: {}, features: {} } as unknown as Cinema2AudioIntelligenceFrame
      instance.lifecycle.update({ parameters, targets: {} as never, frame: {
        frameId: tick, elapsedTimeSec: elapsed, timestampMs: elapsed * 1000, deltaTimeSec: 1 / 60,
        viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio, director: null,
        transport: { sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: 'track', timeSec: elapsed },
      } })
      return submergePatternFromController(instance.inspect().activePattern)
    }
    expect(update(null)).toBe('suspension')
    const next = update('kick-1')
    expect(next).not.toBe('suspension')
    expect(update('kick-1')).toBe(next)
    expect(update('kick-2', true)).toBe(next)
    expect(update('kick-3')).not.toBe(next)
    values.set('patternChange', false)
    expect(update('kick-4')).toBe('suspension')
    expect(values.get('pattern')).toBe('suspension')
    instance.lifecycle.dispose()
  })
})
