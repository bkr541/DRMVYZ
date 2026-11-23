export interface NativeRecoveryEvent {
  /** The GPU process died while the window was still running. */
  kind: 'gpu-process-gone'
  reason?: string
}

export interface NativeRecoveryBridge {
  /** Called when the main process reports a graphics-process failure that did not need the window reloaded. Returns the unsubscribe. */
  onEvent?: (callback: (event: NativeRecoveryEvent) => void) => () => void
}

export function getNativeRecoveryBridge(): NativeRecoveryBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.recovery ?? null
}
