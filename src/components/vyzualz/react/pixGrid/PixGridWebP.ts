function fourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function uint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0
}

/** Canonical PixGrid WebP animation detector shared by ingestion and rendering. */
export function isAnimatedPixGridWebPBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WEBP') return false
  const declaredSize = uint32LE(bytes, 4) + 8
  const scanEnd = Math.min(bytes.length, declaredSize)
  for (let offset = 12; offset + 8 <= scanEnd;) {
    const chunk = fourCc(bytes, offset)
    const size = uint32LE(bytes, offset + 4)
    const payloadOffset = offset + 8
    if (chunk === 'ANIM' || chunk === 'ANMF') return true
    if (chunk === 'VP8X' && payloadOffset < scanEnd && (bytes[payloadOffset] & 0x02) !== 0) return true
    const next = payloadOffset + size + (size & 1)
    if (next <= offset || next > scanEnd) break
    offset = next
  }
  return false
}

export async function isAnimatedPixGridWebP(blob: Blob): Promise<boolean> {
  return isAnimatedPixGridWebPBytes(new Uint8Array(await blob.arrayBuffer()))
}
