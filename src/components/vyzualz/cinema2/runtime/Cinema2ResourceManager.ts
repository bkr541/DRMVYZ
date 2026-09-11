export type Cinema2RenderTargetColorFormat = 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg8'
export type Cinema2RenderTargetDepthFormat = 'none' | 'depth16' | 'depth24'
export type Cinema2RenderTargetFilter = 'linear' | 'nearest'
export type Cinema2RenderTargetWrap = 'clamp' | 'repeat' | 'mirror'
export type Cinema2RenderTargetOwnershipClass = 'transient' | 'persistent'
export type Cinema2RenderTargetSurfaceLayout = 'single' | 'paired'

export type Cinema2RenderTargetSize =
  | Readonly<{ kind: 'viewport'; widthScale?: number; heightScale?: number }>
  | Readonly<{ kind: 'fixed'; width: number; height: number }>

export interface Cinema2RenderTargetDescriptor {
  size: Cinema2RenderTargetSize
  colorFormat: Cinema2RenderTargetColorFormat
  depthFormat?: Cinema2RenderTargetDepthFormat
  filter?: Cinema2RenderTargetFilter
  wrap?: Cinema2RenderTargetWrap
  /** A pair is only a storage primitive. History/ping-pong semantics belong to later render-graph stages. */
  surfaceLayout?: Cinema2RenderTargetSurfaceLayout
}

export interface Cinema2RenderTargetLease {
  readonly leaseId: string
  readonly ownerId: string
  readonly ownershipClass: Cinema2RenderTargetOwnershipClass
  readonly descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>
}

export interface Cinema2RenderTargetBinding {
  readonly framebuffer: WebGLFramebuffer
  readonly colorTexture: WebGLTexture
  readonly depthRenderbuffer: WebGLRenderbuffer | null
  readonly width: number
  readonly height: number
  readonly surfaceIndex: number
}

export interface Cinema2ResourceManagerSnapshot {
  readonly disposed: boolean
  readonly contextAvailable: boolean
  readonly viewport: Readonly<Cinema2ResourceViewport>
  readonly maximumTextureSize: number
  readonly maximumPooledAllocationCount: number
  readonly activeLeaseCount: number
  readonly activeTransientLeaseCount: number
  readonly activePersistentLeaseCount: number
  readonly pooledAllocationCount: number
  readonly activeSurfaceCount: number
  readonly pooledSurfaceCount: number
  readonly createdAllocationCount: number
  readonly reusedAllocationCount: number
  readonly destroyedAllocationCount: number
  readonly reconstructedAllocationCount: number
  readonly estimatedGpuMemoryBytes: number
  readonly activeLeaseCountByOwner: Readonly<Record<string, number>>
}

export interface Cinema2ResourceManagerOptions {
  maximumPooledAllocationCount?: number
  maximumTextureSize?: number
}

export interface Cinema2ResourceViewport {
  width: number
  height: number
  dpr: number
}

interface Cinema2NormalizedRenderTargetDescriptor {
  size: Readonly<
    | { kind: 'viewport'; widthScale: number; heightScale: number }
    | { kind: 'fixed'; width: number; height: number }
  >
  colorFormat: Cinema2RenderTargetColorFormat
  depthFormat: Cinema2RenderTargetDepthFormat
  filter: Cinema2RenderTargetFilter
  wrap: Cinema2RenderTargetWrap
  surfaceLayout: Cinema2RenderTargetSurfaceLayout
}

interface TargetSurface {
  framebuffer: WebGLFramebuffer | null
  colorTexture: WebGLTexture | null
  depthRenderbuffer: WebGLRenderbuffer | null
}

interface TargetRecord {
  lease: Cinema2RenderTargetLease
  key: string
  width: number
  height: number
  surfaces: TargetSurface[]
}

interface PendingReplacement {
  record: TargetRecord
  width: number
  height: number
  key: string
  surfaces: TargetSurface[]
}

const DEFAULT_VIEWPORT: Readonly<Cinema2ResourceViewport> = Object.freeze({ width: 1, height: 1, dpr: 1 })

/**
 * Canonical Cinema 2.0 GPU render-target owner.
 *
 * The manager owns framebuffer/texture/depth lifetimes, pooling and accounting.
 * Render-graph scheduling and temporal meaning intentionally remain outside this
 * service so later stages can compose them without creating another GPU owner.
 */
