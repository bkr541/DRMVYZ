'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {
  GOOGLE_CAST_OPEN_PICKER_ACTION,
  GoogleCastProvider,
  MAX_BOOTSTRAP_BYTES,
  MAX_MEDIA_CHUNK_BYTES,
  listPrivateIpv4Addresses,
  normalizeAppId,
  normalizeHttpsUrl,
  normalizeMimeType,
} = require('./providers/googleCastProvider.cjs')

function deterministicBytes(size) {
  return Buffer.alloc(size, 0x5a)
}

function configuredProvider(overrides = {}) {
  let provider
  let openedUrl = null
  provider = new GoogleCastProvider({
    appId: 'A1B2C3D4',
    senderUrl: 'https://cast.example.test/drmvyz/sender/',
    randomUUID: () => 'transaction-1',
    randomBytes: deterministicBytes,
    networkInterfaces: () => ({
      wifi: [{ family: 'IPv4', address: '192.168.50.4', internal: false }],
      public: [{ family: 'IPv4', address: '8.8.8.8', internal: false }],
    }),
    openCompanion: async url => {
      openedUrl = url
      overrides.onOpen?.(provider, url)
    },
    ...overrides,
  })
  provider.configureService({ port: 45678 })
  return { provider, getOpenedUrl: () => openedUrl }
}

function transactionFromUrl(provider, value) {
  const url = new URL(value)
  const params = new URLSearchParams(url.hash.slice(1))
  const id = params.get('transactionId')
  const token = params.get('callbackToken')
  assert.ok(id)
  assert.ok(token)
  return { transaction: provider.transactions.get(id), id, token, params }
}

class FakeResponse extends EventEmitter {
  constructor() {
    super()
    this.statusCode = null
    this.headers = null
    this.chunks = []
    this.ended = false
  }
  writeHead(statusCode, headers) {
    this.statusCode = statusCode
    this.headers = headers
  }
  write(chunk) {
    this.chunks.push(Buffer.from(chunk))
    return true
  }
  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk))
    this.ended = true
  }
}


test('Google Cast browser sender and Custom Web Receiver sources are syntactically valid and versioned', () => {
  for (const relativePath of ['google-cast/sender/index.html', 'google-cast/receiver/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
    const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map(match => match[1].trim())
      .filter(Boolean)
    assert.ok(inlineScripts.length > 0, `${relativePath} should contain an inline application script`)
    for (const script of inlineScripts) assert.doesNotThrow(() => new Function(script))
    assert.match(html, /urn:x-cast:com\.dvydrm\.drmvyz\.live/)
    assert.match(html, /PROTOCOL_VERSION = 1/)
  }
})

test('Google Cast configuration is explicit and validates only deployment-safe values', () => {
  const provider = new GoogleCastProvider()
  assert.equal(provider.getStatus().state, 'configuration-required')
  assert.match(provider.getStatus().message, /DRMVYZ_GOOGLE_CAST_APP_ID/)
  assert.match(provider.getStatus().message, /DRMVYZ_GOOGLE_CAST_SENDER_URL/)
  assert.equal(normalizeAppId(' a1b2c3d4 '), 'A1B2C3D4')
  assert.equal(normalizeAppId('not-an-id'), null)
  assert.equal(normalizeHttpsUrl('https://cast.example.test/sender')?.origin, 'https://cast.example.test')
  assert.equal(normalizeHttpsUrl('http://cast.example.test/sender'), null)
  assert.equal(normalizeMimeType('video/webm;codecs=vp8'), 'video/webm;codecs=vp8')
  assert.equal(normalizeMimeType('video/mp4'), null)
})

test('Google Cast reports LAN media service startup failure explicitly and recovers after reconfiguration', async () => {
  const { provider } = configuredProvider()
  provider.reportServiceError(new Error('LAN bind denied'))
  assert.equal(provider.getStatus().state, 'initialization-failed')
  assert.match(provider.getStatus().message, /LAN bind denied/)
  await assert.rejects(provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION), /LAN bind denied/)

  provider.configureService({ port: 45679 })
  assert.equal(provider.getStatus().state, 'available')
})

test('Google Cast picker cancellation leaves no target or fake session state', async () => {
  const { provider, getOpenedUrl } = configuredProvider({
    onOpen: (instance, url) => {
      queueMicrotask(() => {
        const { id, token } = transactionFromUrl(instance, url)
        instance.handleCompanionEvent(id, token, { type: 'cancelled', message: 'User cancelled.' })
      })
    },
  })

  const result = await provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  assert.equal(result.state, 'cancelled')
  assert.ok(getOpenedUrl()?.startsWith('https://cast.example.test/'))
  assert.equal(provider.listTargets().length, 0)
  assert.equal(provider.transactions.size, 0)
  assert.equal(provider.mediaSessions.size, 0)
})

