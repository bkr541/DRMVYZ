'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const Module = require('node:module')
const test = require('node:test')
const { installOutputCastBridge } = require('./outputCastBridge.cjs')

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
  const installed = installOutputCastBridge({
    app,
    BrowserWindow,
    ipcMain,
    screen,
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
