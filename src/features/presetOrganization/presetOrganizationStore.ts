import { create } from 'zustand'
import {
  loadPresetOrganizations,
  savePresetOrganization,
  type PresetOrganization,
} from './presetOrganizationDb'

interface PresetOrganizationState {
  records: Record<string, PresetOrganization>
  status: 'idle' | 'loading' | 'ready'
  error: string | null
  load(): Promise<void>
  update(presetKey: string, organization: PresetOrganization): Promise<boolean>
}

export const EMPTY_PRESET_ORGANIZATION: PresetOrganization = { tags: [], collectionIds: [] }

export const usePresetOrganizationStore = create<PresetOrganizationState>((set, get) => ({
  records: {},
  status: 'idle',
  error: null,
  async load() {
    if (get().status !== 'idle') return
    set({ status: 'loading', error: null })
    try {
      set({ records: await loadPresetOrganizations(), status: 'ready' })
    } catch (error) {
      set({ status: 'ready', error: error instanceof Error ? error.message : 'Preset organization could not be loaded.' })
    }
  },
  async update(presetKey, organization) {
    const next = { tags: [...organization.tags], collectionIds: [...organization.collectionIds] }
    set(state => ({ records: { ...state.records, [presetKey]: next }, error: null }))
    try {
      const saved = await savePresetOrganization(presetKey, next)
      if (!saved) set({ error: 'Sign in to save preset tags and collections.' })
      return saved
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Preset organization could not be saved.' })
      return false
    }
  },
}))
