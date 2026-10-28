'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')
function harness() {
  const ipc = new EventEmitter(), sent = []
  ipc.send = channel => sent.push(channel)
  let native
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rekordbox/preloadRekordboxBridge.cjs'), 'utf8'), {
    process: { platform: 'darwin' },
    require: name => {
      assert.equal(name, 'electron')
      return { ipcRenderer: ipc, webUtils: {}, contextBridge: { exposeInMainWorld(_name, value) { native = value } } }
    },
  })
  return { bridge: native.diagnostics, ipc, sent }
}
test('Logging panel and notices share one watcher and both receive appended entries', () => {
  const { bridge, ipc, sent } = harness(), panel = [], notices = []
  const stopPanel = bridge.watchMainLog(chunk => panel.push(chunk.content))
  const stopNotices = bridge.watchMainLog(chunk => notices.push(chunk.content))
  assert.deepEqual(sent, ['drmvyz:diagnostics:watch-main-log'])
  ipc.emit('drmvyz:diagnostics:main-log-appended', {}, { content: 'first error\n' })
  assert.deepEqual(panel, ['first error\n'])
  assert.deepEqual(notices, ['first error\n'])
  stopPanel()
  assert.deepEqual(sent, ['drmvyz:diagnostics:watch-main-log'])
  ipc.emit('drmvyz:diagnostics:main-log-appended', {}, { content: 'second error\n' })
  assert.deepEqual(panel, ['first error\n'])
  assert.deepEqual(notices, ['first error\n', 'second error\n'])
  stopNotices()
  assert.deepEqual(sent, ['drmvyz:diagnostics:watch-main-log', 'drmvyz:diagnostics:unwatch-main-log'])
})
test('repeated cleanup is harmless and a later subscription restarts the watcher', () => {
  const { bridge, sent } = harness()
  const stop = bridge.watchMainLog(() => {})
  stop(); stop()
  const later = bridge.watchMainLog(() => {})
  assert.deepEqual(sent, ['drmvyz:diagnostics:watch-main-log', 'drmvyz:diagnostics:unwatch-main-log', 'drmvyz:diagnostics:watch-main-log'])
  later()
  assert.equal(sent.length, 4)
})