export class Cinema2ResourceManager {
  private readonly active = new Map<string, TargetRecord>()
  private readonly pooledByKey = new Map<string, TargetRecord[]>()
  private nextLeaseId = 1
  private viewport: Cinema2ResourceViewport = { ...DEFAULT_VIEWPORT }
  private contextAvailable = true
  private disposed = false
  private pooledAllocationCount = 0
  private createdAllocationCount = 0
  private reusedAllocationCount = 0
  private destroyedAllocationCount = 0
  private reconstructedAllocationCount = 0
  private readonly maximumPooledAllocationCount: number
  private readonly maximumTextureSize: number

  constructor(
    private readonly gl: WebGL2RenderingContext,
    options: Cinema2ResourceManagerOptions = {},
  ) {
    this.maximumPooledAllocationCount = positiveInteger(options.maximumPooledAllocationCount, 24)
    this.maximumTextureSize = Math.max(
      1,
      Math.min(
        positiveInteger(options.maximumTextureSize, Number.MAX_SAFE_INTEGER),
        readMaximumTextureSize(gl),
      ),
    )
  }

  acquireRenderTarget(
    ownerId: string,
    descriptor: Cinema2RenderTargetDescriptor,
    ownershipClass: Cinema2RenderTargetOwnershipClass,
  ): Cinema2RenderTargetLease {
    this.assertUsable('acquire a render target')
    const normalizedOwnerId = normalizeOwnerId(ownerId)
    const normalized = normalizeDescriptor(descriptor)
    const size = resolveTargetSize(this.viewport, normalized, this.maximumTextureSize)
    const key = descriptorKey(normalized, size.width, size.height)
    const pooled = this.pooledByKey.get(key)
    const record = pooled?.pop()
    if (pooled?.length === 0) this.pooledByKey.delete(key)

    const lease = createLease(this.nextLeaseId++, normalizedOwnerId, ownershipClass, normalized)
    if (record) {
      this.pooledAllocationCount = Math.max(0, this.pooledAllocationCount - 1)
      this.reusedAllocationCount += 1
      record.lease = lease
      record.key = key
      this.active.set(lease.leaseId, record)
      return lease
    }

    const surfaces = this.createSurfaces(normalized, size.width, size.height)
    const created: TargetRecord = {
      lease,
      key,
      width: size.width,
      height: size.height,
      surfaces,
    }
    this.createdAllocationCount += 1
    this.active.set(lease.leaseId, created)
    return lease
  }

  getRenderTargetBinding(lease: Cinema2RenderTargetLease, surfaceIndex = 0): Readonly<Cinema2RenderTargetBinding> {
    this.assertUsable('resolve a render-target binding')
    const record = this.requireActiveRecord(lease)
    const safeSurfaceIndex = Math.floor(surfaceIndex)
    const surface = Number.isFinite(surfaceIndex) ? record.surfaces[safeSurfaceIndex] : undefined
    if (!surface) {
      throw new Error(`Cinema 2.0 render target "${lease.leaseId}" has no surface at index ${surfaceIndex}.`)
    }
    if (!surface.framebuffer || !surface.colorTexture) {
      throw new Error(`Cinema 2.0 render target "${lease.leaseId}" is not resident in the current WebGL2 context.`)
    }
    return Object.freeze({
      framebuffer: surface.framebuffer,
      colorTexture: surface.colorTexture,
      depthRenderbuffer: surface.depthRenderbuffer,
      width: record.width,
      height: record.height,
      surfaceIndex: safeSurfaceIndex,
    })
  }

  getSurfaceCount(lease: Cinema2RenderTargetLease): number {
    return this.requireActiveRecord(lease).surfaces.length
  }

  release(lease: Cinema2RenderTargetLease): void {
    const record = this.active.get(lease.leaseId)
    if (!record || record.lease !== lease) return
    this.active.delete(lease.leaseId)
    if (this.disposed || !this.contextAvailable || this.pooledAllocationCount >= this.maximumPooledAllocationCount) {
      this.destroyRecord(record, this.contextAvailable && !this.disposed)
      return
    }
    const bucket = this.pooledByKey.get(record.key) ?? []
    bucket.push(record)
    this.pooledByKey.set(record.key, bucket)
    this.pooledAllocationCount += 1
  }

