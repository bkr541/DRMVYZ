import { analyzeSvgCapabilities } from '../renderers/svgCapabilityAnalysis'
import { isAnimatedPixGridWebPBytes } from './PixGridWebP'

export const PIX_GRID_DECK_MAX_SOURCE_BYTES = 25 * 1024 * 1024
export const PIX_GRID_DECK_MAX_RASTER_DIMENSION = 8192
export const PIX_GRID_DECK_MAX_DECODED_PIXELS = 33_554_432

export type PixGridDeckSourceMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml'

export type PixGridDeckMediaValidationCode =
  | 'empty-file'
  | 'file-too-large'
  | 'unsupported-format'
  | 'mime-mismatch'
  | 'extension-mismatch'
  | 'corrupt-image'
  | 'animated-image'
  | 'unsafe-svg'
  | 'external-svg-resource'
  | 'raster-dimension-limit'
  | 'decoded-pixel-limit'
  | 'decode-unavailable'
  | 'fingerprint-unavailable'

export interface PixGridDeckMediaValidationError {
  code: PixGridDeckMediaValidationCode
  message: string
  fileName: string
}

export interface PixGridDeckValidatedSource {
  file: File
  mimeType: PixGridDeckSourceMimeType
  extension: 'jpg' | 'png' | 'webp' | 'svg'
  width: number | null
  height: number | null
  hasAlpha: boolean
  fingerprint: string
}

export type PixGridDeckMediaValidationResult =
  | { ok: true; source: PixGridDeckValidatedSource }
  | { ok: false; error: PixGridDeckMediaValidationError }

interface InspectedSource {
  mimeType: PixGridDeckSourceMimeType
  extension: PixGridDeckValidatedSource['extension']
  width: number | null
  height: number | null
  hasAlpha: boolean
}

const MIME_TO_EXTENSION: Record<PixGridDeckSourceMimeType, PixGridDeckValidatedSource['extension']> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

function failure(file: Pick<File, 'name'> | null | undefined, code: PixGridDeckMediaValidationCode, message: string): PixGridDeckMediaValidationResult {
  return { ok: false, error: { code, message, fileName: file?.name ?? 'unknown' } }
}

function extensionForFile(file: File): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(file.name.trim())
  if (!match) return null
  const extension = match[1].toLowerCase()
  return extension === 'jpeg' ? 'jpg' : extension
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function inspectPng(bytes: Uint8Array): InspectedSource | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) return null
  if (ascii(bytes, 12, 4) !== 'IHDR') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16, false)
  const height = view.getUint32(20, false)
  const colorType = bytes[25]
  if (!width || !height || ![0, 2, 3, 4, 6].includes(colorType)) return null

  let offset = 8
  let hasTransparencyChunk = false
  let sawImageData = false
  let sawEnd = false
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false)
    const type = ascii(bytes, offset + 4, 4)
    const next = offset + 12 + length
    if (next > bytes.length) return null
    if (type === 'tRNS') hasTransparencyChunk = true
    if (type === 'IDAT') sawImageData = true
    if (type === 'IEND') {
      sawEnd = true
      break
    }
    offset = next
  }
  if (!sawImageData || !sawEnd) return null
  return {
    mimeType: 'image/png',
    extension: 'png',
    width,
    height,
    hasAlpha: colorType === 4 || colorType === 6 || hasTransparencyChunk,
  }
}

function inspectJpeg(bytes: Uint8Array): InspectedSource | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return null
  }
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) return null
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) return null
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    if (isStartOfFrame) {
      if (length < 7) return null
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (!width || !height) return null
      return { mimeType: 'image/jpeg', extension: 'jpg', width, height, hasAlpha: false }
    }
    offset += length
  }
  return null
}

