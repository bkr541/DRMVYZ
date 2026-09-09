'use strict'

// Main-process logging. This must be required before any other local module in
// electron/main.cjs so that `console.*` is redirected before the native bridges
// (native/output/*.cjs, native/rekordbox/*.cjs) load and start logging.
//
// Local: rotating files via electron-log. In development the file lives at
// <repo>/logs/main.log; in a packaged build it goes to the OS log directory
// (macOS: ~/Library/Logs/DRMVYZ/, visible in Console.app).
//
// Remote: optional. When SENTRY_DSN is set, error-level output and uncaught
// exceptions in the main process are forwarded to Sentry. Without a DSN the
// Sentry package is never loaded.

const path = require('node:path')
const { app } = require('electron')
const log = require('electron-log/main')

const inRepo = !app.isPackaged
const LOG_LEVEL = process.env.DRMVYZ_LOG_LEVEL || 'info'

log.initialize()

log.transports.file.level = LOG_LEVEL
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB, then rotate to main.old.log
log.transports.file.resolvePathFn = () => inRepo
  ? path.join(process.cwd(), 'logs', 'main.log')
  : path.join(app.getPath('logs'), 'main.log')

// Keep terminal output during development; silence the console transport in a
// packaged build (the file still records everything).
log.transports.console.level = inRepo ? 'debug' : false

// Redirect every console.* in the main process (including the native/*.cjs
// bridges) into electron-log without touching those call sites.
Object.assign(console, log.functions)

// ── Optional remote error monitoring ──────────────────────────────────────────
let sentryReady = false
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/electron/main')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      release: app.getVersion(),
      environment: app.isPackaged ? 'production' : 'development',
      // Strip secrets that may ride along in URLs / headers / breadcrumbs.
      beforeSend(event) {
        return scrubSecrets(event)
      },
      beforeBreadcrumb(breadcrumb) {
        return scrubSecrets(breadcrumb)
      },
    })
    sentryReady = true
    log.scope('logging').info('Sentry initialized (main process)')
  } catch (error) {
    log.scope('logging').warn('Sentry init failed; continuing with file logging only:', error)
  }
}

const SECRET_RE = /(sb_(publish|secret)able_[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/g

function scrubSecrets(value) {
  if (!value) return value
  try {
    const json = JSON.stringify(value)
    if (!SECRET_RE.test(json)) return value
    return JSON.parse(json.replace(SECRET_RE, '[redacted]'))
  } catch {
    return value
  }
}

// Uncaught exceptions / unhandled rejections in the main process → file (+ Sentry).
log.errorHandler.startCatching({
  showDialog: false,
  onError({ error }) {
    if (sentryReady) {
      try {
        require('@sentry/electron/main').captureException(error)
      } catch {
        // Sentry unavailable — the file transport has already recorded it.
      }
    }
  },
})

// Forward anything logged at error level to Sentry as well.
if (sentryReady) {
  log.hooks.push((message, transport) => {
    if (transport !== log.transports.file || message.level !== 'error') return message
    try {
      const Sentry = require('@sentry/electron/main')
      const [first, ...rest] = message.data
      if (first instanceof Error) Sentry.captureException(first, { extra: { rest } })
      else Sentry.captureMessage(message.data.map(String).join(' '), 'error')
    } catch {
      // ignore
    }
    return message
  })
}

log.scope('main').info(
  `logging ready — level=${LOG_LEVEL} file=${log.transports.file.getFile().path} remote=${sentryReady ? 'sentry' : 'off'}`,
)

module.exports = log
