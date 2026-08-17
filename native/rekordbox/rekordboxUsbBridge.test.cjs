'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { parseAnlzBuffer, scanRekordboxUsbRoot, isPlausibleRemovableRoot } = require('./rekordboxUsbBridge.cjs')

const PSSI_MASK_BASE = [
  0xcb, 0xe1, 0xee, 0xfa, 0xe5, 0xee, 0xad, 0xee, 0xe9, 0xd2,
  0xe9, 0xeb, 0xe1, 0xe9, 0xf3, 0xe8, 0xe9, 0xf4, 0xe1,
]

function makeTag(fourcc, body, headerLen = 12) {
  const tag = Buffer.alloc(12 + body.length)
  tag.write(fourcc, 0, 'ascii')
  tag.writeUInt32BE(headerLen, 4)
  tag.writeUInt32BE(tag.length, 8)
  body.copy(tag, 12)
  return tag
}

function makePmai(tags = []) {
  const header = Buffer.alloc(0x1c)
  header.write('PMAI', 0, 'ascii')
  header.writeUInt32BE(header.length, 4)
  const total = header.length + tags.reduce((sum, tag) => sum + tag.length, 0)
  header.writeUInt32BE(total, 8)
  return Buffer.concat([header, ...tags], total)
}

function makePqtzTag(beats) {
  const body = Buffer.alloc(12 + beats.length * 8)
  body.writeUInt32BE(0x80000, 4)
  body.writeUInt32BE(beats.length, 8)
  beats.forEach((beat, index) => {
    const offset = 12 + index * 8
    body.writeUInt16BE(beat.beatInBar ?? ((index % 4) + 1), offset)
    body.writeUInt16BE(Math.round((beat.bpm ?? 120) * 100), offset + 2)
    body.writeUInt32BE(beat.timeMs, offset + 4)
  })
  return makeTag('PQTZ', body, 0x18)
}

function utf16Be(value) {
  const littleEndian = Buffer.from(`${value}\0`, 'utf16le')
  const bigEndian = Buffer.alloc(littleEndian.length)
  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index] = littleEndian[index + 1]
    bigEndian[index + 1] = littleEndian[index]
  }
  return bigEndian
}

function makePpthTag(audioPath) {
  const encoded = utf16Be(audioPath)
  const body = Buffer.alloc(4 + encoded.length)
  body.writeUInt32BE(encoded.length, 0)
  encoded.copy(body, 4)
  return makeTag('PPTH', body, 0x10)
}

function makePssiTag({ mood = 2, bank = 0, endBeat, entries, masked = false, entryBytes = 24 }) {
  const songBody = Buffer.alloc(14 + entries.length * entryBytes)
  songBody.writeUInt16BE(mood, 0)
  songBody.writeUInt16BE(endBeat, 8)
  songBody.writeUInt8(bank, 12)

  entries.forEach((entry, index) => {
    const offset = 14 + index * entryBytes
    if (entryBytes < 24) return
    songBody.writeUInt16BE(entry.index ?? index + 1, offset)
    songBody.writeUInt16BE(entry.beat, offset + 2)
    songBody.writeUInt16BE(entry.kind, offset + 4)
    songBody.writeUInt8(entry.k1 ?? 0, offset + 7)
    songBody.writeUInt8(entry.k2 ?? 0, offset + 9)
    songBody.writeUInt8(entry.b ?? 0, offset + 11)
    songBody.writeUInt16BE(entry.beat2 ?? 0, offset + 12)
    songBody.writeUInt16BE(entry.beat3 ?? 0, offset + 14)
    songBody.writeUInt16BE(entry.beat4 ?? 0, offset + 16)
    songBody.writeUInt8(entry.k3 ?? 0, offset + 19)
    songBody.writeUInt8(entry.fill ?? 0, offset + 21)
    songBody.writeUInt16BE(entry.beatFill ?? 0, offset + 22)
  })

  const encodedSongBody = Buffer.from(songBody)
  if (masked) {
    for (let index = 0; index < encodedSongBody.length; index++) {
      encodedSongBody[index] ^= (PSSI_MASK_BASE[index % PSSI_MASK_BASE.length] + entries.length) & 0xff
    }
  }

  const body = Buffer.alloc(6 + encodedSongBody.length)
  body.writeUInt32BE(entryBytes, 0)
  body.writeUInt16BE(entries.length, 4)
  encodedSongBody.copy(body, 6)
  return makeTag('PSSI', body, 0x20)
}

function makePcobTag({ timeMs = 1000, hotCue = 1, cueType = 1 } = {}) {
  const body = Buffer.alloc(12 + 0x38)
  body.writeUInt32BE(1, 0)
  body.writeUInt16BE(1, 6)
  body.writeUInt32BE(1, 8)
  const entry = 12
  body.write('PCPT', entry, 'ascii')
  body.writeUInt32BE(0x1c, entry + 4)
  body.writeUInt32BE(0x38, entry + 8)
  body.writeUInt32BE(hotCue, entry + 0x0c)
  body.writeUInt8(cueType, entry + 0x1c)
  body.writeUInt32BE(timeMs, entry + 0x20)
  return makeTag('PCOB', body, 0x18)
}

