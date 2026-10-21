'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { disableRendererMirroring } = require('./logTransportPolicy.cjs')

test('turns the main-to-renderer IPC transport off and leaves the file and console transports alone', () => {
  const log = { transports: { ipc: { level: 'silly' }, file: { level: 'info' }, console: { level: 'debug' } } }
  assert.equal(disableRendererMirroring(log), true)
  assert.equal(log.transports.ipc.level, false)
  assert.equal(log.transports.file.level, 'info')
  assert.equal(log.transports.console.level, 'debug')
})

test('is a no-op when the IPC transport does not exist (packaged build or no Electron)', () => {
  const log = { transports: { file: { level: 'info' } } }
  assert.equal(disableRendererMirroring(log), false)
  assert.deepEqual(log.transports, { file: { level: 'info' } })
  assert.equal(disableRendererMirroring(undefined), false)
})
