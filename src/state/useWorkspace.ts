import { useState, useCallback } from 'react'
import { generateId } from '../utils/audioUtils'
import type { WorkspacePreset } from '../types/session'

const STORAGE_KEY = 'drmvyz_workspaces'

function load(): WorkspacePreset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function save(items: WorkspacePreset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /**/ }
}

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<WorkspacePreset[]>(load)

  const saveWorkspace = useCallback((name: string, data: Omit<WorkspacePreset, 'id' | 'name' | 'createdAt'>) => {
    const preset: WorkspacePreset = { id: generateId(), name, createdAt: Date.now(), ...data }
    setWorkspaces(prev => {
      const next = [...prev, preset]
      save(next)
      return next
    })
  }, [])

  const deleteWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => {
      const next = prev.filter(w => w.id !== id)
      save(next)
      return next
    })
  }, [])

  const exportWorkspace = useCallback((id: string) => {
    const w = workspaces.find(x => x.id === id)
    if (!w) return
    const blob = new Blob([JSON.stringify(w, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${w.name.replace(/\s+/g, '_')}_workspace.json`
    a.click(); URL.revokeObjectURL(url)
  }, [workspaces])

  const importWorkspace = useCallback((json: string) => {
    try {
      const w: WorkspacePreset = JSON.parse(json)
      w.id = generateId()
      setWorkspaces(prev => {
        const next = [...prev, w]
        save(next)
        return next
      })
    } catch { /**/ }
  }, [])

  return { workspaces, saveWorkspace, deleteWorkspace, exportWorkspace, importWorkspace }
}
