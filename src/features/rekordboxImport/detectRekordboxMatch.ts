import type { RekordboxLibrary } from './types'
import { matchFileToRekordboxTrack } from './matchTrack'
import { guessNativeUsbRootFromFile, scanNativeRekordboxUsbRoot } from './nativeBridge'

/** USB root → parsed library (null when the root has no readable Rekordbox data). Share one across a batch of uploads. */
export type RekordboxScanCache = Map<string, Promise<RekordboxLibrary | null>>

/**
 * True when the file lives on a Rekordbox USB whose library has a matching track. Only a yes/no answer is returned;
 * nothing from the library is kept. Needs the desktop app's native bridge to read the USB, so anywhere else (or on
 * any failure) this is false.
 */
export async function fileHasRekordboxMatch(file: File, cache: RekordboxScanCache = new Map()): Promise<boolean> {
  try {
    const root = guessNativeUsbRootFromFile(file)
    if (!root) return false
    let scan = cache.get(root)
    if (!scan) {
      scan = scanNativeRekordboxUsbRoot(root).then(result => (result && !result.cancelled ? result.library : null))
      cache.set(root, scan)
    }
    return matchFileToRekordboxTrack(file, await scan) !== null
  } catch {
    return false
  }
}
