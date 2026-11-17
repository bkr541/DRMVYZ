import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemSettings } from '../systemSettingsTypes'

const readSystemSettings = vi.fn()
const saveSystemSettings = vi.fn()
vi.mock('../systemSettingsDb', () => ({
  readSystemSettings: (...args: unknown[]) => readSystemSettings(...args),
  saveSystemSettings: (...args: unknown[]) => saveSystemSettings(...args),
}))

import { useVisualStore } from '../../../stores/visualStore'
import { readLocalSystemSettings, useSystemSettingsStore } from '../systemSettingsStore'

const LOCAL: SystemSettings = { quality: 'High', autoQualityEnabled: false, autoQualityMin: 'Low', autoQualityMax: 'High', autoPerformanceDefault: false, bpmSync: false }

beforeEach(() => {
  vi.useFakeTimers()
  readSystemSettings.mockReset()
  saveSystemSettings.mockReset().mockResolvedValue({ error: null })
  useVisualStore.setState(LOCAL)
})
afterEach(() => {
  useSystemSettingsStore.getState().clearForSignedOut()
  vi.useRealTimers()
})

describe('System Settings account sync', () => {
  it('covers every System Settings value of the visual store', () => {
    expect(Object.keys(readLocalSystemSettings()).sort()).toEqual(Object.keys(LOCAL).sort())
  })

  it('applies the account\'s values on sign-in and uploads nothing when every setting is saved', async () => {
    const remote: SystemSettings = { quality: 'Low', autoQualityEnabled: true, autoQualityMin: 'Medium', autoQualityMax: 'Medium', autoPerformanceDefault: true, bpmSync: true }
    readSystemSettings.mockResolvedValue({ settings: remote, error: null })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    expect(readLocalSystemSettings()).toEqual(remote)
    expect(saveSystemSettings).not.toHaveBeenCalled()
  })

  it('uploads this device\'s value for a setting the account has never saved, and keeps the account\'s other values', async () => {
    useVisualStore.setState({ bpmSync: true, quality: 'Medium' })
    readSystemSettings.mockResolvedValue({ settings: { quality: 'Low' }, error: null })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    expect(useVisualStore.getState().quality).toBe('Low')
    expect(saveSystemSettings).toHaveBeenCalledTimes(1)
    expect(saveSystemSettings).toHaveBeenCalledWith('u1', { ...LOCAL, quality: 'Low', bpmSync: true })
  })

  it('saves each later change to the account, once, after a short pause', async () => {
    readSystemSettings.mockResolvedValue({ settings: LOCAL, error: null })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    useVisualStore.getState().setAutoPerformanceDefault(true)
    useVisualStore.getState().setQuality('Low')
    expect(saveSystemSettings).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSystemSettings).toHaveBeenCalledTimes(1)
    expect(saveSystemSettings).toHaveBeenCalledWith('u1', { ...LOCAL, autoPerformanceDefault: true, quality: 'Low' })
  })

  it('does not save changes to other visual state, or while signed out', async () => {
    useVisualStore.getState().setQuality('Low')
    await vi.advanceTimersByTimeAsync(500)
    readSystemSettings.mockResolvedValue({ settings: LOCAL, error: null })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    useVisualStore.setState({ bpm: 133 })
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSystemSettings).not.toHaveBeenCalled()
  })

  it('never overwrites the account when it could not be read', async () => {
    readSystemSettings.mockResolvedValue({ settings: {}, error: 'offline' })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    useVisualStore.getState().setQuality('Low')
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSystemSettings).not.toHaveBeenCalled()
    expect(useSystemSettingsStore.getState().error).toBe('offline')
  })

  it('does not echo the account\'s own values back as a save', async () => {
    readSystemSettings.mockResolvedValue({ settings: { ...LOCAL, quality: 'Low' }, error: null })
    await useSystemSettingsStore.getState().initializeForUser('u1')
    await vi.advanceTimersByTimeAsync(500)
    expect(saveSystemSettings).not.toHaveBeenCalled()
  })
})
