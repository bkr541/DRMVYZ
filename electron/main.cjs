'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, dialog, ipcMain, net, protocol, screen, session, shell } = require('electron')
const { installRekordboxUsbBridge } = require('../native/rekordbox/rekordboxUsbBridge.cjs')
const { installOutputCastBridge } = require('../native/output/outputCastBridge.cjs')

const DEV_SERVER_URL = process.env.DRMVYZ_VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const forceBuiltRenderer = process.argv.includes('--production')
const useDevServer = !app.isPackaged && !forceBuiltRenderer

// Production renders through a custom, privileged scheme instead of raw file://.
// vite.config.ts emits root-relative asset URLs (e.g. "/drmvyz_logo2.png") for
// anything outside its own bundled import graph (see AI_IMPLEMENTATION_CONTRACT.md
// public-asset references). Those only resolve correctly against an origin, and
// file:// has no origin — it would resolve "/drmvyz_logo2.png" to the filesystem
// root. A privileged custom scheme gives the renderer a real origin to resolve
// root-relative paths against while keeping everything sandboxed to dist/.
const APP_SCHEME = 'drmvyz-app'
const APP_ORIGIN = `${APP_SCHEME}://app`
const DIST_DIR = path.join(app.getAppPath(), 'dist')
let mainWindow = null

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
    callback(permission === 'media' && isTrustedAppUrl(requestingUrl))
  })
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#05070a',
    title: 'DRMVYZ',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '..', 'native', 'rekordbox', 'preloadRekordboxBridge.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return
    event.preventDefault()
    openExternalUrl(url)
  })

  if (useDevServer) {
    void window.loadURL(DEV_SERVER_URL)
  } else {
    void window.loadURL(`${APP_ORIGIN}/index.html`)
  }

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  mainWindow = window
  return window
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createMainWindow()
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    if (!useDevServer) registerAppProtocol()
    configureSessionSecurity()
    installRekordboxUsbBridge({ ipcMain, dialog, BrowserWindow })
    installOutputCastBridge({ app, BrowserWindow, ipcMain, screen, isTrustedAppUrl })
    createMainWindow()

    app.on('activate', () => {
      if (!mainWindow) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