  /** Later frame executors can retire all frame-local targets without touching persistent leases. */
  releaseTransient(ownerId?: string): void {
    const normalizedOwnerId = ownerId == null ? null : normalizeOwnerId(ownerId)
    const leases = [...this.active.values()]
      .filter(record => record.lease.ownershipClass === 'transient' && (normalizedOwnerId == null || record.lease.ownerId === normalizedOwnerId))
      .map(record => record.lease)
    for (const lease of leases) this.release(lease)
  }

  releaseOwner(ownerId: string): void {
    const normalizedOwnerId = normalizeOwnerId(ownerId)
    const leases = [...this.active.values()]
      .filter(record => record.lease.ownerId === normalizedOwnerId)
      .map(record => record.lease)
    for (const lease of leases) this.release(lease)
  }

  resize(viewport: Cinema2ResourceViewport): boolean {
    this.assertNotDisposed()
    const next = normalizeViewport(viewport)
    if (sameViewport(this.viewport, next)) return false
    if (!this.contextAvailable) {
      this.viewport = next
      return true
    }
    const replacements: PendingReplacement[] = []
    try {
      for (const record of this.active.values()) {
        const size = resolveTargetSize(next, record.lease.descriptor, this.maximumTextureSize)
        if (record.width === size.width && record.height === size.height) continue
        replacements.push({
          record,
          width: size.width,
          height: size.height,
          key: descriptorKey(record.lease.descriptor, size.width, size.height),
          surfaces: this.createSurfaces(record.lease.descriptor, size.width, size.height),
        })
      }
    } catch (error) {
      for (const replacement of replacements) this.destroySurfaces(replacement.surfaces, true)
      throw error
    }

    this.viewport = next
    for (const replacement of replacements) {
      const previous = replacement.record.surfaces
      replacement.record.surfaces = replacement.surfaces
      replacement.record.width = replacement.width
      replacement.record.height = replacement.height
      replacement.record.key = replacement.key
      this.destroySurfaces(previous, true)
      this.reconstructedAllocationCount += 1
    }
    this.destroyPooledRecords(true)
    return true
  }

  handleContextLost(): void {
    if (this.disposed || !this.contextAvailable) return
    this.contextAvailable = false
    this.destroyPooledRecords(false)
    for (const record of this.active.values()) this.abandonSurfaces(record.surfaces)
  }

  handleContextRestored(): void {
    this.assertNotDisposed()
    if (this.contextAvailable) return
    this.contextAvailable = true
    const replacements: PendingReplacement[] = []
    try {
      for (const record of this.active.values()) {
        const size = resolveTargetSize(this.viewport, record.lease.descriptor, this.maximumTextureSize)
        replacements.push({
          record,
          width: size.width,
          height: size.height,
          key: descriptorKey(record.lease.descriptor, size.width, size.height),
          surfaces: this.createSurfaces(record.lease.descriptor, size.width, size.height),
        })
      }
    } catch (error) {
      for (const replacement of replacements) this.destroySurfaces(replacement.surfaces, true)
      this.contextAvailable = false
      throw error
    }

    for (const replacement of replacements) {
      replacement.record.surfaces = replacement.surfaces
      replacement.record.width = replacement.width
      replacement.record.height = replacement.height
      replacement.record.key = replacement.key
      this.reconstructedAllocationCount += 1
    }
  }

