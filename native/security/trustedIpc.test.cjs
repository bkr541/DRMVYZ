'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { isTrustedIpcSender, createTrustedIpcMain } = require('./trustedIpc.cjs')

const trusted = url => url.startsWith('drmvyz-app://app/')
function page(url = 'drmvyz-app://app/index.html') {
  const mainFrame = { url }
  const sender = { mainFrame, isDestroyed: () => false }
  return { sender, mainFrame }
}
function fakeIpcMain() {
  const handlers = new Map(), listeners = new Map()
  return {
    handlers, listeners,
    handle: (channel, fn) => handlers.set(channel, fn),
    removeHandler: channel => handlers.delete(channel),
    on: (channel, fn) => listeners.set(channel, [...(listeners.get(channel) ?? []), fn]),
    removeListener: (channel, fn) => listeners.set(channel, (listeners.get(channel) ?? []).filter(entry => entry !== fn)),
  }
}

test('serves only the main frame of the app\'s own live page', () => {
  const { sender, mainFrame } = page()
  assert.equal(isTrustedIpcSender({ sender, senderFrame: mainFrame }, trusted), true)
  // An embedded frame, even one on the app's own origin.
  assert.equal(isTrustedIpcSender({ sender, senderFrame: { url: 'drmvyz-app://app/index.html' } }, trusted), false)
  // A page that navigated elsewhere, or an untrusted page.
  const other = page('https://evil.example/')
  assert.equal(isTrustedIpcSender({ sender: other.sender, senderFrame: other.mainFrame }, trusted), false)
  // A frame that no longer exists (Electron reports null), or a destroyed page.
  assert.equal(isTrustedIpcSender({ sender, senderFrame: null }, trusted), false)
  assert.equal(isTrustedIpcSender({ sender: { ...sender, isDestroyed: () => true }, senderFrame: mainFrame }, trusted), false)
  assert.equal(isTrustedIpcSender(undefined, trusted), false)
})

test('every bridge handler behind the wrapper is checked: untrusted requests are rejected and logged once per channel', async () => {
  const ipcMain = fakeIpcMain(), warnings = []
  const log = { scope: () => ({ warn: (message, details) => warnings.push(details.channel) }) }
  const trustedIpc = createTrustedIpcMain({ ipcMain, isTrustedAppUrl: trusted, log })
  let served = 0
  trustedIpc.handle('drmvyz:rekordbox:scan', () => { served += 1; return 'ok' })
  const handler = ipcMain.handlers.get('drmvyz:rekordbox:scan')
  const good = page(), bad = page('https://evil.example/')
  assert.equal(await handler({ sender: good.sender, senderFrame: good.mainFrame }), 'ok')
  assert.throws(() => handler({ sender: bad.sender, senderFrame: bad.mainFrame }), /Untrusted request: drmvyz:rekordbox:scan/)
  assert.throws(() => handler({ sender: bad.sender, senderFrame: bad.mainFrame }), /Untrusted/)
  assert.equal(served, 1)
  assert.deepEqual(warnings, ['drmvyz:rekordbox:scan'])
  trustedIpc.removeHandler('drmvyz:rekordbox:scan')
  assert.equal(ipcMain.handlers.has('drmvyz:rekordbox:scan'), false)
})

test('one-way messages from an untrusted sender are ignored, and listeners can still be removed', () => {
  const ipcMain = fakeIpcMain()
  const trustedIpc = createTrustedIpcMain({ ipcMain, isTrustedAppUrl: trusted })
  const received = []
  const listener = (_event, value) => received.push(value)
  trustedIpc.on('drmvyz:diagnostics:watch-main-log', listener)
  const [wrapped] = ipcMain.listeners.get('drmvyz:diagnostics:watch-main-log')
  const good = page(), bad = page('file:///tmp/other.html')
  wrapped({ sender: good.sender, senderFrame: good.mainFrame }, 'trusted')
  wrapped({ sender: bad.sender, senderFrame: bad.mainFrame }, 'untrusted')
  assert.deepEqual(received, ['trusted'])
  trustedIpc.removeListener('drmvyz:diagnostics:watch-main-log', listener)
  assert.deepEqual(ipcMain.listeners.get('drmvyz:diagnostics:watch-main-log'), [])
})
