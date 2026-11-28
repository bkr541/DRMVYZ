'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { installRecordingBridge } = require('./recordingBridge.cjs')

function setup(freeSpace = async () => 100 * 1024 ** 3) {
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'stageless-recording-'))
  const handlers = new Map()
  installRecordingBridge({ ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) }, app: { getPath: () => downloads }, freeSpace })
  const call = (channel, ...args) => handlers.get(channel)({}, ...args)
  return { downloads, call, folder: path.join(downloads, 'STAGELESS Recordings') }
}
const bytes = text => new TextEncoder().encode(text)

test('writes chunks to a .partial file as they arrive and renames it when the recording finishes', async () => {
  const { call, folder } = setup()
  const started = await call('drmvyz:recording:start', 'stageless-performance-1.webm')
  assert.equal(started.ok, true)
  await call('drmvyz:recording:append', started.id, bytes('one'))
  assert.equal(fs.readFileSync(path.join(folder, 'stageless-performance-1.webm.partial'), 'utf8'), 'one')
  await call('drmvyz:recording:append', started.id, bytes('two').buffer)
  const finished = await call('drmvyz:recording:finish', started.id)
  assert.deepEqual(finished, { ok: true, path: path.join(folder, 'stageless-performance-1.webm'), bytes: 6 })
  assert.equal(fs.readFileSync(finished.path, 'utf8'), 'onetwo')
  assert.equal(fs.existsSync(`${finished.path}.partial`), false)
})

test('keeps what was recorded when a recording is interrupted', async () => {
  const { call, folder } = setup()
  const { id } = await call('drmvyz:recording:start', 'stageless-performance-2.webm')
  await call('drmvyz:recording:append', id, bytes('kept'))
  const aborted = await call('drmvyz:recording:abort', id)
  assert.equal(aborted.path, path.join(folder, 'stageless-performance-2.webm.partial'))
  assert.equal(fs.readFileSync(aborted.path, 'utf8'), 'kept')
})

test('refuses to start with too little free space, and rejects unsafe file names', async () => {
  const low = setup(async () => 512 * 1024 ** 2)
  assert.equal((await low.call('drmvyz:recording:start', 'stageless-performance-3.webm')).reason, 'low-disk')
  const { call } = setup()
  await assert.rejects(() => call('drmvyz:recording:start', '../escape.webm'), /Invalid recording file name/)
  await assert.rejects(() => call('drmvyz:recording:start', 'notes.txt'), /Invalid recording file name/)
})
