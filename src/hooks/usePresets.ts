import { useState, useCallback } from 'react'
import { VisualPreset, GlobalSettings, ModuleInstance, LayoutPreset } from '../types'
import { generateId } from '../utils/audioUtils'

const STORAGE_KEY = 'drmvyz_presets'

function loadFromStorage(): VisualPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(presets: VisualPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch { /* storage full */ }
}

export interface PresetSystem {
  presets: VisualPreset[]
  savePreset: (name: string, settings: GlobalSettings, modules: ModuleInstance[], layout: LayoutPreset) => void
  loadPreset: (id: string) => VisualPreset | null
  deletePreset: (id: string) => void
  exportPreset: (id: string) => void
  importPreset: (json: string) => void
}

export function usePresets(): PresetSystem {
  const [presets, setPresets] = useState<VisualPreset[]>(loadFromStorage)

  const savePreset = useCallback((
    name: string,
    settings: GlobalSettings,
    modules: ModuleInstance[],
    layout: LayoutPreset
  ) => {
    const preset: VisualPreset = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      settings: { ...settings },
      modules: modules.map(m => ({ ...m, settings: { ...m.settings } })),
      layout,
    }
    setPresets(prev => {
      const next = [...prev, preset]
      saveToStorage(next)
      return next
    })
  }, [])

  const loadPreset = useCallback((id: string): VisualPreset | null => {
    return presets.find(p => p.id === id) ?? null
  }, [presets])

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  const exportPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id)
    if (!preset) return
    const json = JSON.stringify(preset, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drmvyz-preset-${preset.name.replace(/\s+/g, '-')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [presets])

  const importPreset = useCallback((json: string) => {
    try {
      const preset = JSON.parse(json) as VisualPreset
      if (!preset.id || !preset.name) throw new Error('Invalid preset')
      preset.id = generateId() // ensure unique id
      setPresets(prev => {
        const next = [...prev, preset]
        saveToStorage(next)
        return next
      })
    } catch {
      alert('Invalid preset file.')
    }
  }, [])

  return { presets, savePreset, loadPreset, deletePreset, exportPreset, importPreset }
}