  getSnapshot(): Readonly<Cinema2ResourceManagerSnapshot> {
    const activeRecords = [...this.active.values()]
    const pooledRecords = [...this.pooledByKey.values()].flat()
    const activeLeaseCountByOwner: Record<string, number> = {}
    let activeTransientLeaseCount = 0
    let activePersistentLeaseCount = 0
    for (const record of activeRecords) {
      activeLeaseCountByOwner[record.lease.ownerId] = (activeLeaseCountByOwner[record.lease.ownerId] ?? 0) + 1
      if (record.lease.ownershipClass === 'transient') activeTransientLeaseCount += 1
      else activePersistentLeaseCount += 1
    }
    const residentRecords = this.contextAvailable ? [...activeRecords, ...pooledRecords] : []
    return Object.freeze({
      disposed: this.disposed,
      contextAvailable: this.contextAvailable,
      viewport: Object.freeze({ ...this.viewport }),
      maximumTextureSize: this.maximumTextureSize,
      maximumPooledAllocationCount: this.maximumPooledAllocationCount,
      activeLeaseCount: activeRecords.length,
      activeTransientLeaseCount,
      activePersistentLeaseCount,
      pooledAllocationCount: this.pooledAllocationCount,
      activeSurfaceCount: activeRecords.reduce((sum, record) => sum + record.surfaces.length, 0),
      pooledSurfaceCount: pooledRecords.reduce((sum, record) => sum + record.surfaces.length, 0),
      createdAllocationCount: this.createdAllocationCount,
      reusedAllocationCount: this.reusedAllocationCount,
      destroyedAllocationCount: this.destroyedAllocationCount,
      reconstructedAllocationCount: this.reconstructedAllocationCount,
      estimatedGpuMemoryBytes: residentRecords.reduce((sum, record) => sum + estimateRecordBytes(record), 0),
      activeLeaseCountByOwner: Object.freeze({ ...activeLeaseCountByOwner }),
    })
  }

  dispose(): void {
    if (this.disposed) return
    const deleteGlResources = this.contextAvailable
    this.disposed = true
    for (const record of this.allRecords()) this.destroyRecord(record, deleteGlResources)
    this.active.clear()
    this.pooledByKey.clear()
    this.pooledAllocationCount = 0
    this.contextAvailable = false
  }

  private createSurfaces(
    descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>,
    width: number,
    height: number,
  ): TargetSurface[] {
    if (!this.contextAvailable) throw new Error('Cinema 2.0 cannot allocate render targets while its WebGL2 context is unavailable.')
    if ((descriptor.colorFormat === 'rgba16f' || descriptor.colorFormat === 'rgba32f') && !supportsFloatColorTargets(this.gl)) {
      throw new Error(`Cinema 2.0 render-target format "${descriptor.colorFormat}" requires EXT_color_buffer_float.`)
    }
    const count = descriptor.surfaceLayout === 'paired' ? 2 : 1
    const surfaces: TargetSurface[] = []
    try {
      for (let index = 0; index < count; index += 1) surfaces.push(this.createSurface(descriptor, width, height))
      return surfaces
    } catch (error) {
      this.destroySurfaces(surfaces, true)
      throw error
    }
  }

  private createSurface(
    descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>,
    width: number,
    height: number,
  ): TargetSurface {
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Cinema 2.0 could not allocate a render-target framebuffer.')
    let colorTexture: WebGLTexture | null = null
    let depthRenderbuffer: WebGLRenderbuffer | null = null
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      colorTexture = gl.createTexture()
      if (!colorTexture) throw new Error('Cinema 2.0 could not allocate a render-target color texture.')
      gl.bindTexture(gl.TEXTURE_2D, colorTexture)
      configureTexture(gl, descriptor.filter, descriptor.wrap)
      allocateColorTexture(gl, descriptor.colorFormat, width, height)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0)

