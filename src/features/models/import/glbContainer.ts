/** Pure inspection of a GLB container, before anything is decoded or uploaded. */
export const MODEL_UPLOAD_ACCEPT = '.glb,model/gltf-binary'
export const MODEL_UPLOAD_LABEL = '.glb, up to 64 MB'

export function isGlbFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.glb$/i.test(file.name) || file.type === 'model/gltf-binary'
}

export const MODEL_IMPORT_LIMITS = {
  /** Longest side of any embedded image. */
  imageSide: 8192,
  /** Decoded RGBA size of all embedded images together (width x height x 4), which is what the browser holds in memory once the model is open. */
  imageBytes: 768 * 1024 * 1024,
} as const

export interface GlbImageInfo { mimeType: string | null; width: number | null; height: number | null }
export interface GlbContainer { json: Record<string, unknown>; images: GlbImageInfo[]; extensionsRequired: string[] }

/** Extensions the viewer's loader cannot decode (it ships no Draco, Meshopt or KTX2 decoder), with the reason to show. */
const UNSUPPORTED_EXTENSIONS: Readonly<Record<string, string>> = {
  KHR_draco_mesh_compression: 'Draco-compressed geometry',
  EXT_meshopt_compression: 'Meshopt-compressed geometry',
  KHR_texture_basisu: 'KTX2/Basis textures',
}

export function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue }
      const marker = bytes[offset + 1]!
      if (marker === 0xff) { offset++; continue }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue }
      const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!, width: (bytes[offset + 7]! << 8) | bytes[offset + 8]! }
      }
      if (length < 2) return null
      offset += 2 + length
    }
  }
  return null
}

/**
 * Checks the GLB header and JSON chunk, rejects files that need decoders or external files, and reads the size of every embedded PNG/JPEG
 * from its header so an oversized texture is refused before the browser decodes it (a decode of a huge image can exhaust memory first).
 */
export function scanGlbContainer(buffer: ArrayBuffer): GlbContainer {
  if (buffer.byteLength < 20) throw new Error('This file is too small to be a GLB model.')
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('This is not a binary glTF (GLB) file.')
  if (view.getUint32(4, true) !== 2) throw new Error('Only GLB version 2 files are supported.')
  if (view.getUint32(8, true) !== buffer.byteLength) throw new Error('This GLB is truncated or its length is wrong.')
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) throw new Error('This GLB has no readable JSON chunk.')
  let json: Record<string, unknown>
  try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as Record<string, unknown> }
  catch { throw new Error('This GLB has an unreadable JSON chunk.') }
  const list = (key: string) => Array.isArray(json[key]) ? json[key] as Record<string, unknown>[] : []
  if ([...list('buffers'), ...list('images')].some(item => typeof item.uri === 'string' && !item.uri.startsWith('data:'))) throw new Error('This GLB points at external files. Export it as a self-contained GLB.')
  const extensionsRequired = Array.isArray(json.extensionsRequired) ? json.extensionsRequired.filter((name): name is string => typeof name === 'string') : []
  const unsupported = [...new Set([...extensionsRequired, ...(Array.isArray(json.extensionsUsed) ? json.extensionsUsed as string[] : [])])].find(name => UNSUPPORTED_EXTENSIONS[name])
  if (unsupported) throw new Error(`This GLB uses ${UNSUPPORTED_EXTENSIONS[unsupported]} (${unsupported}), which the 3D viewer cannot open. Export it without compression.`)

  // The binary chunk follows the JSON chunk; images stored in it are addressed by buffer view.
  const binaryStart = 20 + jsonLength + (4 - jsonLength % 4) % 4
  let binary: Uint8Array | null = null
  if (binaryStart + 8 <= buffer.byteLength && view.getUint32(binaryStart + 4, true) === 0x004e4942) {
    binary = new Uint8Array(buffer, binaryStart + 8, Math.min(view.getUint32(binaryStart, true), buffer.byteLength - binaryStart - 8))
  }
  const views = list('bufferViews')
  const images = list('images').map((image): GlbImageInfo => {
    const mimeType = typeof image.mimeType === 'string' ? image.mimeType : null
    const bufferView = typeof image.bufferView === 'number' ? views[image.bufferView] : undefined
    if (!bufferView || !binary) return { mimeType, width: null, height: null }
    const offset = Number(bufferView.byteOffset ?? 0), length = Number(bufferView.byteLength ?? 0)
    if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length < 1 || offset + length > binary.length) return { mimeType, width: null, height: null }
    const size = readImageSize(binary.subarray(offset, offset + length))
    return { mimeType, width: size?.width ?? null, height: size?.height ?? null }
  })
  return { json, images, extensionsRequired }
}

/** Throws a friendly error when the images alone would blow the budget. Images of unknown size are checked again after decoding. */
export function assertImageBudget(images: readonly GlbImageInfo[]): { maxSide: number; bytes: number } {
  let maxSide = 0, bytes = 0
  for (const { width, height } of images) {
    if (width === null || height === null) continue
    if (width < 1 || height < 1) throw new Error('This GLB has an image with no size.')
    maxSide = Math.max(maxSide, width, height); bytes += width * height * 4
    if (Math.max(width, height) > MODEL_IMPORT_LIMITS.imageSide) throw new Error(`An embedded texture is ${width} × ${height}; the limit is ${MODEL_IMPORT_LIMITS.imageSide} pixels on a side.`)
  }
  if (bytes > MODEL_IMPORT_LIMITS.imageBytes) throw new Error(`The embedded textures need about ${Math.round(bytes / 1048576)} MiB of memory once decoded; the limit is ${MODEL_IMPORT_LIMITS.imageBytes / 1048576} MiB.`)
  return { maxSide, bytes }
}
