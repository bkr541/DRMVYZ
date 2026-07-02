import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireReactLiveEngineOwnership,
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
  waitForReactLiveEngineStable,
} from '../ReactLiveEngineOwnership'

describe('React live engine ownership', () => {
  beforeEach(() => resetReactLiveEngineOwnershipForTests())
  afterEach(() => resetReactLiveEngineOwnershipForTests())

  it('synchronously retires the previous family before exposing its replacement', () => {
    const order: string[] = []
    const cinematic = acquireReactLiveEngineOwnership('cinematicPortal', () => order.push('retire:cinematic'))
    cinematic.markStable()

    const shader = acquireReactLiveEngineOwnership('shaderPads', () => order.push('retire:shader'))
    order.push(`active:${getReactLiveEngineOwnershipDiagnosticsForTests().activeEngine}`)

    expect(order).toEqual(['retire:cinematic', 'active:shaderPads'])
    expect(cinematic.isCurrent()).toBe(false)
    expect(shader.isCurrent()).toBe(true)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeOwnerCount: 1,
      activeEngine: 'shaderPads',
      phase: 'initializing',
    })
  })

  it('keeps only the final generation active during rapid family switching', () => {
    const retired = {
      cinematicFirst: vi.fn(),
      shader: vi.fn(),
      cinematicFinal: vi.fn(),
    }
    const cinematicFirst = acquireReactLiveEngineOwnership('cinematicPortal', retired.cinematicFirst)
    const shader = acquireReactLiveEngineOwnership('shaderPads', retired.shader)
    const cinematicFinal = acquireReactLiveEngineOwnership('cinematicPortal', retired.cinematicFinal)

    cinematicFirst.markStable()
    shader.markStable()
    cinematicFirst.retire('unmount')
    shader.retire('unmount')
    cinematicFinal.markStable()

    expect(retired.cinematicFirst).toHaveBeenCalledTimes(1)
    expect(retired.shader).toHaveBeenCalledTimes(1)
    expect(retired.cinematicFinal).not.toHaveBeenCalled()
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeOwnerCount: 1,
      activeEngine: 'cinematicPortal',
      phase: 'stable',
    })
  })

  it('makes cleanup idempotent for Strict Mode-style double retirement', () => {
    const retire = vi.fn()
    const owner = acquireReactLiveEngineOwnership('laserDmx', retire)

    owner.retire('unmount')
    owner.retire('unmount')
    resetReactLiveEngineOwnershipForTests()

    expect(retire).toHaveBeenCalledTimes(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests().activeOwnerCount).toBe(0)
  })

  it('blocks background work until the current owner is stable', async () => {
    const owner = acquireReactLiveEngineOwnership('neonLattice', vi.fn())
    let settled = false
    const waiting = waitForReactLiveEngineStable().then(() => { settled = true })

    await Promise.resolve()
    expect(settled).toBe(false)

    owner.markStable()
    await waiting
    expect(settled).toBe(true)
  })

  it('aborts a stale waiter without changing the current owner', async () => {
    const owner = acquireReactLiveEngineOwnership('oscilloscope', vi.fn())
    const controller = new AbortController()
    const waiting = waitForReactLiveEngineStable(controller.signal)

    controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    expect(owner.isCurrent()).toBe(true)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests().phase).toBe('initializing')
  })
})
