'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const Module = require('node:module')
const test = require('node:test')
const { installOutputCastBridge } = require('./outputCastBridge.cjs')
const { serializeDiscoveryAdvertisement } = require('./providers/drmvyzReceiverProvider.cjs')

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
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init })
    if (String(url).endsWith('/api/start-cast')) {
      return { ok: true, status: 200, json: async () => ({ castId: 'remote-cast-1', controlToken: 'remote-control-1' }) }
    }
    return { ok: true, status: 204, json: async () => ({}) }
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
    const receiver = targets.find(target => target.id === 'receiver:remote-production-1')
    assert.ok(receiver)
    assert.equal(receiver.providerId, 'drmvyz-receiver')

    const session = await exposed.drmvyzNative.output.startCast({
      targetId: receiver.id,
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
    assert.equal(session.providerId, 'drmvyz-receiver')
    assert.equal(session.targetId, receiver.id)
    assert.equal(session.state, 'connecting')
    assert.match(fetchCalls[0].url, /127\.0\.0\.1:45000\/api\/start-cast$/)
    assert.match(JSON.parse(fetchCalls[0].init.body).sourceUrl, /127\.0\.0\.1:\d+\/receiver/)

    await exposed.drmvyzNative.output.stopCast()
    assert.equal(fetchCalls.length, 2)
    assert.match(fetchCalls[1].url, /api\/stop-cast$/)
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
