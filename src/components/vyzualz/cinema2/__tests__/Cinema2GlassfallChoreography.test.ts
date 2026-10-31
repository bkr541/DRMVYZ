import { describe, it, expect } from 'vitest'
import { cinema2StableId } from '../contracts/Cinema2NativePresetManifest'
import { createGlassfallChoreography, GLASSFALL_EVENT_ENVELOPES } from '../presets/Cinema2GlassfallChoreography'
import { readGlassfallChoreography } from '../modules/glassfall/Cinema2GlassfallAudio'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
describe('GLASSFALL authored choreography', () => {
  it('routes shared facts/events to separate transient module channels without owning manual design', () => {
    const rules = createGlassfallChoreography(cinema2StableId('glassfall-field'))
    expect(rules).toHaveLength(8)
    expect(new Set(rules.flatMap(rule => rule.actions.map(action => 'property' in action.target ? action.target.property : ''))).size).toBe(8)
    for (const rule of rules) {
      expect(rule.enabledParameter?.$ref).toBe('glassfall-choreography')
      expect(rule.strengthParameter).toBeUndefined() // Reactivity is applied exactly once by the native consumer.
      for (const action of rule.actions) expect(action.target.kind).toBe('module')
      if (rule.source.signal === 'continuous') expect(rule.source.clamp).toEqual([0, 1])
      else { expect(rule.conditions).toContainEqual({ kind: 'once-per-event' }); expect(rule.actions[0].envelope?.unit).toBe('seconds') }
    }
    expect(GLASSFALL_EVENT_ENVELOPES.drop.release).toBeGreaterThan(GLASSFALL_EVENT_ENVELOPES.snare.release)
  })
  it('fails closed on missing/invalid targets and bounds resolved values', () => {
    const values: Record<string, unknown> = { 'choreo-energy': 5, 'choreo-bass': -.2, 'choreo-kick': NaN, 'choreo-drop': .6 }
    const channels = readGlassfallChoreography({ get: (name: string) => values[name] } as Cinema2ModuleParameterReadFacet)
    expect(channels).toMatchObject({ energy: 1, bass: 0, kick: 0, drop: .6, snare: 0 })
  })
})
