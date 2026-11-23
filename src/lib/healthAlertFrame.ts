import { isCriticalHealth, useHealthStore } from '../stores/healthStore'

/**
 * Mirrors "something is being repaired or could not be" onto <html data-health-alert>, which draws the red frame around the visualizer and the left rail (styles/healthAlert.css).
 * Call once at startup; returns the cleanup.
 */
export function installHealthAlertFrame(root: HTMLElement = document.documentElement): () => void {
  const apply = () => {
    const state = useHealthStore.getState().systems
    if (isCriticalHealth(state)) root.setAttribute('data-health-alert', 'true')
    else root.removeAttribute('data-health-alert')
  }
  apply()
  const unsubscribe = useHealthStore.subscribe(apply)
  return () => { unsubscribe(); root.removeAttribute('data-health-alert') }
}
