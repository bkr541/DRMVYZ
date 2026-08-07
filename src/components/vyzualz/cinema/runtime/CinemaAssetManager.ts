import {
  createCinemaAssetFallback,
  isCinemaAssetRoleCompatible,
  resolveCinemaAuthoredAssetBindings,
  type CinemaAssetFallbackDescriptor,
  type CinemaExternalAssetSnapshot,
} from '../CinemaAssets'
import type {
  CinemaAssetBindingDefinition,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
} from '../CinemaDomain'
import {
  createCinemaDiagnostic,
  type CinemaDiagnostic,
} from '../CinemaDiagnostics'
import type { CinemaAssetBindingId, CinemaAssetId } from '../CinemaIdentifiers'
import type {
  CinemaAssetRuntimeService,
  CinemaRuntimeAssetView,
  CinemaRuntimeDiagnosticSink,
} from '../CinemaRendererContracts'

interface RuntimeAssetRecord {
  source: Readonly<CinemaExternalAssetSnapshot>
  sourceKey: string
  status: CinemaRuntimeAssetView['status']
  element: HTMLImageElement | HTMLVideoElement | null
  texture: WebGLTexture | null
  ownedObjectUrl: string | null
  promise: Promise<Readonly<CinemaRuntimeAssetView>> | null
  abortController: AbortController
  error: string | null
  width: number | null
  height: number | null
  durationSec: number | null
}

export interface CinemaAssetManagerDependencies {
  fetch: typeof fetch
  createImage: () => HTMLImageElement
  createVideo: () => HTMLVideoElement
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
}

const DEFAULT_DEPENDENCIES: CinemaAssetManagerDependencies = {
  fetch: (...args) => fetch(...args),
  createImage: () => new Image(),
  createVideo: () => document.createElement('video'),
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
}

/**
 * Runtime-only media and texture owner for Cinema asset bindings. Persisted
 * state never enters this registry except as stable binding/asset IDs.
 */
