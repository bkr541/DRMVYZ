// MediaRecorder writes WebM live, so the file has no Duration in its Segment
// Info and browsers report `duration === Infinity`, which breaks the Media
// Manager timeline and any consumer that needs a real length. The true length
// is known here (it is the source video's duration), so this writes it into the
// header. Only the header bytes are rewritten; the media payload is appended by
// reference (Blob.slice) and never read into memory.

const ID_SEGMENT = 0x18538067
const ID_INFO = 0x1549a966
const ID_DURATION = 0x4489
const ID_TIMECODE_SCALE = 0x2ad7b1
const DEFAULT_TIMECODE_SCALE_NS = 1_000_000
/** Segment Info sits at the very start of a MediaRecorder file. */
const HEADER_BYTES = 16 * 1024

interface ElementHeader {
  id: number
  /** Offset of the first ID byte. */
  start: number
  idLength: number
  sizeLength: number
  /** null when the size is the EBML "unknown" marker. */
  size: number | null
  dataStart: number
}

function readElementHeader(bytes: Uint8Array, offset: number): ElementHeader | null {
  if (offset >= bytes.length) return null
  const first = bytes[offset]!
  if (first === 0) return null
  const idLength = Math.clz32(first) - 24 + 1
  if (idLength > 4 || offset + idLength >= bytes.length) return null
  let id = 0
  for (let i = 0; i < idLength; i += 1) id = id * 256 + bytes[offset + i]!

  const sizeOffset = offset + idLength
  const sizeFirst = bytes[sizeOffset]!
  if (sizeFirst === 0) return null
  const sizeLength = Math.clz32(sizeFirst) - 24 + 1
  if (sizeLength > 8 || sizeOffset + sizeLength > bytes.length) return null
  let size = sizeFirst & (0xff >> sizeLength)
  let allOnes = size === (0xff >> sizeLength)
  for (let i = 1; i < sizeLength; i += 1) {
    const byte = bytes[sizeOffset + i]!
    if (byte !== 0xff) allOnes = false
    size = size * 256 + byte
  }
  return {
    id,
    start: offset,
    idLength,
    sizeLength,
    size: allOnes ? null : size,
    dataStart: sizeOffset + sizeLength,
  }
}

function encodeSize(size: number, minLength: number): Uint8Array {
  let length = Math.max(1, minLength)
  while (size >= 2 ** (7 * length) - 1 && length < 8) length += 1
  const out = new Uint8Array(length)
  let remaining = size
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = remaining % 256
    remaining = Math.floor(remaining / 256)
  }
  out[0] = out[0]! | (0x80 >> (length - 1))
  return out
}

function float64Bytes(value: number): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setFloat64(0, value, false)
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

export interface WebmHeaderPatch {
  /** Replacement for the first `replacedBytes` bytes of the file. */
  head: Uint8Array
  replacedBytes: number
}

/**
 * Pure header rewrite. Returns null when the bytes are not a WebM whose Segment
 * Info can be located (the caller then keeps the original file untouched).
 */
export function buildWebmDurationPatch(header: Uint8Array, durationSec: number): WebmHeaderPatch | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null
  const ebml = readElementHeader(header, 0)
  if (!ebml || ebml.size === null) return null
  const segmentOffset = ebml.dataStart + ebml.size
  const segment = readElementHeader(header, segmentOffset)
  if (!segment || segment.id !== ID_SEGMENT) return null

  // Walk the Segment's children until Info.
  let cursor = segment.dataStart
  let info: ElementHeader | null = null
  while (cursor < header.length) {
    const child = readElementHeader(header, cursor)
    if (!child || child.size === null) return null
    if (child.id === ID_INFO) { info = child; break }
    cursor = child.dataStart + child.size
  }
  if (!info || info.size === null) return null
  const infoEnd = info.dataStart + info.size
  if (infoEnd > header.length) return null

  // Timecode scale (nanoseconds per tick) decides how long the Duration value is.
  let timecodeScale = DEFAULT_TIMECODE_SCALE_NS
  let existingDuration: ElementHeader | null = null
  for (let inner = info.dataStart; inner < infoEnd;) {
    const child = readElementHeader(header, inner)
    if (!child || child.size === null) return null
    if (child.id === ID_TIMECODE_SCALE) {
      let value = 0
      for (let i = 0; i < child.size; i += 1) value = value * 256 + header[child.dataStart + i]!
      if (value > 0) timecodeScale = value
    }
    if (child.id === ID_DURATION) existingDuration = child
    inner = child.dataStart + child.size
  }
  const ticks = (durationSec * 1e9) / timecodeScale

  const infoPayload = header.slice(info.dataStart, infoEnd)
  let newPayload: Uint8Array
  if (existingDuration) {
    const relative = existingDuration.dataStart - info.dataStart
    const before = infoPayload.slice(0, existingDuration.start - info.dataStart)
    const after = infoPayload.slice(relative + (existingDuration.size ?? 0))
    newPayload = concat([before, Uint8Array.of(0x44, 0x89, 0x88), float64Bytes(ticks), after])
  } else {
    newPayload = concat([infoPayload, Uint8Array.of(0x44, 0x89, 0x88), float64Bytes(ticks)])
  }

  const newInfoSize = encodeSize(newPayload.length, info.sizeLength)
  const delta = (newInfoSize.length - info.sizeLength) + (newPayload.length - infoPayload.length)

  // Everything before Info stays byte-identical except a *known* Segment size, which grows by delta.
  const beforeInfo = header.slice(0, info.start + info.idLength)
  if (segment.size !== null) {
    const newSegmentSize = encodeSize(segment.size + delta, segment.sizeLength)
    if (newSegmentSize.length !== segment.sizeLength) return null
    beforeInfo.set(newSegmentSize, segment.start + segment.idLength)
  }
  return { head: concat([beforeInfo, newInfoSize, newPayload]), replacedBytes: infoEnd }
}

/** Returns a Blob with the true duration in its header, or the original blob if it can't be patched. */
export async function withWebmDuration(blob: Blob, durationSec: number): Promise<Blob> {
  try {
    const header = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer())
    const patch = buildWebmDurationPatch(header, durationSec)
    if (!patch) return blob
    return new Blob([patch.head as BlobPart, blob.slice(patch.replacedBytes)], { type: blob.type })
  } catch {
    return blob
  }
}
