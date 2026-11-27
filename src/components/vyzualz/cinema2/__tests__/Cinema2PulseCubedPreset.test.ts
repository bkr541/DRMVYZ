import { describe, expect, it } from 'vitest'
import { CINEMA2_PULSE_CUBED_PRESET_ID, CINEMA2_PULSE_CUBED_PRESET_MANIFEST as manifest, pulseParameterId } from '../presets/Cinema2PulseCubedPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_PULSE_CUBED_MODULE_TYPE_ID, createCinema2PulseCubedNativeModuleDefinition, type PulseCubedModuleInstance } from '../modules/Cinema2PulseCubedNativeModule'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { PULSE_PATTERNS, patternPose } from '../modules/pulseCubed/PulseCubedDomain'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import type { Cinema2ModuleCreateContext, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'

describe('Cinema 2.0 PULSE CUBED', () => {
  it('registers and compiles with the four inspector parents, canonical triggers and editable palette recipes', () => {
    expect(cinema2NativePresetRegistry.compile(CINEMA2_PULSE_CUBED_PRESET_ID).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_PULSE_CUBED_MODULE_TYPE_ID, 1)).toBeTruthy()
    expect(validateCinema2PresetAuthoringConventions({ role: 'reference', manifest }).diagnostics).toEqual([])
    expect(new Set(manifest.parameters!.map(p => p.designParentGroup).filter(Boolean))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(manifest.parameters!.find(p => p.id === pulseParameterId('trigger'))?.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(manifest.parameters!.find(p => p.id === pulseParameterId('patternChange'))?.defaultValue).toBe(false)
    expect(manifest.variations).toHaveLength(8)
    for (const recipe of manifest.variations!) expect(Object.keys(recipe.parameterValues!)).toHaveLength(7)
  })
  it('authors twelve distinct spatial and temporal programs, with finite poses', () => {
    const poses = PULSE_PATTERNS.map(pattern => Array.from({ length: 4 }, (_, i) => patternPose(pattern, i, .37, .8)))
    expect(new Set(poses.map(p => JSON.stringify(p))).size).toBe(12)
    expect(poses.flat(2).every(Number.isFinite)).toBe(true)
    expect(patternPose('inward-collapse', 3, .3, .5)[2]).toBeLessThan(0)
    expect(patternPose('supernova', 3, .3, .5)[2]).toBeGreaterThan(0)
    expect(patternPose('counterphase', 1, .3, .5)[0]).toBeLessThan(0)
  })
  it('deduplicates triggers, holds while paused and preserves authored pattern selection', () => {
    const module = manifest.modules![0]!, values = new Map(Object.entries(module.parameters!))
    values.set('patternChange', true); values.set('trigger', 'kick')
    const parameters = { get: (key: string) => values.get(key), getAuthored: (key: string) => values.get(key), resolve: () => null }
    const instance = createCinema2PulseCubedNativeModuleDefinition().create({ module, parameters } as unknown as Cinema2ModuleCreateContext) as PulseCubedModuleInstance
    let tick = 0, time = 0
    const update = (kick: string | null, paused = false) => {
      tick++; if (!paused) time += 1 / 60
      const audio = { upstream: { timeSec: time, trackId: 'track', publicationSequence: tick }, rhythm: { kick: kick ? { id: kick } : null }, structure: { semanticMoments: { available: false }, section: { available: false } } }
      instance.lifecycle.update({ parameters, targets: {}, frame: { frameId: tick, elapsedTimeSec: time, timestampMs: tick * 1000 / 60, deltaTimeSec: 1 / 60, viewport: { width: 840, height: 525, dpr: 1 }, contextGeneration: 1, audio, director: null, transport: { sourcePresent: true, playing: !paused, analysisActive: true, paused, animationActive: !paused, trackId: 'track', timeSec: time } } } as unknown as Cinema2ModuleUpdateContext)
      return instance.inspect()
    }
    expect(update(null).performingPattern).toBe('circulation')
    const next = update('kick-1'); expect(next.performingPattern).toBe('counterphase')
    const held = update('kick-1'); expect(held.performingPattern).toBe(next.performingPattern)
    expect(update('kick-2', true).phase).toBe(held.phase)
    expect(update('kick-2').performingPattern).toBe(next.performingPattern)
    expect(update('kick-3').performingPattern).toBe('inward-collapse')
    expect(values.get('pattern')).toBe('circulation')
    values.set('pattern', 'optical-drift'); expect(update(null).performingPattern).toBe('optical-drift')
    instance.lifecycle.dispose()
  })
})
