import { useState, useCallback } from 'react'
import { ModuleInstance, ModuleWidth, ModuleHeight, ModuleSettings, DEFAULT_MODULES } from '../types'

export interface ModuleSystem {
  modules: ModuleInstance[]
  setModules: React.Dispatch<React.SetStateAction<ModuleInstance[]>>
  enabledModules: ModuleInstance[]
  toggleModule: (id: string) => void
  updateModuleSettings: (id: string, settings: Partial<ModuleSettings>) => void
  setModuleWidth: (id: string, width: ModuleWidth) => void
  setModuleHeight: (id: string, height: ModuleHeight) => void
  moveModule: (id: string, direction: 'up' | 'down') => void
  swapModules: (idA: string, idB: string) => void
}

export function useModuleSystem(initial = DEFAULT_MODULES): ModuleSystem {
  const [modules, setModules] = useState<ModuleInstance[]>(
    () => [...initial].sort((a, b) => a.order - b.order)
  )

  const enabledModules = modules.filter(m => m.enabled)

  const toggleModule = useCallback((id: string) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }, [])

  const updateModuleSettings = useCallback((id: string, settings: Partial<ModuleSettings>) => {
    setModules(prev => prev.map(m =>
      m.id === id ? { ...m, settings: { ...m.settings, ...settings } } : m
    ))
  }, [])

  const setModuleWidth = useCallback((id: string, width: ModuleWidth) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, width } : m))
  }, [])

  const setModuleHeight = useCallback((id: string, height: ModuleHeight) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, height } : m))
  }, [])

  const moveModule = useCallback((id: string, direction: 'up' | 'down') => {
    setModules(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex(m => m.id === id)
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev

      // Swap orders
      const result = sorted.map(m => ({ ...m }))
      const tmp = result[idx].order
      result[idx].order = result[targetIdx].order
      result[targetIdx].order = tmp
      return result.sort((a, b) => a.order - b.order)
    })
  }, [])

  const swapModules = useCallback((idA: string, idB: string) => {
    setModules(prev => {
      const result = prev.map(m => ({ ...m }))
      const a = result.find(m => m.id === idA)
      const b = result.find(m => m.id === idB)
      if (!a || !b) return prev
      const tmp = a.order
      a.order = b.order
      b.order = tmp
      return result.sort((a, b) => a.order - b.order)
    })
  }, [])

  return {
    modules,
    setModules,
    enabledModules,
    toggleModule,
    updateModuleSettings,
    setModuleWidth,
    setModuleHeight,
    moveModule,
    swapModules,
  }
}
