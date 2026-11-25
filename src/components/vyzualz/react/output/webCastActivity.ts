import { useSyncExternalStore } from 'react'
let active = false
const listeners = new Set<() => void>()
export function setWebCastActive(value: boolean) {
  if (active === value) return
  active = value
  listeners.forEach(listener => listener())
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useWebCastActivity() { return useSyncExternalStore(subscribe, () => active, () => false) }