test('Google Cast selection creates one transient target and a tokenized private-LAN media session', async () => {
  const { provider, getOpenedUrl } = configuredProvider({
    onOpen: (instance, url) => {
      queueMicrotask(() => {
        const { id, token } = transactionFromUrl(instance, url)
        instance.handleCompanionEvent(id, token, { type: 'selected', receiverName: 'Studio TV', receiverId: 'cast-device-7' })
      })
    },
  })

  const result = await provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  assert.equal(result.state, 'selected')
  assert.equal(provider.listTargets()[0].name, 'Studio TV')
  const { id, token, params } = transactionFromUrl(provider, getOpenedUrl())
  assert.equal(params.get('callbackUrl'), 'http://127.0.0.1:45678/api/google-cast/companion/transaction-1')
  assert.equal(new URL(getOpenedUrl()).search, '')

  const runtime = await provider.startSession({
    target: provider.listTargets()[0],
    context: { sessionId: 'cast-session-1' },
  })
  assert.deepEqual(runtime, { transactionId: id, sessionId: 'cast-session-1' })
  await assert.rejects(
    async () => provider.beginMediaStream('cast-session-1', { mimeType: 'video/mp4' }),
    /WebM MediaRecorder stream/,
  )
  const started = provider.beginMediaStream('cast-session-1', {
    mimeType: 'video/webm;codecs=vp8', width: 1280, height: 720, framesPerSecond: 30,
  })
  assert.equal(started.ok, true)
  assert.equal(started.mediaUrls.length, 1)
  assert.match(started.mediaUrls[0], /^http:\/\/192\.168\.50\.4:45678\/api\/google-cast\/live\/cast-session-1\?token=/)
  assert.deepEqual(listPrivateIpv4Addresses(provider.networkInterfaces), ['192.168.50.4'])

  const command = provider.takeCompanionCommand(id, token)
  assert.equal(command.command.type, 'start')
  assert.deepEqual(command.command.mediaUrls, started.mediaUrls)
})

test('Google Cast receiver departure after selection cannot leave a startable stale target', async () => {
  const { provider, getOpenedUrl } = configuredProvider({
    onOpen: (instance, url) => queueMicrotask(() => {
      const { id, token } = transactionFromUrl(instance, url)
      instance.handleCompanionEvent(id, token, { type: 'selected', receiverName: 'Departing TV' })
    }),
  })

  const result = await provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  assert.equal(result.state, 'selected')
  const staleTarget = provider.listTargets()[0]
  const { id, token } = transactionFromUrl(provider, getOpenedUrl())
  const disconnect = provider.handleCompanionEvent(id, token, { type: 'disconnected', message: 'Receiver left before media startup.' })
  assert.equal(disconnect.sessionEvent, null)
  assert.equal(provider.listTargets().length, 0)
  await assert.rejects(
    async () => provider.startSession({ target: staleTarget, context: { sessionId: 'stale-session' } }),
    /Choose a Google Cast device again/,
  )
})

