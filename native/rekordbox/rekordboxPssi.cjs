'use strict'

// Rekordbox PSSI (Song Structure Information) decoding.
//
// The binary layout follows the PSSI structure used by crate-digger / the
// rekordbox-parser ANLZ model. Rekordbox 6 exports may XOR-mask the song
// structure body; the mask is derived from the phrase count.

const PSSI_ENTRY_BYTES = 24
const PSSI_MASK_BASE = Object.freeze([
  0xcb, 0xe1, 0xee, 0xfa, 0xe5, 0xee, 0xad, 0xee, 0xe9, 0xd2,
  0xe9, 0xeb, 0xe1, 0xe9, 0xf3, 0xe8, 0xe9, 0xf4, 0xe1,
])

const MOOD_LABELS = Object.freeze({
  1: 'high_energy',
  2: 'mid_energy',
  3: 'low_energy',
})

const BANK_LABELS = Object.freeze({
  0: 'default',
  1: 'cool',
  2: 'natural',
  3: 'hot',
  4: 'subtle',
  5: 'warm',
  6: 'vivid',
  7: 'club_1',
  8: 'club_2',
})

const HIGH_KIND_LABELS = Object.freeze({
  1: 'intro',
  2: 'up',
  3: 'down',
  5: 'chorus',
  6: 'outro',
})

const MID_KIND_LABELS = Object.freeze({
  1: 'intro',
  2: 'verse_1',
  3: 'verse_2',
  4: 'verse_3',
  5: 'verse_4',
  6: 'verse_5',
  7: 'verse_6',
  8: 'bridge',
  9: 'chorus',
  10: 'outro',
})

const LOW_KIND_LABELS = Object.freeze({
  1: 'intro',
  2: 'verse_1',
  3: 'verse_1b',
  4: 'verse_1c',
  5: 'verse_2',
  6: 'verse_2b',
  7: 'verse_2c',
  8: 'bridge',
  9: 'chorus',
  10: 'outro',
})

