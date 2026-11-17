/**
 * The user's own default for every Auto Performance toggle in the app (Settings > System Settings > Auto Performance).
 * One value, read by every engine that has the toggle: Cinema 2.0 presets, the CANVAS renderers, the XY Scope instruments and Sound Drawing.
 * Engines never import an app store for it; the visual store publishes it here.
 *
 * null until the user's setting is known (tests, and any host that never sets it): each engine then keeps its own authored default.
 */
let userDefault: boolean | null = null
const listeners = new Set<(value: boolean) => void>()

export function getAutoPerformanceUserDefault(): boolean | null {
  return userDefault
}

export function setAutoPerformanceUserDefault(value: boolean | null): void {
  if (userDefault === value) return
  userDefault = value
  if (value !== null) listeners.forEach(listener => listener(value))
}

/** Called when the setting changes while engines are running. */
export function subscribeAutoPerformanceUserDefault(listener: (value: boolean) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
