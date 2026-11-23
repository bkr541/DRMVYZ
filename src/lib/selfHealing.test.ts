import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaLoadRetry, watchAudioContext, MEDIA_RETRY_DELAY_MS, type ContextLike } from './audioSelfHealing'
import { CastReconnector } from './castSelfHealing'
import { GraphicsHealer, CONTEXT_LOST_GRACE_MS } from './graphicsSelfHealing'
import { installHealthAlertFrame } from './healthAlertFrame'
import { RETRY_DELAYS_MS, beginHealing, markFailed, markHealed, setHealthQuietly } from './selfHealing'
import { isCriticalHealth, useHealthStore } from '../stores/healthStore'
import { useNotificationStore } from '../stores/notificationStore'

const health = () => useHealthStore.getState().systems
const notices = () => useNotificationStore.getState().events.react.map(event => `${event.tone}:${event.title}`)

beforeEach(() => { vi.useFakeTimers(); useHealthStore.getState().reset(); useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } }) })
afterEach(() => { vi.useRealTimers() })

describe('health reporting', () => {
  it('posts "started" once per episode and "complete" when the system is healthy again', () => {
    beginHealing('audio', 'Audio output stopped')
    beginHealing('audio', 'Audio output stopped')
    expect(health().audio.state).toBe('healing')
    expect(isCriticalHealth(health())).toBe(true)
    markHealed('audio')
    markHealed('audio')
    expect(health().audio.state).toBe('ok')
    expect(notices()).toEqual(['success:Self-healing complete: Audio', 'warning:Self-healing started: Audio'])
  })

  it('a system running at reduced quality is not an alert, and quiet states never override a repair', () => {
    setHealthQuietly('graphics', 'degraded', 'Quality is reduced')
    expect(health().graphics.state).toBe('degraded')
    expect(isCriticalHealth(health())).toBe(false)
    beginHealing('graphics', 'The visualizer stopped')
    setHealthQuietly('graphics', 'ok')
    expect(health().graphics.state).toBe('healing')
    markFailed('graphics', 'The visualizer could not restart')
    markFailed('graphics', 'The visualizer could not restart')
    expect(notices().filter(text => text.startsWith('error:'))).toHaveLength(1)
  })

  it('shows the alert frame on the document only while a repair or failure is active', () => {
    const attrs = new Map<string, string>()
    const root = { setAttribute: (k: string, v: string) => { attrs.set(k, v) }, removeAttribute: (k: string) => { attrs.delete(k) }, hasAttribute: (k: string) => attrs.has(k), getAttribute: (k: string) => attrs.get(k) ?? null } as unknown as HTMLElement
    const stop = installHealthAlertFrame(root)
    expect(root.hasAttribute('data-health-alert')).toBe(false)
    beginHealing('cast', 'The cast connection was lost')
    expect(root.getAttribute('data-health-alert')).toBe('true')
    markHealed('cast')
    expect(root.hasAttribute('data-health-alert')).toBe(false)
    stop()
  })
})

describe('cast reconnect', () => {
  const request = { targetId: 'display-2', windowMode: 'fullscreen', aspectRatio: '16:9' }

  it('restarts the cast with the same choices when the session fails, then reports it healed', async () => {
    const start = vi.fn(async () => true)
    const cast = new CastReconnector({ start })
    cast.remember(request)
    cast.observe('connecting'); cast.observe('connected')
    expect(health().cast.state).toBe('ok')
    cast.observe('failed')
    expect(health().cast.state).toBe('healing')
    expect(start).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    expect(start).toHaveBeenCalledWith(request)
    cast.observe('connected')
    expect(health().cast.state).toBe('ok')
    expect(notices()).toEqual(['success:Self-healing complete: Output cast', 'warning:Self-healing started: Output cast'])
  })

  it('gives up after the last delay and says so once; a new cast from the user starts clean', async () => {
    const start = vi.fn(async () => false)
    const cast = new CastReconnector({ start })
    cast.remember(request)
    cast.observe('failed')
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.reduce((total, ms) => total + ms, 0) + 1_000)
    expect(start).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length)
    expect(health().cast.state).toBe('failed')
    expect(notices().filter(text => text.startsWith('error:'))).toHaveLength(1)
    cast.remember(request)
    expect(health().cast.state).toBe('ok')
  })

  it('does nothing after the user stopped the cast, or when nothing was ever started', async () => {
    const start = vi.fn(async () => true)
    const cast = new CastReconnector({ start })
    cast.observe('failed')
    cast.remember(request)
    cast.observe('failed')
    cast.forget()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(start).not.toHaveBeenCalled()
    expect(health().cast.state).toBe('idle')
    expect(isCriticalHealth(health())).toBe(false)
  })

  it('treats a connected cast that simply ends as finished: nothing to repair, and the cast is no longer "in use"', async () => {
    const start = vi.fn(async () => true)
    const cast = new CastReconnector({ start })
    cast.remember(request)
    cast.observe('connected')
    expect(health().cast.state).toBe('ok')
    cast.observe('disconnected')
    expect(health().cast.state).toBe('idle')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(start).not.toHaveBeenCalled()
  })

  it('does not drop a new request when the previous session winds down, nor during a repair', async () => {
    const cast = new CastReconnector({ start: async () => true })
    cast.remember(request)
    cast.observe('disconnecting'); cast.observe('disconnected')   // an older session ending while the new one is starting
    expect(health().cast.state).toBe('ok')
    cast.observe('connected'); cast.observe('failed')
    cast.observe('disconnected')                                   // the repair stops the failed session first
    expect(health().cast.state).toBe('healing')
  })

  it('retries again when the restarted session fails straight away', async () => {
    const start = vi.fn(async () => true)
    const cast = new CastReconnector({ start })
    cast.remember(request)
    cast.observe('failed')
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    cast.observe('failed')
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1])
    expect(start).toHaveBeenCalledTimes(2)
  })
})

