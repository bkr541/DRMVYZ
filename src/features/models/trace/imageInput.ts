import { loadImageElement } from '../../media/edit/mediaEditImageExport'
import type { ModelGeneratorRecipe } from '../domain/modelAssetTypes'
import { checkAbort, checkDimensions, MODEL_INPUT_LIMITS, MODEL_QUALITY, ModelGenerationError, type ModelDiagnostic, type ModelQuality } from '../geometry/modelQualityBudget'
import { sanitizeModelSvg } from './svgSanitize'
export type ModelInputMime = 'image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp'
export interface PreparedModelInput {
  svg?: string; pixels?: Uint8Array; width: number; height: number; sourceSnapshot: Blob
  foregroundPreview?: Blob; requiresForegroundConfirmation: boolean; recipe: ModelGeneratorRecipe; warnings: ModelDiagnostic[]
}
export function sniffModelImage(bytes: Uint8Array): { mime: ModelInputMime; width?: number; height?: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length >= 24 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i])) return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) break
      const marker = bytes[offset + 1], length = view.getUint16(offset + 2)
      if ([0xc0, 0xc1, 0xc2].includes(marker)) return { mime: 'image/jpeg', height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
      if (length < 2) break
      offset += length + 2
    }
    throw new ModelGenerationError('input_format', 'JPEG has no supported image frame.')
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const kind = ascii(12, 16)
    if (kind === 'VP8X') return { mime: 'image/webp', width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) }
    if (kind === 'VP8 ') return { mime: 'image/webp', width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    if (kind === 'VP8L') return { mime: 'image/webp', width: 1 + bytes[21] + ((bytes[22] & 63) << 8), height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10) }
    throw new ModelGenerationError('input_format', 'Unsupported WebP frame.')
  }
  let source: string
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new ModelGenerationError('input_format', 'Image bytes are not a supported raster or SVG.') }
  if (/^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(source)) return { mime: 'image/svg+xml' }
  throw new ModelGenerationError('input_format', 'Expected SVG, PNG, JPEG or WebP image bytes.')
}
export function createForegroundMask(pixels: Uint8ClampedArray, recipe: ModelGeneratorRecipe): { pixels: Uint8Array; coverage: number; opaque: boolean } {
  let opaque = true, foreground = 0
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) { opaque = false; break }
  const result = new Uint8Array(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    let inside = recipe.foreground.mode === 'alpha' || recipe.foreground.mode === 'prepared'
      ? alpha > 0 && alpha >= recipe.foreground.threshold * 255
      : alpha > 0 && (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) < recipe.trace.threshold * 255
    if (recipe.foreground.invert) inside = !inside
    if (inside) foreground++
    result[i] = result[i + 1] = result[i + 2] = inside ? 0 : 255; result[i + 3] = 255
  }
  return { pixels: result, coverage: foreground / (pixels.length / 4), opaque }
}
function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new ModelGenerationError('input_decode', 'Could not encode model source PNG.')), 'image/png'))
}
export async function prepareModelInput(blob: Blob, inputRecipe: ModelGeneratorRecipe, quality: ModelQuality, signal?: AbortSignal): Promise<PreparedModelInput> {
  checkAbort(signal)
  if (!blob.size || blob.size > MODEL_INPUT_LIMITS.bytes) throw new ModelGenerationError('input_budget', 'Model source must be nonempty and at most 16 MiB.')
  const bytes = new Uint8Array(await blob.arrayBuffer()), detected = sniffModelImage(bytes)
  if (blob.type && blob.type !== detected.mime && !(blob.type === 'image/jpg' && detected.mime === 'image/jpeg')) throw new ModelGenerationError('input_format', 'Declared image MIME does not match its bytes.')
  if (detected.mime === 'image/svg+xml') {
    const svg = sanitizeModelSvg(new TextDecoder().decode(bytes))
    return { svg, width: 0, height: 0, sourceSnapshot: new Blob([svg], { type: 'image/svg+xml' }), requiresForegroundConfirmation: false, recipe: inputRecipe, warnings: [] }
  }
  checkDimensions(detected.width!, detected.height!)
  const url = URL.createObjectURL(new Blob([bytes], { type: detected.mime }))
  const canvas = document.createElement('canvas'), previewCanvas = document.createElement('canvas')
  try {
    const image = await loadImageElement(url, signal); checkAbort(signal)
    checkDimensions(image.naturalWidth, image.naturalHeight)
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new ModelGenerationError('input_decode', 'Image decoding canvas is unavailable.')
    ctx.drawImage(image, 0, 0)
    const sourceSnapshot = await png(canvas)
    const scale = Math.min(1, MODEL_QUALITY[quality].traceEdge / Math.max(canvas.width, canvas.height))
    previewCanvas.width = Math.max(1, Math.round(canvas.width * scale)); previewCanvas.height = Math.max(1, Math.round(canvas.height * scale))
    const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true })
    if (!previewCtx) throw new ModelGenerationError('input_decode', 'Foreground preview canvas is unavailable.')
    previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height)
    const pixels = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height)
    const opaque = createForegroundMask(pixels.data, inputRecipe).opaque
    const requiresForegroundConfirmation = opaque && inputRecipe.foreground.mode !== 'prepared'
    const recipe = opaque && inputRecipe.foreground.mode === 'alpha' ? { ...inputRecipe, foreground: { ...inputRecipe.foreground, mode: 'luminance' as const } } : inputRecipe
    const mask = createForegroundMask(pixels.data, recipe)
    if (mask.coverage <= 0 || mask.coverage >= 1) throw new ModelGenerationError('empty_foreground', 'Foreground preparation produced an empty or full rectangle; adjust the threshold or use background removal.')
    const previewPixels = previewCtx.createImageData(previewCanvas.width, previewCanvas.height)
    for (let i = 0; i < mask.pixels.length; i += 4) {
      previewPixels.data[i] = previewPixels.data[i + 1] = previewPixels.data[i + 2] = 255
      previewPixels.data[i + 3] = mask.pixels[i] === 0 ? 255 : 0
    }
    previewCtx.putImageData(previewPixels, 0, 0)
    const foregroundPreview = await png(previewCanvas); checkAbort(signal)
    const warnings: ModelDiagnostic[] = []
    if (requiresForegroundConfirmation) warnings.push({ code: 'foreground_confirmation_required', message: 'Review the threshold foreground preview before generating this opaque image.' })
    if (scale < 1) warnings.push({ code: 'trace_downsampled', message: 'Tracing resolution was reduced to the selected quality budget; the source snapshot is preserved.' })
    return { pixels: mask.pixels, width: previewCanvas.width, height: previewCanvas.height, sourceSnapshot, foregroundPreview, requiresForegroundConfirmation, recipe, warnings }
  } finally { URL.revokeObjectURL(url); canvas.width = canvas.height = previewCanvas.width = previewCanvas.height = 0 }
}
