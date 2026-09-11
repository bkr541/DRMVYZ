import type {
  Cinema2MediaKind,
  Cinema2MediaSlotId,
  Cinema2MediaSlotManifest,
} from '../contracts/Cinema2NativePresetManifest'

export type Cinema2MediaSlotStatus = 'empty' | 'missing-required' | 'loading' | 'ready' | 'error'
export type Cinema2MediaFit = 'contain' | 'cover' | 'fill'

export interface Cinema2MediaPresentation {
  fit: Cinema2MediaFit
  position: readonly [number, number]
  scale: readonly [number, number]
  rotation: number
  opacity: number
}

export interface Cinema2MediaSource {
  id: string
  revision?: string | number
  label: string
  kind: Cinema2MediaKind
  url: string
  mimeType?: string | null
  width?: number
  height?: number
  durationSec?: number
}

export interface Cinema2MediaPlaybackSnapshot {
  currentTimeSec: number
  durationSec: number | null
  paused: boolean
  loop: boolean
  muted: boolean
}

export interface Cinema2ManagedMediaResource {
  slotId: Cinema2MediaSlotId
  source: Readonly<Cinema2MediaSource>
  texture: WebGLTexture
  width: number
  height: number
  presentation: Readonly<Cinema2MediaPresentation>
  playback: Readonly<Cinema2MediaPlaybackSnapshot> | null
}

export interface Cinema2MediaSlotSnapshot {
  id: Cinema2MediaSlotId
  label: string
  accepts: readonly Cinema2MediaKind[]
  required: boolean
  status: Cinema2MediaSlotStatus
  source: Readonly<Cinema2MediaSource> | null
  presentation: Readonly<Cinema2MediaPresentation>
  error: string | null
  readyWidth: number | null
  readyHeight: number | null
  playback: Readonly<Cinema2MediaPlaybackSnapshot> | null
}

export interface Cinema2MediaSlotRuntimeSnapshot {
  slotCount: number
  readyResourceCount: number
  loadingCount: number
  errorCount: number
  missingRequiredCount: number
  slots: readonly Readonly<Cinema2MediaSlotSnapshot>[]
}

export interface Cinema2LoadedMedia {
  pixelSource: TexImageSource
  width: number
  height: number
  dynamic: boolean
  getPlaybackSnapshot?: () => Cinema2MediaPlaybackSnapshot | null
  canUploadFrame?: () => boolean
  dispose(): void
}

export interface Cinema2MediaLoader {
  load(source: Readonly<Cinema2MediaSource>, signal: AbortSignal): Promise<Cinema2LoadedMedia>
}

interface SlotRecord {
  manifest: Readonly<Cinema2MediaSlotManifest>
  status: Cinema2MediaSlotStatus
  source: Readonly<Cinema2MediaSource> | null
  presentation: Readonly<Cinema2MediaPresentation>
  error: string | null
  texture: WebGLTexture | null
  loaded: Cinema2LoadedMedia | null
  abortController: AbortController | null
  generation: number
}

const DEFAULT_PRESENTATION: Readonly<Cinema2MediaPresentation> = Object.freeze({
  fit: 'contain',
  position: Object.freeze([0.5, 0.5] as const),
  scale: Object.freeze([1, 1] as const),
  rotation: 0,
  opacity: 1,
})

