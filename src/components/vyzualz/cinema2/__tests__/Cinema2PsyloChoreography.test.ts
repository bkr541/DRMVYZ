import { describe, expect, it } from 'vitest'
import { psyloChoreographyHarness } from '../../../../test/support/PsyloChoreographyHarness'
import { CINEMA2_PSYLO_PRESET_MANIFEST as manifest } from '../presets/Cinema2PsyloPreset'
import { PSYLO_EVENT_ACTIONS } from '../presets/Cinema2PsyloChoreography'
import { PsyloPatternTransition } from '../modules/psylo/Cinema2PsyloTransition'
import { PSYLO_MUSIC_DEFAULTS } from '../modules/psylo/Cinema2PsyloAudio'

describe('PSYLO bounded shared choreography', () => {
  it('routes facts/actions exclusively into transient native channels and leaves manual controls unbound', () => {
    for (const rule of manifest.choreography!.rules.filter(r => r.source.signal !== 'parameter')) {
      expect(rule.strengthParameter).toBeUndefined() // Music Response applied once downstream.
      for (const action of rule.actions) {
        expect(action.target.kind).toBe('module')
        expect('property' in action.target && action.target.property.startsWith('choreo')).toBe(true)
        if (action.operation === 'envelope') {
          expect(action.envelope?.unit).toBe('seconds')
          expect(rule.conditions).toContainEqual({ kind: 'once-per-event' })
        }
      }
    }
    expect(manifest.choreography?.tempoSyncParameter).toBeUndefined() // Sync OFF does not invent beat events.
  })
  it.each(['kick', 'snare', 'beat', 'drop'] as const)('%s attacks, releases and restores its target to zero', kind => {
    const h = psyloChoreographyHarness(), action = PSYLO_EVENT_ACTIONS[kind]
    const saved = h.state.getSnapshot().persistentValues
    h.publish({ timeSec: 0 }); h.publish({ timeSec: .1, event: kind, eventId: 50 })
    const peak = h.publish({ timeSec: .1 + action.attack })
    expect(peak.channels[action.property]).toBeGreaterThan(0)
    expect(peak.channels[action.property]).toBeLessThanOrEqual(action.maximum)
    const tail = h.publish({ timeSec: .1 + action.attack + action.release * .5 })
    expect(tail.channels[action.property]).toBeLessThan(peak.channels[action.property])
    expect(h.publish({ timeSec: .101 + action.attack + action.release }).channels[action.property]).toBe(0)
    expect(h.choreography.getSnapshot().activeEnvelopeCount).toBe(0)
    expect(h.state.getSnapshot().persistentValues).toEqual(saved)
  })
  it('smooths continuous changes, bounds combined response and immediately honors Music Response zero', () => {
    const h = psyloChoreographyHarness(); h.publish({ timeSec: 0, energy: 0, bass: 0, vocal: 0, high: 0 })
    const step = h.publish({ timeSec: .01, energy: 1, bass: 1, high: 1, vocal: 1, build: 1 })
    expect(step.channels.choreoEnergy).toBeGreaterThan(0); expect(step.channels.choreoEnergy).toBeLessThan(1)
    const settled = h.publish({ timeSec: 1, energy: 1, bass: 1, high: 1, vocal: 1, build: 1 }).output
    expect(settled.musicRange).toBeGreaterThanOrEqual(.4); expect(settled.musicRange).toBeLessThan(.7)
    expect(settled.musicBuild).toBeLessThanOrEqual(.15)
    expect(Object.values(settled).every(value => value >= 0 && value <= 1)).toBe(true)
    expect(h.publish({ timeSec: 1.01, event: 'drop', build: 1 }, 0).output).toEqual(PSYLO_MUSIC_DEFAULTS)
  })
  it('suppresses activation and stale envelopes after reset, analysis replacement and gaps', () => {
    const h = psyloChoreographyHarness()
    h.publish({ timeSec: .1, event: 'kick' }); expect(h.publish({ timeSec: .12 }).output.musicKick).toBe(0)
    h.publish({ timeSec: .2, event: 'kick' }); expect(h.publish({ timeSec: .22 }).output.musicKick).toBeGreaterThan(0)
    expect(h.publish({ timeSec: .23, event: 'kick', analysisRevision: 'replacement' }, 1, false, true).output.musicKick).toBe(0)
    expect(h.publish({ timeSec: .24, analysisRevision: 'replacement' }).output.musicKick).toBe(0)
    h.choreography.reset('test-seek'); h.delivery.reset()
    expect(h.choreography.getSnapshot().activeEnvelopeCount).toBe(0)
    expect(h.publish({ timeSec: .01, event: 'drop' }).output.musicDrop).toBe(0)
  })
})
describe('PSYLO automatic pattern blends', () => {
  it('keeps convex weights, holds on pause, handles interrupted transitions and restores exact destinations', () => {
    const t = new PsyloPatternTransition()
    expect(t.update(0, 0, false)).toEqual([1, 0, 0, 0, 0, 0, 0, 0])
    const middle = t.update(1, .175, false)
    expect(middle[0]).toBeCloseTo(.5); expect(middle[1]).toBeCloseTo(.5)
    expect(t.update(1, 0, false)).toEqual(middle)
    expect(t.update(2, 0, false)).toEqual(middle)
    for (const dt of [.05, .1, .2]) {
      const weights = t.update(2, dt, false)
      expect(weights.reduce((a, b) => a + b)).toBeCloseTo(1)
      expect(weights.every(value => value >= 0 && value <= 1)).toBe(true)
    }
    expect(t.update(2, 0, false)).toEqual([0, 0, 1, 0, 0, 0, 0, 0])
    expect(t.update(5, 0, true)).toEqual([0, 0, 0, 0, 0, 1, 0, 0])
  })
})
