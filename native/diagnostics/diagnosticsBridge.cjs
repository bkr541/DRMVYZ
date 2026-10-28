'use strict'

const fs = require('node:fs')
const path = require('node:path')
const fsp = require('node:fs/promises')

const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])
// Mirrors src/lib/logComponents.ts — kept in sync manually since main-process
// .cjs files can't import the TS source.
const LOG_COMPONENTS = new Set([
  'react', 'show-manager', 'rekordbox', 'output', 'lyrics',
  'music-intelligence', 'brand-kit', 'settings', 'auth', 'system',
])
// Initial load reads only the tail of the file — a live show's log can run
// to several MB, and the Logging panel only needs recent history to be useful.
const TAIL_BYTES = 2 * 1024 * 1024
const CHANGE_DEBOUNCE_MS = 150

// One watcher per subscribed renderer (webContents id), so closing/reopening
// the Settings panel — or having it open in more than one window — never
// leaks file watchers or double-delivers appended text.
const watchersBySenderId = new Map()

/**
 * Forwards renderer log entries (see src/lib/logger.ts) into the same
 * electron-log file the main process already writes to, so a packaged
 * build's renderer failures — React crashes, WebGL context loss, audio
 * engine issues — leave a trace on disk instead of only living in a
 * DevTools console no user can reach. Also serves that same file back to
 * the renderer for the Settings → Developer → Logging panel: a one-shot
 * tail read plus a live-tail subscription.
 */
function installDiagnosticsBridge({ ipcMain, log }) {
  ipcMain.on('drmvyz:diagnostics:log', (_event, entry) => {
    if (!entry || typeof entry !== 'object') return
    const { level, component, category, message, context } = entry
    const componentPrefix = LOG_COMPONENTS.has(component) ? component : 'system'
    const categoryPart = typeof category === 'string' && category ? `:${category}` : ''
    const scoped = log.scope(`${componentPrefix}${categoryPart}`)
    const write = LOG_LEVELS.has(level) ? scoped[level] : scoped.info
    const text = typeof message === 'string' ? message : String(message)
    if (context === undefined) write.call(scoped, text)
    else write.call(scoped, text, context)
  })

  ipcMain.handle('drmvyz:diagnostics:read-main-log', async () => {
    const filePath = log.transports.file.getFile().path
    try {
      const stat = await fsp.stat(filePath)
      const start = Math.max(0, stat.size - TAIL_BYTES)
      const content = await readRange(filePath, start, stat.size)
      return { path: filePath, content, truncated: start > 0, sizeBytes: stat.size }
    } catch (error) {
      log.scope('system:diagnostics').warn('read-main-log failed:', error)
      return null
    }
  })

  ipcMain.on('drmvyz:diagnostics:watch-main-log', event => {
    const sender = event.sender
    startWatching(sender, log)
  })

  ipcMain.on('drmvyz:diagnostics:unwatch-main-log', event => stopWatcher(event.sender.id))
}

async function readRange(filePath, start, end) {
  if (end <= start) return ''
  const fh = await fsp.open(filePath, 'r')
  try {
    const length = end - start
    const buffer = Buffer.alloc(length)
    await fh.read(buffer, 0, length, start)
    return buffer.toString('utf8')
  } finally {
    await fh.close()
  }
}

function startWatching(sender, log) {
  stopWatcher(sender.id)
  const filePath = log.transports.file.getFile().path
  const state = { offset: 0, inode: null, pendingReset: false, ready: false, timer: null, watcher: null, disposed: false, sender, onDestroyed: null }
  watchersBySenderId.set(sender.id, state)

  const readDelta = async () => {
    if (state.disposed) return
    try {
      const stat = await fsp.stat(filePath)
      if (!state.ready) {
        // The initial read-log call already covers everything up to "now" —
        // only emit text appended after this subscription started.
        state.inode = stat.ino
        state.offset = stat.size
        state.ready = true
        return
      }
      const reset = state.pendingReset || stat.ino !== state.inode || stat.size < state.offset
      state.pendingReset = reset
      if (reset) state.offset = 0
      state.inode = stat.ino
      if (stat.size <= state.offset) return
      const content = await readRange(filePath, state.offset, stat.size)
      state.offset = stat.size
      state.pendingReset = false
      if (!state.disposed && !sender.isDestroyed()) {
        sender.send('drmvyz:diagnostics:main-log-appended', { content, ...(reset ? { reset: true } : {}) })
      }
    } catch (error) {
      log.scope('system:diagnostics').warn('watch-main-log read failed:', error)
    }
  }

  let reads = Promise.resolve()
  const queueRead = () => { reads = reads.then(readDelta) }
  queueRead()
  try {
    state.watcher = fs.watch(path.dirname(filePath), { persistent: false }, (_event, filename) => {
      if (filename && filename.toString() !== path.basename(filePath)) return
      if (state.timer) clearTimeout(state.timer)
      state.timer = setTimeout(queueRead, CHANGE_DEBOUNCE_MS)
    })
  } catch (error) {
    log.scope('system:diagnostics').warn('watch-main-log failed to start:', error)
  }

  // Kept on the state so stopWatcher can take it off again: otherwise every watch/unwatch cycle (the panel mounting, StrictMode's second
  // mount) leaves one more 'destroyed' listener on the same WebContents until Node warns about a leak.
  state.onDestroyed = () => stopWatcher(sender.id)
  sender.once('destroyed', state.onDestroyed)
}

function stopWatcher(senderId) {
  const state = watchersBySenderId.get(senderId)
  if (!state) return
  state.disposed = true
  if (state.timer) clearTimeout(state.timer)
  try { state.watcher?.close() } catch { /* already closed */ }
  if (state.onDestroyed && typeof state.sender?.removeListener === 'function') {
    try { state.sender.removeListener('destroyed', state.onDestroyed) } catch { /* sender already gone */ }
  }
  state.onDestroyed = null
  state.sender = null
  watchersBySenderId.delete(senderId)
}

module.exports = { installDiagnosticsBridge }
