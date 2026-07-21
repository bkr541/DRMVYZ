import { describe, expect, it } from 'vitest'
import {
  SharedBehaviorRoutingRuntime,
  type SharedBehaviorContinuousRoute,
  type SharedBehaviorEventBinding,
  type SharedBehaviorRoutingSink,
  type SharedBehaviorTransportState,
} from './behaviorRouting'

interface TestContext {
  timeSec: number
  continuous: Record<string, number>
  events: Record<string, { active: boolean; strength: number; identity: string | number | null; startedAtSec?: number }>
  section: string | null
  capabilities: Record<string, boolean>
  confidence: Record<string, number>
  transport?: SharedBehaviorTransportState
}

function context(overrides: Partial<TestContext> = {}): TestContext {
  return {
    timeSec: 0,
    continuous: { energy: 0 },
    events: {},
    section: 'verse',
    capabilities: { rhythm: true },
    confidence: { overall: 1 },
    ...overrides,
  }
}

function route(overrides: Partial<SharedBehaviorContinuousRoute> = {}): SharedBehaviorContinuousRoute {
  return {
    id: 'route-energy',
    source: 'energy',
    target: 'motion',
    inputRange: { min: 0, max: 1 },
    outputRange: { min: 0, max: 1 },
    amount: 1,
    attackSec: 1,
    releaseSec: 1,
    ...overrides,
  }
}

function binding(overrides: Partial<SharedBehaviorEventBinding> = {}): SharedBehaviorEventBinding {
  return {
    id: 'binding-kick',
    source: 'kick',
    target: 'impulse',
    amount: 1,
    attackSec: 0.1,
    holdSec: 0.2,
    releaseSec: 0.2,
    curve: 'linear',
    ...overrides,
  }
}

function createHarness(options: ConstructorParameters<typeof SharedBehaviorRoutingRuntime<TestContext>>[1] = {}) {
  const continuous = new Map<string, number>()
  const events: Array<{ target: string; value: number; bindingId: string; identity: string }> = []
  const sink: SharedBehaviorRoutingSink = {
    applyContinuous: (target, value) => continuous.set(target, value),
    applyEvent: (target, value, bindingId, identity) => events.push({ target, value, bindingId, identity }),
  }
  const runtime = new SharedBehaviorRoutingRuntime<TestContext>({
    timeSec: value => value.timeSec,
    resolveContinuous: (value, source) => value.continuous[source] ?? 0,
    resolveEvent: (value, source) => value.events[source] ?? { active: false, strength: 0, identity: null },
    section: value => value.section,
    capability: (value, key) => value.capabilities[key] ?? false,
    confidence: (value, key) => value.confidence[key] ?? 0,
    transport: value => value.transport ?? null,
  }, options)
  return { runtime, continuous, events, sink }
}

