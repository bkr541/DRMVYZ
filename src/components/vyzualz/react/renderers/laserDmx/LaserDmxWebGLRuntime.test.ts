import { describe, expect, it } from 'vitest'
import { LaserDmxWebGLContextState, LaserDmxWebGLResourceLedger } from './LaserDmxWebGLRuntime'

describe('LaserDMX WebGL context lifecycle state', () => {
  it('marks loss, schedules one deterministic resource recreation, and clears the request after consumption', () => {
    const state = new LaserDmxWebGLContextState()
    expect(state.generation).toBe(0)
    state.markLost()
    expect(state.contextLost).toBe(true)
    expect(state.restorePending).toBe(false)

    state.markRestored()
    expect(state.contextLost).toBe(false)
    expect(state.restorePending).toBe(true)
    expect(state.generation).toBe(1)
    expect(state.consumeRestore()).toBe(true)
    expect(state.consumeRestore()).toBe(false)
  })

  it('makes disposal terminal and prevents later restoration work', () => {
    const state = new LaserDmxWebGLContextState()
    state.markLost()
    state.dispose()
    state.markRestored()
    expect(state.disposed).toBe(true)
    expect(state.contextLost).toBe(false)
    expect(state.restorePending).toBe(false)
    expect(state.generation).toBe(0)
    expect(state.consumeRestore()).toBe(false)
  })
})


describe('LaserDMX WebGL reusable resource ledger', () => {
  it('reuses named resources, releases resized targets, and clears every allocation on disposal', () => {
    const ledger = new LaserDmxWebGLResourceLedger()
    ledger.allocate('gpu-core')
    ledger.allocate('rear-light')
    ledger.allocate('front-light')
    ledger.allocate('atmosphere')
    ledger.allocate('atmosphere')
    expect(ledger.activeCount).toBe(4)

    ledger.release('atmosphere')
    expect(ledger.activeCount).toBe(3)
    ledger.allocate('atmosphere')
    ledger.dispose()

    expect(ledger.disposed).toBe(true)
    expect(ledger.activeCount).toBe(0)
    ledger.allocate('late-resource')
    expect(ledger.activeCount).toBe(0)
  })
})
