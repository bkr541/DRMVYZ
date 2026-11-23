'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, dialog, ipcMain, net, protocol, screen, session, shell, systemPreferences } = require('electron')
const { BRAND_NAME } = require('./brand.cjs')
const { applyStagelessProfile } = require('../native/system/userDataMigration.cjs')

// Electron derives userData and the log folder from the product name, and
// app.setName() does not change them, so both are set explicitly. Legacy
// DRMVYZ folders are moved over first (docs/stageless-rename.md section 5).
// This runs before ./logging.cjs and before app.whenReady(); the outcome is
// logged once logging is available.
const profileMigration = applyStagelessProfile({ app, brandName: BRAND_NAME, isDevelopment: !app.isPackaged })

// Must load before the native bridges so console.* is redirected before they run.
const log = require('./logging.cjs')
for (const { scope, status, error } of profileMigration) {
  const entry = log.scope('system:app')
  if (status === 'failed') entry.warn(`${scope} migration failed; continuing with the legacy folder`, { error: error?.message })
  else if (status !== 'no-old' && status !== 'already-migrated') entry.info(`${scope} migration: ${status}`)
}
const { installRekordboxUsbBridge } = require('../native/rekordbox/rekordboxUsbBridge.cjs')
const { installOutputCastBridge } = require('../native/output/outputCastBridge.cjs')
const { installDiagnosticsBridge } = require('../native/diagnostics/diagnosticsBridge.cjs')
const { redactUrlForLog } = require('../native/diagnostics/redactUrl.cjs')
const { installSystemMetricsBridge } = require('../native/system/systemMetricsBridge.cjs')
const { installCameraAccessBridge, readCameraAccessStatus } = require('../native/system/cameraAccessBridge.cjs')
const { createRendererRecovery } = require('../native/system/rendererRecovery.cjs')

const DEV_SERVER_URL = process.env.DRMVYZ_VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const forceBuiltRenderer = process.argv.includes('--production')
const useDevServer = !app.isPackaged && !forceBuiltRenderer

// Production renders through a custom, privileged scheme instead of raw file://.
// vite.config.ts emits root-relative asset URLs (e.g. "/stageless_logo.png") for
// anything outside its own bundled import graph (see AI_IMPLEMENTATION_CONTRACT.md
// public-asset references). Those only resolve correctly against an origin, and
// file:// has no origin — it would resolve "/stageless_logo.png" to the filesystem
// root. A privileged custom scheme gives the renderer a real origin to resolve
// root-relative paths against while keeping everything sandboxed to dist/.
const APP_SCHEME = 'drmvyz-app'
const APP_ORIGIN = `${APP_SCHEME}://app`
const DIST_DIR = path.join(app.getAppPath(), 'dist')
const APP_ICON = path.join(__dirname, 'assets', 'app-icon.png')
let mainWindow = null
// Reloads the main window if its renderer stops (see native/system/rendererRecovery.cjs).
let mainRecovery = null

/** The page the window loads: the dev server or the built app. A recovery load adds `?recovery=<reason>`, which the renderer reads once and removes. */
function pageUrl(recoveryReason) {
  const url = new URL(useDevServer ? DEV_SERVER_URL : `${APP_ORIGIN}/index.html`)
  if (recoveryReason) url.searchParams.set('recovery', recoveryReason)
  return url.toString()
}

// The development profile (and its single-instance lock) stays separate from
// both the packaged application and unrelated Electron projects; the folder
// names are set in applyStagelessProfile above.
app.setName(BRAND_NAME)

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async request => {
    const requestUrl = new URL(request.url)
    const decodedPath = decodeURIComponent(requestUrl.pathname)
    const relative = decodedPath === '' || decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
    const resolved = path.normalize(path.join(DIST_DIR, relative))

    // Refuse to serve anything outside dist/, in case a crafted request path
    // contains traversal segments.
    if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const response = await net.fetch(pathToFileURL(resolved).toString())
      if (response.ok) return response
    } catch {
      // Fall through to the SPA fallback below.
    }

    // Single-page app: unknown paths fall back to index.html rather than 404ing.
    return net.fetch(pathToFileURL(path.join(DIST_DIR, 'index.html')).toString())
  })
}

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === `${APP_SCHEME}:`) return !useDevServer && url.host === 'app'
    return useDevServer && url.origin === new URL(DEV_SERVER_URL).origin
  } catch {
    return false
  }
}

function openExternalUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') {
      void shell.openExternal(url.toString())
    }
  } catch {
    // Ignore malformed or unsupported navigation targets.
  }
}

