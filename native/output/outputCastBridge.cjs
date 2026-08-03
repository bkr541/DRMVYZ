'use strict'

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const http = require('node:http')
const os = require('node:os')
const net = require('node:net')

const DISCOVERY_PORT = 53531
const DISCOVERY_MAGIC = 'DRMVYZ_CAST_RECEIVER'
const DISCOVERY_VERSION = 1
const DISCOVERY_INTERVAL_MS = 2_500
const DISCOVERY_EXPIRY_MS = 8_000
const SESSION_TTL_MS = 10 * 60 * 1_000
const MAX_JSON_BODY_BYTES = 64 * 1_024

const WINDOW_MODES = new Set(['windowed', 'borderless', 'fullscreen'])
const ASPECT_RATIOS = Object.freeze({
  '16:9': 16 / 9,
  '16:10': 16 / 10,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '1:1': 1,
  '9:16': 9 / 16,
})

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

function calculateWindowBounds(displayBounds, aspectRatio, scale = 0.72) {
  const ratio = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS['16:9']
  const availableWidth = Math.max(320, Math.floor(displayBounds.width * scale))
  const availableHeight = Math.max(240, Math.floor(displayBounds.height * scale))
  let width = availableWidth
  let height = Math.round(width / ratio)
  if (height > availableHeight) {
    height = availableHeight
    width = Math.round(height * ratio)
  }
  return {
    x: Math.round(displayBounds.x + (displayBounds.width - width) / 2),
    y: Math.round(displayBounds.y + (displayBounds.height - height) / 2),
    width,
    height,
  }
}

