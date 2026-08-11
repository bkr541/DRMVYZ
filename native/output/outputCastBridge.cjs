'use strict'

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { OutputTargetManager } = require('./outputTargetManager.cjs')
const {
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  DRMVYZ_RECEIVER_QUALITY_POLICY,
  buildCapabilityDocument,
  normalizePairRequest,
  normalizeQualityPolicy,
  normalizeV2StartRequest,
} = require('./drmvyzReceiverProtocol.cjs')
const { createReceiverTrustStore } = require('./drmvyzReceiverTrustStore.cjs')
const {
  ASPECT_RATIOS,
  LocalDisplayProvider,
  buildLocalDisplayTargets,
  calculateWindowBounds,
} = require('./providers/localDisplayProvider.cjs')
const {
  DISCOVERY_VERSION,
  DrmvyzReceiverProvider,
} = require('./providers/drmvyzReceiverProvider.cjs')
const {
  MacOsAirPlayProvider,
} = require('./providers/macosAirPlayProvider.cjs')
const {
  WindowsMiracastProvider,
} = require('./providers/windowsMiracastProvider.cjs')

const SESSION_TTL_MS = 10 * 60 * 1_000
const MAX_JSON_BODY_BYTES = 64 * 1_024
const WINDOW_MODES = new Set(['windowed', 'borderless', 'fullscreen'])

const RECEIVER_IDENTITY_FILENAME = 'drmvyz-output-receiver-identity.json'

function isValidReceiverDeviceId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value)
}

function loadOrCreateReceiverDeviceId(app, { fsImpl = fs, cryptoImpl = crypto } = {}) {
  const fallback = () => cryptoImpl.randomUUID()
  if (!app || typeof app.getPath !== 'function') return fallback()
  let userDataPath
  try {
    userDataPath = app.getPath('userData')
  } catch {
    return fallback()
  }
  if (typeof userDataPath !== 'string' || !userDataPath) return fallback()
  const identityPath = path.join(userDataPath, RECEIVER_IDENTITY_FILENAME)
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(identityPath, 'utf8'))
    if (parsed?.version === 1 && isValidReceiverDeviceId(parsed.deviceId)) return parsed.deviceId
  } catch {
    // Missing or malformed identity is repaired below.
  }
  const deviceId = fallback()
  try {
    fsImpl.mkdirSync(userDataPath, { recursive: true })
    fsImpl.writeFileSync(identityPath, `${JSON.stringify({ version: 1, deviceId })}\n`, { encoding: 'utf8', mode: 0o600 })
  } catch (error) {
    console.warn('[DRMVYZ Output] Could not persist receiver identity; discovery identity will change after restart:', error)
  }
  return deviceId
}

function normalizeRemoteAddress(value) {
  if (typeof value !== 'string') return ''
  return value.startsWith('::ffff:') ? value.slice(7) : value
}

function isPrivateIpv4(value) {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  if (parts[0] === 10 || parts[0] === 127) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  return parts[0] === 192 && parts[1] === 168
}

function isPrivateNetworkAddress(value) {
  const normalized = normalizeRemoteAddress(value)
  if (normalized === '::1' || normalized === 'localhost') return true
  if (net.isIPv4(normalized)) return isPrivateIpv4(normalized)
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase()
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
  }
  return false
}

function normalizeCastRequest(value) {
  if (!value || typeof value !== 'object') return null
  const targetId = typeof value.targetId === 'string' ? value.targetId.trim() : ''
  const windowMode = typeof value.windowMode === 'string' ? value.windowMode : ''
  const aspectRatio = typeof value.aspectRatio === 'string' ? value.aspectRatio : ''
  if (!targetId || !WINDOW_MODES.has(windowMode) || !Object.hasOwn(ASPECT_RATIOS, aspectRatio)) return null
  return { targetId, windowMode, aspectRatio }
}

function jsonResponse(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(body)
}

function emptyResponse(response, statusCode = 204) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end()
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error('Request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    request.on('error', reject)
  })
}

function waitForIceGathering(peerExpression) {
  return `
function waitForIceGathering(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }, 3500)
    function onChange() {
      if (pc.iceGatheringState !== 'complete') return
      clearTimeout(timeout)
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}
${peerExpression}`
}