describe('SharedBehaviorRoutingRuntime', () => {
  it('uses distinct attack and release smoothing durations', () => {
    const { runtime, continuous, sink } = createHarness()
    runtime.configure([route({ attackSec: 1, releaseSec: 0.1 })], [])
    runtime.update({ context: context({ continuous: { energy: 0 } }), deltaSec: 0 }, sink)
    runtime.update({ context: context({ continuous: { energy: 1 } }), deltaSec: 0.1 }, sink)
    const attacked = continuous.get('motion') ?? 0
    runtime.update({ context: context({ continuous: { energy: 0 } }), deltaSec: 0.1 }, sink)
    const released = continuous.get('motion') ?? 1

    expect(attacked).toBeGreaterThan(0)
    expect(attacked).toBeLessThan(0.2)
    expect(released).toBeLessThan(attacked * 0.5)
  })

  it('applies response curves, input/output mapping, route amount, and output clamps', () => {
    const { runtime, continuous, sink } = createHarness()
    runtime.configure([route({
      inputRange: { min: 0.25, max: 0.75 },
      outputRange: { min: 2, max: 6 },
      responseCurve: 'easeIn',
      amount: 0.5,
      attackSec: 0,
      releaseSec: 0,
      outputClamp: { min: 0, max: 2 },
    })], [])
    runtime.update({ context: context({ continuous: { energy: 0.5 } }), deltaSec: 0 }, sink)
    expect(continuous.get('motion')).toBeCloseTo(1.5)

    runtime.update({ context: context({ continuous: { energy: 1 } }), deltaSec: 0 }, sink)
    expect(continuous.get('motion')).toBe(2)
  })

  it('honors section, confidence, and capability gates', () => {
    const definitions = [route({
      sectionFilters: ['drop'],
      confidenceRequirement: { key: 'overall', min: 0.8 },
      capabilityRequirement: { key: 'rhythm' },
      attackSec: 0,
      releaseSec: 0,
    })]
    const { runtime, continuous, sink } = createHarness()
    runtime.configure(definitions, [])

    runtime.update({ context: context({ continuous: { energy: 1 }, section: 'verse' }), deltaSec: 0 }, sink)
    expect(continuous.has('motion')).toBe(false)
    runtime.update({ context: context({ continuous: { energy: 1 }, section: 'drop', confidence: { overall: 0.4 } }), deltaSec: 0 }, sink)
    expect(continuous.has('motion')).toBe(false)
    runtime.update({ context: context({ continuous: { energy: 1 }, section: 'drop', capabilities: { rhythm: false } }), deltaSec: 0 }, sink)
    expect(continuous.has('motion')).toBe(false)
    runtime.update({ context: context({ continuous: { energy: 1 }, section: 'drop' }), deltaSec: 0 }, sink)
    expect(continuous.get('motion')).toBe(1)
  })

  it('resolves event attack, hold, and release timing', () => {
    const { runtime, events, sink } = createHarness()
    runtime.configure([], [binding()])
    const eventContext = (timeSec: number, active = false) => context({
      timeSec,
      events: { kick: { active, strength: 0.8, identity: 'kick-12' } },
    })

    runtime.update({ context: eventContext(0, true), deltaSec: 0 }, sink)
    runtime.update({ context: eventContext(0.05), deltaSec: 0.05 }, sink)
    runtime.update({ context: eventContext(0.2), deltaSec: 0.15 }, sink)
    runtime.update({ context: eventContext(0.4), deltaSec: 0.2 }, sink)

    expect(events[0].value).toBe(0)
    expect(events[1].value).toBeCloseTo(0.4)
    expect(events[2].value).toBeCloseTo(0.8)
    expect(events[3].value).toBeCloseTo(0.4)
  })

  it('suppresses duplicate deterministic event identities after completion', () => {
    const { runtime, events, sink } = createHarness()
    runtime.configure([], [binding({ attackSec: 0, holdSec: 0, releaseSec: 0 })])
    const pulse = context({ events: { kick: { active: true, strength: 1, identity: 'same-kick' } } })
    runtime.update({ context: pulse, deltaSec: 0 }, sink)
    runtime.update({ context: pulse, deltaSec: 0 }, sink)
    expect(events).toHaveLength(1)
    expect(runtime.getStats().rememberedEventIdentityCount).toBe(1)
  })

  it('keeps active and remembered event state bounded and cleans completed events', () => {
    const { runtime, sink } = createHarness({ maxActiveEventStates: 2, maxRememberedEventIdentities: 2 })
    runtime.configure([], [binding({ attackSec: 0, holdSec: 10, releaseSec: 0 })])
    for (let index = 0; index < 4; index += 1) {
      runtime.update({ context: context({
        timeSec: index,
        events: { kick: { active: true, strength: 1, identity: `kick-${index}` } },
      }), deltaSec: 1 }, sink)
    }
    expect(runtime.getStats().activeEventStateCount).toBe(2)
    expect(runtime.getStats().rememberedEventIdentityCount).toBeLessThanOrEqual(2)

    runtime.update({ context: context({ timeSec: 20 }), deltaSec: 16 }, sink)
    expect(runtime.getStats().activeEventStateCount).toBe(0)
    expect(runtime.getStats().rememberedEventIdentityCount).toBeLessThanOrEqual(2)
  })

  it('synchronizes volatile state when a route or event source is replaced', () => {
    const { runtime, sink } = createHarness()
    runtime.configure([route()], [binding({ holdSec: 10 })])
    runtime.update({ context: context({
      events: { kick: { active: true, strength: 1, identity: 'old-source-event' } },
    }), deltaSec: 0 }, sink)
    expect(runtime.getStats().activeEventStateCount).toBe(1)

    runtime.configure(
      [route({ source: 'alternate-energy' })],
      [binding({ source: 'snare', holdSec: 10 })],
    )
    expect(runtime.getStats().routeStateCount).toBe(0)
    expect(runtime.getStats().activeEventStateCount).toBe(0)
    expect(runtime.getStats().synchronizationCount).toBe(1)
  })

  it('resets deterministically and clears smoothing state', () => {
    const { runtime, continuous, sink } = createHarness()
    runtime.configure([route()], [])
    runtime.update({ context: context({ continuous: { energy: 0 } }), deltaSec: 0 }, sink)
    runtime.update({ context: context({ continuous: { energy: 1 } }), deltaSec: 0.2 }, sink)
    expect(continuous.get('motion')).toBeLessThan(1)

    runtime.reset()
    runtime.update({ context: context({ continuous: { energy: 1 } }), deltaSec: 0.2 }, sink)
    expect(continuous.get('motion')).toBe(1)
    expect(runtime.getStats().routeStateCount).toBe(1)
  })

  it('synchronizes route and event state on seek and loop wrap', () => {
    const { runtime, continuous, sink } = createHarness()
    runtime.configure([route()], [binding({ attackSec: 0, holdSec: 10, releaseSec: 0 })])
    runtime.update({ context: context({
      continuous: { energy: 0 },
      events: { kick: { active: true, strength: 1, identity: 'before-seek' } },
    }), deltaSec: 0 }, sink)
    expect(runtime.getStats().activeEventStateCount).toBe(1)

    runtime.update({ context: context({
      timeSec: 5,
      continuous: { energy: 1 },
      transport: { seekDetected: true, synchronizationIdentity: 'seek-1' },
    }), deltaSec: 0.1 }, sink)
    expect(continuous.get('motion')).toBe(1)
    expect(runtime.getStats().activeEventStateCount).toBe(0)

    runtime.update({ context: context({
      timeSec: 1,
      continuous: { energy: 0.5 },
      transport: { loopWrapDetected: true, synchronizationIdentity: 'loop-1' },
    }), deltaSec: 0.1 }, sink)
    expect(continuous.get('motion')).toBe(0.5)
    expect(runtime.getStats().synchronizationCount).toBe(2)
  })
  it('uses an authoritative event onset when the boundary is observed late', () => {
    const { runtime, events, sink } = createHarness()
    runtime.configure([], [binding({ attackSec: 0.1, holdSec: 0.1, releaseSec: 0.2 })])
    runtime.update({ context: context({
      timeSec: 0.15,
      events: { kick: { active: true, strength: 1, identity: 'late-kick', startedAtSec: 0 } },
    }), deltaSec: 0.15 }, sink)
    expect(events).toHaveLength(1)
    expect(events[0].value).toBeCloseTo(1)
  })

  it('suppresses repeated synchronization flags with the same identity', () => {
    const { runtime, sink } = createHarness()
    runtime.configure([route()], [])
    const repeated = context({
      transport: { loopWrapDetected: true, synchronizationIdentity: 'loop-a' },
    })
    runtime.update({ context: repeated, deltaSec: 0 }, sink)
    runtime.update({ context: repeated, deltaSec: 0 }, sink)
    expect(runtime.getStats().synchronizationCount).toBe(1)
  })

})
