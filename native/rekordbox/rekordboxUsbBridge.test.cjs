'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { parseAnlzBuffer, scanRekordboxUsbRoot, isPlausibleRemovableRoot } = require('./rekordboxUsbBridge.cjs')

test('parseAnlzBuffer accepts a minimal PMAI container', () => {
  const buffer = Buffer.alloc(0x1c)
  buffer.write('PMAI', 0, 'ascii')
  buffer.writeUInt32BE(0x1c, 4)
  buffer.writeUInt32BE(0x1c, 8)

  const result = parseAnlzBuffer(buffer, 'ANLZ0000.DAT')
  assert.deepEqual(result.cues, [])
  assert.deepEqual(result.beatGrid, [])
})

test('scanRekordboxUsbRoot returns a safe empty result for a non-Rekordbox folder', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'drmvyz-rb-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  const result = await scanRekordboxUsbRoot(root)
  assert.equal(result.cancelled, false)
  assert.equal(result.detectedPdbFiles, 0)
  assert.equal(result.detectedAnlzFiles, 0)
  assert.equal(result.library.tracks.length, 0)
  assert.ok(result.warnings.some(warning => warning.includes('export.pdb')))
})

test('isPlausibleRemovableRoot accepts real removable-media mount shapes', () => {
  assert.equal(isPlausibleRemovableRoot('/Volumes/DJ USB'), true)
  assert.equal(isPlausibleRemovableRoot('/Volumes/DJ USB/'), true)
  assert.equal(isPlausibleRemovableRoot('/media/kody/DJ USB'), true)
  assert.equal(isPlausibleRemovableRoot('/run/media/kody/DJ USB'), true)
  assert.equal(isPlausibleRemovableRoot('/mnt/usb'), true)
})

test('isPlausibleRemovableRoot rejects arbitrary filesystem paths a compromised renderer might probe', () => {
  assert.equal(isPlausibleRemovableRoot(os.homedir() + '/.ssh'), false)
  assert.equal(isPlausibleRemovableRoot('/etc'), false)
  assert.equal(isPlausibleRemovableRoot('/'), false)
  assert.equal(isPlausibleRemovableRoot(''), false)
})
