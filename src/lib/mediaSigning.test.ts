import { describe, expect, it, vi } from 'vitest'
import { MediaSigningCoordinator } from './mediaSigning'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const request = (path: string, priority: 'visible' | 'near' | 'prefetch' = 'visible', scopeId = 'query-1') => ({
  userId: 'user-1', bucket: 'media-items', path, priority, scopeId,
})

describe('MediaSigningCoordinator', () => {
  it('never exceeds configured concurrency', async () => {
    const gates = [deferred<{ url: string; error: null }>(), deferred<{ url: string; error: null }>(), deferred<{ url: string; error: null }>()]
    let active = 0
    let maxActive = 0
    const signer = vi.fn(async () => {
      const gate = gates[signer.mock.calls.length - 1]
      active += 1
      maxActive = Math.max(maxActive, active)
      const result = await gate.promise
      active -= 1
      return result
    })
    const coordinator = new MediaSigningCoordinator({ maxConcurrency: 2, signer })
    const promises = ['a', 'b', 'c'].map(path => coordinator.request(request(path)))
    await Promise.resolve()
    expect(signer).toHaveBeenCalledTimes(2)
    gates[0].resolve({ url: 'a-url', error: null })
    await Promise.resolve(); await Promise.resolve()
    expect(signer).toHaveBeenCalledTimes(3)
    gates[1].resolve({ url: 'b-url', error: null })
    gates[2].resolve({ url: 'c-url', error: null })
    await Promise.all(promises)
    expect(maxActive).toBe(2)
  })

  it('promotes visible work ahead of queued prefetch work', async () => {
    const first = deferred<{ url: string; error: null }>()
    const order: string[] = []
    const signer = vi.fn(async (_bucket: string, path: string) => {
      order.push(path)
      if (path === 'blocker') return first.promise
      return { url: `${path}-url`, error: null }
    })
    const coordinator = new MediaSigningCoordinator({ maxConcurrency: 1, signer })
    const blocker = coordinator.request(request('blocker', 'prefetch'))
    const slow = coordinator.request(request('slow-prefetch', 'prefetch'))
    const visible = coordinator.request(request('visible', 'visible'))
    first.resolve({ url: 'blocker-url', error: null })
    await Promise.all([blocker, slow, visible])
    expect(order).toEqual(['blocker', 'visible', 'slow-prefetch'])
  })

  it('reuses a valid URL, refreshes near expiry, and deduplicates forced refreshes', async () => {
    let now = 1_000
    const signer = vi.fn(async (_bucket: string, path: string) => ({ url: `${path}-${signer.mock.calls.length}`, error: null }))
    const coordinator = new MediaSigningCoordinator({ signer, now: () => now, expiresInSeconds: 60, refreshSkewMs: 5_000 })
    const first = await coordinator.request(request('asset'))
    const reused = await coordinator.request(request('asset'))
    expect(reused.url).toBe(first.url)
    expect(signer).toHaveBeenCalledTimes(1)
    now = first.expiresAt - 4_000
    const refreshed = await coordinator.request(request('asset'))
    expect(refreshed.url).not.toBe(first.url)
    expect(signer).toHaveBeenCalledTimes(2)

    const gate = deferred<{ url: string; error: null }>()
    signer.mockImplementationOnce(() => gate.promise)
    const forcedA = coordinator.request({ ...request('asset'), force: true })
    const forcedB = coordinator.request({ ...request('asset'), force: true })
    gate.resolve({ url: 'forced-url', error: null })
    expect((await forcedA).url).toBe('forced-url')
    expect((await forcedB).url).toBe('forced-url')
    expect(signer).toHaveBeenCalledTimes(3)
  })

  it('allows a replacement query for the same user to reuse active signing work', async () => {
    const gate = deferred<{ url: string; error: null }>()
    const signer = vi.fn(() => gate.promise)
    const coordinator = new MediaSigningCoordinator({ maxConcurrency: 1, signer })
    const original = coordinator.request(request('shared', 'visible', 'query-old'))
    coordinator.abandonScope('query-old')
    const replacement = coordinator.request(request('shared', 'visible', 'query-new'))
    gate.resolve({ url: 'shared-url', error: null })
    await expect(original).resolves.toMatchObject({ url: 'shared-url' })
    await expect(replacement).resolves.toMatchObject({ url: 'shared-url' })
    expect(signer).toHaveBeenCalledTimes(1)
  })

  it('abandons obsolete queued work and prevents private cache reuse across users', async () => {
    const blocker = deferred<{ url: string; error: null }>()
    const signer = vi.fn(async (_bucket: string, path: string) => path === 'blocker' ? blocker.promise : ({ url: `${path}-url`, error: null }))
    const coordinator = new MediaSigningCoordinator({ maxConcurrency: 1, signer })
    const active = coordinator.request(request('blocker'))
    const obsolete = coordinator.request(request('queued'))
    coordinator.abandonScope('query-1')
    await expect(obsolete).rejects.toMatchObject({ name: 'AbortError' })
    blocker.resolve({ url: 'blocker-url', error: null })
    await expect(active).rejects.toMatchObject({ name: 'AbortError' })

    await coordinator.request({ ...request('asset', 'visible', 'query-2'), userId: 'user-1' })
    await coordinator.request({ ...request('asset', 'visible', 'query-3'), userId: 'user-2' })
    expect(signer.mock.calls.filter(([, path]) => path === 'asset')).toHaveLength(2)
  })
})