function inspectWebp(bytes: Uint8Array): InspectedSource | null {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const declaredSize = readUint32LE(bytes, 4) + 8
  if (declaredSize !== bytes.length || declaredSize < 20) return null

  let offset = 12
  let width: number | null = null
  let height: number | null = null
  let hasAlpha = false
  let sawImagePayload = false
  while (offset + 8 <= declaredSize) {
    const type = ascii(bytes, offset, 4)
    const size = readUint32LE(bytes, offset + 4)
    const dataOffset = offset + 8
    const next = dataOffset + size + (size % 2)
    if (next > declaredSize) return null

    if (type === 'ALPH') hasAlpha = true
    if (type === 'VP8X') {
      if (size < 10) return null
      const flags = bytes[dataOffset]
      hasAlpha ||= (flags & 0x10) !== 0
      width = 1 + readUint24LE(bytes, dataOffset + 4)
      height = 1 + readUint24LE(bytes, dataOffset + 7)
    } else if (type === 'VP8 ') {
      if (size < 10 || bytes[dataOffset + 3] !== 0x9d || bytes[dataOffset + 4] !== 0x01 || bytes[dataOffset + 5] !== 0x2a) return null
      width ??= ((bytes[dataOffset + 7] << 8) | bytes[dataOffset + 6]) & 0x3fff
      height ??= ((bytes[dataOffset + 9] << 8) | bytes[dataOffset + 8]) & 0x3fff
      sawImagePayload = true
    } else if (type === 'VP8L') {
      if (size < 5 || bytes[dataOffset] !== 0x2f) return null
      const b1 = bytes[dataOffset + 1]
      const b2 = bytes[dataOffset + 2]
      const b3 = bytes[dataOffset + 3]
      const b4 = bytes[dataOffset + 4]
      width ??= 1 + (((b2 & 0x3f) << 8) | b1)
      height ??= 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      hasAlpha ||= (b4 & 0x10) !== 0
      sawImagePayload = true
    }
    offset = next
  }

  if (!sawImagePayload || !width || !height) return null
  return { mimeType: 'image/webp', extension: 'webp', width, height, hasAlpha }
}

function externalSvgReference(rawSvg: string): boolean {
  const hrefPattern = /\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefPattern.exec(rawSvg)) !== null) {
    const value = match[1].trim()
    if (value && !value.startsWith('#') && !value.startsWith('data:')) return true
  }
  const urlPattern = /url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi
  while ((match = urlPattern.exec(rawSvg)) !== null) {
    const value = match[1].trim()
    if (value && !value.startsWith('#') && !value.startsWith('data:')) return true
  }
  return false
}

