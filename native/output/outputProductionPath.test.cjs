'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const Module = require('node:module')
const test = require('node:test')
const { installOutputCastBridge } = require('./outputCastBridge.cjs')
const { serializeDiscoveryAdvertisement } = require('./providers/drmvyzReceiverProvider.cjs')
const { DRMVYZ_RECEIVER_PROTOCOL_VERSION, buildCapabilityDocument } = require('./drmvyzReceiverProtocol.cjs')

class FakeScreen extends EventEmitter {
  constructor() {
    super()
    this.displays = [
      { id: 7, label: '', bounds: { x: 0, y: 0, width: 2560, height: 1440 }, workArea: { x: 0, y: 0, width: 2560, height: 1400 } },
    ]
  }
  getAllDisplays() { return this.displays }
  getPrimaryDisplay() { return this.displays[0] }
}

test('production preload invoke reaches IPC target manager and LocalDisplayProvider', async () => {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  const app = new EventEmitter()
  const screen = new FakeScreen()
  const BrowserWindow = { getAllWindows: () => [] }
  let macDisplayOpens = 0
  const installed = installOutputCastBridge({
    app,
    BrowserWindow,
    ipcMain,
    screen,
    platform: 'darwin',
    openSystemDisplays: async () => {
      macDisplayOpens += 1
      return { message: 'macOS display controls opened.' }
    },
    isTrustedAppUrl: url => url === 'drmvyz-app://app/index.html',
  })

  const sender = new EventEmitter()
  sender.id = 41
  sender.getURL = () => 'drmvyz-app://app/index.html'
  sender.isDestroyed = () => false
  const event = { sender, senderFrame: { url: 'drmvyz-app://app/index.html' } }
  const ipcRenderer = new EventEmitter()
  ipcRenderer.invoke = async (channel, ...args) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
    return handler(event, ...args)
  }

  const exposed = {}
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: { exposeInMainWorld: (name, value) => { exposed[name] = value } },
        ipcRenderer,
        webUtils: { getPathForFile: () => null },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const preloadPath = require.resolve('../rekordbox/preloadRekordboxBridge.cjs')
    delete require.cache[preloadPath]
    require(preloadPath)

    const targets = await exposed.drmvyzNative.output.listTargets()
    assert.deepEqual(targets.map(target => target.id), ['display:7'])
    assert.equal(targets[0].name, 'This display')
    assert.equal(targets[0].providerId, 'local-display')

    const snapshot = await exposed.drmvyzNative.output.getTargetSnapshot()
    assert.equal(snapshot.targets[0].id, 'display:7')
    assert.equal(snapshot.providers.find(provider => provider.providerId === 'local-display').state, 'available')
    const airplay = snapshot.providers.find(provider => provider.providerId === 'airplay')
    assert.equal(airplay.state, 'available')
    assert.deepEqual(airplay.capabilities.actions, ['open-system-picker'])

    const action = await exposed.drmvyzNative.output.performProviderAction('airplay', 'open-system-picker')
    assert.equal(action.state, 'opened')
    assert.equal(macDisplayOpens, 1)
    assert.equal(await exposed.drmvyzNative.output.getSession(), null)
    assert.deepEqual((await exposed.drmvyzNative.output.listTargets()).map(target => target.id), ['display:7'])

    const untrusted = { sender, senderFrame: { url: 'https://example.invalid/' } }
    await assert.rejects(
      handlers.get('drmvyz:output:list-targets')(untrusted),
      /Untrusted output target request/,
    )
  } finally {
    Module._load = originalLoad
    await installed.shutdown()
  }
})


