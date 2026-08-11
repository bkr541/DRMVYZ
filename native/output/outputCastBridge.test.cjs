'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const {
  buildLocalDisplayTargets,
  calculateWindowBounds,
  createReceiverHtml,
  installOutputCastBridge,
  isAllowedReceiverSource,
  isPrivateNetworkAddress,
  loadOrCreateReceiverDeviceId,
  normalizeCastRequest,
  openMacOsDisplaySettings,
  openWindowsWirelessDisplaySettings,
} = require('./outputCastBridge.cjs')
const { DRMVYZ_RECEIVER_PROTOCOL_VERSION } = require('./drmvyzReceiverProtocol.cjs')

test('normalizeCastRequest requires a target, window mode, and aspect ratio', () => {
  assert.deepEqual(normalizeCastRequest({
    targetId: 'display:1',
    windowMode: 'fullscreen',
    aspectRatio: '16:9',
  }), {
    targetId: 'display:1',
    windowMode: 'fullscreen',
    aspectRatio: '16:9',
  })
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: '', aspectRatio: '16:9' }), null)
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: 'fullscreen', aspectRatio: '' }), null)
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: 'floating', aspectRatio: '21:9' }), null)
})

test('calculateWindowBounds centers a bounded window at the requested aspect ratio', () => {
  const bounds = calculateWindowBounds({ x: 100, y: 50, width: 1920, height: 1080 }, '4:3')
  assert.ok(bounds.width <= 1920)
  assert.ok(bounds.height <= 1080)
  assert.ok(Math.abs(bounds.width / bounds.height - 4 / 3) < 0.01)
  assert.equal(bounds.x, Math.round(100 + (1920 - bounds.width) / 2))
  assert.equal(bounds.y, Math.round(50 + (1080 - bounds.height) / 2))
})

test('buildLocalDisplayTargets labels primary and secondary displays without inventing network targets', () => {
  const targets = buildLocalDisplayTargets([
    { id: 1, label: '', bounds: { width: 1920, height: 1080 } },
    { id: 2, label: 'Stage Screen', bounds: { width: 3840, height: 2160 } },
  ], 1)
  assert.deepEqual(targets.map(target => target.id), ['display:1', 'display:2'])
  assert.equal(targets[0].name, 'This display')
  assert.equal(targets[1].name, 'Stage Screen')
  assert.match(targets[1].detail, /3840 × 2160/)
})


test('receiver page ships a syntactically valid isolated WebRTC client', () => {
  const html = createReceiverHtml()
  const script = html.match(/<script>([\s\S]+)<\/script>/)?.[1]
  assert.ok(script)
  assert.doesNotThrow(() => new Function(script))
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /RTCPeerConnection/)
})

test('receiver navigation is restricted to the requesting private-network sender', () => {
  assert.equal(isPrivateNetworkAddress('192.168.1.8'), true)
  assert.equal(isPrivateNetworkAddress('10.0.0.4'), true)
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false)
  assert.equal(isAllowedReceiverSource('http://192.168.1.8:51300/receiver?session=a', '192.168.1.8'), true)
  assert.equal(isAllowedReceiverSource('https://192.168.1.8/receiver', '192.168.1.8'), false)
  assert.equal(isAllowedReceiverSource('http://192.168.1.9:51300/receiver', '192.168.1.8'), false)
  assert.equal(isAllowedReceiverSource('http://8.8.8.8:51300/receiver', '8.8.8.8'), false)
})


test('receiver identity persists under Electron userData and repairs malformed state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-output-id-'))
  const app = { getPath: name => name === 'userData' ? root : '' }
  try {
    const first = loadOrCreateReceiverDeviceId(app)
    const second = loadOrCreateReceiverDeviceId(app)
    assert.equal(second, first)
    assert.match(first, /^[A-Za-z0-9._:-]{8,128}$/)

    const identityPath = path.join(root, 'drmvyz-output-receiver-identity.json')
    fs.writeFileSync(identityPath, '{bad json', 'utf8')
    const repaired = loadOrCreateReceiverDeviceId(app)
    assert.notEqual(repaired, first)
    assert.equal(loadOrCreateReceiverDeviceId(app), repaired)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})


test('macOS display action opens the legacy Displays preference pane when present and falls back to System Settings', async () => {
  const opened = []
  const shell = { openPath: async value => { opened.push(value); return '' } }
  const fsImpl = { existsSync: value => value === '/System/Library/PreferencePanes/Displays.prefPane' }
  const direct = await openMacOsDisplaySettings({ shell, fsImpl })
  assert.equal(direct.opened, '/System/Library/PreferencePanes/Displays.prefPane')
  assert.deepEqual(opened, ['/System/Library/PreferencePanes/Displays.prefPane'])

  opened.length = 0
  const fallbackFs = { existsSync: value => value === '/System/Applications/System Settings.app' }
  const fallback = await openMacOsDisplaySettings({ shell, fsImpl: fallbackFs })
  assert.equal(fallback.opened, '/System/Applications/System Settings.app')
  assert.deepEqual(opened, ['/System/Applications/System Settings.app'])
})

