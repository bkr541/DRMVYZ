import { MODEL_MAX_FILE_BYTES } from '../domain/modelAssetTypes'
import { assertImageBudget, readImageSize, scanGlbContainer } from './glbContainer'

const align = (n: number) => Math.ceil(n / 4) * 4
interface BufferEntry { uri?: string; byteLength: number }
interface ViewEntry { buffer: number; byteOffset?: number; byteLength: number; [key: string]: unknown }
interface ImageEntry { uri?: string; bufferView?: number; mimeType?: string; [key: string]: unknown }
interface GltfDocument { asset?: { version?: string }; buffers?: BufferEntry[]; bufferViews?: ViewEntry[]; images?: ImageEntry[]; [key: string]: unknown }

/** Resolve only local selected files, or embedded base64. No fetch, URL loader, or path traversal. */
export async function packGltf(text: string, files: readonly File[], signal: AbortSignal): Promise<ArrayBuffer> {
  if (text.length > 4 * 1024 * 1024) throw new Error('glTF metadata exceeds 4 MiB.')
  const json = JSON.parse(text) as GltfDocument
  if (json?.asset?.version !== '2.0') throw new Error('Only glTF 2.0 is supported.')
  if (files.reduce((n, f) => n + f.size, 0) > MODEL_MAX_FILE_BYTES) throw new Error('Model resources exceed the 64 MB budget.')
  const byName = new Map<string, File>()
  for (const file of files) { if (byName.has(file.name)) throw new Error(`Duplicate resource name: ${file.name}`); byName.set(file.name, file) }
  const read = async (uri: unknown): Promise<Uint8Array> => {
    if (signal.aborted) throw new DOMException('Import cancelled.', 'AbortError')
    if (typeof uri !== 'string') throw new Error('Missing glTF resource URI.')
    const data = /^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(uri)
    if (data) return Uint8Array.from(atob(data[1]!), c => c.charCodeAt(0))
    // Flat multi-selection: paths are accepted only as a safe relative path whose basename is unique.
    const name = decodeURIComponent(uri)
    if (/[:?#\\\u0000-\u001f]/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..' || part === '')) throw new Error(`Unsafe or external glTF resource: ${uri}`)
    const file = byName.get(name.split('/').pop()!)
    if (!file) throw new Error(`Missing glTF resource: ${uri}. Select the glTF and its companion files together.`)
    return new Uint8Array(await file.arrayBuffer())
  }
  const chunks: { bytes: Uint8Array; offset: number }[] = []; let length = 0
  const append = (bytes: Uint8Array) => { const offset = length; length += align(bytes.byteLength); if (length > MODEL_MAX_FILE_BYTES) throw new Error('Canonical GLB exceeds 64 MB.'); chunks.push({ bytes, offset }); return offset }
  const offsets: number[] = [], sizes: number[] = []
  for (const buffer of json.buffers ?? []) {
    const bytes = await read(buffer.uri)
    if (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength < 1 || bytes.length < buffer.byteLength || bytes.length > buffer.byteLength + 3) throw new Error('glTF buffer length does not match its declaration.')
    offsets.push(append(bytes)); sizes.push(buffer.byteLength)
  }
  const views = json.bufferViews ?? []
  for (const view of views) {
    const offset = view.byteOffset ?? 0, base = offsets[view.buffer], size = sizes[view.buffer]
    if (base === undefined || size === undefined || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(view.byteLength) || view.byteLength < 1 || offset + view.byteLength > size) throw new Error('glTF buffer view is out of bounds.')
    view.byteOffset = base + offset; view.buffer = 0
  }
  for (const image of json.images ?? []) if (image.uri !== undefined) {
    const bytes = await read(image.uri)
    const png = bytes[0] === 0x89 && bytes[1] === 0x50, jpeg = bytes[0] === 0xff && bytes[1] === 0xd8
    if (!png && !jpeg) throw new Error('External glTF images must be PNG or JPEG. Convert other image formats first.')
    const mimeType = png ? 'image/png' : 'image/jpeg', dimensions = readImageSize(bytes)
    if (!dimensions) throw new Error('An image has an invalid header.')
    assertImageBudget([{ mimeType, ...dimensions }])
    image.bufferView = views.length; image.mimeType = mimeType; views.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length }); delete image.uri
  }
  json.buffers = [{ byteLength: length }]; json.bufferViews = views
  const metadata = new TextEncoder().encode(JSON.stringify(json)), jsonSize = align(metadata.length)
  const total = 28 + jsonSize + length
  if (total > MODEL_MAX_FILE_BYTES || jsonSize > 4 * 1024 * 1024) throw new Error('Canonical GLB exceeds the import budget.')
  const result = new ArrayBuffer(total), view = new DataView(result), bytes = new Uint8Array(result)
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true)
  view.setUint32(12, jsonSize, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + jsonSize); bytes.set(metadata, 20)
  view.setUint32(20 + jsonSize, length, true); view.setUint32(24 + jsonSize, 0x004e4942, true)
  for (const chunk of chunks) bytes.set(chunk.bytes, 28 + jsonSize + chunk.offset)
  const scanned = scanGlbContainer(result); assertImageBudget(scanned.images)
  return result
}