/** Canonical Cinema 2.0 owner for media loading, GPU texture lifetime and slot state. */
export class Cinema2MediaSlotRuntime {
  private readonly records = new Map<Cinema2MediaSlotId, SlotRecord>()
  private readonly listeners = new Set<() => void>()
  private snapshotCache: Readonly<Cinema2MediaSlotRuntimeSnapshot> | null = null
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    slots: readonly Readonly<Cinema2MediaSlotManifest>[],
    private readonly loader: Cinema2MediaLoader = browserCinema2MediaLoader,
  ) {
    for (const slot of slots) {
      this.records.set(slot.id, {
        manifest: slot,
        status: slot.required ? 'missing-required' : 'empty',
        source: null,
        presentation: DEFAULT_PRESENTATION,
        error: null,
        texture: null,
        loaded: null,
        abortController: null,
        generation: 0,
      })
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): Readonly<Cinema2MediaSlotRuntimeSnapshot> => {
    if (this.snapshotCache) return this.snapshotCache
    const slots = [...this.records.values()].map(record => freezeSlotSnapshot(record))
    this.snapshotCache = Object.freeze({
      slotCount: slots.length,
      readyResourceCount: slots.filter(slot => slot.status === 'ready').length,
      loadingCount: slots.filter(slot => slot.status === 'loading').length,
      errorCount: slots.filter(slot => slot.status === 'error').length,
      missingRequiredCount: slots.filter(slot => slot.status === 'missing-required').length,
      slots: Object.freeze(slots),
    })
    return this.snapshotCache
  }

  getSlotSnapshot(slotId: Cinema2MediaSlotId): Readonly<Cinema2MediaSlotSnapshot> | null {
    const record = this.records.get(slotId)
    return record ? freezeSlotSnapshot(record) : null
  }

  getManagedResource(slotId: Cinema2MediaSlotId): Readonly<Cinema2ManagedMediaResource> | null {
    const record = this.records.get(slotId)
    if (!record || record.status !== 'ready' || !record.source || !record.loaded || !record.texture) return null
    return Object.freeze({
      slotId,
      source: record.source,
      texture: record.texture,
      width: record.loaded.width,
      height: record.loaded.height,
      presentation: record.presentation,
      playback: freezePlayback(record.loaded.getPlaybackSnapshot?.() ?? null),
    })
  }

  async replace(
    slotId: Cinema2MediaSlotId,
    source: Readonly<Cinema2MediaSource>,
    presentation: Partial<Cinema2MediaPresentation> = {},
  ): Promise<Readonly<Cinema2MediaSlotSnapshot>> {
    const record = this.requireRecord(slotId)
    if (this.disposed) throw new Error('Cinema 2.0 media-slot runtime is disposed.')
    if (!record.manifest.accepts.includes(source.kind)) {
      throw new Error(`Cinema 2.0 media slot "${record.manifest.label}" does not accept ${source.kind} media.`)
    }
    if (!source.id.trim() || !source.url.trim()) {
      throw new Error(`Cinema 2.0 media slot "${record.manifest.label}" requires a media source ID and runtime URL.`)
    }

    this.releaseRecordResources(record, false)
    record.generation += 1
    const generation = record.generation
    const abortController = new AbortController()
    record.abortController = abortController
    record.source = freezeSource(source)
    record.presentation = normalizePresentation(presentation)
    record.status = 'loading'
    record.error = null
    this.emit()

    try {
      const loaded = await this.loader.load(record.source, abortController.signal)
      if (this.disposed || record.generation !== generation || abortController.signal.aborted) {
        loaded.dispose()
        return freezeSlotSnapshot(record)
      }
      record.loaded = loaded
      record.texture = this.createTexture(loaded.pixelSource)
      record.abortController = null
      record.status = 'ready'
      record.error = null
      this.emit()
    } catch (error) {
      if (record.generation === generation && !this.disposed && !abortController.signal.aborted) {
        record.abortController = null
        this.releaseTexture(record)
        if (record.loaded) {
          record.loaded.dispose()
          record.loaded = null
        }
        record.status = 'error'
        record.error = errorMessage(error)
        this.emit()
      }
    }

    return freezeSlotSnapshot(record)
  }

  remove(slotId: Cinema2MediaSlotId): Readonly<Cinema2MediaSlotSnapshot> {
    const record = this.requireRecord(slotId)
    if (this.disposed) return freezeSlotSnapshot(record)
    record.generation += 1
    this.releaseRecordResources(record, true)
    record.status = record.manifest.required ? 'missing-required' : 'empty'
    record.error = null
    this.emit()
    return freezeSlotSnapshot(record)
  }

  /** Uploads current video frames while retaining engine ownership of the texture. */
  updateVideoTextures(): void {
    if (this.disposed) return
    for (const record of this.records.values()) {
      if (record.status !== 'ready' || record.source?.kind !== 'video' || !record.loaded || !record.texture) continue
      if (record.loaded.canUploadFrame && !record.loaded.canUploadFrame()) continue
      try {
        this.uploadTexture(record.texture, record.loaded.pixelSource)
      } catch (error) {
        record.status = 'error'
        record.error = `Video texture update failed: ${errorMessage(error)}`
        this.releaseTexture(record)
        this.emit()
      }
    }
  }

  handleContextLost(): void {
    if (this.disposed) return
    let changed = false
    for (const record of this.records.values()) {
      if (!record.texture) continue
      this.releaseTexture(record)
      if (record.loaded) record.status = 'loading'
      changed = true
    }
    if (changed) this.emit()
  }

  handleContextRestored(): void {
    if (this.disposed) return
    let changed = false
    for (const record of this.records.values()) {
      if (!record.loaded || !record.source) continue
      try {
        record.texture = this.createTexture(record.loaded.pixelSource)
        record.status = 'ready'
        record.error = null
      } catch (error) {
        record.status = 'error'
        record.error = `Media texture restore failed: ${errorMessage(error)}`
      }
      changed = true
    }
    if (changed) this.emit()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.records.values()) {
      record.generation += 1
      this.releaseRecordResources(record, true)
    }
    this.listeners.clear()
  }

  private requireRecord(slotId: Cinema2MediaSlotId): SlotRecord {
    const record = this.records.get(slotId)
    if (!record) throw new Error(`Unknown Cinema 2.0 media slot "${slotId}".`)
    return record
  }

  private releaseRecordResources(record: SlotRecord, clearSource: boolean): void {
    record.abortController?.abort()
    record.abortController = null
    this.releaseTexture(record)
    if (record.loaded) {
      try {
        record.loaded.dispose()
      } finally {
        record.loaded = null
      }
    }
    if (clearSource) {
      record.source = null
      record.presentation = DEFAULT_PRESENTATION
    }
  }

  private releaseTexture(record: SlotRecord): void {
    if (!record.texture) return
    this.gl.deleteTexture(record.texture)
    record.texture = null
  }

  private createTexture(pixelSource: TexImageSource): WebGLTexture {
    const texture = this.gl.createTexture()
    if (!texture) throw new Error('WebGL2 could not allocate a Cinema 2.0 media texture.')
    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
      this.uploadTexture(texture, pixelSource)
      return texture
    } catch (error) {
      this.gl.deleteTexture(texture)
      throw error
    }
  }

  private uploadTexture(texture: WebGLTexture, pixelSource: TexImageSource): void {
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0)
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixelSource)
  }

  private emit(): void {
    this.snapshotCache = null
    for (const listener of [...this.listeners]) listener()
  }
}