export class CinemaAssetManager implements CinemaAssetRuntimeService {
  private readonly records = new Map<CinemaAssetId, RuntimeAssetRecord>()
  private readonly sources = new Map<CinemaAssetId, Readonly<CinemaExternalAssetSnapshot>>()
  private contextAvailable = true
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly diagnostics: CinemaRuntimeDiagnosticSink,
    private readonly dependencies: CinemaAssetManagerDependencies = DEFAULT_DEPENDENCIES,
  ) {}

  setSources(sources: readonly Readonly<CinemaExternalAssetSnapshot>[]): void {
    this.assertActive()
    const next = new Map<CinemaAssetId, Readonly<CinemaExternalAssetSnapshot>>()
    for (const source of sources) next.set(source.assetId, Object.freeze({ ...source }))

    for (const [assetId, record] of this.records) {
      const source = next.get(assetId)
      if (!source || source.deleted || sourceKey(source) !== record.sourceKey) {
        this.releaseRecord(record, source?.deleted === true ? 'deleted' : 'replaced')
        this.records.delete(assetId)
      }
    }
    this.sources.clear()
    for (const [assetId, source] of next) this.sources.set(assetId, source)
  }

  resolve(binding: Readonly<CinemaAssetBindingDefinition>): Readonly<CinemaRuntimeAssetView> {
    if (this.disposed) return fallbackView(binding, 'unavailable')
    const source = this.sources.get(binding.assetId)
    if (!source || source.deleted) {
      const reason = source?.deleted ? 'deleted' : 'missing'
      this.reportFallback(binding, reason, source ?? null)
      return fallbackView(binding, reason)
    }
    if (!isCinemaAssetRoleCompatible(binding.role, source.mediaKind, source.mimeType)) {
      this.reportFallback(binding, 'incompatible', source)
      return fallbackView(binding, 'incompatible')
    }
    const record = this.records.get(binding.assetId)
    if (!record) {
      void this.prepare(binding)
      return Object.freeze({
        bindingId: binding.id,
        assetId: binding.assetId,
        status: 'loading',
        mediaKind: source.mediaKind,
        mimeType: source.mimeType,
        width: source.width ?? null,
        height: source.height ?? null,
        durationSec: source.durationSec ?? null,
        texture: null,
        mediaElement: null,
        fallback: null,
      })
    }
    return this.view(binding, record)
  }

  async prepare(binding: Readonly<CinemaAssetBindingDefinition>, signal?: AbortSignal): Promise<Readonly<CinemaRuntimeAssetView>> {
    this.assertActive()
    const source = this.sources.get(binding.assetId)
    if (!source || source.deleted) {
      const reason = source?.deleted ? 'deleted' : 'missing'
      this.reportFallback(binding, reason, source ?? null)
      return fallbackView(binding, reason)
    }
    if (!isCinemaAssetRoleCompatible(binding.role, source.mediaKind, source.mimeType)) {
      this.reportFallback(binding, 'incompatible', source)
      return fallbackView(binding, 'incompatible')
    }
    if (!source.runtimeUrl) return fallbackView(binding, 'unavailable')

    let record = this.records.get(binding.assetId)
    const key = sourceKey(source)
    if (record && record.sourceKey !== key) {
      this.releaseRecord(record, 'replaced')
      this.records.delete(binding.assetId)
      record = undefined
    }
    if (record?.status === 'ready') return this.view(binding, record)
    if (record?.promise) {
      const sharedRecord = record
      await awaitWithSignal(sharedRecord.promise, signal)
      return this.isCurrentRecord(sharedRecord)
        ? this.view(binding, sharedRecord)
        : fallbackView(binding, 'unavailable')
    }

    record = {
      source,
      sourceKey: key,
      status: 'loading',
      element: null,
      texture: null,
      ownedObjectUrl: null,
      promise: null,
      abortController: new AbortController(),
      error: null,
      width: source.width ?? null,
      height: source.height ?? null,
      durationSec: source.durationSec ?? null,
    }
    this.records.set(binding.assetId, record)
    record.promise = this.prepareRecord(binding, record)
    const preparingRecord = record
    await awaitWithSignal(preparingRecord.promise, signal)
    return this.isCurrentRecord(preparingRecord)
      ? this.view(binding, preparingRecord)
      : fallbackView(binding, 'unavailable')
  }

  validateAuthoredBindings(
    composition: Readonly<CinemaCompositionDefinition>,
    instance: Readonly<CinemaCompositionInstance> | null,
  ): ReturnType<typeof resolveCinemaAuthoredAssetBindings> {
    const result = resolveCinemaAuthoredAssetBindings({
      composition,
      instance,
      sources: [...this.sources.values()],
    })
    for (const diagnostic of result.diagnostics.diagnostics) this.diagnostics.report(diagnostic)
    return result
  }

  releaseAsset(assetId: CinemaAssetId): void {
    const record = this.records.get(assetId)
    if (!record) return
    this.releaseRecord(record, 'released')
    this.records.delete(assetId)
  }

  handleContextLost(): void {
    if (this.disposed) return
    this.contextAvailable = false
    for (const record of this.records.values()) record.texture = null
  }

  rebuildAfterContextRestore(): void {
    if (this.disposed) return
    this.contextAvailable = true
    for (const record of this.records.values()) {
      if (record.status !== 'ready' || !record.element) continue
      record.texture = this.createTexture(record.element)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.records.values()) this.releaseRecord(record, 'disposed')
    this.records.clear()
    this.sources.clear()
  }

  getDiagnostics(): Readonly<{ sourceCount: number; resourceCount: number; readyCount: number }> {
    let readyCount = 0
    for (const record of this.records.values()) if (record.status === 'ready') readyCount += 1
    return Object.freeze({ sourceCount: this.sources.size, resourceCount: this.records.size, readyCount })
  }

  private async prepareRecord(
    binding: Readonly<CinemaAssetBindingDefinition>,
    record: RuntimeAssetRecord,
  ): Promise<Readonly<CinemaRuntimeAssetView>> {
    const signal = record.abortController.signal
    try {
      if (signal.aborted) throw abortError()
      const sourceUrl = await this.resolveDecodeUrl(record, signal)
      if (signal.aborted || !this.isCurrentRecord(record)) throw abortError()
      const element = record.source.mediaKind === 'video'
        ? await this.decodeVideo(sourceUrl, signal)
        : await this.decodeImage(sourceUrl, signal)
      if (signal.aborted || !this.isCurrentRecord(record)) throw abortError()
      record.element = element
      record.width = record.source.mediaKind === 'video'
        ? (element as HTMLVideoElement).videoWidth || record.width
        : (element as HTMLImageElement).naturalWidth || record.width
      record.height = record.source.mediaKind === 'video'
        ? (element as HTMLVideoElement).videoHeight || record.height
        : (element as HTMLImageElement).naturalHeight || record.height
      record.durationSec = record.source.mediaKind === 'video'
        ? finiteOrNull((element as HTMLVideoElement).duration) ?? record.durationSec
        : record.durationSec
      record.texture = this.contextAvailable ? this.createTexture(element) : null
      record.status = 'ready'
      record.promise = null
      return this.view(binding, record)
    } catch (error) {
      record.promise = null
      if (isAbortError(error) || !this.isCurrentRecord(record)) {
        return fallbackView(binding, 'unavailable')
      }
      record.status = 'error'
      record.error = error instanceof Error ? error.message : String(error)
      this.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_MEDIA_DECODE_FAILED',
        severity: 'warning',
        message: `Cinema could not prepare asset "${binding.assetId}"; a deterministic fallback remains active.`,
        attribution: { assetId: binding.assetId, stage: 'asset-manager' },
        details: { reason: record.error },
      }))
      return this.view(binding, record)
    }
  }

  private async resolveDecodeUrl(record: RuntimeAssetRecord, signal: AbortSignal): Promise<string> {
    const runtimeUrl = record.source.runtimeUrl
    if (!runtimeUrl) throw new Error('Runtime URL unavailable')
    if (runtimeUrl.startsWith('blob:') || runtimeUrl.startsWith('data:')) return runtimeUrl
    if (record.source.mediaKind === 'video' || record.source.mediaKind === 'audio') return runtimeUrl
    const response = await this.dependencies.fetch(runtimeUrl, { signal })
    if (!response.ok) throw new Error(`Asset request failed with ${response.status}`)
    const blob = await response.blob()
    const objectUrl = this.dependencies.createObjectUrl(blob)
    record.ownedObjectUrl = objectUrl
    return objectUrl
  }

  private decodeImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = this.dependencies.createImage()
      const abort = () => { cleanup(); reject(abortError()) }
      const cleanup = () => {
        image.onload = null
        image.onerror = null
        signal?.removeEventListener('abort', abort)
      }
      image.onload = () => { cleanup(); resolve(image) }
      image.onerror = () => { cleanup(); reject(new Error('Image decode failed')) }
      signal?.addEventListener('abort', abort, { once: true })
      image.src = url
    })
  }

  private decodeVideo(url: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = this.dependencies.createVideo()
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      const abort = () => { cleanup(); reject(abortError()) }
      const cleanup = () => {
        video.onloadeddata = null
        video.onerror = null
        signal?.removeEventListener('abort', abort)
      }
      video.onloadeddata = () => { cleanup(); resolve(video) }
      video.onerror = () => { cleanup(); reject(new Error('Video decode failed')) }
      signal?.addEventListener('abort', abort, { once: true })
      video.src = url
      video.load()
    })
  }

  private createTexture(element: HTMLImageElement | HTMLVideoElement): WebGLTexture | null {
    if (!this.contextAvailable) return null
    const texture = this.gl.createTexture()
    if (!texture) return null
    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
      this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, element)
      this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      return texture
    } catch (error) {
      this.gl.deleteTexture(texture)
      throw error
    }
  }

  private isCurrentRecord(record: RuntimeAssetRecord): boolean {
    return !this.disposed
      && this.records.get(record.source.assetId) === record
      && !record.abortController.signal.aborted
  }

  private reportFallback(
    binding: Readonly<CinemaAssetBindingDefinition>,
    reason: CinemaAssetFallbackDescriptor['reason'],
    source: Readonly<CinemaExternalAssetSnapshot> | null,
  ): void {
    const incompatible = reason === 'incompatible'
    this.diagnostics.report(createCinemaDiagnostic({
      code: incompatible ? 'CINEMA_ASSET_CAPABILITY_MISMATCH' : 'CINEMA_ASSET_MISSING',
      severity: 'warning',
      message: incompatible
        ? `Cinema asset "${binding.assetId}" is incompatible with role "${binding.role}"; a deterministic fallback is active.`
        : `Cinema asset "${binding.assetId}" is ${reason}; a deterministic fallback is active.`,
      attribution: { assetId: binding.assetId, stage: 'asset-manager' },
      details: {
        reason,
        role: binding.role,
        mediaKind: source?.mediaKind ?? 'unknown',
        mimeType: source?.mimeType ?? '',
      },
    }))
  }

  private releaseRecord(record: RuntimeAssetRecord, reason: string): void {
    record.abortController.abort()
    record.promise = null
    if (record.texture && this.contextAvailable) {
      try { this.gl.deleteTexture(record.texture) } catch { /* Context teardown continues. */ }
    }
    record.texture = null
    if (typeof HTMLVideoElement !== 'undefined' && record.element instanceof HTMLVideoElement) {
      record.element.pause()
      record.element.removeAttribute('src')
      record.element.load()
    } else if (record.element) {
      record.element.removeAttribute('src')
    }
    record.element = null
    if (record.ownedObjectUrl) {
      this.dependencies.revokeObjectUrl(record.ownedObjectUrl)
      record.ownedObjectUrl = null
    }
    this.diagnostics.report(createCinemaDiagnostic({
      code: 'CINEMA_ASSET_RUNTIME_RELEASED',
      severity: 'info',
      message: `Cinema released runtime resources for asset "${record.source.assetId}".`,
      attribution: { assetId: record.source.assetId, stage: 'asset-manager' },
      details: { reason },
    }))
  }

  private view(
    binding: Readonly<CinemaAssetBindingDefinition>,
    record: RuntimeAssetRecord,
  ): Readonly<CinemaRuntimeAssetView> {
    const fallback = record.status === 'error'
      ? createCinemaAssetFallback(binding.role, 'unavailable')
      : null
    return Object.freeze({
      bindingId: binding.id,
      assetId: binding.assetId,
      status: record.status,
      mediaKind: record.source.mediaKind,
      mimeType: record.source.mimeType,
      width: record.width,
      height: record.height,
      durationSec: record.durationSec,
      texture: record.texture,
      mediaElement: record.element,
      fallback,
      ...(record.error ? { error: record.error } : {}),
    })
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Cinema asset manager is disposed')
  }
}

