/**
 * The renderer's half of freeze recovery (the main process's half is native/system/rendererRecovery.cjs).
 *
 * When the main process had to reload the window because the renderer stopped, it loads the page again with `?recovery=<reason>`. This reads that flag once,
 * removes it from the address (so a manual reload is a normal start), and starts safely instead of restoring whatever was on screen when it stopped:
 *   - opens a light preset (the cheapest Cinema 2.0 preset in the app's own render telemetry) at reduced quality for a couple of minutes, and
 *   - tells the user what happened.
 * It never deletes anything: the previous preset is still in the library and one click away.
 *
 * Separately, when the GPU process dies while the window is still running, the main process sends an event and the renderer holds a short stretch of reduced load.
 */
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../components/vyzualz/cinema2'
import { cinema2NamespacedId, type Cinema2PresetId } from '../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { getNativeRecoveryBridge } from '../native/recoveryBridge'
import { notify } from '../stores/notificationStore'
import { useReactStore } from '../stores/reactStore'
import { writeCinema2LastPresetId } from '../components/vyzualz/react/cinema2WorkspacePreferences'
import { setPerformancePressure } from './performancePressure'
import { createLogger } from './logger'

const log = createLogger('system', 'recovery')

/** About 2 ms a frame on this machine's own telemetry, against 5-6 ms for the preset the app opens by default. */
export const RECOVERY_SAFE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.inertia')

const declarationFor = (id: Cinema2PresetId) => CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(declaration => declaration.manifest.id === id) ?? null
/** How long a recovery start (and, shorter, a GPU restart) holds reduced quality before the engines are free to go back up. */
export const RECOVERY_PRESSURE_HOLD_MS = 120_000
export const GPU_RESTART_PRESSURE_HOLD_MS = 60_000

/** For tests: whether the light preset still exists in the app's catalog (a rename would silently turn a recovery start into reduced quality only). */
export function recoverySafePresetIsAvailable(): boolean { return declarationFor(RECOVERY_SAFE_PRESET_ID) !== null }

const REASON_TEXT: Readonly<Record<string, string>> = Object.freeze({
  'renderer-unresponsive': 'the display stopped responding',
  'renderer-crashed': 'the display crashed',
  'renderer-killed': 'the display was stopped',
  'renderer-oom': 'the display ran out of memory',
  'renderer-launch-failed': 'the display failed to start',
  'renderer-integrity-failure': 'the display failed an integrity check',
  'renderer-abnormal-exit': 'the display exited unexpectedly',
  'renderer-gone': 'the display stopped',
  'gpu-process-gone': 'the graphics process stopped',
})

export interface RecoveryRequest { reason: string }

/** Reads `?recovery=` once and removes it from the address. Only the known reasons are accepted; anything else is not a recovery start. */
export function consumeRecoveryRequest(win: Pick<Window, 'location' | 'history'> = window): RecoveryRequest | null {
  let reason: string | null = null
  try {
    const url = new URL(win.location.href)
    reason = url.searchParams.get('recovery')
    if (reason === null) return null
    url.searchParams.delete('recovery')
    win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    return null
  }
  return reason in REASON_TEXT ? { reason } : null
}

export interface RecoverySafeStartDeps {
  presetExists: (id: Cinema2PresetId) => boolean
  presetName: (id: Cinema2PresetId) => string | null
  /** Switches the app to the Cinema 2.0 engine and opens the preset; returns whether it opened. */
  openPreset: (id: Cinema2PresetId) => boolean
  notifyUser: (title: string, message: string) => void
  setPressure: (holdMs: number) => void
}

/** Starts safely after a recovery reload. Returns whether the light preset was opened. */
export function applyRecoverySafeStart(request: RecoveryRequest, deps: RecoverySafeStartDeps): boolean {
  deps.setPressure(RECOVERY_PRESSURE_HOLD_MS)
  const id = RECOVERY_SAFE_PRESET_ID
  const opened = deps.presetExists(id) && deps.openPreset(id)
  const cause = REASON_TEXT[request.reason] ?? 'the display stopped'
  const minutes = Math.round(RECOVERY_PRESSURE_HOLD_MS / 60_000)
  deps.notifyUser(
    'Recovered from a graphics stall',
    opened
      ? `STAGELESS restarted its display because ${cause}. It opened ${deps.presetName(id) ?? 'a light preset'} at reduced quality; quality returns to normal in about ${minutes} minutes. Your previous preset is still in the Preset Manager.`
      : `STAGELESS restarted its display because ${cause}. It will run at reduced quality for about ${minutes} minutes.`,
  )
  return opened
}

function defaultDeps(): RecoverySafeStartDeps {
  return {
    presetExists: id => declarationFor(id) !== null,
    presetName: id => declarationFor(id)?.manifest.metadata?.name ?? null,
    openPreset: id => {
      const store = useReactStore.getState()
      store.selectReactEngine('cinema2')
      const result = useReactStore.getState().activateCinema2Workspace({ presetId: id })
      if (result.ok) writeCinema2LastPresetId(id)
      return result.ok
    },
    notifyUser: (title, message) => { notify('react', { tone: 'warning', title, message }) },
    setPressure: holdMs => setPerformancePressure('recovery', 2, { holdMs }),
  }
}

/**
 * Call once at startup, before the first render. Applies the safe start if the main process reloaded the window, and listens for the GPU-restart notice.
 * Returns the cleanup (for hot reload).
 */
export function installRendererRecovery(deps: RecoverySafeStartDeps = defaultDeps(), win: Pick<Window, 'location' | 'history'> = window): () => void {
  const request = consumeRecoveryRequest(win)
  if (request) {
    log.warn('starting in recovery mode', { reason: request.reason })
    // The store restores the saved selection as it loads; apply the safe start once it has.
    const run = () => { try { applyRecoverySafeStart(request, deps) } catch (error) { log.error('recovery safe start failed', { message: error instanceof Error ? error.message : String(error) }) } }
    const persist = useReactStore.persist
    if (persist.hasHydrated()) run()
    else persist.onFinishHydration(run)
  }

  const bridge = getNativeRecoveryBridge()
  const stop = bridge?.onEvent?.(event => {
    if (event?.kind !== 'gpu-process-gone') return
    log.warn('graphics process restarted; holding reduced quality', { reason: event.reason ?? null })
    setPerformancePressure('gpu', 1, { holdMs: GPU_RESTART_PRESSURE_HOLD_MS })
  })
  return () => { stop?.() }
}