test('Google Cast media server rejects arbitrary/public access and bounds encoder buffering', async () => {
  const { provider } = configuredProvider({
    onOpen: (instance, url) => queueMicrotask(() => {
      const { id, token } = transactionFromUrl(instance, url)
      instance.handleCompanionEvent(id, token, { type: 'selected', receiverName: 'Studio TV' })
    }),
  })
  await provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  const target = provider.listTargets()[0]
  await provider.startSession({ target, context: { sessionId: 'cast-session-2' } })
  const started = provider.beginMediaStream('cast-session-2', { mimeType: 'video/webm;codecs=vp8', width: 640, height: 360, framesPerSecond: 30 })
  const mediaUrl = new URL(started.mediaUrls[0])
  const mediaToken = mediaUrl.searchParams.get('token')

  const publicResponse = new FakeResponse()
  const publicResult = provider.handleMediaRequest({ method: 'GET' }, publicResponse, 'cast-session-2', mediaToken, '8.8.8.8', value => value.startsWith('192.168.'))
  assert.equal(publicResult.statusCode, 403)
  assert.equal(publicResponse.headers, null)

  const wrongToken = new FakeResponse()
  assert.equal(provider.handleMediaRequest({ method: 'GET' }, wrongToken, 'cast-session-2', 'wrong', '192.168.50.8', () => true).statusCode, 404)

  const offsetBacking = new Uint8Array([1, 2, 3, 4, 5])
  const offsetChunk = offsetBacking.subarray(1, 4)
  assert.equal(provider.appendMediaChunk('cast-session-2', offsetChunk).ok, true)
  assert.equal(provider.mediaSessions.get('cast-session-2').bootstrapBytes, 3)
  assert.equal(provider.appendMediaChunk('cast-session-2', Buffer.alloc(MAX_MEDIA_CHUNK_BYTES + 1)).reason, 'chunk-too-large')

  const streamResponse = new FakeResponse()
  const streamResult = provider.handleMediaRequest({ method: 'GET' }, streamResponse, 'cast-session-2', mediaToken, '192.168.50.8', () => true)
  assert.equal(streamResult.handled, true)
  assert.equal(streamResponse.statusCode, 200)
  assert.equal(streamResponse.headers['Content-Type'], 'video/webm;codecs=vp8')
  assert.deepEqual(Buffer.concat(streamResponse.chunks), Buffer.from([2, 3, 4]))

  assert.equal(provider.appendMediaChunk('cast-session-2', Buffer.from([9, 8])).ok, true)
  assert.deepEqual(Buffer.concat(streamResponse.chunks), Buffer.from([2, 3, 4, 9, 8]))
  assert.equal(provider.mediaSessions.get('cast-session-2').bootstrapBytes, 0)

  const bufferingProvider = configuredProvider({
    randomUUID: () => 'transaction-2',
    onOpen: (instance, url) => queueMicrotask(() => {
      const { id, token } = transactionFromUrl(instance, url)
      instance.handleCompanionEvent(id, token, { type: 'selected', receiverName: 'Other TV' })
    }),
  }).provider
  await bufferingProvider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  await bufferingProvider.startSession({ target: bufferingProvider.listTargets()[0], context: { sessionId: 'cast-session-3' } })
  bufferingProvider.beginMediaStream('cast-session-3', { mimeType: 'video/webm', width: 640, height: 360, framesPerSecond: 30 })
  const chunk = Buffer.alloc(Math.min(MAX_MEDIA_CHUNK_BYTES, 1024 * 1024))
  let result = { ok: true }
  while (result.ok) result = bufferingProvider.appendMediaChunk('cast-session-3', chunk)
  assert.equal(result.reason, 'receiver-not-consuming')
  assert.ok(bufferingProvider.mediaSessions.get('cast-session-3').bootstrapBytes <= MAX_BOOTSTRAP_BYTES)
})

test('Google Cast disconnect and repeated teardown release media clients and transient targets exactly once', async () => {
  const { provider, getOpenedUrl } = configuredProvider({
    onOpen: (instance, url) => queueMicrotask(() => {
      const { id, token } = transactionFromUrl(instance, url)
      instance.handleCompanionEvent(id, token, { type: 'selected', receiverName: 'Studio TV' })
    }),
  })
  await provider.performAction(GOOGLE_CAST_OPEN_PICKER_ACTION)
  const { id, token } = transactionFromUrl(provider, getOpenedUrl())
  const runtime = await provider.startSession({ target: provider.listTargets()[0], context: { sessionId: 'cast-session-4' } })
  provider.beginMediaStream('cast-session-4', { mimeType: 'video/webm;codecs=vp9', width: 1280, height: 720, framesPerSecond: 30 })
  const media = provider.mediaSessions.get('cast-session-4')
  const response = new FakeResponse()
  provider.handleMediaRequest({ method: 'GET' }, response, 'cast-session-4', media.mediaToken, '192.168.50.9', () => true)

  const disconnect = provider.handleCompanionEvent(id, token, { type: 'disconnected', message: 'TV left' })
  assert.equal(disconnect.sessionEvent, 'disconnected')
  assert.equal(disconnect.sessionId, 'cast-session-4')

  await provider.stopSession(runtime, { id: 'cast-session-4', targetId: provider.listTargets()[0].id })
  assert.equal(response.ended, true)
  assert.equal(provider.mediaSessions.size, 0)
  assert.equal(provider.listTargets().length, 0)
  await provider.stopSession(runtime, { id: 'cast-session-4', targetId: 'gone' })
  provider.shutdown()
  assert.equal(provider.transactions.size, 0)
  assert.equal(provider.mediaSessions.size, 0)
})
