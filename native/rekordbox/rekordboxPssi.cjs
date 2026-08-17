'use strict'

// Rekordbox PSSI (Song Structure Information) decoding.
//
// PSSI versions 0 and 1 share the same 24-byte phrase entries but use a
// versioned six-byte content header: uint16 version, uint16 entry size,
// uint16 entry count. Version 0 therefore happens to look like the legacy
// uint32 value 0x00000018, while version 1 does not. Rekordbox can XOR-mask
// the song-structure body; the mask start is rotated by the PSSI version.

const PSSI_ENTRY_BYTES = 24
const PSSI_SUPPORTED_VERSIONS = new Set([0, 1])
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

function emptyIntegrity(overrides = {}) {
  return {
    detected: true,
    version: null,
    entrySize: null,
    declaredEntryCount: 0,
    readableEntryCount: 0,
    complete: false,
    masked: null,
    supported: false,
    warnings: [],
    ...overrides,
  }
}

function resultWithIntegrity(phrases, warnings, integrity) {
  const uniqueWarnings = Array.from(new Set(warnings))
  return {
    phrases,
    warnings: uniqueWarnings,
    integrity: { ...integrity, warnings: uniqueWarnings },
  }
}

function parsePssiTag(buffer, tagStart, tagLen) {
  const warnings = []
  const tagEnd = Math.min(buffer.length, tagStart + tagLen)
  const version = readU16BE(buffer, tagStart + 0x0c)
  const entryBytes = readU16BE(buffer, tagStart + 0x0e)
  const entryCount = readU16BE(buffer, tagStart + 0x10)
  let integrity = emptyIntegrity({ version, entrySize: entryBytes, declaredEntryCount: entryCount ?? 0 })

  if (version == null || entryBytes == null || entryCount == null) {
    warnings.push('PSSI versioned header is truncated.')
    return resultWithIntegrity([], warnings, integrity)
  }
  if (!PSSI_SUPPORTED_VERSIONS.has(version)) {
    warnings.push(`PSSI version ${version} is unsupported; phrase data was not guessed.`)
    return resultWithIntegrity([], warnings, integrity)
  }
  if (entryCount > 10000) {
    warnings.push(`PSSI phrase count ${entryCount} is outside the supported range.`)
    return resultWithIntegrity([], warnings, integrity)
  }
  if (entryBytes !== PSSI_ENTRY_BYTES) {
    warnings.push(`PSSI entry size ${entryBytes} is unsupported; expected ${PSSI_ENTRY_BYTES} bytes.`)
    return resultWithIntegrity([], warnings, integrity)
  }

  integrity = { ...integrity, supported: true }
  const encodedBodyStart = tagStart + 0x12
  if (encodedBodyStart + 14 > tagEnd) {
    warnings.push('PSSI song-structure body is truncated.')
    return resultWithIntegrity([], warnings, integrity)
  }

  const encodedBody = Buffer.from(buffer.subarray(encodedBodyStart, tagEnd))
  const plaintextCandidate = inspectBodyCandidate(encodedBody, entryCount, entryBytes)
  const decodedBody = unmaskPssiBody(encodedBody, entryCount, version)
  const maskedCandidate = inspectBodyCandidate(decodedBody, entryCount, entryBytes)
  const selected = selectBodyCandidate(plaintextCandidate, maskedCandidate)

  if (!selected) {
    warnings.push('PSSI body could not be deterministically interpreted as plaintext or version-aware masked data.')
    return resultWithIntegrity([], warnings, { ...integrity, supported: false })
  }
  const { body, masked, mood, endBeat, bank, entries: rawEntries } = selected
  const availableEntryCount = Math.floor(Math.max(0, body.length - 14) / entryBytes)
  const readableCount = Math.min(entryCount, availableEntryCount, rawEntries.length)
  const complete = readableCount === entryCount
  integrity = {
    ...integrity,
    readableEntryCount: readableCount,
    complete,
    masked,
  }

  if (!MOOD_LABELS[mood]) {
    warnings.push(`PSSI mood ${mood} is unknown; phrase data cannot be decoded safely.`)
    return resultWithIntegrity([], warnings, { ...integrity, complete: false })
  }
  if (!BANK_LABELS[bank]) warnings.push(`PSSI bank ${bank} is unknown; raw bank data was preserved.`)
  if (!complete) {
    warnings.push(`PSSI contains ${readableCount} readable phrase entries but declares ${entryCount}; partial phrase data was kept for diagnostics only.`)
  }

  const phrases = rawEntries.slice(0, readableCount).map((entry, index) => {
    const next = rawEntries[index + 1]
    // Never stretch the last surviving entry of a truncated record to endBeat:
    // unread phrases may exist between it and the declared final boundary.
    const phraseEndBeat = next?.beat ?? (complete && endBeat > 0 ? endBeat : null)
    const rekordboxKind = kindLabel(mood, entry.kind)
    const sourceLabel = sourcePhraseLabel(mood, entry, rekordboxKind)
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
        version,
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

  return resultWithIntegrity(phrases, warnings, integrity)
}

function inspectBodyCandidate(body, entryCount, entryBytes) {
  const mood = readU16BE(body, 0)
  const endBeat = readU16BE(body, 8)
  const bank = readU8(body, 12)
  if (mood == null || endBeat == null || bank == null) return null

  const availableEntryCount = Math.floor(Math.max(0, body.length - 14) / entryBytes)
  const readableCount = Math.min(entryCount, availableEntryCount)
  const entries = []
  for (let index = 0; index < readableCount; index++) {
    const offset = 14 + (index * entryBytes)
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
    if ([sourceIndex, beat, kind, k1, k2, b, beat2, beat3, beat4, k3, fill, beatFill].some(value => value == null)) break
    entries.push({
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

  return {
    body,
    mood,
    endBeat,
    bank,
    entries,
    score: bodyCandidateScore(mood, endBeat, bank, entries),
  }
}

function bodyCandidateScore(mood, endBeat, bank, entries) {
  if (!MOOD_LABELS[mood]) return -1000
  let score = 30
  if (BANK_LABELS[bank]) score += 2
  if (entries.length === 0) return score

  let previousBeat = 0
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    if (entry.sourceIndex === index + 1) score += 4
    else if (entry.sourceIndex > 0) score += 1
    else score -= 8
    if (entry.beat > previousBeat && entry.beat >= 1) score += 5
    else score -= 12
    previousBeat = entry.beat
    if (entry.fill === 0 || entry.beatFill >= entry.beat) score += 1
  }
  if (endBeat === 0 || endBeat > previousBeat) score += 4
  else score -= 10
  return score
}

function selectBodyCandidate(plaintext, masked) {
  const candidates = [
    plaintext && { ...plaintext, masked: false },
    masked && { ...masked, masked: true },
  ].filter(candidate => candidate && candidate.score >= 0)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  candidates.sort((a, b) => b.score - a.score)
  // If both interpretations satisfy the same structural invariants, refusing
  // to guess is safer than silently choosing the wrong authority source.
  if (candidates[0].score === candidates[1].score) return null
  return candidates[0]
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

function mergePssiIntegrity(a, b) {
  if (!a) return b ? cloneIntegrity(b) : null
  if (!b) return cloneIntegrity(a)
  const warnings = Array.from(new Set([...(a.warnings || []), ...(b.warnings || [])]))
  const sameShape = a.version === b.version
    && a.entrySize === b.entrySize
    && a.declaredEntryCount === b.declaredEntryCount
    && a.masked === b.masked
  if (sameShape) {
    return {
      ...a,
      detected: Boolean(a.detected || b.detected),
      readableEntryCount: Math.max(a.readableEntryCount || 0, b.readableEntryCount || 0),
      complete: Boolean(a.complete && b.complete),
      supported: Boolean(a.supported && b.supported),
      warnings,
    }
  }
  const conflict = 'Multiple PSSI records for the same track disagree on version, entry shape, phrase count, or masking; Track Section authority was disabled.'
  return {
    detected: true,
    version: a.version === b.version ? a.version : null,
    entrySize: a.entrySize === b.entrySize ? a.entrySize : null,
    declaredEntryCount: Math.max(a.declaredEntryCount || 0, b.declaredEntryCount || 0),
    readableEntryCount: Math.max(a.readableEntryCount || 0, b.readableEntryCount || 0),
    complete: false,
    masked: a.masked === b.masked ? a.masked : null,
    supported: Boolean(a.supported && b.supported),
    warnings: Array.from(new Set([...warnings, conflict])),
  }
}

function cloneIntegrity(value) {
  return { ...value, warnings: [...(value.warnings || [])] }
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

function unmaskPssiBody(encodedBody, entryCount, version) {
  const decoded = Buffer.from(encodedBody)
  const maskStart = version % PSSI_MASK_BASE.length
  for (let i = 0; i < decoded.length; i++) {
    const maskByte = (PSSI_MASK_BASE[(i + maskStart) % PSSI_MASK_BASE.length] + entryCount) & 0xff
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

function sourcePhraseLabel(mood, entry, baseLabel) {
  if (!baseLabel) return null
  if (mood !== 1) return sourceDisplayLabel(baseLabel)
  if (entry.kind === 1) return entry.k1 === 1 ? 'Intro 1' : entry.k1 === 0 ? 'Intro 2' : 'Intro'
  if (entry.kind === 2) {
    if (entry.k2 === 0 && entry.k3 === 0) return 'Up 1'
    if (entry.k2 === 0 && entry.k3 === 1) return 'Up 2'
    if (entry.k2 === 1 && entry.k3 === 0) return 'Up 3'
    return 'Up'
  }
  if (entry.kind === 3) return 'Down 1'
  if (entry.kind === 5) return entry.k1 === 1 ? 'Chorus 2' : entry.k1 === 0 ? 'Chorus 1' : 'Chorus'
  if (entry.kind === 6) return entry.k1 === 1 ? 'Outro 1' : entry.k1 === 0 ? 'Outro 2' : 'Outro'
  return sourceDisplayLabel(baseLabel)
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

module.exports = {
  PSSI_ENTRY_BYTES,
  parsePssiTag,
  alignRekordboxPhrases,
  mergeRekordboxPhrases,
  mergePssiIntegrity,
}
