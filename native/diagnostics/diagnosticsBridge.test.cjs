'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { installDiagnosticsBridge } = require('./diagnosticsBridge.cjs')

function fakeIpcMain() {
  const onHandlers = new Map()
  const handleHandlers = new Map()
  return {
    on(channel, handler) { onHandlers.set(channel, handler) },
    handle(channel, handler) { handleHandlers.set(channel, handler) },
    emit(channel, ...args) { onHandlers.get(channel)?.(...args) },
    invoke(channel, ...args) { return handleHandlers.get(channel)?.({}, ...args) },
  }
}

function fakeSender() {
  const sent = []
  return {
    id: `${Date.now()}-${Math.random()}`,
    sent,
    send(channel, payload) { sent.push({ channel, payload }) },
    isDestroyed() { return false },
    once() { /* no 'destroyed' cleanup path needed in these tests */ },
  }
}

function fileLog(filePath) {
  return {
    transports: { file: { getFile: () => ({ path: filePath }) } },
    scope: () => ({ warn: () => {}, error: () => {}, info: () => {}, debug: () => {} }),
  }
}

async function waitFor(predicate, timeoutMs = 1500) {
  const start = Date.now()
  for (;;) {
    if (await predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

function fakeLog() {
  const calls = []
  const scopes = new Map()
  return {
    calls,
    scope(name) {
      if (!scopes.has(name)) {
        scopes.set(name, {
          debug: (...args) => calls.push({ scope: name, level: 'debug', args }),
          info:  (...args) => calls.push({ scope: name, level: 'info',  args }),
          warn:  (...args) => calls.push({ scope: name, level: 'warn',  args }),
          error: (...args) => calls.push({ scope: name, level: 'error', args }),
        })
      }
      return scopes.get(name)
    },
  }
}

test('routes a renderer log entry to the matching level, scoped by component and category', () => {
  const ipcMain = fakeIpcMain()
  const log = fakeLog()
  installDiagnosticsBridge({ ipcMain, log })

  ipcMain.emit('drmvyz:diagnostics:log', null, {
    level: 'error', component: 'react', category: 'WebGL2Renderer', message: 'context lost',
  })

  assert.deepEqual(log.calls, [{ scope: 'react:WebGL2Renderer', level: 'error', args: ['context lost'] }])
})

test('forwards context as a second argument when present', () => {
  const ipcMain = fakeIpcMain()
  const log = fakeLog()
  installDiagnosticsBridge({ ipcMain, log })

  ipcMain.emit('drmvyz:diagnostics:log', null, {
    level: 'warn', component: 'react', category: 'AudioEngine', message: 'device list changed', context: { count: 3 },
  })

  assert.deepEqual(log.calls, [
    { scope: 'react:AudioEngine', level: 'warn', args: ['device list changed', { count: 3 }] },
  ])
})

test('falls back to "system" for an unrecognized or missing component', () => {
  const ipcMain = fakeIpcMain()
  const log = fakeLog()
  installDiagnosticsBridge({ ipcMain, log })

  ipcMain.emit('drmvyz:diagnostics:log', null, {
    level: 'info', component: 'not-a-real-component', category: 'Thing', message: 'hi',
  })
  ipcMain.emit('drmvyz:diagnostics:log', null, { level: 'info', category: 'Thing', message: 'hi again' })

  assert.deepEqual(log.calls, [
    { scope: 'system:Thing', level: 'info', args: ['hi'] },
    { scope: 'system:Thing', level: 'info', args: ['hi again'] },
  ])
})

test('falls back to info for an unrecognized level and omits the category segment when missing', () => {
  const ipcMain = fakeIpcMain()
  const log = fakeLog()
  installDiagnosticsBridge({ ipcMain, log })

  ipcMain.emit('drmvyz:diagnostics:log', null, { level: 'trace', component: 'react', category: '', message: 'hello' })

  assert.deepEqual(log.calls, [{ scope: 'react', level: 'info', args: ['hello'] }])
})

test('ignores malformed entries without throwing', () => {
  const ipcMain = fakeIpcMain()
  const log = fakeLog()
  installDiagnosticsBridge({ ipcMain, log })

  assert.doesNotThrow(() => {
    ipcMain.emit('drmvyz:diagnostics:log', null, null)
    ipcMain.emit('drmvyz:diagnostics:log', null, undefined)
    ipcMain.emit('drmvyz:diagnostics:log', null, 'not an object')
  })
  assert.deepEqual(log.calls, [])
})

test('read-main-log returns the full file for a small log', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-diag-'))
  try {
    const filePath = path.join(dir, 'main.log')
    const text = '[2026-09-22 00:00:00.000] [info]  hello\n'
    fs.writeFileSync(filePath, text)

    const ipcMain = fakeIpcMain()
    installDiagnosticsBridge({ ipcMain, log: fileLog(filePath) })
    const result = await ipcMain.invoke('drmvyz:diagnostics:read-main-log')

    assert.equal(result.path, filePath)
    assert.equal(result.content, text)
    assert.equal(result.truncated, false)
    assert.equal(result.sizeBytes, Buffer.byteLength(text))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('read-main-log truncates to the tail of a file larger than the tail window', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-diag-'))
  try {
    const filePath = path.join(dir, 'main.log')
    const line = '[2026-09-22 00:00:00.000] [info]  padding line for size\n'
    const repeats = Math.ceil((2 * 1024 * 1024 + 1024) / line.length)
    fs.writeFileSync(filePath, line.repeat(repeats) + '[2026-09-22 00:00:01.000] [info]  tail marker\n')

    const ipcMain = fakeIpcMain()
    installDiagnosticsBridge({ ipcMain, log: fileLog(filePath) })
    const result = await ipcMain.invoke('drmvyz:diagnostics:read-main-log')

    assert.equal(result.truncated, true)
    assert.ok(Buffer.byteLength(result.content) < result.sizeBytes)
    assert.ok(result.content.includes('tail marker'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('read-main-log reports null instead of throwing when the file is missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-diag-'))
  try {
    const ipcMain = fakeIpcMain()
    installDiagnosticsBridge({ ipcMain, log: fileLog(path.join(dir, 'does-not-exist.log')) })
    const result = await ipcMain.invoke('drmvyz:diagnostics:read-main-log')
    assert.equal(result, null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('watch-main-log pushes only text appended after the subscription started', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-diag-'))
  try {
    const filePath = path.join(dir, 'main.log')
    fs.writeFileSync(filePath, '[2026-09-22 00:00:00.000] [info]  initial\n')

    const ipcMain = fakeIpcMain()
    installDiagnosticsBridge({ ipcMain, log: fileLog(filePath) })
    const sender = fakeSender()
    ipcMain.emit('drmvyz:diagnostics:watch-main-log', { sender })

    // Let the baseline-offset read (which must not itself emit) settle.
    await new Promise(resolve => setTimeout(resolve, 80))
    assert.equal(sender.sent.length, 0)

    fs.appendFileSync(filePath, '[2026-09-22 00:00:02.000] [warn]  appended\n')
    await waitFor(() => sender.sent.length > 0)

    assert.equal(sender.sent[0].channel, 'drmvyz:diagnostics:main-log-appended')
    assert.match(sender.sent[0].payload.content, /appended/)
    assert.doesNotMatch(sender.sent[0].payload.content, /initial/)

    ipcMain.emit('drmvyz:diagnostics:unwatch-main-log', { sender })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('unwatch-main-log stops further pushes to that sender', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-diag-'))
  try {
    const filePath = path.join(dir, 'main.log')
    fs.writeFileSync(filePath, '[2026-09-22 00:00:00.000] [info]  initial\n')

    const ipcMain = fakeIpcMain()
    installDiagnosticsBridge({ ipcMain, log: fileLog(filePath) })
    const sender = fakeSender()
    ipcMain.emit('drmvyz:diagnostics:watch-main-log', { sender })
    await new Promise(resolve => setTimeout(resolve, 80))

    ipcMain.emit('drmvyz:diagnostics:unwatch-main-log', { sender })
    fs.appendFileSync(filePath, '[2026-09-22 00:00:02.000] [warn]  should not arrive\n')
    await new Promise(resolve => setTimeout(resolve, 400))

    assert.equal(sender.sent.length, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