test('production preload selection and IPC dispatch reach DrmvyzReceiverProvider for a discovered receiver', async () => {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  const app = new EventEmitter()
  const screen = new FakeScreen()
  const BrowserWindow = { getAllWindows: () => [] }
  const fetchCalls = []
  let remotePairingToken = null
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = String(url)
    fetchCalls.push({ url: requestUrl, init })
    if (requestUrl.endsWith('/api/v2/capabilities')) {
      return {
        ok: true,
        status: 200,
        json: async () => buildCapabilityDocument({
          deviceId: 'remote-production-1',
          name: 'Production Booth · DRMVYZ',
          paired: Boolean(remotePairingToken && init.headers?.['X-DRMVYZ-Pairing-Token'] === remotePairingToken),
          displays: [
            { id: 'remote-display-a', name: 'LED Wall', width: 1920, height: 1080, primary: true },
            { id: 'remote-display-b', name: 'Projector', width: 2560, height: 1440, primary: false },
          ],
        }),
      }
    }
    if (requestUrl.endsWith('/api/v2/pair')) {
      remotePairingToken = 'production-pairing-token-abcdefghijklmnopqrstuvwxyz'
      return { ok: true, status: 200, json: async () => ({ protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION, paired: true, pairingToken: remotePairingToken }) }
    }
    if (requestUrl.endsWith('/api/v2/sessions')) {
      return { ok: true, status: 200, json: async () => ({ protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION, castId: 'remote-cast-1', controlToken: 'remote-control-1' }) }
    }
    if (/\/api\/v2\/sessions\/remote-cast-1\/stop$/.test(requestUrl)) {
      return { ok: true, status: 204, json: async () => ({}) }
    }
    throw new Error(`Unexpected fetch: ${requestUrl}`)
  }

  const installed = installOutputCastBridge({
    app,
    BrowserWindow,
    ipcMain,
    screen,
    isTrustedAppUrl: url => url === 'drmvyz-app://app/index.html',
  })

  const sender = new EventEmitter()
  sender.id = 77
  sender.getURL = () => 'drmvyz-app://app/index.html'
  sender.isDestroyed = () => false
  const event = { sender, senderFrame: { url: 'drmvyz-app://app/index.html' } }
  const ipcRenderer = new EventEmitter()
  ipcRenderer.invoke = async (channel, ...args) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
    return handler(event, ...args)
  }

  const exposed = {}
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: { exposeInMainWorld: (name, value) => { exposed[name] = value } },
        ipcRenderer,
        webUtils: { getPathForFile: () => null },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const preloadPath = require.resolve('../rekordbox/preloadRekordboxBridge.cjs')
    delete require.cache[preloadPath]
    require(preloadPath)

    const receiverProvider = installed.targetManager.providers.get('drmvyz-receiver')
    assert.ok(receiverProvider)
    for (let attempt = 0; attempt < 20 && !receiverProvider.receiverService?.port; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
    assert.ok(receiverProvider.receiverService?.port)

    receiverProvider.handleLegacyBeacon(serializeDiscoveryAdvertisement({
      deviceId: 'remote-production-1',
      name: 'Production Booth · DRMVYZ',
      port: 45000,
      receiverToken: 'remote-production-token',
    }), { address: '127.0.0.1' })

    const targets = await exposed.drmvyzNative.output.listTargets()
    const receiverDisplays = targets.filter(target => target.receiverId === 'remote-production-1')
    assert.equal(receiverDisplays.length, 2)
    const receiver = receiverDisplays.find(target => target.receiverDisplayId === 'remote-display-b')
    assert.ok(receiver)
    assert.equal(receiver.providerId, 'drmvyz-receiver')
    assert.equal(receiver.receiverPaired, false)

    const session = await exposed.drmvyzNative.output.startCast({
      targetId: receiver.id,
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
    assert.equal(session.providerId, 'drmvyz-receiver')
    assert.equal(session.targetId, receiver.id)
    assert.equal(session.state, 'connecting')
    const pairCall = fetchCalls.find(call => call.url.endsWith('/api/v2/pair'))
    assert.ok(pairCall)
    const startCall = fetchCalls.find(call => call.url.endsWith('/api/v2/sessions'))
    assert.ok(startCall)
    const startBody = JSON.parse(startCall.init.body)
    assert.equal(startBody.protocolVersion, DRMVYZ_RECEIVER_PROTOCOL_VERSION)
    assert.equal(startBody.displayId, 'remote-display-b')
    assert.equal(startBody.pairingToken, remotePairingToken)
    assert.match(startBody.sourceUrl, /127\.0\.0\.1:\d+\/receiver/)

    await exposed.drmvyzNative.output.stopCast()
    assert.ok(fetchCalls.some(call => /\/api\/v2\/sessions\/remote-cast-1\/stop$/.test(call.url)))
    assert.equal(await exposed.drmvyzNative.output.getSession(), null)
  } finally {
    Module._load = originalLoad
    globalThis.fetch = originalFetch
    await installed.shutdown()
  }
})