function grid(timesMs, bpms = []) {
  return timesMs.map((timeMs, index) => ({ timeMs, bpm: bpms[index] ?? bpms.at(-1) ?? 120 }))
}

test('parseAnlzBuffer accepts a minimal PMAI container', () => {
  const result = parseAnlzBuffer(makePmai(), 'ANLZ0000.DAT')
  assert.deepEqual(result.cues, [])
  assert.deepEqual(result.beatGrid, [])
  assert.deepEqual(result.phrases, [])
  assert.deepEqual(result.warnings, [])
})

test('parseAnlzBuffer parses masked PSSI phrases in order with fill metadata and PQTZ-aligned timestamps', () => {
  const beatTimes = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000]
  const buffer = makePmai([
    makePqtzTag(grid(beatTimes, [120])),
    makeTag('ZZZZ', Buffer.from([1, 2, 3, 4])),
    makePssiTag({
      mood: 2,
      bank: 7,
      endBeat: 13,
      masked: true,
      entries: [
        { index: 1, beat: 1, kind: 1 },
        { index: 2, beat: 5, kind: 2, fill: 1, beatFill: 8 },
        { index: 3, beat: 9, kind: 9 },
      ],
    }),
  ])

  const result = parseAnlzBuffer(buffer, 'ANLZ0000.EXT')
  assert.equal(result.phrases.length, 3)
  assert.deepEqual(result.phrases.map(phrase => phrase.phraseIndex), [0, 1, 2])
  assert.deepEqual(result.phrases.map(phrase => phrase.sourceIndex), [1, 2, 3])
  assert.deepEqual(result.phrases.map(phrase => phrase.startBeat), [1, 5, 9])
  assert.deepEqual(result.phrases.map(phrase => phrase.endBeat), [5, 9, 13])
  assert.deepEqual(result.phrases.map(phrase => phrase.startTimeSec), [0, 2, 4])
  assert.deepEqual(result.phrases.map(phrase => phrase.endTimeSec), [2, 4, 6])
  assert.equal(result.phrases[1].mood, 'mid_energy')
  assert.equal(result.phrases[1].rekordboxKind, 'verse_1')
  assert.equal(result.phrases[1].sourceLabel, 'Verse 1')
  assert.equal(result.phrases[1].normalizedLabel, 'verse')
  assert.equal(result.phrases[1].bank, 'club_1')
  assert.equal(result.phrases[1].fillStartBeat, 8)
  assert.equal(result.phrases[1].fillStartTimeSec, 3.5)
  assert.equal(result.phrases[1].sourceFlags.fill, true)
  assert.equal(result.phrases[1].sourceFlags.beatFill, 8)
  assert.equal(result.phrases[1].sourceFlags.masked, true)
  assert.equal(result.phrases[1].sourcePayload.kind, 2)
  assert.equal(result.warnings.length, 0)
})

test('PSSI timestamps follow a variable-tempo/manual PQTZ grid instead of average BPM math', () => {
  const timesMs = [0, 500, 1000, 1500, 1900, 2300, 2700, 3100, 3450, 3800, 4150, 4500]
  const bpms = [120, 120, 120, 120, 150, 150, 150, 150, 171.43, 171.43, 171.43, 171.43]
  const result = parseAnlzBuffer(makePmai([
    makePqtzTag(grid(timesMs, bpms)),
    makePssiTag({
      mood: 3,
      bank: 2,
      endBeat: 12,
      entries: [
        { beat: 5, kind: 6 },
        { beat: 9, kind: 9, fill: 1, beatFill: 11 },
      ],
    }),
  ]), 'ANLZ0001.EXT')

  assert.equal(result.phrases[0].rekordboxKind, 'verse_2b')
  assert.equal(result.phrases[0].sourceLabel, 'Verse 2')
  assert.equal(result.phrases[0].normalizedLabel, 'verse')
  assert.equal(result.phrases[0].startTimeSec, 1.9)
  assert.equal(result.phrases[0].endTimeSec, 3.45)
  assert.equal(result.phrases[1].startTimeSec, 3.45)
  assert.equal(result.phrases[1].endTimeSec, 4.5)
  assert.equal(result.phrases[1].fillStartTimeSec, 4.15)
})

test('partial PSSI keeps complete entries and reports the truncated remainder', () => {
  const fullTag = makePssiTag({
    mood: 2,
    bank: 1,
    endBeat: 13,
    entries: [
      { beat: 1, kind: 1 },
      { beat: 5, kind: 2 },
      { beat: 9, kind: 9 },
    ],
  })
  const partialTag = Buffer.from(fullTag.subarray(0, fullTag.length - 10))
  partialTag.writeUInt32BE(partialTag.length, 8)
  const result = parseAnlzBuffer(makePmai([partialTag]), 'ANLZ-PARTIAL.EXT')

  assert.equal(result.phrases.length, 2)
  assert.deepEqual(result.phrases.map(phrase => phrase.startBeat), [1, 5])
  assert.deepEqual(result.phrases.map(phrase => phrase.endBeat), [5, 13])
  assert.ok(result.warnings.some(warning => warning.includes('2 readable phrase entries but declares 3')))
})

