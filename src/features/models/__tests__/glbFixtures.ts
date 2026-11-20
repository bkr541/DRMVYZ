/** A minimal GLB: a JSON chunk, and optionally a binary chunk. */
export function glb(json: Record<string, unknown>, binary: Uint8Array = new Uint8Array(0)): ArrayBuffer {
  const text = new TextEncoder().encode(JSON.stringify(json))
  const jsonLength = Math.ceil(text.length / 4) * 4, binaryLength = Math.ceil(binary.length / 4) * 4
  const total = 12 + 8 + jsonLength + (binary.length ? 8 + binaryLength : 0)
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true)
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true)
  bytes.set(text, 20); bytes.fill(0x20, 20 + text.length, 20 + jsonLength)
  if (binary.length) { const at = 20 + jsonLength; view.setUint32(at, binaryLength, true); view.setUint32(at + 4, 0x004e4942, true); bytes.set(binary, at + 8) }
  return bytes.buffer
}
