'use strict'

const crypto = require('node:crypto')
const os = require('node:os')

const GOOGLE_CAST_PROVIDER_ID = 'google-cast'
const GOOGLE_CAST_PROVIDER_LABEL = 'Google Cast'
const GOOGLE_CAST_OPEN_PICKER_ACTION = 'open-picker'
const GOOGLE_CAST_TRANSPORT = 'google-cast-webm'
const GOOGLE_CAST_PROTOCOL_VERSION = 1
const GOOGLE_CAST_NAMESPACE = 'urn:x-cast:com.dvydrm.drmvyz.live'
const DEFAULT_PICKER_TIMEOUT_MS = 90_000
const MAX_MEDIA_CHUNK_BYTES = 4 * 1024 * 1024
const MAX_BOOTSTRAP_BYTES = 24 * 1024 * 1024

function normalizeAppId(value) {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[0-9A-F]{8}$/.test(id) ? id : null
}

function normalizeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function isPrivateIpv4(value) {
  const parts = String(value).split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  return parts[0] === 192 && parts[1] === 168
}

function listPrivateIpv4Addresses(networkInterfaces = os.networkInterfaces) {
  const addresses = []
  const seen = new Set()
  const interfaces = networkInterfaces() || {}
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      const family = entry?.family === 4 || entry?.family === 'IPv4' ? 4 : entry?.family
      if (family !== 4 || entry.internal || !isPrivateIpv4(entry.address) || seen.has(entry.address)) continue
      seen.add(entry.address)
      addresses.push(entry.address)
    }
  }
  return addresses
}

function normalizeCompanionEvent(value) {
  if (!value || typeof value !== 'object') return null
  const type = typeof value.type === 'string' ? value.type.trim() : ''
  if (!['ready', 'selected', 'cancelled', 'connected', 'disconnected', 'error'].includes(type)) return null
  return {
    type,
    receiverName: typeof value.receiverName === 'string' && value.receiverName.trim() ? value.receiverName.trim().slice(0, 160) : null,
    receiverId: typeof value.receiverId === 'string' && value.receiverId.trim() ? value.receiverId.trim().slice(0, 256) : null,
    castSessionId: typeof value.castSessionId === 'string' && value.castSessionId.trim() ? value.castSessionId.trim().slice(0, 256) : null,
    message: typeof value.message === 'string' && value.message.trim() ? value.message.trim().slice(0, 500) : null,
  }
}

function normalizeMimeType(value) {
  if (typeof value !== 'string') return null
  const mimeType = value.trim().toLowerCase()
  if (mimeType === 'video/webm') return mimeType
  if (/^video\/webm\s*;\s*codecs\s*=\s*"?(vp8|vp9)"?$/.test(mimeType)) return mimeType
  return null
}

function safePositiveNumber(value, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.min(maximum, number)
}

class GoogleCastProvider {
  constructor({
    appId = process.env.DRMVYZ_GOOGLE_CAST_APP_ID,
    senderUrl = process.env.DRMVYZ_GOOGLE_CAST_SENDER_URL,
    openCompanion = null,
    pickerTimeoutMs = DEFAULT_PICKER_TIMEOUT_MS,
    networkInterfaces = os.networkInterfaces,
    randomUUID = crypto.randomUUID,
    randomBytes = crypto.randomBytes,
  } = {}) {
    this.id = GOOGLE_CAST_PROVIDER_ID
    this.label = GOOGLE_CAST_PROVIDER_LABEL
    this.transport = GOOGLE_CAST_TRANSPORT
    this.capabilities = Object.freeze({
      targetEnumeration: false,
      sessions: true,
      picker: true,
      actions: [GOOGLE_CAST_OPEN_PICKER_ACTION],
    })
    this.appId = normalizeAppId(appId)
    this.senderUrl = normalizeHttpsUrl(senderUrl)
    this.openCompanion = openCompanion
    this.pickerTimeoutMs = Math.max(1_000, Number(pickerTimeoutMs) || DEFAULT_PICKER_TIMEOUT_MS)
    this.networkInterfaces = networkInterfaces
    this.randomUUID = randomUUID
    this.randomBytes = randomBytes
    this.servicePort = null
    this.lastError = null
    this.selectedTarget = null
    this.transactions = new Map()
    this.mediaSessions = new Map()
    this.onStatusChanged = () => {}
    this.onTargetsChanged = () => {}
  }