function fallbackView(
  binding: Readonly<CinemaAssetBindingDefinition>,
  reason: CinemaAssetFallbackDescriptor['reason'],
): Readonly<CinemaRuntimeAssetView> {
  return Object.freeze({
    bindingId: binding.id,
    assetId: binding.assetId,
    status: 'fallback',
    mediaKind: 'unknown',
    mimeType: null,
    width: null,
    height: null,
    durationSec: null,
    texture: null,
    mediaElement: null,
    fallback: createCinemaAssetFallback(binding.role, reason),
  })
}

function sourceKey(source: Readonly<CinemaExternalAssetSnapshot>): string {
  return `${source.assetId}:${String(source.revision)}:${source.runtimeUrl ?? ''}:${source.deleted === true ? 'deleted' : 'active'}`
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null
}


async function awaitWithSignal<Value>(promise: Promise<Value>, signal?: AbortSignal): Promise<Value> {
  if (!signal) return promise
  if (signal.aborted) throw abortError()
  return new Promise<Value>((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError()) }
    const cleanup = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(
      value => { cleanup(); resolve(value) },
      error => { cleanup(); reject(error) },
    )
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function abortError(): Error {
  const error = new Error('Cinema asset preparation aborted')
  error.name = 'AbortError'
  return error
}