function createReceiverHtml() {
  const script = waitForIceGathering(`
const params = new URLSearchParams(location.search)
const sessionId = params.get('session') || ''
const token = params.get('token') || ''
const status = document.getElementById('status')
const video = document.getElementById('output')
const apiBase = '/api/sessions/' + encodeURIComponent(sessionId)
const authQuery = '?token=' + encodeURIComponent(token)

function setStatus(message, state) {
  status.textContent = message
  document.body.dataset.state = state || 'connecting'
}

async function request(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options })
  if (!response.ok && response.status !== 204) throw new Error('Receiver request failed (' + response.status + ')')
  return response
}

async function waitForOffer() {
  for (;;) {
    const response = await request(apiBase + '/offer' + authQuery)
    if (response.status === 200) return response.json()
    await new Promise(resolve => setTimeout(resolve, 120))
  }
}

async function connect() {
  if (!sessionId || !token) throw new Error('The output session is incomplete')
  const pc = new RTCPeerConnection({ iceServers: [] })
  pc.addEventListener('track', event => {
    const [stream] = event.streams
    if (stream) video.srcObject = stream
    void video.play().catch(() => {})
  })
  let disconnectTimer = null
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'connected') {
      if (disconnectTimer !== null) clearTimeout(disconnectTimer)
      disconnectTimer = null
      setStatus('Live output', 'connected')
      return
    }
    if (pc.connectionState === 'disconnected') {
      setStatus('Reconnecting output…', 'connecting')
      if (disconnectTimer === null) disconnectTimer = setTimeout(() => {
        disconnectTimer = null
        if (pc.connectionState !== 'connected') setStatus('Output connection lost', 'error')
      }, 3000)
      return
    }
    if (pc.connectionState === 'failed') setStatus('Output connection lost', 'error')
    if (pc.connectionState === 'closed') setStatus('Output ended', 'ended')
  })

  await request(apiBase + '/register' + authQuery, { method: 'POST' })
  const offer = await waitForOffer()
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await waitForIceGathering(pc)
  await request(apiBase + '/answer' + authQuery, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pc.localDescription),
  })
}

connect().catch(error => {
  setStatus(error instanceof Error ? error.message : 'Output connection failed', 'error')
})
`)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src blob:">
<title>DRMVYZ Output</title>
<style>
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000;color:#7eeaf2;font:600 12px/1.4 system-ui,sans-serif}
body{display:grid;place-items:center}
#output{width:100%;height:100%;display:block;object-fit:contain;background:#000}
#status{position:fixed;left:50%;bottom:24px;z-index:2;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(126,234,242,.22);border-radius:8px;background:rgba(4,12,16,.78);letter-spacing:.08em;text-transform:uppercase;transition:opacity .2s ease}
body[data-state="connected"] #status{opacity:0;pointer-events:none}
body[data-state="error"] #status{color:#ff8b94;border-color:rgba(255,139,148,.4)}
</style>
</head>
<body data-state="connecting"><video id="output" autoplay muted playsinline></video><div id="status">Connecting output…</div><script>${script}</script></body>
</html>`
}

function isAllowedReceiverSource(sourceUrl, remoteAddress) {
  try {
    const url = new URL(sourceUrl)
    if (url.protocol !== 'http:') return false
    if (url.pathname !== '/receiver') return false
    const sourceHost = normalizeRemoteAddress(url.hostname)
    const requestHost = normalizeRemoteAddress(remoteAddress)
    if (!isPrivateNetworkAddress(sourceHost) || !isPrivateNetworkAddress(requestHost)) return false
    return sourceHost === requestHost || requestHost === '127.0.0.1' || requestHost === '::1'
  } catch {
    return false
  }
}

function resolveReachableLocalAddress(remoteHost) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket(net.isIPv6(remoteHost) ? 'udp6' : 'udp4')
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      try { socket.close() } catch { /* Already closed. */ }
      if (error) reject(error)
      else resolve(value)
    }
    socket.once('error', error => finish(error))
    socket.connect(9, remoteHost, () => {
      try {
        finish(null, socket.address().address)
      } catch (error) {
        finish(error)
      }
    })
  })
}


async function openWindowsWirelessDisplaySettings({ shell } = {}) {
  if (!shell || typeof shell.openExternal !== 'function') {
    throw new Error('Electron shell.openExternal is unavailable for Windows wireless-display selection')
  }

  await shell.openExternal('ms-settings:display')
  return {
    opened: 'ms-settings:display',
    message: 'Windows Display settings opened. Use Connect under Multiple displays to choose a wireless display; DRMVYZ will detect the display Windows adds.',
  }
}

async function openMacOsDisplaySettings({ shell, fsImpl = fs } = {}) {
  if (!shell || typeof shell.openPath !== 'function') {
    throw new Error('Electron shell.openPath is unavailable for macOS display selection')
  }

  const candidates = [
    { path: '/System/Library/PreferencePanes/Displays.prefPane', label: 'Displays settings' },
    { path: '/System/Applications/System Settings.app', label: 'System Settings' },
    { path: '/Applications/System Settings.app', label: 'System Settings' },
    { path: '/System/Applications/System Preferences.app', label: 'System Preferences' },
  ]
  let attempted = false
  let lastError = ''
  for (const candidate of candidates) {
    if (typeof fsImpl.existsSync === 'function' && !fsImpl.existsSync(candidate.path)) continue
    attempted = true
    const errorMessage = await shell.openPath(candidate.path)
    if (!errorMessage) {
      return {
        opened: candidate.path,
        message: `${candidate.label} opened. Use Screen Mirroring or display extension there; DRMVYZ will detect any display macOS connects.`,
      }
    }
    lastError = errorMessage
  }

  if (!attempted) throw new Error('macOS display settings could not be located')
  throw new Error(lastError || 'macOS display settings could not be opened')
}


function buildReceiverDisplayCapabilities(screen) {
  const displays = screen.getAllDisplays()
  if (!Array.isArray(displays)) throw new Error('Electron did not return a display list')
  const primaryId = screen.getPrimaryDisplay()?.id
  return displays.map((display, index) => ({
    id: String(display.id),
    name: display.label?.trim() || (display.id === primaryId ? 'Primary display' : `Display ${index + 1}`),
    width: display.bounds.width,
    height: display.bounds.height,
    scaleFactor: display.scaleFactor ?? 1,
    refreshRate: Number.isFinite(Number(display.displayFrequency)) ? Number(display.displayFrequency) : null,
    primary: display.id === primaryId,
  }))
}

async function approveReceiverPairing(dialog, senderName, senderDeviceId) {
  if (!dialog || typeof dialog.showMessageBox !== 'function') return false
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Allow', 'Deny'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Pair DRMVYZ Receiver',
    message: `Allow ${senderName} to cast to this DRMVYZ receiver?`,
    detail: `Sender identity: ${senderDeviceId}`,
  })
  return result?.response === 0
}

function receiverRequestToken(request) {
  const value = request.headers['x-drmvyz-receiver-token']
  return Array.isArray(value) ? value[0] : value
}

function receiverSenderId(request) {
  const value = request.headers['x-drmvyz-sender-id']
  return Array.isArray(value) ? value[0] : value
}

function receiverPairingToken(request) {
  const value = request.headers['x-drmvyz-pairing-token']
  return Array.isArray(value) ? value[0] : value
}

function installOutputCastBridge({
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell = null,
  dialog = null,
  platform = process.platform,
  openSystemDisplays = null,
  openWindowsDisplays = null,
  isTrustedAppUrl,
}) {
  const receiverToken = crypto.randomBytes(24).toString('base64url')
  const receiverDeviceId = loadOrCreateReceiverDeviceId(app)
  const receiverTrustStore = createReceiverTrustStore(app)
  const signalSessions = new Map()
  const receiverWindows = new Map()
  let httpServer = null
  let httpPort = null
  let sessionGcInterval = null
  let shuttingDown = false

  const trustedRendererWindows = () => BrowserWindow.getAllWindows().filter(window => {
    const url = window.webContents.getURL()
    return url && isTrustedAppUrl(url)
  })

  const sendToTrustedRenderers = (channel, payload) => {
    for (const window of trustedRendererWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }

  const createOutputWindow = ({ display, windowMode, aspectRatio, sourceUrl, onClosed }) => {
    const ratio = ASPECT_RATIOS[aspectRatio]
    const workArea = display.workArea ?? display.bounds
    const bounds = windowMode === 'windowed'
      ? calculateWindowBounds(workArea, aspectRatio)
      : { ...display.bounds }
    const outputWindow = new BrowserWindow({
      ...bounds,
      show: false,
      frame: windowMode === 'windowed',
      fullscreenable: true,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      title: 'DRMVYZ Output',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    })
    outputWindow.setAspectRatio(ratio)
    outputWindow.setMenuBarVisibility(false)
    outputWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    outputWindow.webContents.on('will-navigate', (event, url) => {
      if (url === sourceUrl) return
      event.preventDefault()
    })
    outputWindow.once('ready-to-show', () => {
      if (windowMode === 'fullscreen') outputWindow.setFullScreen(true)
      outputWindow.show()
    })
    outputWindow.on('closed', onClosed)
    void outputWindow.loadURL(sourceUrl)
    return outputWindow
  }

  const localDisplayProvider = new LocalDisplayProvider({ screen, createOutputWindow })
  const macOsAirPlayProvider = new MacOsAirPlayProvider({
    platform,
    openSystemDisplays: openSystemDisplays ?? (platform === 'darwin' ? () => openMacOsDisplaySettings({ shell }) : null),
  })
  const windowsMiracastProvider = new WindowsMiracastProvider({
    platform,
    openWindowsDisplays: openWindowsDisplays ?? (platform === 'win32' ? () => openWindowsWirelessDisplaySettings({ shell }) : null),
  })
  const receiverProvider = new DrmvyzReceiverProvider({
    isPrivateNetworkAddress,
    resolveReachableLocalAddress,
    deviceId: receiverDeviceId,
    trustStore: receiverTrustStore,
  })

  let targetManager = null

  const broadcastTargets = async () => {
    if (!targetManager || shuttingDown) return
    const snapshot = await targetManager.getSnapshot()
    sendToTrustedRenderers('drmvyz:output:targets-changed', snapshot.targets)
    sendToTrustedRenderers('drmvyz:output:target-snapshot-changed', snapshot)
  }

  targetManager = new OutputTargetManager({
    providers: [localDisplayProvider, macOsAirPlayProvider, windowsMiracastProvider, receiverProvider],
    onTargetsChanged: () => void broadcastTargets(),
    onSessionChanged: session => sendToTrustedRenderers('drmvyz:output:session-changed', session),
  })

  const currentSession = () => targetManager.getSession()

  const removeSignalSession = sessionId => {
    const session = signalSessions.get(sessionId)
    if (!session) return
    if (session.sourceWebContents && !session.sourceWebContents.isDestroyed() && session.sourceDestroyedHandler) {
      session.sourceWebContents.removeListener('destroyed', session.sourceDestroyedHandler)
    }
    for (const waiter of session.answerWaiters.splice(0)) {
      waiter.reject(new Error('The output session ended before the receiver answered'))
    }
    signalSessions.delete(sessionId)
  }

  const stopSession = async sessionId => {
    const current = currentSession()
    if (current && (!sessionId || current.id === sessionId)) await targetManager.stopSession()
    if (sessionId) removeSignalSession(sessionId)
    else if (current?.id) removeSignalSession(current.id)
  }

  const openIncomingReceiverWindow = ({ sourceUrl, windowMode, aspectRatio, displayId, senderDeviceId, pairingToken, qualityPolicy }) => {
    const display = screen.getAllDisplays().find(item => String(item.id) === String(displayId))
    if (!display) throw new Error('The selected receiver display is no longer available')
    const castId = crypto.randomUUID()
    const controlToken = crypto.randomBytes(24).toString('base64url')
    const outputWindow = createOutputWindow({
      display,
      windowMode,
      aspectRatio,
      sourceUrl,
      onClosed: () => receiverWindows.delete(castId),
    })
    receiverWindows.set(castId, { outputWindow, controlToken, displayId: String(display.id), senderDeviceId, pairingToken })
    return {
      protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
      castId,
      controlToken,
      selectedDisplay: String(display.id),
      qualityPolicy: normalizeQualityPolicy(qualityPolicy),
    }
  }

  const handleReceiverDisplayRemoved = (_event, display) => {
    const removedId = String(display?.id ?? '')
    if (!removedId) return
    for (const [castId, receiver] of receiverWindows) {
      if (receiver.displayId !== removedId) continue
      if (!receiver.outputWindow.isDestroyed()) receiver.outputWindow.close()
      receiverWindows.delete(castId)
    }
  }
  screen.on('display-removed', handleReceiverDisplayRemoved)

  const handleHttpRequest = async (request, response) => {
    const host = request.headers.host || `127.0.0.1:${httpPort}`
    const url = new URL(request.url || '/', `http://${host}`)
    const remoteAddress = normalizeRemoteAddress(request.socket.remoteAddress || '')

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        jsonResponse(response, 200, { service: 'drmvyz-output', discoveryVersion: DISCOVERY_VERSION, protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/v2/capabilities') {
        if (!isPrivateNetworkAddress(remoteAddress) || receiverRequestToken(request) !== receiverToken) {
          jsonResponse(response, 403, { error: 'Receiver capability requests require a discovered local-network receiver' })
          return
        }
        const senderDeviceId = receiverSenderId(request)
        const pairingToken = receiverPairingToken(request)
        const paired = receiverTrustStore.verifySenderToken(senderDeviceId, pairingToken)
        jsonResponse(response, 200, buildCapabilityDocument({
          deviceId: receiverDeviceId,
          name: `${os.hostname()} · DRMVYZ`,
          displays: buildReceiverDisplayCapabilities(screen),
          paired,
          qualityPolicy: DRMVYZ_RECEIVER_QUALITY_POLICY,
        }))
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/v2/pair') {
        if (!isPrivateNetworkAddress(remoteAddress)) {
          jsonResponse(response, 403, { error: 'Receiver pairing is limited to the local network' })
          return
        }
        const body = normalizePairRequest(await readJsonBody(request))
        if (!body || body.protocolVersion !== DRMVYZ_RECEIVER_PROTOCOL_VERSION || body.receiverToken !== receiverToken) {
          jsonResponse(response, 400, { error: 'Invalid receiver pairing request' })
          return
        }
        const replacingTrust = receiverTrustStore.hasTrustedSender(body.senderDeviceId)
        const approved = await approveReceiverPairing(dialog, body.senderName, body.senderDeviceId)
        if (!approved) {
          jsonResponse(response, 403, { error: 'Pairing declined' })
          return
        }
        const pairingToken = receiverTrustStore.pairSender(body.senderDeviceId, body.senderName, { replace: replacingTrust })
        jsonResponse(response, 200, { protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION, paired: true, pairingToken })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/v2/sessions') {
        if (!isPrivateNetworkAddress(remoteAddress)) {
          jsonResponse(response, 403, { error: 'Receiver sessions are limited to the local network' })
          return
        }
        const body = normalizeV2StartRequest(await readJsonBody(request), WINDOW_MODES, new Set(Object.keys(ASPECT_RATIOS)))
        if (!body || body.receiverToken !== receiverToken || !receiverTrustStore.verifySenderToken(body.senderDeviceId, body.pairingToken) || !isAllowedReceiverSource(body.sourceUrl, remoteAddress)) {
          jsonResponse(response, 401, { error: 'Receiver session is not authorized' })
          return
        }
        if (!screen.getAllDisplays().some(display => String(display.id) === body.displayId)) {
          jsonResponse(response, 409, { error: 'Selected receiver display is no longer available' })
          return
        }
        const receiver = openIncomingReceiverWindow(body)
        jsonResponse(response, 200, receiver)
        return
      }

      const v2StopMatch = url.pathname.match(/^\/api\/v2\/sessions\/([^/]+)\/stop$/)
      if (request.method === 'POST' && v2StopMatch) {
        if (!isPrivateNetworkAddress(remoteAddress)) {
          jsonResponse(response, 403, { error: 'Receiver session control is limited to the local network' })
          return
        }
        const body = await readJsonBody(request)
        const castId = decodeURIComponent(v2StopMatch[1])
        const receiver = receiverWindows.get(castId)
        if (!receiver || body.receiverToken !== receiverToken || body.controlToken !== receiver.controlToken || body.senderDeviceId !== receiver.senderDeviceId || !receiverTrustStore.verifySenderToken(body.senderDeviceId, body.pairingToken)) {
          jsonResponse(response, 404, { error: 'Receiver session not found' })
          return
        }
        if (!receiver.outputWindow.isDestroyed()) receiver.outputWindow.close()
        receiverWindows.delete(castId)
        emptyResponse(response)
        return
      }

      if (request.method === 'GET' && url.pathname === '/receiver') {
        const session = signalSessions.get(url.searchParams.get('session') || '')
        if (!session || session.token !== url.searchParams.get('token')) {
          emptyResponse(response, 404)
          return
        }
        const html = createReceiverHtml()
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        })
        response.end(html)
        return
      }

      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(register|offer|answer)$/)
      if (sessionMatch) {
        const session = signalSessions.get(decodeURIComponent(sessionMatch[1]))
        if (!session || session.token !== url.searchParams.get('token')) {
          emptyResponse(response, 404)
          return
        }
        const action = sessionMatch[2]
        if (request.method === 'POST' && action === 'register') {
          session.receiverRegisteredAt = Date.now()
          sendToTrustedRenderers('drmvyz:output:receiver-requested', { sessionId: session.id })
          emptyResponse(response)
          return
        }
        if (request.method === 'GET' && action === 'offer') {
          if (!session.offer) emptyResponse(response)
          else jsonResponse(response, 200, session.offer)
          return
        }
        if (request.method === 'POST' && action === 'answer') {
          const answer = await readJsonBody(request)
          if (!answer || answer.type !== 'answer' || typeof answer.sdp !== 'string') {
            jsonResponse(response, 400, { error: 'Invalid WebRTC answer' })
            return
          }
          session.answer = { type: 'answer', sdp: answer.sdp }
          for (const waiter of session.answerWaiters.splice(0)) waiter.resolve(session.answer)
          targetManager.markConnected(session.id)
          emptyResponse(response)
          return
        }
      }

      if (request.method === 'POST' && (url.pathname === '/api/start-cast' || url.pathname === '/api/stop-cast')) {
        jsonResponse(response, 426, {
          error: `DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} session protocol is required`,
          protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
        })
        return
      }

      emptyResponse(response, 404)
    } catch (error) {
      jsonResponse(response, 500, { error: error instanceof Error ? error.message : 'Output receiver failed' })
    }
  }

  const startHttpServer = () => new Promise((resolve, reject) => {
    httpServer = http.createServer((request, response) => void handleHttpRequest(request, response))
    httpServer.once('error', reject)
    httpServer.listen(0, '0.0.0.0', () => {
      const address = httpServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not bind the DRMVYZ output receiver'))
        return
      }
      httpPort = address.port
      receiverProvider.configureReceiverService({ port: httpPort, receiverToken })
      resolve()
    })
  })

  const isTrustedSender = event => {
    const url = event.senderFrame?.url || event.sender.getURL()
    return isTrustedAppUrl(url)
  }

  ipcMain.handle('drmvyz:output:list-targets', async event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output target request')
    return targetManager.listTargets()
  })

  ipcMain.handle('drmvyz:output:get-target-snapshot', async event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output target request')
    return targetManager.getSnapshot()
  })

  ipcMain.handle('drmvyz:output:get-session', event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output session request')
    return currentSession()
  })

  ipcMain.handle('drmvyz:output:perform-provider-action', async (event, providerId, actionId, payload) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output provider action')
    if (typeof providerId !== 'string' || !providerId.trim() || typeof actionId !== 'string' || !actionId.trim()) {
      throw new Error('A valid output provider action is required')
    }
    return targetManager.performProviderAction(providerId.trim(), actionId.trim(), payload, {
      senderWebContentsId: event.sender.id,
    })
  })

  ipcMain.handle('drmvyz:output:start-cast', async (event, value) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output cast request')
    const request = normalizeCastRequest(value)
    if (!request) throw new Error('Select a window mode and aspect ratio before casting')
    if (!httpPort) throw new Error('The output receiver is still starting')

    const previous = currentSession()
    if (previous) await stopSession(previous.id)

    const signalSession = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(24).toString('base64url'),
      createdAt: Date.now(),
      offer: null,
      answer: null,
      answerWaiters: [],
      sourceWebContentsId: event.sender.id,
      sourceWebContents: event.sender,
      sourceDestroyedHandler: null,
    }
    signalSession.sourceDestroyedHandler = () => {
      if (signalSessions.has(signalSession.id)) void stopSession(signalSession.id)
    }
    event.sender.once('destroyed', signalSession.sourceDestroyedHandler)
    signalSessions.set(signalSession.id, signalSession)

    const sourceUrl = `http://127.0.0.1:${httpPort}/receiver?session=${encodeURIComponent(signalSession.id)}&token=${encodeURIComponent(signalSession.token)}`
    try {
      return await targetManager.startSession(request, {
        sessionId: signalSession.id,
        sessionToken: signalSession.token,
        sourceUrl,
        onClosed: () => {
          if (signalSessions.has(signalSession.id)) void stopSession(signalSession.id)
        },
      })
    } catch (error) {
      await targetManager.failSession(signalSession.id, error instanceof Error ? error.message : 'Could not start output')
      setTimeout(() => void stopSession(signalSession.id), 2_500).unref?.()
      throw error
    }
  })

  ipcMain.handle('drmvyz:output:stop-cast', async event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output stop request')
    const current = currentSession()
    if (current) await stopSession(current.id)
    return null
  })

  ipcMain.handle('drmvyz:output:publish-offer', (event, sessionId, offer) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted WebRTC offer')
    const session = signalSessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) throw new Error('Output session not found')
    if (!offer || offer.type !== 'offer' || typeof offer.sdp !== 'string') throw new Error('Invalid WebRTC offer')
    session.offer = { type: 'offer', sdp: offer.sdp }
    return true
  })

  ipcMain.handle('drmvyz:output:wait-for-answer', (event, sessionId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted WebRTC answer request')
    const session = signalSessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) throw new Error('Output session not found')
    if (session.answer) return session.answer
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: answer => {
          clearTimeout(timeout)
          resolve(answer)
        },
        reject: error => {
          clearTimeout(timeout)
          reject(error)
        },
      }
      const timeout = setTimeout(() => {
        const index = session.answerWaiters.indexOf(waiter)
        if (index >= 0) session.answerWaiters.splice(index, 1)
        reject(new Error('The output receiver did not answer in time'))
      }, 12_000)
      session.answerWaiters.push(waiter)
    })
  })

  ipcMain.handle('drmvyz:output:fail-session', async (event, sessionId, message) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output failure request')
    const session = signalSessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) return false
    const failed = await targetManager.failSession(sessionId, message)
    if (failed) removeSignalSession(sessionId)
    return failed
  })

  ipcMain.handle('drmvyz:output:report-stats', (event, sessionId, stats) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output diagnostics')
    const session = signalSessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) return false
    return targetManager.updateSessionStats(sessionId, stats)
  })

  const providerStartPromise = targetManager.start().then(() => broadcastTargets()).catch(error => {
    console.error('[DRMVYZ Output] Provider initialization failed:', error)
  })
  const receiverServiceStartPromise = startHttpServer().then(() => broadcastTargets()).catch(error => {
    receiverProvider.reportReceiverServiceError(error)
    void broadcastTargets()
    console.error('[DRMVYZ Output] Receiver service failed to start:', error)
  })

  sessionGcInterval = setInterval(() => {
    const cutoff = Date.now() - SESSION_TTL_MS
    const activeId = currentSession()?.id
    for (const [id, session] of signalSessions) {
      if (session.createdAt < cutoff && id !== activeId) removeSignalSession(id)
    }
  }, 4_000)
  sessionGcInterval.unref?.()

  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    if (sessionGcInterval) clearInterval(sessionGcInterval)
    screen.removeListener('display-removed', handleReceiverDisplayRemoved)
    await Promise.allSettled([providerStartPromise, receiverServiceStartPromise])
    for (const receiver of receiverWindows.values()) {
      if (!receiver.outputWindow.isDestroyed()) receiver.outputWindow.destroy()
    }
    receiverWindows.clear()
    for (const id of [...signalSessions.keys()]) removeSignalSession(id)
    await targetManager.shutdown()
    await new Promise(resolve => {
      if (!httpServer?.listening) { resolve(); return }
      httpServer.close(() => resolve())
    })
  }

  app.on('before-quit', () => { void shutdown() })

  return {
    getTargets: () => targetManager.listTargets(),
    getTargetSnapshot: () => targetManager.getSnapshot(),
    getSession: currentSession,
    shutdown,
    targetManager,
  }
}

module.exports = {
  ASPECT_RATIOS,
  buildLocalDisplayTargets,
  calculateWindowBounds,
  buildReceiverDisplayCapabilities,
  createReceiverHtml,
  installOutputCastBridge,
  isAllowedReceiverSource,
  openMacOsDisplaySettings,
  openWindowsWirelessDisplaySettings,
  isPrivateNetworkAddress,
  normalizeCastRequest,
  loadOrCreateReceiverDeviceId,
  approveReceiverPairing,
  resolveReachableLocalAddress,
}