  start({ onStatusChanged, onTargetsChanged } = {}) {
    this.onStatusChanged = typeof onStatusChanged === 'function' ? onStatusChanged : () => {}
    this.onTargetsChanged = typeof onTargetsChanged === 'function' ? onTargetsChanged : () => {}
  }

  configureService({ port } = {}) {
    this.servicePort = Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null
    this.onStatusChanged()
  }

  getSenderOrigin() {
    return this.senderUrl?.origin ?? null
  }

  getStatus() {
    const missing = []
    if (!this.appId) missing.push('DRMVYZ_GOOGLE_CAST_APP_ID (8-character Cast receiver application ID)')
    if (!this.senderUrl) missing.push('DRMVYZ_GOOGLE_CAST_SENDER_URL (HTTPS companion URL)')
    if (missing.length) {
      return {
        state: 'configuration-required',
        message: `Google Cast requires ${missing.join(' and ')}. The Cast picker stays disabled until both are configured.`,
      }
    }
    if (typeof this.openCompanion !== 'function') {
      return {
        state: 'unavailable',
        message: 'Google Cast cannot open the browser sender companion in this build.',
      }
    }
    if (!this.servicePort) {
      return {
        state: 'unavailable',
        message: 'Google Cast is waiting for the local DRMVYZ media/control service to start.',
      }
    }
    if (this.lastError) return { state: 'initialization-failed', message: this.lastError }
    return { state: 'available', message: null }
  }

  listTargets() {
    return this.selectedTarget ? [{ ...this.selectedTarget }] : []
  }

  buildCompanionUrl(transaction) {
    const url = new URL(this.senderUrl.toString())
    url.hash = new URLSearchParams({
      protocolVersion: String(GOOGLE_CAST_PROTOCOL_VERSION),
      appId: this.appId,
      transactionId: transaction.id,
      callbackToken: transaction.token,
      callbackUrl: `http://127.0.0.1:${this.servicePort}/api/google-cast/companion/${encodeURIComponent(transaction.id)}`,
    }).toString()
    return url.toString()
  }

  createTransaction() {
    const id = this.randomUUID()
    const token = this.randomBytes(32).toString('base64url')
    const transaction = {
      id,
      token,
      state: 'waiting',
      selected: null,
      sessionId: null,
      commands: [],
      selectionResolve: null,
      selectionReject: null,
      pickerTimer: null,
      cleanupTimer: null,
    }
    this.transactions.set(id, transaction)
    return transaction
  }

  cleanupTransaction(transaction, { keepSelectedTarget = false } = {}) {
    if (!transaction) return
    if (transaction.pickerTimer) clearTimeout(transaction.pickerTimer)
    if (transaction.cleanupTimer) clearTimeout(transaction.cleanupTimer)
    if (transaction.selectionResolve && transaction.state === 'waiting') {
      transaction.selectionResolve({ state: 'cancelled', message: 'Google Cast selection was cancelled.' })
    }
    this.transactions.delete(transaction.id)
    if (!keepSelectedTarget && this.selectedTarget?.googleCastTransactionId === transaction.id) {
      this.selectedTarget = null
      this.onTargetsChanged()
    }
  }