function parsePssiTag(buffer, tagStart, tagLen) {
  const warnings = []
  const tagEnd = Math.min(buffer.length, tagStart + tagLen)
  const entryBytes = readU32BE(buffer, tagStart + 0x0c)
  const entryCount = readU16BE(buffer, tagStart + 0x10)

  if (entryBytes == null || entryCount == null) {
    return { phrases: [], warnings: ['PSSI header is truncated.'] }
  }
  if (entryCount > 10000) {
    return { phrases: [], warnings: [`PSSI phrase count ${entryCount} is outside the supported range.`] }
  }
  if (entryBytes < PSSI_ENTRY_BYTES) {
    return { phrases: [], warnings: [`PSSI entry size ${entryBytes} is smaller than the supported ${PSSI_ENTRY_BYTES}-byte structure.`] }
  }
  if (entryBytes !== PSSI_ENTRY_BYTES) {
    warnings.push(`PSSI entry size is ${entryBytes} bytes; decoding the known first ${PSSI_ENTRY_BYTES} bytes of each entry.`)
  }

  const encodedBodyStart = tagStart + 0x12
  if (encodedBodyStart + 14 > tagEnd) {
    return { phrases: [], warnings: [...warnings, 'PSSI song-structure body is truncated.'] }
  }

  const encodedBody = Buffer.from(buffer.subarray(encodedBodyStart, tagEnd))
  const rawMood = readU16BE(encodedBody, 0)
  const masked = rawMood != null && rawMood > 20
  const body = masked ? unmaskPssiBody(encodedBody, entryCount) : encodedBody

  const mood = readU16BE(body, 0)
  const endBeat = readU16BE(body, 8)
  const bank = readU8(body, 12)
  if (mood == null || endBeat == null || bank == null) {
    return { phrases: [], warnings: [...warnings, 'PSSI song-structure header is incomplete after decoding.'] }
  }

  if (!MOOD_LABELS[mood]) warnings.push(`PSSI mood ${mood} is unknown; phrase source values were preserved without a normalized mood.`)
  if (!BANK_LABELS[bank]) warnings.push(`PSSI bank ${bank} is unknown; raw bank data was preserved.`)

  const entriesStart = 14
  const availableEntryCount = Math.floor(Math.max(0, body.length - entriesStart) / entryBytes)
  const readableCount = Math.min(entryCount, availableEntryCount)
  if (readableCount < entryCount) {
    warnings.push(`PSSI contains ${readableCount} readable phrase entries but declares ${entryCount}; partial phrase data was kept.`)
  }

  const rawEntries = []
  for (let index = 0; index < readableCount; index++) {
    const offset = entriesStart + (index * entryBytes)
    const sourceIndex = readU16BE(body, offset)
    const beat = readU16BE(body, offset + 2)
    const kind = readU16BE(body, offset + 4)
    const k1 = readU8(body, offset + 7)
    const k2 = readU8(body, offset + 9)
    const b = readU8(body, offset + 11)
    const beat2 = readU16BE(body, offset + 12)
    const beat3 = readU16BE(body, offset + 14)
    const beat4 = readU16BE(body, offset + 16)
    const k3 = readU8(body, offset + 19)
    const fill = readU8(body, offset + 21)
    const beatFill = readU16BE(body, offset + 22)

    if ([sourceIndex, beat, kind, k1, k2, b, beat2, beat3, beat4, k3, fill, beatFill].some(value => value == null)) {
      warnings.push(`PSSI phrase entry ${index} is truncated and was skipped.`)
      continue
    }

    rawEntries.push({
      phraseIndex: index,
      sourceIndex,
      beat,
      kind,
      k1,
      k2,
      b,
      beat2,
      beat3,
      beat4,
      k3,
      fill,
      beatFill,
    })
  }

  const phrases = rawEntries.map((entry, index) => {
    const next = rawEntries[index + 1]
    const phraseEndBeat = next?.beat ?? (endBeat > 0 ? endBeat : null)
    const rekordboxKind = kindLabel(mood, entry.kind)
    const sourceLabel = rekordboxKind ? sourceDisplayLabel(rekordboxKind) : null
    const normalizedLabel = normalizeKindLabel(rekordboxKind)

    if (!rekordboxKind) {
      warnings.push(`PSSI phrase ${entry.sourceIndex || entry.phraseIndex + 1} has unknown mood/kind combination mood=${mood}, kind=${entry.kind}.`)
    }

    return {
      phraseIndex: entry.phraseIndex,
      sourceIndex: entry.sourceIndex,
      sourceMood: mood,
      mood: MOOD_LABELS[mood] || null,
      sourceKind: entry.kind,
      rekordboxKind,
      sourceBank: bank,
      bank: BANK_LABELS[bank] || null,
      sourceLabel,
      normalizedLabel,
      startBeat: entry.beat,
      endBeat: phraseEndBeat,
      startTimeSec: null,
      endTimeSec: null,
      fillStartBeat: entry.fill ? entry.beatFill : null,
      fillStartTimeSec: null,
      sourceFlags: {
        masked,
        fill: Boolean(entry.fill),
        beatFill: entry.fill ? entry.beatFill : null,
        k1: entry.k1,
        k2: entry.k2,
        k3: entry.k3,
        b: entry.b,
        beat2: entry.beat2,
        beat3: entry.beat3,
        beat4: entry.beat4,
      },
      sourcePayload: {
        index: entry.sourceIndex,
        mood,
        bank,
        kind: entry.kind,
        beat: entry.beat,
        endBeat: phraseEndBeat,
        k1: entry.k1,
        k2: entry.k2,
        k3: entry.k3,
        b: entry.b,
        beat2: entry.beat2,
        beat3: entry.beat3,
        beat4: entry.beat4,
        fill: entry.fill,
        beatFill: entry.beatFill,
        lenEntryBytes: entryBytes,
      },
    }
  })

  return { phrases, warnings }
}

