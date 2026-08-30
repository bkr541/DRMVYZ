import type { CanvasMediaItem } from './ReactTypes'
import { hasTransparentCanvasPixels } from './canvasMediaTransparency'
import {
  getCanvasLayerSlotState,
  type CanvasLayerSlotState,
} from './canvasPerformance/CanvasAuthoringState'

type CanvasLayerAdmissionMedia = Pick<
  CanvasMediaItem,
  'id' | 'name' | 'type' | 'objectUrl' | 'mimeType' | 'mediaRevision'
>

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const ALPHA_SCAN_TILE_SIZE = 256
const ALPHA_SCAN_YIELD_INTERVAL = 16
const transparencyResults = new Map<string, boolean>()
const transparencyChecks = new Map<string, Promise<boolean | null>>()

export interface CanvasLayerAdmissionDecision {
  eligible: boolean
  verifiedTransparentPng: boolean | null
  occupiedSlots: number
  requiredSlots: number
  hasCapacity: boolean
}

function canvasLayerAdmissionCacheKey(item: CanvasLayerAdmissionMedia): string {
  return Number.isFinite(item.mediaRevision)
    ? `${item.id}\u0000revision:${item.mediaRevision}`
    : `${item.id}\u0000url:${item.objectUrl}`
}

function hasPngExtension(value: string): boolean {
  return /\.png(?:$|[?#])/i.test(value.trim())
}

export function isCanvasPngLayerCandidate(
  item: CanvasLayerAdmissionMedia | null | undefined,
): item is CanvasLayerAdmissionMedia {
  if (!item || item.type !== 'image') return false
  const mimeType = item.mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (mimeType) return mimeType === 'image/png'
  return hasPngExtension(item.name) || hasPngExtension(item.objectUrl)
}

export function hasCanvasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length
    && PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

export function getCanvasLayerAdmissionDecision({
  candidate,
  verifiedTransparentPng,
  authoredLayers,
  renderMode,
  activeCanvasMediaId,
}: Omit<CanvasLayerSlotState, 'candidateMediaId'> & {
  candidate: CanvasLayerAdmissionMedia | null | undefined
  verifiedTransparentPng: boolean | null
}): CanvasLayerAdmissionDecision {
  const slotState = getCanvasLayerSlotState({
    authoredLayers,
    renderMode,
    activeCanvasMediaId,
    candidateMediaId: candidate?.id ?? null,
  })
  return {
    eligible: isCanvasPngLayerCandidate(candidate)
      && verifiedTransparentPng === true
      && slotState.hasCapacity,
    verifiedTransparentPng,
    occupiedSlots: slotState.occupiedSlots,
    requiredSlots: slotState.requiredSlots,
    hasCapacity: slotState.hasCapacity,
  }
}

export function getCanvasTransparentPngVerification(
  item: CanvasLayerAdmissionMedia | null | undefined,
): boolean | null {
  if (!isCanvasPngLayerCandidate(item)) return false
  const key = canvasLayerAdmissionCacheKey(item)
  return transparencyResults.has(key) ? transparencyResults.get(key)! : null
}

function yieldCanvasAlphaScan(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

async function decodeCanvasLayerImage(blob: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
} | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Fall through.
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('CANVAS PNG decode failed'))
      image.src = objectUrl
    })
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) {
      URL.revokeObjectURL(objectUrl)
      return null
    }
    return {
      source: image,
      width,
      height,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}

async function canvasImageHasTransparentPixel(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<boolean | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(ALPHA_SCAN_TILE_SIZE, sourceWidth)
  canvas.height = Math.min(ALPHA_SCAN_TILE_SIZE, sourceHeight)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) return null

  let scannedTiles = 0
  try {
    for (let y = 0; y < sourceHeight; y += ALPHA_SCAN_TILE_SIZE) {
      const height = Math.min(ALPHA_SCAN_TILE_SIZE, sourceHeight - y)
      for (let x = 0; x < sourceWidth; x += ALPHA_SCAN_TILE_SIZE) {
        const width = Math.min(ALPHA_SCAN_TILE_SIZE, sourceWidth - x)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(source, x, y, width, height, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data
        if (hasTransparentCanvasPixels(pixels)) return true
        scannedTiles += 1
        if (scannedTiles % ALPHA_SCAN_YIELD_INTERVAL === 0) await yieldCanvasAlphaScan()
      }
    }
    return false
  } catch {
    return null
  }
}

async function verifyCanvasTransparentPng(item: CanvasLayerAdmissionMedia): Promise<boolean | null> {
  if (!isCanvasPngLayerCandidate(item)) return false
  if (typeof fetch !== 'function') return null

  try {
    const response = await fetch(item.objectUrl, { cache: 'no-store' })
    if (!response.ok) return null
    const blob = await response.blob()
    const signature = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer())
    if (!hasCanvasPngSignature(signature)) return false

    const decoded = await decodeCanvasLayerImage(blob)
    if (!decoded) return null
    try {
      return await canvasImageHasTransparentPixel(decoded.source, decoded.width, decoded.height)
    } finally {
      decoded.dispose()
    }
  } catch {
    return null
  }
}

export function ensureCanvasTransparentPngVerification(item: CanvasLayerAdmissionMedia): Promise<boolean | null> {
  if (!isCanvasPngLayerCandidate(item)) return Promise.resolve(false)
  const key = canvasLayerAdmissionCacheKey(item)
  const cached = transparencyResults.get(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const pending = transparencyChecks.get(key)
  if (pending) return pending

  const check = verifyCanvasTransparentPng(item)
    .then(result => {
      if (result !== null) transparencyResults.set(key, result)
      return result
    })
    .catch(() => null)
    .finally(() => transparencyChecks.delete(key))
  transparencyChecks.set(key, check)
  return check
}

export function setCanvasTransparentPngVerificationForTests(
  item: CanvasLayerAdmissionMedia,
  verified: boolean,
): void {
  transparencyResults.set(canvasLayerAdmissionCacheKey(item), verified)
}

export function clearCanvasLayerAdmissionCacheForTests(): void {
  transparencyResults.clear()
  transparencyChecks.clear()
}
