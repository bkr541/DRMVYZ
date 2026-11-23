'use strict'

// Recovers the main window from a renderer that has stopped, which nothing else in the app does: the engines' own quality governors sample frames inside their render
// loop, so they cannot see a renderer that has stopped producing frames, and Electron by itself only reports `unresponsive` / `render-process-gone` / a dead GPU process.
//
// What it does:
//   - the renderer stays unresponsive for UNRESPONSIVE_RECOVERY_MS      -> terminate it and load the window again
//   - the renderer process is gone (crashed, killed, out of memory...)  -> load the window again
//   - the GPU process dies while the renderer is already unresponsive   -> load the window again at once
//   - the GPU process dies and the renderer is fine                     -> leave it running (the engines recover their own graphics contexts) and tell it,
//                                                                         so it can shed load while the GPU settles
// A reload loads the same page with `?recovery=<reason>`; the renderer starts on a light preset at reduced quality (src/lib/rendererRecovery.ts) instead of
// restoring whatever was on screen when it stopped. Recovery is rate-limited so a window that cannot come back is left alone instead of reloading forever, it
// never runs while the app is quitting, and DRMVYZ_RENDERER_RECOVERY=off turns it off.

// Chromium itself takes about 16 s to call a stuck renderer unresponsive (measured on Electron 43), so this is on top of that.
const UNRESPONSIVE_RECOVERY_MS = 10_000
const MAX_RECOVERIES = 3
const RECOVERY_WINDOW_MS = 5 * 60_000
/** A reload that has not finished loading by then no longer blocks the next recovery. */
const RECOVERING_TIMEOUT_MS = 30_000
const BAD_PROCESS_REASONS = new Set(['crashed', 'killed', 'oom', 'launch-failed', 'integrity-failure', 'abnormal-exit'])

/** The `recovery` query value for a renderer-process-gone reason; only known words ever reach the page. */
function recoveryReasonFor(kind, detail) {
  if (kind === 'gpu') return 'gpu-process-gone'
  if (kind === 'unresponsive') return 'renderer-unresponsive'
  return BAD_PROCESS_REASONS.has(detail) ? `renderer-${detail}` : 'renderer-gone'
}

function recoveryEnabled(env = process.env) {
  return String(env.DRMVYZ_RENDERER_RECOVERY ?? '').toLowerCase() !== 'off'
}

function createRendererRecovery({ log, buildUrl, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, enabled = recoveryEnabled(), unresponsiveMs = UNRESPONSIVE_RECOVERY_MS }) {
  const state = { webContents: null, unresponsive: false, recovering: false, quitting: false, limitLogged: false, recoveries: [], unresponsiveTimer: null, recoveringTimer: null }

  const alive = () => state.webContents && !state.webContents.isDestroyed()
  const clearTimers = () => {
    if (state.unresponsiveTimer !== null) { clearTimer(state.unresponsiveTimer); state.unresponsiveTimer = null }
    if (state.recoveringTimer !== null) { clearTimer(state.recoveringTimer); state.recoveringTimer = null }
  }

  function recover(reason) {
    if (!alive() || state.quitting) return false
    if (!enabled) {
      log.warn('renderer recovery is off (DRMVYZ_RENDERER_RECOVERY=off); leaving the window as it is', { reason })
      return false
    }
    if (state.recovering) return false
    const at = now()
    state.recoveries = state.recoveries.filter(time => at - time < RECOVERY_WINDOW_MS)
    if (state.recoveries.length >= MAX_RECOVERIES) {
      if (!state.limitLogged) {
        state.limitLogged = true
        log.error('renderer recovery limit reached; leaving the window as it is', { reason, recoveries: state.recoveries.length, windowMs: RECOVERY_WINDOW_MS })
      }
      return false
    }
    state.recoveries.push(at)
    state.recovering = true
    state.unresponsive = false
    if (state.unresponsiveTimer !== null) { clearTimer(state.unresponsiveTimer); state.unresponsiveTimer = null }
    log.warn('renderer recovery: reloading the window', { reason, attempt: state.recoveries.length, maxAttempts: MAX_RECOVERIES })
    const contents = state.webContents
    // A stuck renderer cannot be asked to reload: end its process first, then load the page into a new one.
    try { contents.forcefullyCrashRenderer?.() } catch { /* already gone */ }
    try { void contents.loadURL(buildUrl(reason)) } catch (error) { log.error('renderer recovery: loadURL failed', error) }
    state.recoveringTimer = setTimer(() => { state.recovering = false; state.recoveringTimer = null }, RECOVERING_TIMEOUT_MS)
    return true
  }

  return {
    /** Starts watching one window's web contents. */
    attach(webContents) {
      state.webContents = webContents
      webContents.on('unresponsive', () => {
        state.unresponsive = true
        if (state.unresponsiveTimer !== null) clearTimer(state.unresponsiveTimer)
        state.unresponsiveTimer = setTimer(() => { state.unresponsiveTimer = null; if (state.unresponsive) recover(recoveryReasonFor('unresponsive')) }, unresponsiveMs)
      })
      webContents.on('responsive', () => {
        if (state.unresponsive) log.info('renderer responsive again')
        state.unresponsive = false
        if (state.unresponsiveTimer !== null) { clearTimer(state.unresponsiveTimer); state.unresponsiveTimer = null }
      })
      webContents.on('render-process-gone', (_event, details) => {
        // A clean exit is the window closing or the app quitting, not a failure.
        if (!details || details.reason === 'clean-exit') return
        recover(recoveryReasonFor('gone', details.reason))
      })
      webContents.on('did-finish-load', () => {
        if (state.recoveringTimer !== null) { clearTimer(state.recoveringTimer); state.recoveringTimer = null }
        state.recovering = false
      })
      webContents.once('destroyed', () => { clearTimers(); state.webContents = null })
    },

    /** Wire to `app.on('child-process-gone')`. */
    handleChildProcessGone(details) {
      if (!details || details.type !== 'GPU' || !BAD_PROCESS_REASONS.has(details.reason)) return
      if (state.unresponsive) { recover(recoveryReasonFor('gpu')); return }
      if (!alive() || state.quitting) return
      log.warn('GPU process died while the renderer is still responsive; telling the renderer to shed load', { reason: details.reason })
      try { state.webContents.send('drmvyz:recovery:event', { kind: 'gpu-process-gone', reason: details.reason }) } catch { /* window closing */ }
    },

    /** Wire to `app.on('before-quit')`: nothing is recovered while the app is quitting. */
    setQuitting() { state.quitting = true; clearTimers() },

    dispose() { clearTimers(); state.webContents = null },
  }
}

module.exports = { createRendererRecovery, recoveryReasonFor, recoveryEnabled, UNRESPONSIVE_RECOVERY_MS, MAX_RECOVERIES, RECOVERY_WINDOW_MS, BAD_PROCESS_REASONS }