test('production preload and provider-action IPC reach WindowsMiracastProvider without creating a fake session', async () => {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  const app = new EventEmitter()
  const screen = new FakeScreen()
  const BrowserWindow = { getAllWindows: () => [] }
  let windowsDisplayOpens = 0
  const installed = installOutputCastBridge({
    app,
    BrowserWindow,
    ipcMain,
    screen,
    platform: 'win32',
    openWindowsDisplays: async () => {
      windowsDisplayOpens += 1
      return { message: 'Windows Display settings opened.' }
    },
    isTrustedAppUrl: url => url === 'drmvyz-app://app/index.html',
  })

  const sender = new EventEmitter()
  sender.id = 91
  sender.getURL = () => 'drmvyz-app://app/index.html'
  sender.isDestroyed = () => false
  const event = { sender, senderFrame: { url: 'drmvyz-app://app/index.html' } }
  const ipcRenderer = new EventEmitter()
  ipcRenderer.invoke = async (channel, ...args) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
    return handler(event, ...args)
  }

  const exposed = {}
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: { exposeInMainWorld: (name, value) => { exposed[name] = value } },
        ipcRenderer,
        webUtils: { getPathForFile: () => null },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const preloadPath = require.resolve('../rekordbox/preloadRekordboxBridge.cjs')
    delete require.cache[preloadPath]
    require(preloadPath)

    const snapshot = await exposed.drmvyzNative.output.getTargetSnapshot()
    const miracast = snapshot.providers.find(provider => provider.providerId === 'miracast')
    assert.equal(miracast.state, 'available')
    assert.deepEqual(miracast.capabilities, {
      targetEnumeration: false,
      sessions: false,
      picker: true,
      actions: ['open-system-picker'],
    })

    const action = await exposed.drmvyzNative.output.performProviderAction('miracast', 'open-system-picker')
    assert.equal(action.state, 'opened')
    assert.equal(windowsDisplayOpens, 1)
    assert.equal(await exposed.drmvyzNative.output.getSession(), null)
    assert.deepEqual((await exposed.drmvyzNative.output.listTargets()).map(target => target.id), ['display:7'])
  } finally {
    Module._load = originalLoad
    await installed.shutdown()
  }
})

