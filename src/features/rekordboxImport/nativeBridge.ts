import type { RekordboxLibrary } from './types'
import type { NativeOutputBridge } from '../../native/outputBridge'

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

export interface NativeFileBridge {
  /** Resolve the absolute path backing an Electron File object. */
  getPathForFile?: (file: File) => string | null
}

export interface DrmvyzNativeBridge {
  runtime?: {
    isElectron: boolean
    platform: string
  }
  files?: NativeFileBridge
  rekordbox?: NativeRekordboxBridge
  output?: NativeOutputBridge
}

declare global {
  interface Window {
    drmvyzNative?: DrmvyzNativeBridge
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

export function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && window.drmvyzNative?.runtime?.isElectron === true
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
 * Electron removed the legacy `File.path` augmentation. The preload bridge now
 * resolves the path with `webUtils.getPathForFile`, while the fallback keeps
 * compatibility with older Electron builds and tests.
 */
export function getNativeFilePath(file: File): string | null {
  if (typeof window !== 'undefined') {
    try {
      const bridgedPath = window.drmvyzNative?.files?.getPathForFile?.(file)
      if (typeof bridgedPath === 'string' && bridgedPath.trim().length > 0) {
        return bridgedPath.replace(/\\/g, '/')
      }
    } catch {
      // Continue to the legacy fallback below.
    }
  }

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