function configureSessionSecurity() {
  const appSession = session.defaultSession

  appSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === 'media' && isTrustedAppUrl(requestingOrigin)
  })

  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL()
    const allowed = permission === 'media' && isTrustedAppUrl(requestingUrl)
    if (allowed && details.mediaTypes?.includes('video')) {
      // Granting here only lifts Electron's own gate. macOS can still refuse the device, so
      // record the OS state next to the grant to make a silent block diagnosable from the log.
      log.scope('system:camera').info('camera request', {
        osAccess: readCameraAccessStatus({ systemPreferences }),
      })
    }
    callback(allowed)
  })

  // Record network failures for the app's own backends (Supabase, casting
  // discovery, etc.) so issues like the auth-refresh ERR_TIMED_OUT leave a
  // trace in the log file rather than only the renderer console. Signed
  // Storage URLs carry their token in the query string, so only origin + path
  // is logged.
  appSession.webRequest.onErrorOccurred(
    { urls: ['*://*.supabase.co/*', '*://*.supabase.io/*'] },
    details => log.scope('system:network').warn('net-error', { url: redactUrlForLog(details.url), error: details.error }),
  )
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#05070a',
    title: BRAND_NAME,
    icon: APP_ICON,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '..', 'native', 'rekordbox', 'preloadRekordboxBridge.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: useDevServer ? ['--stageless-review-notes'] : [],
    },
  })

  window.once('ready-to-show', () => window.show())

  const windowLog = log.scope('system:window')
  const wc = window.webContents
  wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3) return // ERR_ABORTED — navigation superseded, not a failure
    windowLog.warn('did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame })
  })
  wc.on('render-process-gone', (_event, details) => windowLog.error('render-process-gone', details))
  wc.on('unresponsive', () => windowLog.warn('renderer unresponsive'))
  mainRecovery?.dispose()
  mainRecovery = createRendererRecovery({ log: log.scope('system:recovery'), buildUrl: pageUrl })
  mainRecovery.attach(wc)

  window.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // The renderer fills a named blank window with the running app in a 393 × 852 phone frame.
    if (frameName === 'drmvyz-mobile-app-preview' && (url === '' || url === 'about:blank')) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 449, height: 908, minWidth: 449, minHeight: 480, useContentSize: true, resizable: true,
        minimizable: true, maximizable: true, fullscreenable: false,
        backgroundColor: '#020304', title: `${BRAND_NAME} — Mobile App Preview`, icon: APP_ICON,
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
      } }
    }
    const popupConfig = frameName === 'drmvyz-layout-lab'
      ? { title: `${BRAND_NAME} — Layout Lab`, backgroundColor: '#060d10' }
      : frameName === 'drmvyz-lyric-manager-layout'
        ? { title: `${BRAND_NAME} — Lyric Manager Layout`, backgroundColor: '#060d10' }
        : frameName === 'drmvyz-track-timeline'
          ? { title: `${BRAND_NAME} — Track Timeline Visualizer`, backgroundColor: '#090d0f' }
          : null

    if (popupConfig) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1600,
          height: 1000,
          minWidth: 1180,
          minHeight: 760,
          backgroundColor: popupConfig.backgroundColor,
          title: popupConfig.title,
          icon: APP_ICON,
          autoHideMenuBar: process.platform !== 'darwin',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        },
      }
    }
    openExternalUrl(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return
    event.preventDefault()
    openExternalUrl(url)
  })

  void window.loadURL(pageUrl())

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  mainWindow = window
  return window
}

if (!app.requestSingleInstanceLock()) {
  log.scope('system:app').warn('another STAGELESS instance owns the development profile; focusing it instead')
  app.quit()
} else {
  app.on('before-quit', () => { mainRecovery?.setQuitting(); log.scope('system:app').info('before-quit') })
  app.on('will-quit', () => log.scope('system:app').info('will-quit'))
  app.on('quit', (_event, exitCode) => log.scope('system:app').info('quit', { exitCode }))
  process.on('exit', exitCode => log.scope('system:app').info('main process exit', { exitCode }))
  app.on('second-instance', () => {
    if (!mainWindow) {
      createMainWindow()
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('child-process-gone', (_event, details) => {
    log.scope('system:process').error('child-process-gone', details)
    mainRecovery?.handleChildProcessGone(details)
  })

  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.setIcon(APP_ICON)
    log.scope('system:app').info(`app ready — v${app.getVersion()} electron ${process.versions.electron} ${process.platform}/${process.arch} devServer=${useDevServer}`)
    if (!useDevServer) registerAppProtocol()
    configureSessionSecurity()
    installRekordboxUsbBridge({ ipcMain, dialog, BrowserWindow, app, log })
    installOutputCastBridge({ app, BrowserWindow, ipcMain, screen, shell, dialog, isTrustedAppUrl })
    installDiagnosticsBridge({ ipcMain, log, app })
    installSystemMetricsBridge({ app, ipcMain, log })
    installCameraAccessBridge({ ipcMain, shell, systemPreferences, log })
    if (useDevServer) {
      ipcMain.handle('drmvyz:review-notes:capture', async event => {
        if (event.sender !== mainWindow?.webContents || !event.senderFrame || event.senderFrame !== event.sender.mainFrame
          || !isTrustedAppUrl(event.senderFrame.url)) return null
        const frame = await event.sender.capturePage()
        if (frame.isEmpty()) return null
        return (frame.getSize().width > 1600 ? frame.resize({ width: 1600 }) : frame).toDataURL()
      })
    }
    createMainWindow()

    app.on('activate', () => {
      if (!mainWindow) createMainWindow()
    })
  }).catch(error => log.scope('system:app').error('app bootstrap failed', error))

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
