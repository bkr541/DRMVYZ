/** Mirrors Electron's `systemPreferences.getMediaAccessStatus()` ('granted' on platforms that have no OS gate). */
export type NativeCameraAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

export interface NativeCameraBridge {
  /** The operating system's own camera permission for DRMVYZ — independent of Electron's session permission. */
  getAccessStatus?: () => Promise<NativeCameraAccessStatus>
  /** Raises the macOS camera prompt when status is 'not-determined'; resolves to the resulting status. */
  requestAccess?: () => Promise<NativeCameraAccessStatus>
  /** Opens the OS camera-privacy settings page. Resolves false when the platform has none. */
  openSettings?: () => Promise<boolean>
}

export function getNativeCameraBridge(): NativeCameraBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = window.drmvyzNative?.camera
  return bridge && (bridge.getAccessStatus || bridge.requestAccess) ? bridge : null
}