  async performAction(actionId) {
    if (actionId !== GOOGLE_CAST_OPEN_PICKER_ACTION) {
      throw new Error(`${this.label} does not support action: ${actionId}`)
    }
    const status = this.getStatus()
    if (status.state === 'configuration-required' || status.state === 'unavailable') throw new Error(status.message)
    if (this.selectedTarget) throw new Error('Stop the current Google Cast output before choosing another Cast device')

    for (const transaction of this.transactions.values()) {
      if (transaction.state === 'waiting') this.cleanupTransaction(transaction)
    }

    const transaction = this.createTransaction()
    const selectionPromise = new Promise((resolve, reject) => {
      transaction.selectionResolve = resolve
      transaction.selectionReject = reject
      transaction.pickerTimer = setTimeout(() => {
        if (transaction.state !== 'waiting') return
        transaction.state = 'timed-out'
        this.transactions.delete(transaction.id)
        reject(new Error('The Google Cast browser companion did not complete device selection in time'))
      }, this.pickerTimeoutMs)
      transaction.pickerTimer.unref?.()
    })

    this.lastError = null
    try {
      await this.openCompanion(this.buildCompanionUrl(transaction))
      const selection = await selectionPromise
      if (selection.state === 'cancelled') {
        this.cleanupTransaction(transaction)
        this.onStatusChanged()
        return {
          providerId: this.id,
          actionId,
          state: 'cancelled',
          message: selection.message ?? 'Google Cast selection cancelled.',
        }
      }
      return {
        providerId: this.id,
        actionId,
        state: 'selected',
        targetId: this.selectedTarget?.id ?? null,
        message: this.selectedTarget ? `Selected ${this.selectedTarget.name}. Starting live output…` : 'Google Cast device selected.',
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not open Google Cast'
      this.cleanupTransaction(transaction)
      this.onStatusChanged()
      throw error
    }
  }

  handleCompanionEvent(transactionId, token, value) {
    const transaction = this.transactions.get(transactionId)
    if (!transaction || token !== transaction.token) return { ok: false, statusCode: 404, message: 'Google Cast companion transaction not found' }
    const event = normalizeCompanionEvent(value)
    if (!event) return { ok: false, statusCode: 400, message: 'Invalid Google Cast companion event' }

    if (event.type === 'ready') return { ok: true, statusCode: 204 }

    if (event.type === 'selected') {
      if (transaction.state !== 'waiting') return { ok: true, statusCode: 204 }
      const receiverName = event.receiverName || 'Google Cast device'
      transaction.state = 'selected'
      transaction.selected = event
      if (transaction.pickerTimer) clearTimeout(transaction.pickerTimer)
      this.selectedTarget = {
        id: `google-cast:${transaction.id}`,
        kind: 'network',
        name: receiverName,
        detail: 'Google Cast · selected in browser companion',
        available: true,
        googleCastTransactionId: transaction.id,
        googleCastReceiverId: event.receiverId,
      }
      this.onTargetsChanged()
      this.onStatusChanged()
      transaction.selectionResolve?.({ state: 'selected' })
      return { ok: true, statusCode: 204 }
    }

    if (event.type === 'cancelled') {
      if (transaction.state === 'waiting') {
        transaction.state = 'cancelled'
        if (transaction.pickerTimer) clearTimeout(transaction.pickerTimer)
        transaction.selectionResolve?.({ state: 'cancelled', message: event.message })
      }
      return { ok: true, statusCode: 204 }
    }

    if (event.type === 'error') {
      const message = event.message || 'Google Cast browser companion failed'
      this.lastError = message
      this.onStatusChanged()
      if (transaction.state === 'waiting') {
        transaction.state = 'failed'
        if (transaction.pickerTimer) clearTimeout(transaction.pickerTimer)
        transaction.selectionReject?.(new Error(message))
        return { ok: true, statusCode: 204 }
      }
      if (!transaction.sessionId) {
        transaction.state = 'failed'
        if (this.selectedTarget?.googleCastTransactionId === transaction.id) {
          this.selectedTarget = null
          this.onTargetsChanged()
        }
      }
      return { ok: true, statusCode: 204, sessionEvent: transaction.sessionId ? 'failed' : null, sessionId: transaction.sessionId, message }
    }

    if (event.type === 'connected') {
      return { ok: true, statusCode: 204, sessionEvent: transaction.sessionId ? 'connected' : null, sessionId: transaction.sessionId }
    }

    if (event.type === 'disconnected') {
      if (!transaction.sessionId) {
        transaction.state = 'disconnected'
        if (this.selectedTarget?.googleCastTransactionId === transaction.id) {
          this.selectedTarget = null
          this.onTargetsChanged()
        }
      }
      return {
        ok: true,
        statusCode: 204,
        sessionEvent: transaction.sessionId ? 'disconnected' : null,
        sessionId: transaction.sessionId,
        message: event.message || 'The Google Cast session ended.',
      }
    }

    return { ok: true, statusCode: 204 }
  }

  takeCompanionCommand(transactionId, token) {
    const transaction = this.transactions.get(transactionId)
    if (!transaction || token !== transaction.token) return { ok: false, statusCode: 404, message: 'Google Cast companion transaction not found' }
    return { ok: true, statusCode: 200, command: transaction.commands.shift() ?? null }
  }

  queueCommand(transaction, command) {
    if (!transaction || !this.transactions.has(transaction.id)) return false
    transaction.commands.push(command)
    return true
  }

  async startSession({ target, context }) {
    const transactionId = target?.googleCastTransactionId
    const transaction = this.transactions.get(transactionId)
    if (!transaction || transaction.state !== 'selected') throw new Error('Choose a Google Cast device again before starting output')
    if (!context?.sessionId) throw new Error('Google Cast session identity is missing')
    const addresses = listPrivateIpv4Addresses(this.networkInterfaces)
    if (!addresses.length) throw new Error('Google Cast needs an active private IPv4 network interface reachable by the Cast device')

    transaction.sessionId = context.sessionId
    transaction.state = 'starting'
    const mediaToken = this.randomBytes(32).toString('base64url')
    const mediaUrls = addresses.map(address => `http://${address}:${this.servicePort}/api/google-cast/live/${encodeURIComponent(context.sessionId)}?token=${encodeURIComponent(mediaToken)}`)
    this.mediaSessions.set(context.sessionId, {
      sessionId: context.sessionId,
      transactionId,
      mediaToken,
      mediaUrls,
      mimeType: null,
      width: null,
      height: null,
      framesPerSecond: null,
      clients: new Set(),
      bootstrapChunks: [],
      bootstrapBytes: 0,
      clientStarted: false,
      ended: false,
      bytesPublished: 0,
    })
    return { transactionId, sessionId: context.sessionId }
  }

  beginMediaStream(sessionId, metadata) {
    const media = this.mediaSessions.get(sessionId)
    if (!media || media.ended) throw new Error('Google Cast media session not found')
    const mimeType = normalizeMimeType(metadata?.mimeType)
    if (!mimeType) throw new Error('Google Cast live output requires a WebM MediaRecorder stream using VP8 or VP9')
    media.mimeType = mimeType
    media.width = safePositiveNumber(metadata?.width, 7_680)
    media.height = safePositiveNumber(metadata?.height, 4_320)
    media.framesPerSecond = safePositiveNumber(metadata?.framesPerSecond, 120)
    const transaction = this.transactions.get(media.transactionId)
    if (!transaction) throw new Error('Google Cast browser companion is no longer available')
    this.queueCommand(transaction, {
      type: 'start',
      protocolVersion: GOOGLE_CAST_PROTOCOL_VERSION,
      namespace: GOOGLE_CAST_NAMESPACE,
      sessionId,
      mediaUrls: media.mediaUrls,
      mimeType,
      width: media.width,
      height: media.height,
      framesPerSecond: media.framesPerSecond,
    })
    return { ok: true, mediaUrls: [...media.mediaUrls] }
  }

  appendMediaChunk(sessionId, value) {
    const media = this.mediaSessions.get(sessionId)
    if (!media || media.ended || !media.mimeType) return { ok: false, reason: 'not-active' }
    const chunk = Buffer.isBuffer(value)
      ? value
      : ArrayBuffer.isView(value)
        ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
        : value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.alloc(0)
    if (chunk.length === 0) return { ok: true, bytesPublished: media.bytesPublished }
    if (chunk.length > MAX_MEDIA_CHUNK_BYTES) return { ok: false, reason: 'chunk-too-large' }
    media.bytesPublished += chunk.length

    if (!media.clientStarted) {
      if (media.bootstrapBytes + chunk.length > MAX_BOOTSTRAP_BYTES) return { ok: false, reason: 'receiver-not-consuming' }
      media.bootstrapChunks.push(chunk)
      media.bootstrapBytes += chunk.length
      return { ok: true, bytesPublished: media.bytesPublished }
    }

    let backpressured = false
    for (const response of [...media.clients]) {
      try {
        if (response.write(chunk) === false) {
          backpressured = true
          media.clients.delete(response)
          try { response.destroy?.() } catch { /* Client is already being released. */ }
        }
      } catch {
        media.clients.delete(response)
      }
    }
    if (backpressured) return { ok: false, reason: 'receiver-backpressure' }
    return { ok: true, bytesPublished: media.bytesPublished }
  }

  completeMediaStream(sessionId) {
    const media = this.mediaSessions.get(sessionId)
    if (!media) return false
    media.ended = true
    for (const response of media.clients) {
      try { response.end() } catch { /* Client already closed. */ }
    }
    media.clients.clear()
    return true
  }

  handleMediaRequest(request, response, sessionId, token, remoteAddress, isPrivateNetworkAddress) {
    const media = this.mediaSessions.get(sessionId)
    if (!media || token !== media.mediaToken || media.ended || !media.mimeType) return { handled: false, statusCode: 404 }
    if (typeof isPrivateNetworkAddress === 'function' && !isPrivateNetworkAddress(remoteAddress)) return { handled: false, statusCode: 403 }
    if (request.method !== 'GET' && request.method !== 'HEAD') return { handled: false, statusCode: 405 }

    response.writeHead(200, {
      'Content-Type': media.mimeType,
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Connection': 'keep-alive',
    })
    if (request.method === 'HEAD') {
      response.end()
      return { handled: true, statusCode: 200 }
    }

    media.clients.add(response)
    if (!media.clientStarted) {
      media.clientStarted = true
      for (const chunk of media.bootstrapChunks) response.write(chunk)
      media.bootstrapChunks = []
      media.bootstrapBytes = 0
    }
    const cleanup = () => media.clients.delete(response)
    response.once('close', cleanup)
    response.once('error', cleanup)
    return { handled: true, statusCode: 200 }
  }

  async stopSession(runtimeHandle, managedSession = null) {
    const sessionId = runtimeHandle?.sessionId ?? managedSession?.id ?? null
    const transactionId = runtimeHandle?.transactionId ?? (this.selectedTarget && managedSession?.targetId === this.selectedTarget.id ? this.selectedTarget.googleCastTransactionId : null)
    const media = sessionId ? this.mediaSessions.get(sessionId) : null
    if (media) {
      this.completeMediaStream(sessionId)
      this.mediaSessions.delete(sessionId)
    }
    const transaction = transactionId ? this.transactions.get(transactionId) : null
    if (transaction) {
      transaction.state = 'stopping'
      this.queueCommand(transaction, { type: 'stop', protocolVersion: GOOGLE_CAST_PROTOCOL_VERSION, sessionId })
      transaction.cleanupTimer = setTimeout(() => this.cleanupTransaction(transaction), 8_000)
      transaction.cleanupTimer.unref?.()
    } else if (this.selectedTarget?.googleCastTransactionId === transactionId) {
      this.selectedTarget = null
      this.onTargetsChanged()
    }
    this.selectedTarget = null
    this.onTargetsChanged()
  }

  shutdown() {
    for (const sessionId of [...this.mediaSessions.keys()]) {
      this.completeMediaStream(sessionId)
      this.mediaSessions.delete(sessionId)
    }
    for (const transaction of [...this.transactions.values()]) this.cleanupTransaction(transaction)
    this.selectedTarget = null
    this.lastError = null
  }
}

module.exports = {
  DEFAULT_PICKER_TIMEOUT_MS,
  GOOGLE_CAST_NAMESPACE,
  GOOGLE_CAST_OPEN_PICKER_ACTION,
  GOOGLE_CAST_PROTOCOL_VERSION,
  GOOGLE_CAST_PROVIDER_ID,
  GOOGLE_CAST_TRANSPORT,
  GoogleCastProvider,
  MAX_BOOTSTRAP_BYTES,
  MAX_MEDIA_CHUNK_BYTES,
  listPrivateIpv4Addresses,
  normalizeAppId,
  normalizeCompanionEvent,
  normalizeHttpsUrl,
  normalizeMimeType,
}