describe('audio', () => {
  function fakeContext(state: ContextLike['state']) {
    const listeners = new Set<() => void>()
    const ctx: ContextLike & { set: (next: ContextLike['state']) => void; resumes: number } = {
      state, resumes: 0,
      resume: async () => { ctx.resumes += 1; if (ctx.resumes >= 2) ctx.set('running') },
      addEventListener: (_type, listener) => { listeners.add(listener) },
      removeEventListener: (_type, listener) => { listeners.delete(listener) },
      set: next => { ctx.state = next; for (const listener of [...listeners]) listener() },
    }
    return ctx
  }

  it('resumes an audio context that stopped after running, and ignores one that never started', async () => {
    const idle = fakeContext('suspended')
    watchAudioContext(idle); idle.set('suspended')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(idle.resumes).toBe(0)

    const ctx = fakeContext('running')
    watchAudioContext(ctx)
    ctx.set('suspended')
    expect(health().audio.state).toBe('healing')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ctx.state).toBe('running')
    expect(health().audio.state).toBe('ok')
    expect(notices()[0]).toBe('success:Self-healing complete: Audio')
  })

  it('reloads a failed track once, then lets the failure through', () => {
    const reload = vi.fn()
    const retry = new MediaLoadRetry({ reload })
    expect(retry.onFailure('t1', 'Song')).toBe(true)
    vi.advanceTimersByTime(MEDIA_RETRY_DELAY_MS)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(retry.onFailure('t1', 'Song')).toBe(false)
    expect(health().audio.state).toBe('failed')
    retry.onTrackChanged()
    expect(health().audio.state).toBe('ok')
    expect(retry.onFailure('t2', 'Other')).toBe(true)
    retry.onLoaded('t2')
    expect(health().audio.state).toBe('ok')
    expect(notices()).toContain('success:Self-healing complete: Audio')
  })
})

describe('graphics', () => {
  it('rebuilds a stage that stopped, a few times, then reports it; a running stage ends the repair', () => {
    const recreate = vi.fn()
    const healer = new GraphicsHealer(recreate)
    healer.observe('unavailable')
    vi.advanceTimersByTime(RETRY_DELAYS_MS[0])
    expect(recreate).toHaveBeenCalledTimes(1)
    healer.observe('running')
    expect(health().graphics.state).toBe('ok')

    for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) { healer.observe('unavailable'); vi.advanceTimersByTime(RETRY_DELAYS_MS[i]) }
    healer.observe('unavailable')
    expect(health().graphics.state).toBe('failed')
  })

  it('lets a lost context restore itself, and rebuilds only if it stays lost', () => {
    const recreate = vi.fn()
    const healer = new GraphicsHealer(recreate)
    healer.observe('context-lost')
    vi.advanceTimersByTime(CONTEXT_LOST_GRACE_MS - 1)
    healer.observe('running')
    vi.advanceTimersByTime(CONTEXT_LOST_GRACE_MS)
    expect(recreate).not.toHaveBeenCalled()
    healer.observe('context-lost')
    vi.advanceTimersByTime(CONTEXT_LOST_GRACE_MS)
    expect(recreate).toHaveBeenCalledTimes(1)
  })
})
