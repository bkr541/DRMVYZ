import { create } from 'zustand'
import { useVisualStore } from '../../stores/visualStore'
import { readSystemSettings, saveSystemSettings } from './systemSettingsDb'
import { SYSTEM_SETTING_KEYS, type SystemSettings } from './systemSettingsTypes'

/**
 * Keeps Settings > System Settings the same on every device the user signs in on. The values live in `useVisualStore` (and its local storage cache,
 * so the app works signed out and offline); this store copies them to and from `user_settings.system_settings` for the signed-in account.
 *
 * Sign-in: a setting the account has saved wins over this device's value. A setting the account has never saved is uploaded from this device.
 * After that, every change is saved to the account.
 */
export interface SystemSettingsSyncState {
  currentUserId: string | null
  syncing: boolean
  error: string | null
  initializeForUser(userId: string): Promise<void>
  clearForSignedOut(): void
  retrySync(): Promise<void>
}

const SAVE_DELAY_MS = 400

let generation = 0
let ready = false
let applyingRemote = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function readLocalSystemSettings(): SystemSettings {
  const state = useVisualStore.getState()
  return {
    quality: state.quality,
    autoQualityEnabled: state.autoQualityEnabled,
    autoQualityMin: state.autoQualityMin,
    autoQualityMax: state.autoQualityMax,
    autoPerformanceDefault: state.autoPerformanceDefault,
    bpmSync: state.bpmSync,
  }
}

function applyToVisualStore(settings: Partial<SystemSettings>): void {
  if (Object.keys(settings).length === 0) return
  applyingRemote = true
  try { useVisualStore.setState(settings) } finally { applyingRemote = false }
}

function cancelPendingSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
}

export const useSystemSettingsStore = create<SystemSettingsSyncState>((set, get) => ({
  currentUserId: null,
  syncing: false,
  error: null,

  async initializeForUser(userId) {
    const current = ++generation
    ready = false
    cancelPendingSave()
    set({ currentUserId: userId, syncing: true, error: null })

    const remote = await readSystemSettings(userId)
    if (current !== generation || get().currentUserId !== userId) return
    if (remote.error) {
      // Keep this device's values and keep saving nothing until the account can be read, so a failed read never overwrites the account.
      set({ syncing: false, error: remote.error })
      return
    }

    applyToVisualStore(remote.settings)
    const local = readLocalSystemSettings()
    const missing = SYSTEM_SETTING_KEYS.some(key => remote.settings[key] === undefined)
    if (missing) {
      const saved = await saveSystemSettings(userId, local)
      if (current !== generation || get().currentUserId !== userId) return
      if (saved.error) { set({ syncing: false, error: saved.error }); return }
    }
    ready = true
    set({ syncing: false, error: null })
  },

  clearForSignedOut() {
    generation += 1
    ready = false
    cancelPendingSave()
    set({ currentUserId: null, syncing: false, error: null })
  },

  async retrySync() {
    const userId = get().currentUserId
    if (!userId) return
    if (!ready) { await get().initializeForUser(userId); return }
    await flushSave(userId, generation)
  },
}))

async function flushSave(userId: string, current: number): Promise<void> {
  useSystemSettingsStore.setState({ syncing: true })
  const saved = await saveSystemSettings(userId, readLocalSystemSettings())
  if (current !== generation || useSystemSettingsStore.getState().currentUserId !== userId) return
  useSystemSettingsStore.setState({ syncing: false, error: saved.error })
}

function scheduleSave(): void {
  const { currentUserId } = useSystemSettingsStore.getState()
  if (!currentUserId || !ready) return
  cancelPendingSave()
  const current = generation
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushSave(currentUserId, current)
  }, SAVE_DELAY_MS)
}

// Any change to a System Settings value on this device (made in Settings or anywhere else) is saved to the account.
useVisualStore.subscribe((state, previous) => {
  if (applyingRemote) return
  if (SYSTEM_SETTING_KEYS.some(key => state[key] !== previous[key])) scheduleSave()
})
