import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSplitPersistStorage, mergeStorageValues, splitStorageValue } from './splitPersistStorage'

type TestState = {
  preference: string
  project: { payload: string }
  clips: unknown[]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('splitPersistStorage helpers', () => {
  it('keeps small preferences local and moves project fields into the project envelope', () => {
    const split = splitStorageValue<TestState>({
      version: 7,
      state: {
        preference: 'presets',
        project: { payload: '<svg>large</svg>' },
        clips: [{ id: 'clip-1' }],
      },
    }, ['project', 'clips'])

    expect(split.local).toEqual({
      version: 7,
      state: { preference: 'presets' },
    })
    expect(split.project).toEqual({
      version: 7,
      state: {
        project: { payload: '<svg>large</svg>' },
        clips: [{ id: 'clip-1' }],
      },
    })
    expect(split.hasProjectData).toBe(true)
  })

  it('merges local and project envelopes back into one Zustand snapshot', () => {
    const merged = mergeStorageValues<TestState>(
      { version: 3, state: { preference: 'fx' } },
      { version: 3, state: { project: { payload: 'data' }, clips: [] } },
    )

    expect(merged).toEqual({
      version: 3,
      state: {
        preference: 'fx',
        project: { payload: 'data' },
        clips: [],
      },
    })
  })

  it('reports an IndexedDB failure and retries the exact project write successfully', async () => {
    let shouldFail = true
    const statusEvents: Array<{ phase: string; retry?: () => Promise<boolean> }> = []
    const localValues = new Map<string, string>()

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => { localValues.set(key, value) },
      removeItem: (key: string) => { localValues.delete(key) },
    })

    const fakeDb = {
      objectStoreNames: { contains: () => true },
      createObjectStore: vi.fn(),
      close: vi.fn(),
      onversionchange: null as (() => void) | null,
      transaction: vi.fn(() => {
        const tx = {
          error: new Error('disk full'),
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onabort: null as (() => void) | null,
          objectStore: () => ({
            put: () => {
              queueMicrotask(() => {
                if (shouldFail) tx.onerror?.()
                else tx.oncomplete?.()
              })
            },
          }),
        }
        return tx
      }),
    }
    const request = {
      result: fakeDb,
      error: null,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onblocked: null as (() => void) | null,
    }
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        queueMicrotask(() => request.onsuccess?.())
        return request
      }),
    })

    const storage = createSplitPersistStorage<TestState>({
      projectKeys: ['project', 'clips'],
      onStatusChange: event => statusEvents.push(event),
    })
    const snapshot = {
      version: 1,
      state: {
        preference: 'presets',
        project: { payload: 'recover-me' },
        clips: [{ id: 'clip-1' }],
      },
    }

    await storage.setItem('react-project', snapshot)
    const failure = statusEvents.find(event => event.phase === 'error')
    expect(statusEvents.map(event => event.phase)).toEqual(['dirty', 'saving', 'error'])
    expect(failure?.retry).toBeTypeOf('function')

    shouldFail = false
    await expect(failure?.retry?.()).resolves.toBe(true)
    expect(statusEvents[statusEvents.length - 1]?.phase).toBe('saved')
    expect(fakeDb.transaction).toHaveBeenCalledTimes(2)
  })

})
