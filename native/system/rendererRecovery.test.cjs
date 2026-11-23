'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { createRendererRecovery, recoveryEnabled, recoveryReasonFor, MAX_RECOVERIES, RECOVERY_WINDOW_MS, UNRESPONSIVE_RECOVERY_MS } = require('./rendererRecovery.cjs')

function harness(options = {}) {
  const contents = new EventEmitter()
  const calls = { crashed: 0, loaded: [], sent: [] }
  contents.isDestroyed = () => false
  contents.forcefullyCrashRenderer = () => { calls.crashed += 1 }
  contents.loadURL = url => { calls.loaded.push(url); return Promise.resolve() }
  contents.send = (channel, payload) => { calls.sent.push({ channel, payload }) }

  let clock = 1_000_000
  const timers = []
  const logs = []
  const log = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })]))
  const recovery = createRendererRecovery({
    log,
    buildUrl: reason => `http://app.test/?recovery=${reason}`,
    now: () => clock,
    setTimer: (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer },
    clearTimer: timer => { if (timer) timer.cleared = true },
    enabled: true,
    ...options,
  })
  recovery.attach(contents)
  const fire = predicate => { for (const timer of [...timers]) if (!timer.cleared && predicate(timer)) { timer.cleared = true; timer.fn() } }
  return { contents, calls, logs, recovery, advance: ms => { clock += ms }, fireUnresponsive: () => fire(timer => timer.ms === UNRESPONSIVE_RECOVERY_MS), fireAll: () => fire(() => true) }
}

test('reloads the window, in a new renderer process and tagged with why, when it stays unresponsive', () => {
  const h = harness()
  h.contents.emit('unresponsive')
  assert.equal(h.calls.loaded.length, 0)
  h.fireUnresponsive()
  assert.equal(h.calls.crashed, 1)
  assert.deepEqual(h.calls.loaded, ['http://app.test/?recovery=renderer-unresponsive'])
})

test('does nothing when the renderer answers again before the deadline', () => {
  const h = harness()
  h.contents.emit('unresponsive')
  h.contents.emit('responsive')
  h.fireUnresponsive()
  assert.equal(h.calls.loaded.length, 0)
  assert.equal(h.calls.crashed, 0)
})

test('reloads at once when the renderer process is gone for a real reason, and ignores a clean exit', () => {
  const h = harness()
  h.contents.emit('render-process-gone', {}, { reason: 'clean-exit', exitCode: 1 })
  assert.equal(h.calls.loaded.length, 0)
  h.contents.emit('render-process-gone', {}, { reason: 'oom', exitCode: 9 })
  assert.deepEqual(h.calls.loaded, ['http://app.test/?recovery=renderer-oom'])
})

test('one recovery at a time: the process-gone event raised by terminating the renderer does not start a second', () => {
  const h = harness()
  h.contents.emit('unresponsive'); h.fireUnresponsive()
  h.contents.emit('render-process-gone', {}, { reason: 'killed', exitCode: 0 })
  assert.equal(h.calls.loaded.length, 1)
  // Once the page has loaded the guard lifts.
  h.contents.emit('did-finish-load')
  h.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 0 })
  assert.equal(h.calls.loaded.length, 2)
})

test('gives up after repeated recoveries instead of reloading forever, and logs that once', () => {
  const h = harness()
  for (let attempt = 0; attempt < MAX_RECOVERIES + 3; attempt += 1) {
    h.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 0 })
    h.contents.emit('did-finish-load')
  }
  assert.equal(h.calls.loaded.length, MAX_RECOVERIES)
  assert.equal(h.logs.filter(entry => entry.level === 'error').length, 1)
  // Recoveries age out of the window.
  h.advance(RECOVERY_WINDOW_MS + 1)
  h.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 0 })
  assert.equal(h.calls.loaded.length, MAX_RECOVERIES + 1)
})

test('a GPU process death reloads only a renderer that is already unresponsive; otherwise it just tells the renderer', () => {
  const calm = harness()
  calm.recovery.handleChildProcessGone({ type: 'GPU', reason: 'abnormal-exit', exitCode: 512 })
  assert.equal(calm.calls.loaded.length, 0)
  assert.deepEqual(calm.calls.sent, [{ channel: 'drmvyz:recovery:event', payload: { kind: 'gpu-process-gone', reason: 'abnormal-exit' } }])

  const stuck = harness()
  stuck.contents.emit('unresponsive')
  stuck.recovery.handleChildProcessGone({ type: 'GPU', reason: 'abnormal-exit', exitCode: 512 })
  assert.deepEqual(stuck.calls.loaded, ['http://app.test/?recovery=gpu-process-gone'])
  assert.equal(stuck.calls.sent.length, 0)
})

test('ignores other child processes and a clean GPU exit', () => {
  const h = harness()
  h.recovery.handleChildProcessGone({ type: 'Utility', reason: 'abnormal-exit', exitCode: 1 })
  h.recovery.handleChildProcessGone({ type: 'GPU', reason: 'clean-exit', exitCode: 0 })
  assert.equal(h.calls.loaded.length, 0)
  assert.equal(h.calls.sent.length, 0)
})

test('never recovers while the app is quitting, or when switched off', () => {
  const quitting = harness()
  quitting.contents.emit('unresponsive')
  quitting.recovery.setQuitting()
  quitting.fireAll()
  quitting.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 0 })
  assert.equal(quitting.calls.loaded.length, 0)

  const off = harness({ enabled: false })
  off.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 0 })
  assert.equal(off.calls.loaded.length, 0)
  assert.equal(off.logs.some(entry => entry.level === 'warn'), true)
})

test('reasons are a closed set of words, and the switch reads the environment', () => {
  assert.equal(recoveryReasonFor('gone', 'oom'), 'renderer-oom')
  assert.equal(recoveryReasonFor('gone', 'something-new'), 'renderer-gone')
  assert.equal(recoveryReasonFor('gpu'), 'gpu-process-gone')
  assert.equal(recoveryEnabled({}), true)
  assert.equal(recoveryEnabled({ DRMVYZ_RENDERER_RECOVERY: 'OFF' }), false)
})
