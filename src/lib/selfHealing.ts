/**
 * The one place the three self-healers report through. Each detector (cast reconnect, audio recovery, graphics recovery) calls these four functions; they update
 * the HEALTH readout and post the Notifications-tab messages, once per episode, so a retry loop never spams the panel.
 */
import { HEALTH_LABELS, useHealthStore, type HealthState, type HealthSystem } from '../stores/healthStore'
import { notify } from '../stores/notificationStore'
import { createLogger } from './logger'

const log = createLogger('system', 'self-healing')

const stateOf = (system: HealthSystem): HealthState => useHealthStore.getState().systems[system].state

/** A failure was detected and the repair has started. Posts "Self-healing started" once until the system is healthy again. */
export function beginHealing(system: HealthSystem, reason: string): void {
  const wasHealing = stateOf(system) === 'healing'
  useHealthStore.getState().setHealth(system, 'healing', reason)
  if (wasHealing) return
  log.warn('self-healing started', { system, reason })
  notify('react', { tone: 'warning', title: `Self-healing started: ${HEALTH_LABELS[system]}`, message: `${reason}. STAGELESS is fixing it automatically.` })
}

/** The system works again. Posts a confirmation only when it had been healing or failed. */
export function markHealed(system: HealthSystem, detail: string | null = null): void {
  const previous = stateOf(system)
  useHealthStore.getState().setHealth(system, 'ok', detail)
  if (previous !== 'healing' && previous !== 'failed') return
  log.info('self-healing complete', { system })
  notify('react', { tone: 'success', title: `Self-healing complete: ${HEALTH_LABELS[system]}`, message: `${HEALTH_LABELS[system]} is working again.` })
}

/** Automatic repair gave up. Posts one error until the system recovers. */
export function markFailed(system: HealthSystem, reason: string): void {
  const wasFailed = stateOf(system) === 'failed'
  useHealthStore.getState().setHealth(system, 'failed', reason)
  if (wasFailed) return
  log.error('self-healing failed', { system, reason })
  notify('react', { tone: 'error', title: `${HEALTH_LABELS[system]} needs attention`, message: `${reason}. Automatic repair did not work.` })
}

/** A quiet state change with no notice: reduced quality, or nothing to watch. A system that is being repaired keeps its state. */
export function setHealthQuietly(system: HealthSystem, state: 'idle' | 'ok' | 'degraded', detail: string | null = null): void {
  const current = stateOf(system)
  if (current === 'healing' || current === 'failed') return
  useHealthStore.getState().setHealth(system, state, detail)
}

/** Delays between reconnect attempts: three tries over about 15 s, then it stops and says so. */
export const RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_500, 4_000, 10_000])
