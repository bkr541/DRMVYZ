import type { Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
import { disposeObject } from '../modules/three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { checkAbort } from '../../../../features/models/geometry/modelQualityBudget'
import type { UserModelBinding } from './Cinema2ModelBinding'
import { Cinema2UserModelResolver } from './Cinema2UserModelResolver'
export interface Cinema2UserModelLease { asset: Cinema2ThreeLoadedAsset; release(): void }
interface Entry { holders: number; controller: AbortController; promise: Promise<Cinema2ThreeLoadedAsset>; asset: Cinema2ThreeLoadedAsset | null }
/** No idle private data: the final holder releases CPU references and GPU resources. Every hit reauthorizes. */
export class Cinema2UserModelCache {
  private readonly entries = new Map<string, Entry>()
  constructor(readonly resolver = new Cinema2UserModelResolver()) {}
  async acquire(library: Cinema2ThreeLibrary, binding: Extract<UserModelBinding, { kind: 'user-model' }>, signal: AbortSignal): Promise<Cinema2UserModelLease> {
    const authorized = await this.resolver.authorize(binding, signal); checkAbort(signal)
    const key = `${authorized.userId}:${binding.modelAssetId}:${binding.version}`
    let entry = this.entries.get(key)
    if (!entry) {
      const created: Entry = { holders: 0, controller: new AbortController(), asset: null, promise: Promise.resolve(null as never) }
      created.promise = this.resolver.load(library, authorized, created.controller.signal).then(asset => {
        created.asset = asset
        if (!created.holders) disposeObject(asset.scene)
        return asset
      }).catch(error => { if (this.entries.get(key) === created) this.entries.delete(key); throw error })
      this.entries.set(key, created); entry = created
    }
    const held = entry; held.holders++
    let released = false
    const release = () => { if (released) return; released = true; held.holders--; if (!held.holders) { held.controller.abort(); if (this.entries.get(key) === held) this.entries.delete(key); if (held.asset) disposeObject(held.asset.scene) } }
    try {
      const asset = await new Promise<Cinema2ThreeLoadedAsset>((resolve, reject) => {
        const abort = () => { release(); reject(new DOMException('Model selection cancelled.', 'AbortError')) }
        signal.addEventListener('abort', abort, { once: true })
        held.promise.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
        if (signal.aborted) abort()
      })
      checkAbort(signal); return { asset, release }
    } catch (error) { release(); throw error }
  }
  getSnapshot(): { entryCount: number; heldCount: number } { return { entryCount: this.entries.size, heldCount: [...this.entries.values()].reduce((sum, entry) => sum + entry.holders, 0) } }
}
export const cinema2UserModelCache = new Cinema2UserModelCache()
