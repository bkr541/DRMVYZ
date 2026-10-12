'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createRekordboxIndexStore } = require('./rekordboxIndexStore.cjs')

test('Rekordbox index store persists the selected directory and a queryable track index', async t => {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'drmvyz-rb-index-'))
  t.after(() => fs.rm(baseDir, { recursive: true, force: true }))
  const store = createRekordboxIndexStore({ baseDir })

  assert.equal((await store.getStatus()).hasIndex, false)
  const selected = await store.selectRoot('/Volumes/LUMA')
  assert.equal(selected.selectedRootName, 'LUMA')
  assert.equal(selected.hasIndex, false)

  const synced = await store.persistScan('/Volumes/LUMA', {
    library: {
      id: 'library-a',
      tracks: [{ trackId: '1', location: '/Contents/Artist/Track.mp3', filename: 'Track.mp3' }],
    },
    parserMode: 'hybrid',
    detectedPdbFiles: 1,
    detectedAnlzFiles: 3,
    warnings: [],
  })

  assert.equal(synced.hasIndex, true)
  assert.equal(synced.trackCount, 1)
  assert.equal(synced.detectedAnlzFiles, 3)

  const files = await fs.readdir(baseDir)
  const indexFile = files.find(file => file !== 'manifest.json')
  assert.ok(indexFile)
  const payload = JSON.parse(await fs.readFile(path.join(baseDir, indexFile), 'utf8'))
  assert.equal(payload.lookup.byLocation['/contents/artist/track.mp3'], 0)
  assert.deepEqual(payload.lookup.byFilename['track.mp3'], [0])
})
