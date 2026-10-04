import { describe, expect, it } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { cinema2SayItNativeModuleDefinition, type Cinema2SayItModuleInspection } from '../modules/Cinema2SayItNativeModule'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from '../presets/Cinema2SayItPreset'

const frame: Readonly<Cinema2ModuleFrameReadContext> = Object.freeze({
  frameId: 1,
  timestampMs: 16,
  deltaTimeSec: 1 / 60,
  elapsedTimeSec: 1,
  viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
  contextGeneration: 1,
  audio: null,
  director: null,
})

describe('Cinema 2.0 SAY IT native module text updates', () => {
  it('reflows live one/two-line edits and reports bounded fallback behavior before GPU loading', () => {
    const moduleManifest = CINEMA2_SAY_IT_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    const parameters = {
      get: (name: string) => values.get(name),
      getAuthored: (name: string) => values.get(name),
      resolve: () => null,
    }
    const instance = cinema2SayItNativeModuleDefinition.create({
      module: moduleManifest,
      parameters,
      targets: {},
      media: {},
      resources: {},
      randomness: {},
    } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof cinema2SayItNativeModuleDefinition.create> & { inspect(): Cinema2SayItModuleInspection }

    values.set('line1Text', 'HELLO')
    values.set('line2Text', 'WORLD')
    instance.lifecycle.update({ frame, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({ state: 'idle', text: 'HELLO\nWORLD', lineCount: 2, visibleGlyphCount: 10, truncated: false, replacementCount: 0 })

    values.set('lineMode', 'one')
    values.set('line1Text', 'ABCDEFGHIJKLM 🚀')
    instance.lifecycle.update({ frame: { ...frame, frameId: 2 }, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({ text: 'ABCDEFGHIJKL', lineCount: 1, visibleGlyphCount: 12, truncated: true })
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_TEXT_TRUNCATED' }),
    ]))

    values.set('lineMode', 'two')
    values.set('line1Text', 'GO')
    values.set('line2Text', '🚀')
    instance.lifecycle.update({ frame: { ...frame, frameId: 3 }, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({ text: 'GO\n?', replacementCount: 1, truncated: false })
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_UNSUPPORTED_CHARACTERS' }),
    ]))
    instance.lifecycle.dispose()
  })
})