function freezeSlotSnapshot(record: SlotRecord): Readonly<Cinema2MediaSlotSnapshot> {
  return Object.freeze({
    id: record.manifest.id,
    label: record.manifest.label,
    accepts: Object.freeze([...record.manifest.accepts]),
    required: record.manifest.required === true,
    status: record.status,
    source: record.source,
    presentation: record.presentation,
    error: record.error,
    readyWidth: record.status === 'ready' && record.loaded ? record.loaded.width : null,
    readyHeight: record.status === 'ready' && record.loaded ? record.loaded.height : null,
    playback: record.status === 'ready' && record.loaded ? freezePlayback(record.loaded.getPlaybackSnapshot?.() ?? null) : null,
  })
}

function freezeSource(source: Readonly<Cinema2MediaSource>): Readonly<Cinema2MediaSource> {
  return Object.freeze({ ...source })
}

function freezePlayback(value: Cinema2MediaPlaybackSnapshot | null): Readonly<Cinema2MediaPlaybackSnapshot> | null {
  return value ? Object.freeze({ ...value }) : null
}

function normalizePresentation(value: Partial<Cinema2MediaPresentation>): Readonly<Cinema2MediaPresentation> {
  const position = value.position ?? DEFAULT_PRESENTATION.position
  const scale = value.scale ?? DEFAULT_PRESENTATION.scale
  return Object.freeze({
    fit: value.fit === 'cover' || value.fit === 'fill' ? value.fit : 'contain',
    position: Object.freeze([finiteOr(position[0], 0.5), finiteOr(position[1], 0.5)] as const),
    scale: Object.freeze([finiteOr(scale[0], 1), finiteOr(scale[1], 1)] as const),
    rotation: finiteOr(value.rotation, 0),
    opacity: Math.min(1, Math.max(0, finiteOr(value.opacity, 1))),
  })
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function abortError(): DOMException {
  return new DOMException('Cinema 2.0 media loading was cancelled.', 'AbortError')
}

const browserCinema2MediaLoader: Cinema2MediaLoader = Object.freeze({
  async load(source: Readonly<Cinema2MediaSource>, signal: AbortSignal) {
    if (signal.aborted) throw abortError()
    return source.kind === 'video' ? loadBrowserVideo(source, signal) : loadBrowserImage(source, signal)
  },
})

function loadBrowserImage(source: Readonly<Cinema2MediaSource>, signal: AbortSignal): Promise<Cinema2LoadedMedia> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    let settled = false
    const cleanup = () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    const fail = (error: Error | DOMException) => {
      if (settled) return
      settled = true
      cleanup()
      image.src = ''
      reject(error)
    }
    const onAbort = () => fail(abortError())
    const onError = () => fail(new Error(`Failed to load Cinema 2.0 ${source.kind} media "${source.label}".`))
    const onLoad = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve({
        pixelSource: image,
        width: image.naturalWidth || source.width || 1,
        height: image.naturalHeight || source.height || 1,
        dynamic: false,
        dispose: () => { image.src = '' },
      })
    }
    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
    image.src = source.url
  })
}

function loadBrowserVideo(source: Readonly<Cinema2MediaSource>, signal: AbortSignal): Promise<Cinema2LoadedMedia> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.loop = true
    video.playsInline = true
    let settled = false
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    const retireVideo = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    const fail = (error: Error | DOMException) => {
      if (settled) return
      settled = true
      cleanup()
      retireVideo()
      reject(error)
    }
    const onAbort = () => fail(abortError())
    const onError = () => fail(new Error(`Failed to load Cinema 2.0 video media "${source.label}".`))
    const onLoaded = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve({
        pixelSource: video,
        width: video.videoWidth || source.width || 1,
        height: video.videoHeight || source.height || 1,
        dynamic: true,
        canUploadFrame: () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        getPlaybackSnapshot: () => ({
          currentTimeSec: Number.isFinite(video.currentTime) ? Math.max(0, video.currentTime) : 0,
          durationSec: Number.isFinite(video.duration) ? Math.max(0, video.duration) : source.durationSec ?? null,
          paused: video.paused,
          loop: video.loop,
          muted: video.muted,
        }),
        dispose: retireVideo,
      })
    }
    video.addEventListener('loadeddata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
    video.src = source.url
    video.load()
  })
}
