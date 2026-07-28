import type { MonitoringMode } from './audio'

export interface WorkspacePreset {
  id: string
  name: string
  createdAt: number
  monitoringMode: MonitoringMode
  fftSize: number
  smoothing: number
  /** @deprecated Compatibility-only workspace look name. Runtime appearance is owned by features/appearance. */
  theme: string
  layout: string
}

export const DEFAULT_WORKSPACE: Omit<WorkspacePreset, 'id' | 'name' | 'createdAt'> = {
  monitoringMode: 'stereo',
  fftSize: 2048,
  smoothing: 0.8,
  theme: 'cyan-green',
  layout: 'dashboard',
}
