// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readAppearanceTheme, saveAppearanceTheme } = vi.hoisted(() => ({
  readAppearanceTheme: vi.fn(),
  saveAppearanceTheme: vi.fn(),
}))

vi.mock('../appearanceDb', () => ({
  readAppearanceTheme,
  saveAppearanceTheme,
}))

import { useAppearanceStore } from '../appearanceStore'
import { normalizeAppearanceTheme } from '../appearanceTypes'

function resetStore() {
  useAppearanceStore.setState({
    theme: 'dark',
    currentUserId: null,
    loading: false,
    syncing: false,
    error: null,
    source: 'default',
  })
}

describe('appearanceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''
    resetStore()
  })

  it('applies and caches a local theme immediately', async () => {
    await useAppearanceStore.getState().setTheme('cdj')

    expect(useAppearanceStore.getState().theme).toBe('cdj')
    expect(document.documentElement.dataset.theme).toBe('cdj')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('drmvyz:appearance:theme:v1')).toContain('"theme":"cdj"')
    expect(saveAppearanceTheme).not.toHaveBeenCalled()
  })

  it('persists authenticated changes locally and to Supabase', async () => {
    useAppearanceStore.setState({ currentUserId: 'user-a' })
    saveAppearanceTheme.mockResolvedValue({
      record: { theme: 'light', updatedAt: '2026-07-28T08:00:00.000Z' },
      error: null,
    })

    await useAppearanceStore.getState().setTheme('light')

    expect(saveAppearanceTheme).toHaveBeenCalledWith('user-a', 'light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('drmvyz:appearance:user:v1:user-a')).toContain('"theme":"light"')
    expect(useAppearanceStore.getState().source).toBe('database')
  })

  it('hydrates a newer Supabase theme into both caches', async () => {
    readAppearanceTheme.mockResolvedValue({
      record: { theme: 'cdj', updatedAt: '2026-07-28T08:00:00.000Z' },
      error: null,
    })

    await useAppearanceStore.getState().initializeForUser('user-a')

    expect(useAppearanceStore.getState().theme).toBe('cdj')
    expect(document.documentElement.dataset.theme).toBe('cdj')
    expect(localStorage.getItem('drmvyz:appearance:theme:v1')).toContain('"theme":"cdj"')
    expect(localStorage.getItem('drmvyz:appearance:user:v1:user-a')).toContain('"theme":"cdj"')
    expect(saveAppearanceTheme).not.toHaveBeenCalled()
  })

  it('does not let delayed startup hydration overwrite a direct choice', async () => {
    let resolveRead: ((value: unknown) => void) | undefined
    readAppearanceTheme.mockReturnValue(new Promise(resolve => { resolveRead = resolve }))
    saveAppearanceTheme.mockResolvedValue({
      record: { theme: 'light', updatedAt: '2026-07-28T08:01:00.000Z' },
      error: null,
    })

    const initialization = useAppearanceStore.getState().initializeForUser('user-a')
    await useAppearanceStore.getState().setTheme('light')
    resolveRead?.({
      record: { theme: 'cdj', updatedAt: '2026-07-28T08:00:00.000Z' },
      error: null,
    })
    await initialization

    expect(useAppearanceStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('normalizes the legacy system value to Dark', () => {
    expect(normalizeAppearanceTheme('system')).toBe('dark')
  })
})
