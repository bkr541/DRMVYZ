// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readContextualHelpPreference, saveContextualHelpPreference } = vi.hoisted(() => ({
  readContextualHelpPreference: vi.fn(),
  saveContextualHelpPreference: vi.fn(),
}))

vi.mock('../contextualHelpDb', () => ({
  readContextualHelpPreference,
  saveContextualHelpPreference,
}))

import { useContextualHelpStore } from '../contextualHelpStore'

function resetStore() {
  useContextualHelpStore.setState({
    infoEnabled: true,
    currentUserId: null,
    loading: false,
    syncing: false,
    error: null,
    source: 'default',
  })
}

describe('contextualHelpStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetStore()
  })

  it('defaults contextual info icons to enabled', () => {
    expect(useContextualHelpStore.getState().infoEnabled).toBe(true)
  })

  it('applies and caches a local preference immediately', async () => {
    await useContextualHelpStore.getState().setInfoEnabled(false)

    expect(useContextualHelpStore.getState().infoEnabled).toBe(false)
    expect(localStorage.getItem('drmvyz:contextual-help:enabled:v1')).toContain('"infoEnabled":false')
    expect(saveContextualHelpPreference).not.toHaveBeenCalled()
  })

  it('persists authenticated changes locally and to Supabase', async () => {
    useContextualHelpStore.setState({ currentUserId: 'user-a' })
    saveContextualHelpPreference.mockResolvedValue({
      record: { infoEnabled: false, updatedAt: '2026-08-03T09:00:00.000Z' },
      error: null,
    })

    await useContextualHelpStore.getState().setInfoEnabled(false)

    expect(saveContextualHelpPreference).toHaveBeenCalledWith('user-a', false)
    expect(localStorage.getItem('drmvyz:contextual-help:user:v1:user-a')).toContain('"infoEnabled":false')
    expect(useContextualHelpStore.getState().source).toBe('database')
  })

  it('hydrates the saved Supabase preference into both caches', async () => {
    readContextualHelpPreference.mockResolvedValue({
      record: { infoEnabled: false, updatedAt: '2026-08-03T09:00:00.000Z' },
      error: null,
    })

    await useContextualHelpStore.getState().initializeForUser('user-a')

    expect(useContextualHelpStore.getState().infoEnabled).toBe(false)
    expect(localStorage.getItem('drmvyz:contextual-help:enabled:v1')).toContain('"infoEnabled":false')
    expect(localStorage.getItem('drmvyz:contextual-help:user:v1:user-a')).toContain('"infoEnabled":false')
    expect(saveContextualHelpPreference).not.toHaveBeenCalled()
  })

  it('does not let delayed startup hydration overwrite a direct choice', async () => {
    let resolveRead: ((value: unknown) => void) | undefined
    readContextualHelpPreference.mockReturnValue(new Promise(resolve => { resolveRead = resolve }))
    saveContextualHelpPreference.mockResolvedValue({
      record: { infoEnabled: false, updatedAt: '2026-08-03T09:01:00.000Z' },
      error: null,
    })

    const initialization = useContextualHelpStore.getState().initializeForUser('user-a')
    await useContextualHelpStore.getState().setInfoEnabled(false)
    resolveRead?.({
      record: { infoEnabled: true, updatedAt: '2026-08-03T09:00:00.000Z' },
      error: null,
    })
    await initialization

    expect(useContextualHelpStore.getState().infoEnabled).toBe(false)
  })
})