test('PQTZ without PSSI keeps beat-grid data and yields an empty phrase list', () => {
  const result = parseAnlzBuffer(makePmai([
    makePqtzTag(grid([0, 500, 1000, 1500], [120])),
  ]), 'ANLZ0002.DAT')

  assert.equal(result.beatGrid.length, 4)
  assert.deepEqual(result.phrases, [])
  assert.deepEqual(result.warnings, [])
})

test('malformed PSSI and unsupported tags degrade without losing usable PQTZ/cue data', () => {
  const malformedPssi = makePssiTag({
    mood: 2,
    bank: 0,
    endBeat: 9,
    entryBytes: 12,
    entries: [{ beat: 1, kind: 1 }],
  })
  const result = parseAnlzBuffer(makePmai([
    makePqtzTag(grid([0, 500, 1000, 1500], [120])),
    makePcobTag({ timeMs: 1000 }),
    makeTag('ABCD', Buffer.from([9, 8, 7, 6])),
    malformedPssi,
  ]), 'ANLZ0003.EXT')

  assert.equal(result.beatGrid.length, 4)
  assert.equal(result.cues.length, 1)
  assert.equal(result.cues[0].startSec, 1)
  assert.deepEqual(result.phrases, [])
  assert.ok(result.warnings.some(warning => warning.includes('PSSI entry size')))
})

test('scanRekordboxUsbRoot merges sibling DAT beat grid and EXT PSSI for the same audio track', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'drmvyz-rb-pssi-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const analysisDir = path.join(root, 'PIONEER', 'USBANLZ', 'P001', '00000000')
  await fs.mkdir(analysisDir, { recursive: true })
  const audioPath = '/Contents/Test Track.wav'

  await fs.writeFile(path.join(analysisDir, 'ANLZ0000.DAT'), makePmai([
    makePpthTag(audioPath),
    makePqtzTag(grid([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000], [120])),
    makePcobTag({ timeMs: 1000 }),
  ]))
  await fs.writeFile(path.join(analysisDir, 'ANLZ0000.EXT'), makePmai([
    makePpthTag(audioPath),
    makePssiTag({
      mood: 1,
      bank: 6,
      endBeat: 9,
      entries: [
        { beat: 1, kind: 1 },
        { beat: 5, kind: 5, fill: 1, beatFill: 8 },
      ],
    }),
  ]))

  const result = await scanRekordboxUsbRoot(root)
  assert.equal(result.detectedAnlzFiles, 2)
  assert.equal(result.library.tracks.length, 1)
  const [track] = result.library.tracks
  assert.equal(track.location, audioPath)
  assert.equal(track.beatGrid.length, 9)
  assert.equal(track.cues.length, 1)
  assert.equal(track.phrases.length, 2)
  assert.equal(track.phrases[1].rekordboxKind, 'chorus')
  assert.equal(track.phrases[1].startTimeSec, 2)
  assert.equal(track.phrases[1].endTimeSec, 4)
  assert.equal(track.phrases[1].fillStartTimeSec, 3.5)
})

test('corrupted ANLZ extension does not prevent readable sibling metadata or export.pdb discovery', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'drmvyz-rb-corrupt-ext-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const analysisDir = path.join(root, 'PIONEER', 'USBANLZ', 'P001', '00000000')
  const rekordboxDir = path.join(root, 'PIONEER', 'rekordbox')
  await fs.mkdir(analysisDir, { recursive: true })
  await fs.mkdir(rekordboxDir, { recursive: true })
  const audioPath = '/Contents/Still Usable.wav'

  await fs.writeFile(path.join(analysisDir, 'ANLZ0000.DAT'), makePmai([
    makePpthTag(audioPath),
    makePqtzTag(grid([0, 500, 1000, 1500, 2000], [120])),
  ]))
  await fs.writeFile(path.join(analysisDir, 'ANLZ0000.EXT'), Buffer.from('corrupt-anlz-extension'))
  await fs.writeFile(path.join(rekordboxDir, 'export.pdb'), Buffer.from('readable-placeholder-pdb'))

  const result = await scanRekordboxUsbRoot(root)
  assert.equal(result.detectedPdbFiles, 1)
  assert.equal(result.detectedAnlzFiles, 2)
  assert.equal(result.library.tracks.length, 1)
  assert.equal(result.library.tracks[0].location, audioPath)
  assert.equal(result.library.tracks[0].beatGrid.length, 5)
  assert.ok(result.warnings.some(warning => warning.includes('ANLZ0000.EXT')) || result.warnings.some(warning => warning.includes('export.pdb')))
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