test('macOS display action reports unavailable native system controls instead of silently succeeding', async () => {
  await assert.rejects(
    openMacOsDisplaySettings({ shell: null, fsImpl: { existsSync: () => true } }),
    /shell\.openPath is unavailable/,
  )
  await assert.rejects(
    openMacOsDisplaySettings({ shell: { openPath: async () => '' }, fsImpl: { existsSync: () => false } }),
    /could not be located/,
  )
})


test('Windows wireless display action opens the documented Display settings URI', async () => {
  const opened = []
  const shell = { openExternal: async value => { opened.push(value) } }
  const result = await openWindowsWirelessDisplaySettings({ shell })
  assert.equal(result.opened, 'ms-settings:display')
  assert.deepEqual(opened, ['ms-settings:display'])
  assert.match(result.message, /wireless display/i)
})

test('Windows wireless display action reports unavailable native system controls instead of silently succeeding', async () => {
  await assert.rejects(
    openWindowsWirelessDisplaySettings({ shell: null }),
    /shell\.openExternal is unavailable/,
  )
})


test('Receiver V2 HTTP path pairs first use, selects the requested non-primary display, and closes it when destination disappears', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-receiver-v2-'))
  const app = new EventEmitter()
  app.getPath = name => name === 'userData' ? root : root
  const ipcMain = { handle() {} }

  class FakeScreen extends EventEmitter {
    constructor() {
      super()
      this.displays = [
        { id: 1, label: 'Control', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1, displayFrequency: 60 },
        { id: 2, label: 'LED Wall', bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1920, y: 0, width: 2560, height: 1400 }, scaleFactor: 1, displayFrequency: 60 },
      ]
    }
    getAllDisplays() { return this.displays }
    getPrimaryDisplay() { return this.displays[0] }
  }

  const createdWindows = []
  class FakeBrowserWindow extends EventEmitter {
    static getAllWindows() { return [] }
    constructor(options) {
      super()
      this.options = options
      this.destroyed = false
      this.webContents = new EventEmitter()
      this.webContents.setWindowOpenHandler = () => {}
      createdWindows.push(this)
    }
    setAspectRatio() {}
    setMenuBarVisibility() {}
    setFullScreen() {}
    show() {}
    loadURL(url) { this.loadedUrl = url; return Promise.resolve() }
    isDestroyed() { return this.destroyed }
    close() { if (this.destroyed) return; this.destroyed = true; this.emit('closed') }
    destroy() { this.close() }
  }

  const screen = new FakeScreen()
  const installed = installOutputCastBridge({
    app,
    BrowserWindow: FakeBrowserWindow,
    ipcMain,
    screen,
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    isTrustedAppUrl: () => true,
  })

  try {
    const receiverProvider = installed.targetManager.providers.get('drmvyz-receiver')
    for (let attempt = 0; attempt < 30 && !receiverProvider.receiverService?.port; attempt += 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
    const { port, receiverToken } = receiverProvider.receiverService
    const base = `http://127.0.0.1:${port}`
    const senderDeviceId = 'sender-device-v2'

    const capabilityResponse = await fetch(`${base}/api/v2/capabilities`, {
      headers: {
        'X-DRMVYZ-Receiver-Token': receiverToken,
        'X-DRMVYZ-Sender-Id': senderDeviceId,
      },
    })
    assert.equal(capabilityResponse.status, 200)
    const capabilities = await capabilityResponse.json()
    assert.equal(capabilities.protocol.version, DRMVYZ_RECEIVER_PROTOCOL_VERSION)
    assert.deepEqual(capabilities.displays.map(display => display.id), ['1', '2'])
    assert.equal(capabilities.pairing.paired, false)

    const pairResponse = await fetch(`${base}/api/v2/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
        senderDeviceId,
        senderName: 'Sender Laptop',
        receiverToken,
      }),
    })
    assert.equal(pairResponse.status, 200)
    const pairing = await pairResponse.json()
    assert.equal(typeof pairing.pairingToken, 'string')

    const sessionResponse = await fetch(`${base}/api/v2/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
        senderDeviceId,
        pairingToken: pairing.pairingToken,
        receiverToken,
        displayId: '2',
        sourceUrl: `${base}/receiver?session=test-session&token=test-token`,
        windowMode: 'fullscreen',
        aspectRatio: '16:9',
      }),
    })
    assert.equal(sessionResponse.status, 200)
    const session = await sessionResponse.json()
    assert.equal(session.selectedDisplay, '2')
    assert.equal(createdWindows.length, 1)
    assert.equal(createdWindows[0].options.x, 1920)
    assert.equal(createdWindows[0].options.width, 2560)

    const legacyResponse = await fetch(`${base}/api/start-cast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(legacyResponse.status, 426)

    screen.emit('display-removed', {}, screen.displays[1])
    assert.equal(createdWindows[0].isDestroyed(), true)
  } finally {
    await installed.shutdown()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('LAN service failure is isolated from local display output and shutdown releases bridge ownership', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-output-isolation-'))
  const app = new EventEmitter()
  app.getPath = () => root
  const handlers = new Map()
  const removedHandlers = []
  const ipcMain = {
    handle(channel, handler) { handlers.set(channel, handler) },
    removeHandler(channel) { removedHandlers.push(channel); handlers.delete(channel) },
  }

  class FakeScreen extends EventEmitter {
    constructor() {
      super()
      this.display = {
        id: 1,
        label: 'Control',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        displayFrequency: 60,
      }
    }
    getAllDisplays() { return [this.display] }
    getPrimaryDisplay() { return this.display }
  }

  const createdWindows = []
  class FakeBrowserWindow extends EventEmitter {
    static getAllWindows() { return [] }
    constructor(options) {
      super()
      this.options = options
      this.destroyed = false
      this.webContents = new EventEmitter()
      this.webContents.setWindowOpenHandler = () => {}
      createdWindows.push(this)
    }
    setAspectRatio() {}
    setMenuBarVisibility() {}
    setFullScreen() {}
    show() {}
    loadURL(url) { this.loadedUrl = url; return Promise.resolve() }
    isDestroyed() { return this.destroyed }
    close() { if (this.destroyed) return; this.destroyed = true; this.emit('closed') }
    destroy() { this.close() }
  }

  const screen = new FakeScreen()
  const boundHosts = []
  const installed = installOutputCastBridge({
    app,
    BrowserWindow: FakeBrowserWindow,
    ipcMain,
    screen,
    platform: 'linux',
    googleCastAppId: 'A1B2C3D4',
    googleCastSenderUrl: 'https://cast.example.test/sender/',
    openGoogleCastCompanion: async () => {},
    isTrustedAppUrl: () => true,
    listenHttpServer: async (_server, host) => {
      boundHosts.push(host)
      if (host === '127.0.0.1') return 43123
      throw new Error('simulated LAN bind failure')
    },
  })

  const sender = new EventEmitter()
  sender.id = 41
  sender.getURL = () => 'file:///app/index.html'
  sender.isDestroyed = () => false
  const event = { sender, senderFrame: { url: 'file:///app/index.html' } }

  try {
    const startCast = handlers.get('drmvyz:output:start-cast')
    assert.equal(typeof startCast, 'function')
    const session = await startCast(event, {
      targetId: 'display:1',
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })

    assert.equal(session.providerId, 'local-display')
    assert.equal(createdWindows.length, 1)
    assert.match(createdWindows[0].loadedUrl, /^http:\/\/127\.0\.0\.1:43123\/receiver\?/)
    assert.deepEqual(boundHosts, ['127.0.0.1', '0.0.0.0'])

    for (let attempt = 0; attempt < 10; attempt += 1) await new Promise(resolve => setImmediate(resolve))
    const snapshot = await handlers.get('drmvyz:output:get-target-snapshot')(event)
    assert.equal(snapshot.providers.find(item => item.providerId === 'local-display').state, 'available')
    assert.equal(snapshot.providers.find(item => item.providerId === 'drmvyz-receiver').state, 'initialization-failed')
    assert.match(snapshot.providers.find(item => item.providerId === 'drmvyz-receiver').message, /simulated LAN bind failure/)
    assert.equal(snapshot.providers.find(item => item.providerId === 'google-cast').state, 'initialization-failed')
    assert.match(snapshot.providers.find(item => item.providerId === 'google-cast').message, /simulated LAN bind failure/)
  } finally {
    const firstShutdown = installed.shutdown()
    const repeatedShutdown = installed.shutdown()
    assert.equal(repeatedShutdown, firstShutdown)
    await firstShutdown
    fs.rmSync(root, { recursive: true, force: true })
  }

  assert.equal(app.listenerCount('before-quit'), 0)
  assert.equal(screen.listenerCount('display-removed'), 0)
  assert.equal(handlers.size, 0)
  assert.ok(removedHandlers.includes('drmvyz:output:start-cast'))
  assert.ok(removedHandlers.includes('drmvyz:output:get-target-snapshot'))
})
