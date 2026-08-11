'use strict'

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { OutputTargetManager } = require('./outputTargetManager.cjs')
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
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'connected') setStatus('Live output', 'connected')
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      setStatus('Output connection lost', 'error')
    }
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


function installOutputCastBridge({ app, BrowserWindow, ipcMain, screen, isTrustedAppUrl }) {
  const receiverToken = crypto.randomBytes(24).toString('base64url')
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
  const receiverProvider = new DrmvyzReceiverProvider({
    isPrivateNetworkAddress,
    resolveReachableLocalAddress,
    deviceId: loadOrCreateReceiverDeviceId(app),
  })

  let targetManager = null

  const broadcastTargets = async () => {
    if (!targetManager || shuttingDown) return
    const snapshot = await targetManager.getSnapshot()
    sendToTrustedRenderers('drmvyz:output:targets-changed', snapshot.targets)
    sendToTrustedRenderers('drmvyz:output:target-snapshot-changed', snapshot)
  }

  targetManager = new OutputTargetManager({
    providers: [localDisplayProvider, receiverProvider],
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

  const openIncomingReceiverWindow = ({ sourceUrl, windowMode, aspectRatio }) => {
    const display = screen.getPrimaryDisplay()
    const castId = crypto.randomUUID()
    const controlToken = crypto.randomBytes(24).toString('base64url')
    const outputWindow = createOutputWindow({
      display,
      windowMode,
      aspectRatio,
      sourceUrl,
      onClosed: () => receiverWindows.delete(castId),
    })
    receiverWindows.set(castId, { outputWindow, controlToken })
    return { castId, controlToken }
  }

  const handleHttpRequest = async (request, response) => {
    const host = request.headers.host || `127.0.0.1:${httpPort}`
    const url = new URL(request.url || '/', `http://${host}`)
    const remoteAddress = normalizeRemoteAddress(request.socket.remoteAddress || '')

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        jsonResponse(response, 200, { service: 'drmvyz-output', version: DISCOVERY_VERSION })
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

      if (request.method === 'POST' && url.pathname === '/api/start-cast') {
        if (!isPrivateNetworkAddress(remoteAddress)) {
          jsonResponse(response, 403, { error: 'Receiver requests are limited to the local network' })
          return
        }
        const body = await readJsonBody(request)
        const normalized = normalizeCastRequest({
          targetId: 'incoming',
          windowMode: body.windowMode,
          aspectRatio: body.aspectRatio,
        })
        if (body.receiverToken !== receiverToken || !normalized || !isAllowedReceiverSource(body.sourceUrl, remoteAddress)) {
          jsonResponse(response, 400, { error: 'Invalid receiver request' })
          return
        }
        const receiver = openIncomingReceiverWindow({
          sourceUrl: body.sourceUrl,
          windowMode: normalized.windowMode,
          aspectRatio: normalized.aspectRatio,
        })
        jsonResponse(response, 200, receiver)
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/stop-cast') {
        const body = await readJsonBody(request)
        const receiver = receiverWindows.get(body.castId)
        if (!receiver || body.receiverToken !== receiverToken || body.controlToken !== receiver.controlToken) {
          jsonResponse(response, 404, { error: 'Receiver session not found' })
          return
        }
        if (!receiver.outputWindow.isDestroyed()) receiver.outputWindow.close()
        receiverWindows.delete(body.castId)
        emptyResponse(response)
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
      targetManager.failSession(signalSession.id, error instanceof Error ? error.message : 'Could not start output')
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

  ipcMain.handle('drmvyz:output:fail-session', (event, sessionId, message) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output failure request')
    const session = signalSessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) return false
    return targetManager.failSession(sessionId, message)
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
  createReceiverHtml,
  installOutputCastBridge,
  isAllowedReceiverSource,
  isPrivateNetworkAddress,
  normalizeCastRequest,
  loadOrCreateReceiverDeviceId,
  resolveReachableLocalAddress,
}
