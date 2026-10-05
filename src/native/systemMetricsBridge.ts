export interface NativeCpuUsage {
  /** Whole-app CPU as a percentage of total machine capacity (0–100). */
  percent: number
  /** Sum across the app's processes where 100 = one full core. */
  rawPercent: number
  processCount: number
  cores: number
  timestamp: number
}

export interface NativeSystemBridge {
  /** CPU used by every process of the desktop app; null if the main process could not read it. */
  getCpuUsage?: () => Promise<NativeCpuUsage | null>
}

export function getNativeSystemBridge(): NativeSystemBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.system ?? null
}

export function isCpuUsageAvailable(): boolean {
  return typeof getNativeSystemBridge()?.getCpuUsage === 'function'
}