test('production preload provider action reaches GoogleCastProvider and live media IPC without bypassing the target manager', async () => {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  const app = new EventEmitter()
  const screen = new FakeScreen()
  const BrowserWindow = { getAllWindows: () => [] }
  let openedCompanionUrl = null
  const installed = installOutputCastBridge({
    app,
    BrowserWindow,
    ipcMain,
    screen,
    googleCastAppId: 'A1B2C3D4',
    googleCastSenderUrl: 'https://cast.example.test/drmvyz/sender/',
    openGoogleCastCompanion: async url => { openedCompanionUrl = url },
    googleCastNetworkInterfaces: () => ({
      wifi: [{ family: 'IPv4', address: '192.168.60.4', internal: false }],
    }),
    isTrustedAppUrl: url => url === 'drmvyz-app://app/index.html',
  })

  const sender = new EventEmitter()
  sender.id = 101
  sender.getURL = () => 'drmvyz-app://app/index.html'
  sender.isDestroyed = () => false
  const event = { sender, senderFrame: { url: 'drmvyz-app://app/index.html' } }
  const ipcRenderer = new EventEmitter()
  ipcRenderer.invoke = async (channel, ...args) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
    return handler(event, ...args)
  }

  const exposed = {}
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: { exposeInMainWorld: (name, value) => { exposed[name] = value } },
        ipcRenderer,
        webUtils: { getPathForFile: () => null },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const companionFetch = async (path, init = {}) => {
    const browserUrl = new URL(openedCompanionUrl)
    const fragment = new URLSearchParams(browserUrl.hash.slice(1))
    const callbackUrl = fragment.get('callbackUrl')
    const callbackToken = fragment.get('callbackToken')
    assert.ok(callbackUrl)
    assert.ok(callbackToken)
    const url = new URL(`${callbackUrl}${path}`)
    url.searchParams.set('token', callbackToken)
    return fetch(url, {
      ...init,
      headers: {
        Origin: browserUrl.origin,
        ...(init.headers || {}),
      },
    })
  }

  try {
    const preloadPath = require.resolve('../rekordbox/preloadRekordboxBridge.cjs')
    delete require.cache[preloadPath]
    require(preloadPath)

    const googleCastProvider = installed.targetManager.providers.get('google-cast')
    assert.ok(googleCastProvider)
    for (let attempt = 0; attempt < 30 && googleCastProvider.getStatus().state !== 'available'; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
    const snapshot = await exposed.drmvyzNative.output.getTargetSnapshot()
    const googleCast = snapshot.providers.find(provider => provider.providerId === 'google-cast')
    assert.equal(googleCast.state, 'available')
    assert.deepEqual(googleCast.capabilities.actions, ['open-picker'])
    assert.equal(snapshot.targets.some(target => target.providerId === 'google-cast'), false)

    const actionPromise = exposed.drmvyzNative.output.performProviderAction('google-cast', 'open-picker', {
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
    for (let attempt = 0; attempt < 30 && !openedCompanionUrl; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
    assert.match(openedCompanionUrl, /^https:\/\/cast\.example\.test\/drmvyz\/sender\/#/)

    const unauthorized = await fetch(new URL(openedCompanionUrl).hash
      ? (() => {
          const browserUrl = new URL(openedCompanionUrl)
          const fragment = new URLSearchParams(browserUrl.hash.slice(1))
          const url = new URL(`${fragment.get('callbackUrl')}/events`)
          url.searchParams.set('token', fragment.get('callbackToken'))
          return url
        })()
      : 'http://127.0.0.1/invalid', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example.test', 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ type: 'selected', receiverName: 'Attacker TV' }),
    })
    assert.equal(unauthorized.status, 403)

    const selectedResponse = await companionFetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ type: 'selected', receiverName: 'Production Cast TV', receiverId: 'receiver-101' }),
    })
    assert.equal(selectedResponse.status, 204)

    const action = await actionPromise
    assert.equal(action.state, 'selected')
    assert.equal(action.session.providerId, 'google-cast')
    assert.equal(action.session.transport, 'google-cast-webm')
    assert.equal(action.session.state, 'connecting')
    assert.equal(action.session.targetName, 'Production Cast TV')

    const started = await exposed.drmvyzNative.output.beginGoogleCastStream(action.session.id, {
      mimeType: 'video/webm;codecs=vp8',
      width: 1280,
      height: 720,
      framesPerSecond: 30,
    })
    assert.equal(started.ok, true)
    assert.match(started.mediaUrls[0], /^http:\/\/192\.168\.60\.4:/)
    assert.equal(await exposed.drmvyzNative.output.publishGoogleCastChunk(action.session.id, new Uint8Array([1, 2, 3, 4])), true)

    const commandsResponse = await companionFetch('/commands')
    assert.equal(commandsResponse.status, 200)
    const commands = await commandsResponse.json()
    assert.equal(commands.command.type, 'start')
    assert.equal(commands.command.sessionId, action.session.id)
    assert.equal(commands.command.mimeType, 'video/webm;codecs=vp8')

    const connectedResponse = await companionFetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ type: 'connected' }),
    })
    assert.equal(connectedResponse.status, 204)
    assert.equal((await exposed.drmvyzNative.output.getSession()).state, 'connected')

    const disconnectedResponse = await companionFetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ type: 'disconnected', message: 'Receiver left the session.' }),
    })
    assert.equal(disconnectedResponse.status, 204)
    assert.equal(await exposed.drmvyzNative.output.getSession(), null)
    assert.equal((await exposed.drmvyzNative.output.listTargets()).some(target => target.providerId === 'google-cast'), false)
    assert.equal(googleCastProvider.mediaSessions.size, 0)
  } finally {
    Module._load = originalLoad
    await installed.shutdown()
  }
})