function buildLocalDisplayTargets(displays, primaryDisplayId) {
  return displays.map((display, index) => ({
    id: `display:${display.id}`,
    kind: 'display',
    name: display.label?.trim() || (display.id === primaryDisplayId ? 'This display' : `Display ${index + 1}`),
    detail: `${display.bounds.width} × ${display.bounds.height}${display.id === primaryDisplayId ? ' · Primary' : ''}`,
    available: true,
    displayId: String(display.id),
  }))
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
    const socket = dgram.createSocket('udp4')
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
  const deviceId = crypto.randomUUID()
  const receiverToken = crypto.randomBytes(24).toString('base64url')
  const networkTargets = new Map()
  const sessions = new Map()
  const receiverWindows = new Map()
  let activeSessionId = null
  let httpServer = null
  let httpPort = null
  let discoverySocket = null
  let discoveryInterval = null
  let expiryInterval = null

  const trustedRendererWindows = () => BrowserWindow.getAllWindows().filter(window => {
    const url = window.webContents.getURL()
    return url && isTrustedAppUrl(url)
  })

  const sendToTrustedRenderers = (channel, payload) => {
    for (const window of trustedRendererWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }

  const getTargets = () => {
    const displays = screen.getAllDisplays()
    const primaryId = screen.getPrimaryDisplay().id
    const local = buildLocalDisplayTargets(displays, primaryId)
    const network = Array.from(networkTargets.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(target => ({
        id: `receiver:${target.deviceId}`,
        kind: 'network',
        name: target.name,
        detail: `DRMVYZ Receiver · ${target.address}`,
        available: true,
        receiverId: target.deviceId,
      }))
    return [...local, ...network]
  }

  const broadcastTargets = () => sendToTrustedRenderers('drmvyz:output:targets-changed', getTargets())
  const currentSession = () => {
    const session = activeSessionId ? sessions.get(activeSessionId) : null
    if (!session) return null
    return {
      id: session.id,
      targetId: session.targetId,
      targetName: session.targetName,
      windowMode: session.windowMode,
      aspectRatio: session.aspectRatio,
      state: session.state,
      error: session.error ?? null,
    }
  }
  const broadcastSession = () => sendToTrustedRenderers('drmvyz:output:session-changed', currentSession())

  const removeSession = sessionId => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (session.sourceWebContents && !session.sourceWebContents.isDestroyed() && session.sourceDestroyedHandler) {
      session.sourceWebContents.removeListener('destroyed', session.sourceDestroyedHandler)
    }
    for (const waiter of session.answerWaiters.splice(0)) {
      waiter.reject(new Error('The output session ended before the receiver answered'))
    }
    sessions.delete(sessionId)
    if (activeSessionId === sessionId) activeSessionId = null
    broadcastSession()
  }

  const stopRemoteWindow = async session => {
    if (!session.remoteControl) return
    const { address, port, castId, controlToken } = session.remoteControl
    try {
      await fetch(`http://${address}:${port}/api/stop-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castId, controlToken, receiverToken: session.remoteControl.receiverToken }),
        signal: AbortSignal.timeout(2_500),
      })
    } catch {
      // The receiver may already be gone. Local state still needs to close.
    }
  }

  const stopSession = async sessionId => {
    const session = sessions.get(sessionId)
    if (!session) return
    session.state = 'stopping'
    broadcastSession()
    if (session.outputWindow && !session.outputWindow.isDestroyed()) session.outputWindow.close()
    await stopRemoteWindow(session)
    removeSession(sessionId)
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
        const session = sessions.get(url.searchParams.get('session') || '')
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
        const session = sessions.get(decodeURIComponent(sessionMatch[1]))
        if (!session || session.token !== url.searchParams.get('token')) {
          emptyResponse(response, 404)
          return
        }
        const action = sessionMatch[2]
        if (request.method === 'POST' && action === 'register') {
          session.state = 'connecting'
          session.receiverRegisteredAt = Date.now()
          sendToTrustedRenderers('drmvyz:output:receiver-requested', { sessionId: session.id })
          broadcastSession()
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
          session.state = 'connected'
          for (const waiter of session.answerWaiters.splice(0)) waiter.resolve(session.answer)
          broadcastSession()
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
      resolve()
    })
  })

  const sendDiscoveryBeacon = () => {
    if (!discoverySocket || !httpPort) return
    const payload = Buffer.from(JSON.stringify({
      magic: DISCOVERY_MAGIC,
      version: DISCOVERY_VERSION,
      deviceId,
      name: `${os.hostname()} · DRMVYZ`,
      port: httpPort,
      receiverToken,
    }))
    discoverySocket.send(payload, DISCOVERY_PORT, '255.255.255.255', () => {})
  }

  const startDiscovery = () => {
    discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    discoverySocket.on('message', (message, rinfo) => {
      try {
        const beacon = JSON.parse(message.toString('utf8'))
        if (
          beacon.magic !== DISCOVERY_MAGIC
          || beacon.version !== DISCOVERY_VERSION
          || beacon.deviceId === deviceId
          || !Number.isInteger(beacon.port)
          || beacon.port <= 0
          || beacon.port > 65_535
          || typeof beacon.receiverToken !== 'string'
          || !isPrivateNetworkAddress(rinfo.address)
        ) return
        const previous = networkTargets.get(beacon.deviceId)
        networkTargets.set(beacon.deviceId, {
          deviceId: beacon.deviceId,
          name: typeof beacon.name === 'string' && beacon.name.trim() ? beacon.name.trim() : 'DRMVYZ Receiver',
          address: rinfo.address,
          port: beacon.port,
          receiverToken: beacon.receiverToken,
          lastSeenAt: Date.now(),
        })
        if (!previous || previous.address !== rinfo.address || previous.port !== beacon.port || previous.name !== beacon.name) {
          broadcastTargets()
        }
      } catch {
        // Ignore unrelated UDP traffic on the discovery port.
      }
    })
    discoverySocket.on('error', () => {
      // Discovery is optional. Local display output remains available.
    })
    discoverySocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      try { discoverySocket.setBroadcast(true) } catch { /* Platform may restrict broadcast. */ }
      sendDiscoveryBeacon()
      discoveryInterval = setInterval(sendDiscoveryBeacon, DISCOVERY_INTERVAL_MS)
      discoveryInterval.unref?.()
    })
    expiryInterval = setInterval(() => {
      const cutoff = Date.now() - DISCOVERY_EXPIRY_MS
      let changed = false
      for (const [id, target] of networkTargets) {
        if (target.lastSeenAt < cutoff) {
          networkTargets.delete(id)
          changed = true
        }
      }
      if (changed) broadcastTargets()
      const sessionCutoff = Date.now() - SESSION_TTL_MS
      for (const [id, session] of sessions) {
        if (session.createdAt < sessionCutoff && id !== activeSessionId) removeSession(id)
      }
    }, 4_000)
    expiryInterval.unref?.()
  }

  const isTrustedSender = event => {
    const url = event.senderFrame?.url || event.sender.getURL()
    return isTrustedAppUrl(url)
  }

  ipcMain.handle('drmvyz:output:list-targets', event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output target request')
    return getTargets()
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
    if (activeSessionId) await stopSession(activeSessionId)

    const session = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(24).toString('base64url'),
      createdAt: Date.now(),
      targetId: request.targetId,
      targetName: 'Output',
      windowMode: request.windowMode,
      aspectRatio: request.aspectRatio,
      state: 'connecting',
      offer: null,
      answer: null,
      answerWaiters: [],
      outputWindow: null,
      remoteControl: null,
      sourceWebContentsId: event.sender.id,
      sourceWebContents: event.sender,
      sourceDestroyedHandler: null,
    }
    session.sourceDestroyedHandler = () => {
      if (sessions.has(session.id)) void stopSession(session.id)
    }
    event.sender.once('destroyed', session.sourceDestroyedHandler)
    sessions.set(session.id, session)
    activeSessionId = session.id

    try {
      if (request.targetId.startsWith('display:')) {
        const displayId = request.targetId.slice('display:'.length)
        const display = screen.getAllDisplays().find(item => String(item.id) === displayId)
        if (!display) throw new Error('That display is no longer connected')
        const target = getTargets().find(item => item.id === request.targetId)
        session.targetName = target?.name ?? 'Display'
        const sourceUrl = `http://127.0.0.1:${httpPort}/receiver?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.token)}`
        session.outputWindow = createOutputWindow({
          display,
          windowMode: request.windowMode,
          aspectRatio: request.aspectRatio,
          sourceUrl,
          onClosed: () => removeSession(session.id),
        })
      } else if (request.targetId.startsWith('receiver:')) {
        const receiverId = request.targetId.slice('receiver:'.length)
        const target = networkTargets.get(receiverId)
        if (!target) throw new Error('That network receiver is no longer available')
        session.targetName = target.name
        const sourceAddress = await resolveReachableLocalAddress(target.address)
        const sourceUrl = `http://${sourceAddress}:${httpPort}/receiver?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.token)}`
        const response = await fetch(`http://${target.address}:${target.port}/api/start-cast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceUrl,
            windowMode: request.windowMode,
            aspectRatio: request.aspectRatio,
            receiverToken: target.receiverToken,
          }),
          signal: AbortSignal.timeout(4_000),
        })
        if (!response.ok) throw new Error(`The receiver refused the cast (${response.status})`)
        const remote = await response.json()
        if (!remote || typeof remote.castId !== 'string' || typeof remote.controlToken !== 'string') {
          throw new Error('The receiver returned an invalid session')
        }
        session.remoteControl = {
          address: target.address,
          port: target.port,
          castId: remote.castId,
          controlToken: remote.controlToken,
          receiverToken: target.receiverToken,
        }
      } else {
        throw new Error('Unknown output target')
      }
      broadcastSession()
      return currentSession()
    } catch (error) {
      session.state = 'error'
      session.error = error instanceof Error ? error.message : 'Could not start output'
      broadcastSession()
      setTimeout(() => removeSession(session.id), 2_500).unref?.()
      throw error
    }
  })

  ipcMain.handle('drmvyz:output:stop-cast', async event => {
    if (!isTrustedSender(event)) throw new Error('Untrusted output stop request')
    if (activeSessionId) await stopSession(activeSessionId)
    return null
  })

  ipcMain.handle('drmvyz:output:publish-offer', (event, sessionId, offer) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted WebRTC offer')
    const session = sessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) throw new Error('Output session not found')
    if (!offer || offer.type !== 'offer' || typeof offer.sdp !== 'string') throw new Error('Invalid WebRTC offer')
    session.offer = { type: 'offer', sdp: offer.sdp }
    return true
  })

  ipcMain.handle('drmvyz:output:wait-for-answer', (event, sessionId) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted WebRTC answer request')
    const session = sessions.get(sessionId)
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
    const session = sessions.get(sessionId)
    if (!session || session.sourceWebContentsId !== event.sender.id) return false
    session.state = 'error'
    session.error = typeof message === 'string' ? message : 'Output stream failed'
    broadcastSession()
    return true
  })

  const onDisplayChange = () => broadcastTargets()
  screen.on('display-added', onDisplayChange)
  screen.on('display-removed', onDisplayChange)
  screen.on('display-metrics-changed', onDisplayChange)

  void startHttpServer().then(startDiscovery).catch(error => {
    console.error('[DRMVYZ Output] Receiver service failed to start:', error)
  })

  app.on('before-quit', () => {
    if (discoveryInterval) clearInterval(discoveryInterval)
    if (expiryInterval) clearInterval(expiryInterval)
    try { discoverySocket?.close() } catch { /* Already closed. */ }
    try { httpServer?.close() } catch { /* Already closed. */ }
    for (const receiver of receiverWindows.values()) {
      if (!receiver.outputWindow.isDestroyed()) receiver.outputWindow.destroy()
    }
  })

  return {
    getTargets,
    getSession: currentSession,
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
}