function alignRekordboxPhrases(phrases, beatGrid) {
  if (!Array.isArray(phrases) || phrases.length === 0) return []
  const grid = Array.isArray(beatGrid) ? beatGrid : []
  return phrases.map(phrase => ({
    ...phrase,
    startTimeSec: beatTimeSec(grid, phrase.startBeat),
    endTimeSec: beatTimeSec(grid, phrase.endBeat),
    fillStartTimeSec: phrase.fillStartBeat == null ? null : beatTimeSec(grid, phrase.fillStartBeat),
  }))
}

function mergeRekordboxPhrases(a, b) {
  const merged = new Map()
  for (const phrase of [...(a || []), ...(b || [])]) {
    if (!phrase || !Number.isFinite(phrase.startBeat)) continue
    const key = `${phrase.sourceIndex ?? phrase.phraseIndex ?? ''}:${phrase.startBeat}:${phrase.sourceKind ?? ''}`
    const existing = merged.get(key)
    merged.set(key, existing ? {
      ...existing,
      ...phrase,
      sourceFlags: { ...(existing.sourceFlags || {}), ...(phrase.sourceFlags || {}) },
      sourcePayload: { ...(existing.sourcePayload || {}), ...(phrase.sourcePayload || {}) },
    } : phrase)
  }
  return Array.from(merged.values()).sort((x, y) => {
    const beatDelta = (x.startBeat || 0) - (y.startBeat || 0)
    if (beatDelta !== 0) return beatDelta
    return (x.phraseIndex || 0) - (y.phraseIndex || 0)
  })
}

function beatTimeSec(beatGrid, beatNumber) {
  if (!Number.isInteger(beatNumber) || beatNumber < 1 || beatGrid.length === 0) return null
  const exact = beatGrid[beatNumber - 1]
  if (exact && Number.isFinite(exact.timeSec)) return exact.timeSec

  // PSSI end beats are exclusive. If the boundary lands exactly one beat after
  // the final PQTZ entry, extend using only the final local grid interval rather
  // than average track BPM. This keeps variable-tempo/manual grids aligned.
  if (beatNumber === beatGrid.length + 1 && beatGrid.length >= 2) {
    const last = beatGrid[beatGrid.length - 1]
    const prev = beatGrid[beatGrid.length - 2]
    const delta = last?.timeSec - prev?.timeSec
    if (Number.isFinite(last?.timeSec) && Number.isFinite(delta) && delta > 0 && delta < 3) {
      return last.timeSec + delta
    }
  }
  return null
}

function unmaskPssiBody(encodedBody, entryCount) {
  const decoded = Buffer.from(encodedBody)
  for (let i = 0; i < decoded.length; i++) {
    const maskByte = (PSSI_MASK_BASE[i % PSSI_MASK_BASE.length] + entryCount) & 0xff
    decoded[i] ^= maskByte
  }
  return decoded
}

function kindLabel(mood, kind) {
  if (mood === 1) return HIGH_KIND_LABELS[kind] || null
  if (mood === 2) return MID_KIND_LABELS[kind] || null
  if (mood === 3) return LOW_KIND_LABELS[kind] || null
  return null
}

function normalizeKindLabel(label) {
  if (!label) return null
  if (label.startsWith('verse_')) return 'verse'
  return label
}

function sourceDisplayLabel(label) {
  // Low-mood enum variants verse_1b/1c and verse_2b/2c are distinct raw
  // source kinds but Rekordbox displays them as Verse 1 / Verse 2.
  return titleCaseLabel(label.replace(/^(verse_[12])[bc]$/, '$1'))
}

function titleCaseLabel(label) {
  return String(label)
    .split('_')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ')
}

function readU8(buffer, offset) {
  return offset >= 0 && offset < buffer.length ? buffer.readUInt8(offset) : null
}

function readU16BE(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : null
}

function readU32BE(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : null
}

module.exports = {
  PSSI_ENTRY_BYTES,
  parsePssiTag,
  alignRekordboxPhrases,
  mergeRekordboxPhrases,
}