      if (descriptor.depthFormat !== 'none') {
        depthRenderbuffer = gl.createRenderbuffer()
        if (!depthRenderbuffer) throw new Error('Cinema 2.0 could not allocate a render-target depth attachment.')
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer)
        gl.renderbufferStorage(
          gl.RENDERBUFFER,
          descriptor.depthFormat === 'depth16' ? gl.DEPTH_COMPONENT16 : gl.DEPTH_COMPONENT24,
          width,
          height,
        )
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer)
      }

      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Cinema 2.0 render-target framebuffer is incomplete (status ${status}).`)
      }
      return { framebuffer, colorTexture, depthRenderbuffer }
    } catch (error) {
      if (depthRenderbuffer) gl.deleteRenderbuffer(depthRenderbuffer)
      if (colorTexture) gl.deleteTexture(colorTexture)
      gl.deleteFramebuffer(framebuffer)
      throw error
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
  }

  private destroyPooledRecords(deleteGlResources: boolean): void {
    for (const records of this.pooledByKey.values()) {
      for (const record of records) this.destroyRecord(record, deleteGlResources)
    }
    this.pooledByKey.clear()
    this.pooledAllocationCount = 0
  }

  private destroyRecord(record: TargetRecord, deleteGlResources: boolean): void {
    this.destroySurfaces(record.surfaces, deleteGlResources)
    this.destroyedAllocationCount += 1
  }

  private destroySurfaces(surfaces: readonly TargetSurface[], deleteGlResources: boolean): void {
    for (const surface of surfaces) {
      if (deleteGlResources) {
        if (surface.depthRenderbuffer) this.gl.deleteRenderbuffer(surface.depthRenderbuffer)
        if (surface.colorTexture) this.gl.deleteTexture(surface.colorTexture)
        if (surface.framebuffer) this.gl.deleteFramebuffer(surface.framebuffer)
      }
      surface.depthRenderbuffer = null
      surface.colorTexture = null
      surface.framebuffer = null
    }
  }

  private abandonSurfaces(surfaces: readonly TargetSurface[]): void {
    for (const surface of surfaces) {
      surface.depthRenderbuffer = null
      surface.colorTexture = null
      surface.framebuffer = null
    }
  }

  private allRecords(): TargetRecord[] {
    return [...this.active.values(), ...[...this.pooledByKey.values()].flat()]
  }

  private requireActiveRecord(lease: Cinema2RenderTargetLease): TargetRecord {
    const record = this.active.get(lease.leaseId)
    if (!record || record.lease !== lease) {
      throw new Error(`Cinema 2.0 render-target lease "${lease.leaseId}" is not active.`)
    }
    return record
  }

  private assertUsable(operation: string): void {
    this.assertNotDisposed()
    if (!this.contextAvailable) throw new Error(`Cinema 2.0 cannot ${operation} while its WebGL2 context is unavailable.`)
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Cinema 2.0 resource manager is disposed.')
  }
}

function createLease(
  id: number,
  ownerId: string,
  ownershipClass: Cinema2RenderTargetOwnershipClass,
  descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>,
): Cinema2RenderTargetLease {
  return Object.freeze({
    leaseId: `cinema2.runtime.render-target.${id}`,
    ownerId,
    ownershipClass,
    descriptor,
  })
}

function normalizeDescriptor(descriptor: Cinema2RenderTargetDescriptor): Readonly<Cinema2NormalizedRenderTargetDescriptor> {
  if (!descriptor || typeof descriptor !== 'object') throw new Error('Cinema 2.0 render-target descriptor is required.')
  const size = descriptor.size
  if (!size || typeof size !== 'object') throw new Error('Cinema 2.0 render-target descriptor requires a size.')
  const normalizedSize = size.kind === 'fixed'
    ? Object.freeze({
        kind: 'fixed' as const,
        width: positiveInteger(size.width, 1),
        height: positiveInteger(size.height, 1),
      })
    : size.kind === 'viewport'
      ? Object.freeze({
          kind: 'viewport' as const,
          widthScale: finiteScale(size.widthScale),
          heightScale: finiteScale(size.heightScale),
        })
      : null
  if (!normalizedSize) throw new Error(`Cinema 2.0 render-target size kind "${String((size as { kind?: unknown }).kind)}" is unsupported.`)
  if (!isColorFormat(descriptor.colorFormat)) {
    throw new Error(`Cinema 2.0 render-target color format "${String(descriptor.colorFormat)}" is unsupported.`)
  }
  const depthFormat = descriptor.depthFormat ?? 'none'
  if (depthFormat !== 'none' && depthFormat !== 'depth16' && depthFormat !== 'depth24') {
    throw new Error(`Cinema 2.0 render-target depth format "${String(depthFormat)}" is unsupported.`)
  }
  const filter = descriptor.filter ?? 'linear'
  if (filter !== 'linear' && filter !== 'nearest') throw new Error(`Cinema 2.0 render-target filter "${String(filter)}" is unsupported.`)
  const wrap = descriptor.wrap ?? 'clamp'
  if (wrap !== 'clamp' && wrap !== 'repeat' && wrap !== 'mirror') throw new Error(`Cinema 2.0 render-target wrap "${String(wrap)}" is unsupported.`)
  const surfaceLayout = descriptor.surfaceLayout ?? 'single'
  if (surfaceLayout !== 'single' && surfaceLayout !== 'paired') {
    throw new Error(`Cinema 2.0 render-target surface layout "${String(surfaceLayout)}" is unsupported.`)
  }
  return Object.freeze({
    size: normalizedSize,
    colorFormat: descriptor.colorFormat,
    depthFormat,
    filter,
    wrap,
    surfaceLayout,
  })
}

function descriptorKey(
  descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>,
  width: number,
  height: number,
): string {
  return JSON.stringify({
    width,
    height,
    colorFormat: descriptor.colorFormat,
    depthFormat: descriptor.depthFormat,
    filter: descriptor.filter,
    wrap: descriptor.wrap,
    surfaceLayout: descriptor.surfaceLayout,
  })
}

function resolveTargetSize(
  viewport: Readonly<Cinema2ResourceViewport>,
  descriptor: Readonly<Cinema2NormalizedRenderTargetDescriptor>,
  maximumTextureSize: number,
): { width: number; height: number } {
  const rawWidth = descriptor.size.kind === 'fixed' ? descriptor.size.width : viewport.width * descriptor.size.widthScale
  const rawHeight = descriptor.size.kind === 'fixed' ? descriptor.size.height : viewport.height * descriptor.size.heightScale
  return {
    width: Math.min(maximumTextureSize, Math.max(1, Math.round(rawWidth))),
    height: Math.min(maximumTextureSize, Math.max(1, Math.round(rawHeight))),
  }
}

function normalizeViewport(viewport: Cinema2ResourceViewport): Cinema2ResourceViewport {
  return {
    width: positiveInteger(viewport.width, 1),
    height: positiveInteger(viewport.height, 1),
    dpr: finitePositive(viewport.dpr, 1),
  }
}

function sameViewport(left: Readonly<Cinema2ResourceViewport>, right: Readonly<Cinema2ResourceViewport>): boolean {
  return left.width === right.width && left.height === right.height && Math.abs(left.dpr - right.dpr) < 1e-6
}

function normalizeOwnerId(ownerId: string): string {
  const normalized = String(ownerId ?? '').trim()
  if (!normalized) throw new Error('Cinema 2.0 render-target ownerId must be non-empty.')
  return normalized
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.max(1, Math.floor(Number(value))) : fallback
}

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback
}

function finiteScale(value: number | undefined): number {
  return Math.min(4, finitePositive(value, 1))
}

function readMaximumTextureSize(gl: WebGL2RenderingContext): number {
  if (typeof gl.getParameter !== 'function') return 4096
  const value = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 4096
}

function supportsFloatColorTargets(gl: WebGL2RenderingContext): boolean {
  if (typeof gl.getExtension !== 'function') return false
  return gl.getExtension('EXT_color_buffer_float') != null
}

function isColorFormat(value: unknown): value is Cinema2RenderTargetColorFormat {
  return value === 'rgba8' || value === 'rgba16f' || value === 'rgba32f' || value === 'r8' || value === 'rg8'
}

function configureTexture(
  gl: WebGL2RenderingContext,
  filter: Cinema2RenderTargetFilter,
  wrap: Cinema2RenderTargetWrap,
): void {
  const glFilter = filter === 'nearest' ? gl.NEAREST : gl.LINEAR
  const glWrap = wrap === 'repeat' ? gl.REPEAT : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrap)
}

function allocateColorTexture(
  gl: WebGL2RenderingContext,
  format: Cinema2RenderTargetColorFormat,
  width: number,
  height: number,
): void {
  switch (format) {
    case 'rgba8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return
    case 'rgba16f': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null); return
    case 'rgba32f': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null); return
    case 'r8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null); return
    case 'rg8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, null); return
  }
}

function estimateRecordBytes(record: TargetRecord): number {
  const colorBytes = colorBytesPerPixel(record.lease.descriptor.colorFormat)
  const depthBytes = record.lease.descriptor.depthFormat === 'depth16'
    ? 2
    : record.lease.descriptor.depthFormat === 'depth24'
      ? 4
      : 0
  return record.width * record.height * (colorBytes + depthBytes) * record.surfaces.length
}

function colorBytesPerPixel(format: Cinema2RenderTargetColorFormat): number {
  switch (format) {
    case 'rgba32f': return 16
    case 'rgba16f': return 8
    case 'rgba8': return 4
    case 'rg8': return 2
    case 'r8': return 1
  }
}
