import { describe, expect, it } from 'vitest'
import { buildWebmDurationPatch, withWebmDuration } from './webmDuration'

const bytes = (...values: number[]) => Uint8Array.from(values)
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
const float64 = (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b }

const EBML_HEADER = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01)
// Info: TimecodeScale = 1_000_000 (0x0F4240) + MuxingApp "x"
const TIMECODE = bytes(0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40)
const MUXING = bytes(0x4d, 0x80, 0x81, 0x78)
const CLUSTER = bytes(0x1f, 0x43, 0xb6, 0x75, 0x82, 0xe7, 0x81) // tiny stand-in payload

function info(...children: Uint8Array[]): Uint8Array {
  const payload = concat(...children)
  return concat(bytes(0x15, 0x49, 0xa9, 0x66, 0x80 | payload.length), payload)
}
function segment(size: 'unknown' | number, ...children: Uint8Array[]): Uint8Array {
  const payload = concat(...children)
  const head = size === 'unknown'
    ? bytes(0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)
    : bytes(0x18, 0x53, 0x80, 0x67, 0x01, 0, 0, 0, 0, 0, 0, size === 0 ? payload.length : size)
  return concat(head, payload)
}

/** Reads the Duration back out of a patched header (independent of the writer). */
function readDuration(file: Uint8Array): number | null {
  for (let i = 0; i < file.length - 10; i += 1) {
    if (file[i] === 0x44 && file[i + 1] === 0x89 && file[i + 2] === 0x88) return new DataView(file.buffer, file.byteOffset + i + 3, 8).getFloat64(0)
  }
  return null
}

describe('webm duration patch', () => {
  it('adds the missing Duration to an unknown-size Segment and keeps the payload byte-identical', () => {
    const file = concat(EBML_HEADER, segment('unknown', info(TIMECODE, MUXING), CLUSTER))
    const patch = buildWebmDurationPatch(file, 12.5)
    expect(patch).not.toBeNull()
    const rebuilt = concat(patch!.head, file.slice(patch!.replacedBytes))
    expect(readDuration(rebuilt)).toBeCloseTo(12500, 6) // ticks of 1 ms
    // The Cluster survives untouched at the end.
    expect(Array.from(rebuilt.slice(rebuilt.length - CLUSTER.length))).toEqual(Array.from(CLUSTER))
    // Info's size now covers the extra 11 bytes.
    const infoIndex = rebuilt.findIndex((_, i) => rebuilt[i] === 0x15 && rebuilt[i + 1] === 0x49 && rebuilt[i + 2] === 0xa9 && rebuilt[i + 3] === 0x66)
    expect(rebuilt[infoIndex + 4]).toBe(0x80 | (TIMECODE.length + MUXING.length + 11))
  })

  it('respects a non-default timecode scale', () => {
    const TC_500US = bytes(0x2a, 0xd7, 0xb1, 0x83, 0x07, 0xa1, 0x20) // 500_000 ns
    const file = concat(EBML_HEADER, segment('unknown', info(TC_500US), CLUSTER))
    const patch = buildWebmDurationPatch(file, 1)!
    expect(readDuration(concat(patch.head, file.slice(patch.replacedBytes)))).toBeCloseTo(2000, 6)
  })

  it('replaces an existing Duration instead of adding a second', () => {
    const existing = concat(bytes(0x44, 0x89, 0x88), float64(1))
    const file = concat(EBML_HEADER, segment('unknown', info(TIMECODE, existing), CLUSTER))
    const patch = buildWebmDurationPatch(file, 3)!
    const rebuilt = concat(patch.head, file.slice(patch.replacedBytes))
    expect(readDuration(rebuilt)).toBeCloseTo(3000, 6)
    const count = Array.from(rebuilt).filter((_, i) => rebuilt[i] === 0x44 && rebuilt[i + 1] === 0x89 && rebuilt[i + 2] === 0x88).length
    expect(count).toBe(1)
  })

  it('grows a known Segment size by exactly the bytes added', () => {
    const file = concat(EBML_HEADER, segment(0, info(TIMECODE), CLUSTER))
    const sizeBefore = file[EBML_HEADER.length + 11]!
    const patch = buildWebmDurationPatch(file, 2)!
    expect(patch.head[EBML_HEADER.length + 11]).toBe(sizeBefore + 11)
  })

  it('refuses inputs it cannot safely rewrite', () => {
    expect(buildWebmDurationPatch(bytes(1, 2, 3), 2)).toBeNull()
    expect(buildWebmDurationPatch(concat(EBML_HEADER, segment('unknown', CLUSTER)), 2)).toBeNull()
    expect(buildWebmDurationPatch(concat(EBML_HEADER, segment('unknown', info(TIMECODE))), 0)).toBeNull()
    expect(buildWebmDurationPatch(concat(EBML_HEADER, segment('unknown', info(TIMECODE))), Number.NaN)).toBeNull()
  })

  it('patches a Blob without reading the media payload, and returns non-WebM blobs unchanged', async () => {
    const file = concat(EBML_HEADER, segment('unknown', info(TIMECODE), CLUSTER))
    const patched = await withWebmDuration(new Blob([file as BlobPart], { type: 'video/webm' }), 4)
    expect(patched.type).toBe('video/webm')
    expect(patched.size).toBe(file.length + 11)
    expect(readDuration(new Uint8Array(await patched.arrayBuffer()))).toBeCloseTo(4000, 6)

    const junk = new Blob(['not a webm'], { type: 'video/webm' })
    expect(await withWebmDuration(junk, 4)).toBe(junk)
  })
})
