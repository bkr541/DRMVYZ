import { describe, expect, it } from 'vitest'
import {
  PRISM_ECHO_BURST_RUNTIME_COMMAND_ID,
  PRISM_ECHO_MAX_SLOTS,
  PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM,
  PrismEchoSystem,
  prismEchoRuntimeUniformName,
  type PrismEchoStructuralSnapshot,
} from '../prismEchoSystem'

function state(seed: number): PrismEchoStructuralSnapshot {
  return {
    rotation: seed * 0.1,
    rotationMotion: seed * 0.2,
    aperture: 0.7 + seed * 0.03,
    baseRadius: 0.8 + seed * 0.02,
    curvature: 0.4 + seed * 0.04,
    facetAmount: Math.min(1, seed * 0.1),
    chaseIndex: seed,
    chaseStrength: Math.min(1, 0.2 + seed * 0.08),
    alternate: seed % 2 ? 0.8 : 0.2,
    opposing: seed % 3 ? 0.4 : 0.9,
    flare: Math.min(1, seed * 0.07),
  }
}

function step(system: PrismEchoSystem, seed: number, overrides: Partial<Parameters<PrismEchoSystem['step']>[0]> = {}) {
  return system.step({
    amount: 1,
    count: 4,
    spacingSec: 0.03,
    decay: 0.6,
    qualityTier: 'ultra',
    deltaTimeSec: 0.04,
    state: state(seed),
    ...overrides,
  })
}

describe('PrismEchoSystem', () => {
  it('keeps a bounded structural history during long runtime', () => {
    const system = new PrismEchoSystem()
    for (let index = 0; index < 250; index += 1) step(system, index)

    const history = system.getHistorySnapshot()
    expect(history).toHaveLength(PRISM_ECHO_MAX_SLOTS)
    expect(history[0].rotation).toBeCloseTo(state(249).rotation)
    expect(history[history.length - 1]?.rotation).toBeCloseTo(state(246).rotation)
  })

  it('copies historical state instead of retaining a mutable current-state reference', () => {
    const system = new PrismEchoSystem()
    const current = state(1)
    system.step({
      amount: 1,
      count: 4,
      spacingSec: 0.03,
      decay: 0.6,
      qualityTier: 'ultra',
      deltaTimeSec: 0.04,
      state: current,
    })
    current.rotation = 99
    current.aperture = 99

    expect(system.getHistorySnapshot()[0]).toMatchObject({ rotation: 0.1, aperture: 0.73 })
  })

  it('renders newer structural echoes more strongly than older echoes', () => {
    const system = new PrismEchoSystem()
    for (let index = 0; index < 5; index += 1) step(system, index)
    const uniforms = step(system, 6, { deltaTimeSec: 0 })

    expect(uniforms[prismEchoRuntimeUniformName(0, 'Opacity')]).toBeGreaterThan(
      uniforms[prismEchoRuntimeUniformName(1, 'Opacity')],
    )
    expect(uniforms[prismEchoRuntimeUniformName(1, 'Opacity')]).toBeGreaterThan(
      uniforms[prismEchoRuntimeUniformName(2, 'Opacity')],
    )
    expect(uniforms[prismEchoRuntimeUniformName(2, 'Opacity')]).toBeGreaterThan(
      uniforms[prismEchoRuntimeUniformName(3, 'Opacity')],
    )
  })

  it('uses zero amount/count as a no-history fast path', () => {
    const system = new PrismEchoSystem()
    for (let index = 0; index < 4; index += 1) step(system, index)
    expect(system.getHistorySnapshot()).not.toHaveLength(0)

    const zeroAmount = step(system, 5, { amount: 0 })
    expect(system.getHistorySnapshot()).toHaveLength(0)
    expect(zeroAmount[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM]).toBe(0)
    expect(zeroAmount[prismEchoRuntimeUniformName(0, 'Opacity')]).toBe(0)

    const zeroCount = step(system, 6, { count: 0 })
    expect(system.getHistorySnapshot()).toHaveLength(0)
    expect(zeroCount[prismEchoRuntimeUniformName(0, 'Opacity')]).toBe(0)
  })

  it('clears history on reconstruct/reset instead of carrying stale prior states across re-entry', () => {
    const system = new PrismEchoSystem()
    for (let index = 0; index < 4; index += 1) step(system, index)
    expect(system.getHistorySnapshot()).toHaveLength(4)

    step(system, 5, { reconstruct: true })
    expect(system.getHistorySnapshot()).toHaveLength(0)
    expect(system.getRuntimeFloatUniformValues()[prismEchoRuntimeUniformName(0, 'Opacity')]).toBe(0)

    step(system, 6)
    expect(system.getHistorySnapshot()).toHaveLength(1)
  })

  it('caps visible echo instances by the active quality tier', () => {
    const system = new PrismEchoSystem()
    for (let index = 0; index < 5; index += 1) step(system, index)

    const low = step(system, 6, { qualityTier: 'low', deltaTimeSec: 0 })
    expect(low[prismEchoRuntimeUniformName(0, 'Opacity')]).toBeGreaterThan(0)
    expect(low[prismEchoRuntimeUniformName(1, 'Opacity')]).toBe(0)

    const medium = step(system, 7, { qualityTier: 'medium', deltaTimeSec: 0 })
    expect(medium[prismEchoRuntimeUniformName(1, 'Opacity')]).toBeGreaterThan(0)
    expect(medium[prismEchoRuntimeUniformName(2, 'Opacity')]).toBe(0)

    const ultra = step(system, 8, { qualityTier: 'ultra', deltaTimeSec: 0 })
    expect(ultra[prismEchoRuntimeUniformName(3, 'Opacity')]).toBeGreaterThan(0)
  })

  it('supports a runtime-only echo burst without changing the authored Echo Amount', () => {
    const system = new PrismEchoSystem()
    const authoredAmount = 0
    system.requestBurst(1)
    step(system, 1, { amount: authoredAmount })
    const burst = step(system, 2, { amount: authoredAmount })

    expect(PRISM_ECHO_BURST_RUNTIME_COMMAND_ID).toBe('prismEchoBurst')
    expect(authoredAmount).toBe(0)
    expect(burst[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM]).toBeGreaterThan(0)
    expect(burst[prismEchoRuntimeUniformName(0, 'Opacity')]).toBeGreaterThan(0)
  })
})
