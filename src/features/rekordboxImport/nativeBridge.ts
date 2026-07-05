import type { RekordboxLibrary } from './types'

export interface NativeRekordboxUsbScanResult {
  cancelled: boolean
  library: RekordboxLibrary | null
  warnings: string[]
  detectedPdbFiles: number
  detectedAnlzFiles: number
  scannedRootName?: string
  scannedRootPath?: string
  parserMode?: 'rekordbox-parser' | 'anlz-lite' | 'hybrid' | 'unavailable'
}

export interface NativeRekordboxBridge {
  /** Open a native directory picker and parse the selected Rekordbox USB root. */
  selectUsbRootAndParse?: () => Promise<NativeRekordboxUsbScanResult>
  /** Parse a known absolute USB root path without opening another picker. */
  scanUsbRoot?: (rootPath: string) => Promise<NativeRekordboxUsbScanResult>
}

declare global {
  interface Window {
    drmvyzNative?: {
      rekordbox?: NativeRekordboxBridge
    }
  }
}

export function getNativeRekordboxBridge(): NativeRekordboxBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = window.drmvyzNative?.rekordbox
  return bridge && (bridge.selectUsbRootAndParse || bridge.scanUsbRoot) ? bridge : null
}

export function isNativeRekordboxBridgeAvailable(): boolean {
  return getNativeRekordboxBridge() !== null
}

export async function selectNativeRekordboxUsbRoot(): Promise<NativeRekordboxUsbScanResult | null> {
  const bridge = getNativeRekordboxBridge()
  if (!bridge?.selectUsbRootAndParse) return null
  return bridge.selectUsbRootAndParse()
}

export async function scanNativeRekordboxUsbRoot(rootPath: string): Promise<NativeRekordboxUsbScanResult | null> {
  const bridge = getNativeRekordboxBridge()
  if (!bridge?.scanUsbRoot) return null
  return bridge.scanUsbRoot(rootPath)
}

/**
 * Electron exposes absolute paths for File objects in some runtimes. Browsers do
 * not, so this stays best-effort and never blocks normal local-file loading.
 */
export function getNativeFilePath(file: File): string | null {
  const maybePath = (file as File & { path?: unknown }).path
  return typeof maybePath === 'string' && maybePath.trim().length > 0
    ? maybePath.replace(/\\/g, '/')
    : null
}

export function guessNativeUsbRootFromFile(file: File): string | null {
  const nativePath = getNativeFilePath(file)
  if (!nativePath) return null

  const macVolume = nativePath.match(/^(\/Volumes\/[^/]+)(?:\/|$)/)
  if (macVolume) return macVolume[1] ?? null

  const windowsDrive = nativePath.match(/^([A-Za-z]:\/)(?:.*)$/)
  if (windowsDrive) return windowsDrive[1] ?? null

  const linuxMedia = nativePath.match(/^(\/(?:media|mnt)\/[^/]+(?:\/[^/]+)?)(?:\/|$)/)
  if (linuxMedia) return linuxMedia[1] ?? null

  const runMedia = nativePath.match(/^(\/run\/media\/[^/]+\/[^/]+)(?:\/|$)/)
  if (runMedia) return runMedia[1] ?? null

  return null
}