function inspectSvg(bytes: Uint8Array): InspectedSource | 'unsafe' | 'external' | null {
  let rawSvg: string
  try {
    rawSvg = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  const capabilities = analyzeSvgCapabilities(rawSvg)
  if (!capabilities.isValidSvg || !/<svg(?:\s|>)/i.test(rawSvg)) return null
  if (externalSvgReference(rawSvg) || capabilities.hasExternalRaster) return 'external'
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(rawSvg)
    || /<\s*(?:script|foreignObject|animate|animateMotion|animateTransform|set)\b/i.test(rawSvg)
    || /\bon[a-z]+\s*=/i.test(rawSvg)
    || /(?:^|[;{\s])animation(?:-name|-duration|-iteration-count)?\s*:/i.test(rawSvg)) {
    return 'unsafe'
  }

  const svgTag = /<svg\b([^>]*)>/i.exec(rawSvg)?.[1] ?? ''
  const dimension = (name: string): number | null => {
    const value = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i').exec(svgTag)?.[1]
    const number = value ? Number(value) : Number.NaN
    return Number.isFinite(number) && number > 0 ? number : null
  }
  let width = dimension('width')
  let height = dimension('height')
  if (width == null || height == null) {
    const viewBox = /\bviewBox\s*=\s*["']\s*[-+]?\d*\.?\d+(?:[\s,]+)[-+]?\d*\.?\d+(?:[\s,]+)(\d*\.?\d+)(?:[\s,]+)(\d*\.?\d+)/i.exec(svgTag)
    width ??= viewBox ? Number(viewBox[1]) : null
    height ??= viewBox ? Number(viewBox[2]) : null
  }
  return { mimeType: 'image/svg+xml', extension: 'svg', width, height, hasAlpha: true }
}

function inspectContent(bytes: Uint8Array): InspectedSource | 'unsafe' | 'external' | null {
  return inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes) ?? inspectSvg(bytes)
}

interface DecodedSourceDimensions {
  width: number
  height: number
}

type DecodeSourceResult =
  | { ok: true; dimensions: DecodedSourceDimensions }
  | { ok: false; unavailable: boolean }

async function decodeSource(file: File, mimeType: PixGridDeckSourceMimeType): Promise<DecodeSourceResult> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      if (dimensions.width > 0 && dimensions.height > 0) return { ok: true, dimensions }
      return { ok: false, unavailable: false }
    } catch {
      // Chrome/Electron decodes supported raster formats here. SVG support is
      // less uniform, so self-contained SVGs receive the same safe fallback
      // already used by PixGrid asset preparation.
      if (mimeType !== 'image/svg+xml') return { ok: false, unavailable: false }
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { ok: false, unavailable: true }
  }
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl
  try {
    await image.decode()
    const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
    if (dimensions.width <= 0 || dimensions.height <= 0) return { ok: false, unavailable: false }
    return { ok: true, dimensions }
  } catch {
    return { ok: false, unavailable: false }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', bytes.slice().buffer)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}

export async function validatePixGridDeckSourceFile(file: File): Promise<PixGridDeckMediaValidationResult> {
  if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function' || file.size <= 0) {
    return failure(file, 'empty-file', 'Choose a non-empty image file.')
  }
  if (file.size > PIX_GRID_DECK_MAX_SOURCE_BYTES) {
    return failure(file, 'file-too-large', 'Deck images must be 25 MiB or smaller.')
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return failure(file, 'corrupt-image', 'The image could not be read.')
  }

  if (ascii(bytes, 0, Math.min(6, bytes.length)).startsWith('GIF8')) {
    return failure(file, 'unsupported-format', 'GIF files are not supported in PixGrid Decks. Use JPEG, PNG, static WebP, or SVG.')
  }
  if (isAnimatedPixGridWebPBytes(bytes)) {
    return failure(file, 'animated-image', 'Animated WebP and GIF files are not supported in PixGrid Decks.')
  }
  const inspected = inspectContent(bytes)
  if (inspected === 'unsafe') return failure(file, 'unsafe-svg', 'SVG animation, scripts, event handlers, and foreign objects are not supported.')
  if (inspected === 'external') return failure(file, 'external-svg-resource', 'SVG files must be self-contained and cannot load external resources.')
  if (!inspected) return failure(file, 'corrupt-image', 'The file content is not a supported, decodable JPEG, PNG, static WebP, or SVG image.')

  const declaredMime = file.type.trim().toLowerCase()
  if (declaredMime && declaredMime !== inspected.mimeType && !(declaredMime === 'image/jpg' && inspected.mimeType === 'image/jpeg')) {
    return failure(file, 'mime-mismatch', `The declared MIME type does not match the detected ${inspected.mimeType} content.`)
  }
  const extension = extensionForFile(file)
  if (!extension || extension !== MIME_TO_EXTENSION[inspected.mimeType]) {
    return failure(file, 'extension-mismatch', `The filename extension does not match the detected ${inspected.mimeType} content.`)
  }

  if (inspected.width != null && inspected.height != null) {
    if (inspected.width > PIX_GRID_DECK_MAX_RASTER_DIMENSION || inspected.height > PIX_GRID_DECK_MAX_RASTER_DIMENSION) {
      return failure(file, 'raster-dimension-limit', 'Deck raster images cannot exceed 8192 pixels in either dimension.')
    }
    if (inspected.width * inspected.height > PIX_GRID_DECK_MAX_DECODED_PIXELS) {
      return failure(file, 'decoded-pixel-limit', 'Deck raster images cannot exceed 33,554,432 decoded pixels.')
    }
  }

  const decoded = await decodeSource(file, inspected.mimeType)
  if (!decoded.ok) {
    return decoded.unavailable
      ? failure(file, 'decode-unavailable', 'Image decoding is unavailable in this runtime, so the Deck source cannot be verified safely.')
      : failure(file, 'corrupt-image', 'The image headers are recognizable, but the source cannot be decoded safely.')
  }
  const decodedWidth = decoded.dimensions.width
  const decodedHeight = decoded.dimensions.height
  if (inspected.mimeType !== 'image/svg+xml'
    && inspected.width != null
    && inspected.height != null
    && (decodedWidth !== inspected.width || decodedHeight !== inspected.height)) {
    return failure(file, 'corrupt-image', 'The decoded image dimensions do not match its source headers.')
  }
  if (decodedWidth > PIX_GRID_DECK_MAX_RASTER_DIMENSION || decodedHeight > PIX_GRID_DECK_MAX_RASTER_DIMENSION) {
    return failure(file, 'raster-dimension-limit', 'Deck images cannot decode beyond 8192 pixels in either dimension.')
  }
  if (decodedWidth * decodedHeight > PIX_GRID_DECK_MAX_DECODED_PIXELS) {
    return failure(file, 'decoded-pixel-limit', 'Deck images cannot exceed 33,554,432 decoded pixels.')
  }

  const fingerprint = await sha256Hex(bytes)
  if (!fingerprint) return failure(file, 'fingerprint-unavailable', 'A stable source fingerprint could not be created in this runtime.')

  return {
    ok: true,
    source: {
      file,
      mimeType: inspected.mimeType,
      extension: inspected.extension,
      width: decodedWidth,
      height: decodedHeight,
      hasAlpha: inspected.hasAlpha,
      fingerprint: `sha256:${fingerprint}`,
    },
  }
}
