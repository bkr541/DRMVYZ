import type { CinemaNodeId, CinemaStableId } from '../CinemaIdentifiers'
import type { CinemaColor } from '../CinemaDomain'
import type {
  CinemaOutputDescriptor,
  CinemaRenderTargetLease,
  CinemaRenderTargetService,
  CinemaRuntimeDiagnosticSink,
  CinemaTargetDescriptor,
  CinemaTargetFormat,
  CinemaTargetLifetime,
  CinemaTextureFilter,
  CinemaTextureView,
  CinemaTextureWrap,
  CinemaViewport,
} from '../CinemaRendererContracts'
import { createCinemaDiagnostic } from '../CinemaDiagnostics'
import { CinemaTextureManager } from './CinemaTextureManager'

interface TargetAttachment {
  framebuffer: WebGLFramebuffer | null
  colorTexture: WebGLTexture | null
  maskTexture: WebGLTexture | null
  depthRenderbuffer: WebGLRenderbuffer | null
  textureView: CinemaTextureView
  maskTextureView: CinemaTextureView | null
}

interface TargetRecord {
  lease: CinemaRenderTargetLease
  key: string
  width: number
  height: number
  attachments: TargetAttachment[]
  readIndex: number
  leased: boolean
}

export interface CinemaRenderTargetPoolOptions {
  maximumPooledAllocationCount?: number
}

export interface CinemaRenderTargetPoolDiagnostics {
  createdAllocationCount: number
  reusedAllocationCount: number
  destroyedAllocationCount: number
  activeLeaseCount: number
  pooledAllocationCount: number
  maximumPooledAllocationCount: number
  maximumTextureSize: number
  totalAllocationCount: number
  estimatedAllocationMemoryMb: number
  activeLeaseCountByOwner: Readonly<Record<string, number>>
  viewport: CinemaViewport
}

/** Descriptor-aware WebGL2 framebuffer pool owned exclusively by CinemaRuntime. */
export class CinemaRenderTargetPool implements CinemaRenderTargetService {
  private nextLeaseId = 1
  private viewport: CinemaViewport
  private readonly active = new Map<string, TargetRecord>()
  private readonly pooledByKey = new Map<string, TargetRecord[]>()
  private createdAllocationCount = 0
  private reusedAllocationCount = 0
  private destroyedAllocationCount = 0
  private pooledAllocationCount = 0
  private readonly maximumPooledAllocationCount: number
  private readonly maximumTextureSize: number
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly textures: CinemaTextureManager,
    viewport: CinemaViewport,
    private readonly diagnostics: CinemaRuntimeDiagnosticSink,
    options: CinemaRenderTargetPoolOptions = {},
  ) {
    this.viewport = normalizeViewport(viewport)
    this.maximumPooledAllocationCount = positiveInteger(options.maximumPooledAllocationCount, 24)
    this.maximumTextureSize = positiveInteger(Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)), 4096)
  }

  acquire(
    ownerNodeId: CinemaNodeId,
    descriptor: CinemaTargetDescriptor,
    lifetime: CinemaTargetLifetime,
  ): CinemaRenderTargetLease {
    this.assertActive()
    const normalized = normalizeDescriptor(descriptor)
    const { width, height } = resolveTargetSize(this.viewport, normalized, this.maximumTextureSize)
    const key = descriptorKey(normalized, lifetime, width, height)
    const pooled = this.pooledByKey.get(key)
    const record = pooled?.pop()

    if (pooled?.length === 0) this.pooledByKey.delete(key)

    if (record) {
      this.pooledAllocationCount = Math.max(0, this.pooledAllocationCount - 1)
      this.reusedAllocationCount += 1
      record.leased = true
      const lease = createLease(this.nextLeaseId++, ownerNodeId, normalized, lifetime)
      record.lease = lease
      for (const attachment of record.attachments) {
        attachment.textureView = this.textures.createRuntimeView({
          ownerNodeId,
          descriptor: outputDescriptor(normalized),
          width,
          height,
          texture: attachment.colorTexture,
          existingView: attachment.textureView,
        })
        attachment.maskTextureView = attachment.maskTexture
          ? this.textures.createRuntimeView({
              ownerNodeId,
              descriptor: maskOutputDescriptor(normalized),
              width,
              height,
              texture: attachment.maskTexture,
              ...(attachment.maskTextureView ? { existingView: attachment.maskTextureView } : {}),
            })
          : null
      }
      record.readIndex = 0
      this.active.set(lease.leaseId, record)
      return lease
    }

    const lease = createLease(this.nextLeaseId++, ownerNodeId, normalized, lifetime)
    const created: TargetRecord = {
      lease,
      key,
      width,
      height,
      attachments: this.createAttachments(ownerNodeId, normalized, width, height, lifetime === 'ping-pong-node' ? 2 : 1),
      readIndex: 0,
      leased: true,
    }
    this.createdAllocationCount += 1
    this.active.set(lease.leaseId, created)
    return lease
  }

  getReadTexture(lease: CinemaRenderTargetLease): CinemaTextureView | null {
    const record = this.requireActiveRecord(lease)
    return record.attachments[record.readIndex]?.textureView ?? null
  }

  getReadMaskTexture(lease: CinemaRenderTargetLease): CinemaTextureView | null {
    const record = this.requireActiveRecord(lease)
    return record.attachments[record.readIndex]?.maskTextureView ?? null
  }

  swapPingPong(lease: CinemaRenderTargetLease): void {
    const record = this.requireActiveRecord(lease)
    if (record.attachments.length !== 2) return
    record.readIndex = record.readIndex === 0 ? 1 : 0
  }

  clear(lease: CinemaRenderTargetLease): void {
    const record = this.requireActiveRecord(lease)
    const attachment = record.attachments[record.readIndex]
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, attachment.framebuffer)
    this.gl.viewport(0, 0, record.width, record.height)
    const color = normalizeClearColor(record.lease.descriptor.clearColor)
    this.gl.clearColor(color[0], color[1], color[2], color[3])
    let bits = isDepthFormat(record.lease.descriptor.colorFormat) ? 0 : this.gl.COLOR_BUFFER_BIT
    if (record.lease.descriptor.hasDepth || isDepthFormat(record.lease.descriptor.colorFormat)) {
      this.gl.clearDepth(1)
      bits |= this.gl.DEPTH_BUFFER_BIT
    }
    this.gl.clear(bits)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  /** Runtime-internal draw binding used by the Cinema-owned WebGL service. */
  bindDrawTarget(lease: CinemaRenderTargetLease): Readonly<{ framebuffer: WebGLFramebuffer | null; texture: WebGLTexture | null; width: number; height: number }> {
    const record = this.requireActiveRecord(lease)
    const attachment = record.attachments[record.readIndex]
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, attachment.framebuffer)
    this.gl.viewport(0, 0, record.width, record.height)
    return { framebuffer: attachment.framebuffer, texture: attachment.colorTexture, width: record.width, height: record.height }
  }

  release(lease: CinemaRenderTargetLease): void {
    const record = this.active.get(lease.leaseId)
    if (!record || record.lease !== lease) return
    this.active.delete(lease.leaseId)
    record.leased = false
    record.readIndex = 0
    for (const attachment of record.attachments) {
      this.textures.unpublishRuntimeView(attachment.textureView)
      if (attachment.maskTextureView) this.textures.unpublishRuntimeView(attachment.maskTextureView)
    }
    if (this.pooledAllocationCount >= this.maximumPooledAllocationCount) {
      this.destroyRecord(record, true)
      return
    }
    const bucket = this.pooledByKey.get(record.key) ?? []
    bucket.push(record)
    this.pooledByKey.set(record.key, bucket)
    this.pooledAllocationCount += 1
  }

  resize(viewport: CinemaViewport): void {
    this.assertActive()
    const next = normalizeViewport(viewport)
    if (sameViewport(this.viewport, next)) return
    this.viewport = next

    for (const record of this.active.values()) {
      const size = resolveTargetSize(next, record.lease.descriptor, this.maximumTextureSize)
      if (record.width === size.width && record.height === size.height) continue
      this.replaceRecordAttachments(record, size.width, size.height)
      record.key = descriptorKey(record.lease.descriptor, record.lease.lifetime, size.width, size.height)
    }

    for (const records of this.pooledByKey.values()) {
      for (const record of records) this.destroyRecord(record, true)
    }
    this.pooledByKey.clear()
    this.pooledAllocationCount = 0
  }

  abandonContext(): void {
    this.textures.abandonContext()
    for (const record of this.allRecords()) {
      for (const attachment of record.attachments) {
        attachment.framebuffer = null
        attachment.colorTexture = null
        attachment.maskTexture = null
        attachment.depthRenderbuffer = null
      }
    }
  }

  rebuildAfterContextRestore(): void {
    this.assertActive()
    for (const records of this.pooledByKey.values()) {
      for (const record of records) this.destroyRecord(record, false)
    }
    this.pooledByKey.clear()
    this.pooledAllocationCount = 0

    for (const record of this.active.values()) {
      const size = resolveTargetSize(this.viewport, record.lease.descriptor, this.maximumTextureSize)
      const previous = record.attachments
      record.attachments = this.createAttachments(
        record.lease.ownerNodeId,
        record.lease.descriptor,
        size.width,
        size.height,
        record.lease.lifetime === 'ping-pong-node' ? 2 : 1,
      )
      for (const attachment of previous) this.destroyAttachment(attachment, false)
      record.width = size.width
      record.height = size.height
      record.readIndex = 0
      record.key = descriptorKey(record.lease.descriptor, record.lease.lifetime, size.width, size.height)
      this.createdAllocationCount += 1
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.allRecords()) this.destroyRecord(record, true)
    this.active.clear()
    this.pooledByKey.clear()
    this.pooledAllocationCount = 0
  }

  getDiagnostics(): CinemaRenderTargetPoolDiagnostics {
    const records = this.allRecords()
    const activeLeaseCountByOwner: Record<string, number> = {}
    for (const record of this.active.values()) {
      const owner = String(record.lease.ownerNodeId)
      activeLeaseCountByOwner[owner] = (activeLeaseCountByOwner[owner] ?? 0) + 1
    }
    return {
      createdAllocationCount: this.createdAllocationCount,
      reusedAllocationCount: this.reusedAllocationCount,
      destroyedAllocationCount: this.destroyedAllocationCount,
      activeLeaseCount: this.active.size,
      pooledAllocationCount: this.pooledAllocationCount,
      maximumPooledAllocationCount: this.maximumPooledAllocationCount,
      maximumTextureSize: this.maximumTextureSize,
      totalAllocationCount: this.active.size + this.pooledAllocationCount,
      estimatedAllocationMemoryMb: records.reduce((sum, record) => sum + estimateRecordBytes(record), 0) / (1024 * 1024),
      activeLeaseCountByOwner: Object.freeze({ ...activeLeaseCountByOwner }),
      viewport: { ...this.viewport },
    }
  }

  private createAttachments(
    ownerNodeId: CinemaNodeId,
    descriptor: CinemaTargetDescriptor,
    width: number,
    height: number,
    count: number,
    existingViews: readonly CinemaTextureView[] = [],
  ): TargetAttachment[] {
    const attachments: TargetAttachment[] = []
    try {
      for (let index = 0; index < count; index += 1) {
        attachments.push(this.createAttachment(
          ownerNodeId,
          descriptor,
          width,
          height,
          existingViews[index],
        ))
      }
      return attachments
    } catch (error) {
      for (const attachment of attachments) this.destroyAttachment(attachment, true)
      throw error
    }
  }

  private createAttachment(
    ownerNodeId: CinemaNodeId,
    descriptor: CinemaTargetDescriptor,
    width: number,
    height: number,
    existingView?: CinemaTextureView,
  ): TargetAttachment {
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Cinema could not allocate a framebuffer')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)

    let colorTexture: WebGLTexture | null = null
    let maskTexture: WebGLTexture | null = null
    let depthRenderbuffer: WebGLRenderbuffer | null = null

    try {
      colorTexture = gl.createTexture()
      if (!colorTexture) throw new Error('Cinema could not allocate a render-target texture')
      gl.bindTexture(gl.TEXTURE_2D, colorTexture)
      configureTexture(gl, descriptor.filter, descriptor.wrap)
      allocateTextureStorage(gl, descriptor.colorFormat, width, height)

      if (isDepthFormat(descriptor.colorFormat)) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, colorTexture, 0)
        gl.drawBuffers([gl.NONE])
        gl.readBuffer(gl.NONE)
      } else {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0)
      }

      if (descriptor.hasMask && !isDepthFormat(descriptor.colorFormat)) {
        maskTexture = gl.createTexture()
        if (!maskTexture) throw new Error('Cinema could not allocate a mask texture')
        gl.bindTexture(gl.TEXTURE_2D, maskTexture)
        configureTexture(gl, descriptor.filter, descriptor.wrap)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, maskTexture, 0)
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
      }

      if (descriptor.hasDepth && !isDepthFormat(descriptor.colorFormat)) {
        depthRenderbuffer = gl.createRenderbuffer()
        if (!depthRenderbuffer) throw new Error('Cinema could not allocate a depth buffer')
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer)
      }

      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Cinema framebuffer is incomplete (status ${status})`)
      }

      const textureView = this.textures.createRuntimeView({
        ownerNodeId,
        descriptor: outputDescriptor(descriptor),
        width,
        height,
        texture: colorTexture,
        existingView,
      })
      const maskTextureView = maskTexture
        ? this.textures.createRuntimeView({
            ownerNodeId,
            descriptor: maskOutputDescriptor(descriptor),
            width,
            height,
            texture: maskTexture,
          })
        : null
      return { framebuffer, colorTexture, maskTexture, depthRenderbuffer, textureView, maskTextureView }
    } catch (error) {
      if (depthRenderbuffer) gl.deleteRenderbuffer(depthRenderbuffer)
      if (maskTexture) gl.deleteTexture(maskTexture)
      if (colorTexture) gl.deleteTexture(colorTexture)
      gl.deleteFramebuffer(framebuffer)
      this.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        attribution: { stage: 'render-target-pool' },
        details: { format: descriptor.colorFormat, width, height },
      }))
      throw error
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
  }

  private replaceRecordAttachments(record: TargetRecord, width: number, height: number): void {
    const previous = record.attachments
    const replacement = this.createAttachments(
      record.lease.ownerNodeId,
      record.lease.descriptor,
      width,
      height,
      record.lease.lifetime === 'ping-pong-node' ? 2 : 1,
    )
    record.attachments = replacement
    record.width = width
    record.height = height
    record.readIndex = 0
    for (const attachment of previous) this.destroyAttachment(attachment, true)
    this.destroyedAllocationCount += 1
    this.createdAllocationCount += 1
  }

  private destroyRecord(record: TargetRecord, deleteGlResources: boolean): void {
    for (const attachment of record.attachments) this.destroyAttachment(attachment, deleteGlResources)
    this.destroyedAllocationCount += 1
  }

  private destroyAttachment(
    attachment: TargetAttachment,
    deleteGlResources: boolean,
    releaseTextureView = true,
  ): void {
    if (deleteGlResources) {
      if (attachment.depthRenderbuffer) this.gl.deleteRenderbuffer(attachment.depthRenderbuffer)
      if (attachment.maskTexture) this.gl.deleteTexture(attachment.maskTexture)
      if (attachment.colorTexture) this.gl.deleteTexture(attachment.colorTexture)
      if (attachment.framebuffer) this.gl.deleteFramebuffer(attachment.framebuffer)
    }
    if (releaseTextureView) {
      this.textures.releaseRuntimeView(attachment.textureView)
      if (attachment.maskTextureView) this.textures.releaseRuntimeView(attachment.maskTextureView)
    }
  }

  private requireActiveRecord(lease: CinemaRenderTargetLease): TargetRecord {
    const record = this.active.get(lease.leaseId)
    if (!record || record.lease !== lease) throw new Error(`Cinema render-target lease is inactive: ${lease.leaseId}`)
    return record
  }

  private allRecords(): TargetRecord[] {
    return [
      ...this.active.values(),
      ...[...this.pooledByKey.values()].flat(),
    ]
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Cinema render-target pool is disposed')
  }
}

function estimateRecordBytes(record: TargetRecord): number {
  const descriptor = record.lease.descriptor
  const colorBytes = formatBytesPerPixel(descriptor.colorFormat)
  const maskBytes = descriptor.hasMask ? 1 : 0
  const depthBytes = descriptor.hasDepth && !isDepthFormat(descriptor.colorFormat) ? 4 : 0
  return record.width * record.height * (colorBytes + maskBytes + depthBytes) * Math.max(1, record.attachments.length)
}

function formatBytesPerPixel(format: CinemaTargetFormat): number {
  switch (format) {
    case 'rgba32f': return 16
    case 'rgba16f': return 8
    case 'rgba8': return 4
    case 'rg8': return 2
    case 'r8': return 1
    case 'depth24': return 4
    case 'depth16': return 2
  }
}

function createLease(
  id: number,
  ownerNodeId: CinemaNodeId,
  descriptor: CinemaTargetDescriptor,
  lifetime: CinemaTargetLifetime,
): CinemaRenderTargetLease {
  return Object.freeze({
    leaseId: `cinema.runtime.target.${id}` as CinemaStableId<'runtime-target-lease'>,
    ownerNodeId,
    backend: 'webgl2' as const,
    lifetime,
    descriptor: Object.freeze({ ...descriptor, clearColor: Object.freeze([...descriptor.clearColor]) as CinemaColor }),
  })
}

function normalizeDescriptor(descriptor: CinemaTargetDescriptor): CinemaTargetDescriptor {
  return {
    colorSpace: descriptor.colorSpace,
    alphaMode: descriptor.alphaMode,
    colorFormat: descriptor.colorFormat,
    hasDepth: descriptor.hasDepth === true,
    hasMask: descriptor.hasMask === true,
    widthScale: finiteScale(descriptor.widthScale),
    heightScale: finiteScale(descriptor.heightScale),
    filter: descriptor.filter,
    wrap: descriptor.wrap,
    clearColor: normalizeClearColor(descriptor.clearColor),
  }
}

function outputDescriptor(descriptor: CinemaTargetDescriptor): CinemaOutputDescriptor {
  return Object.freeze({
    colorSpace: descriptor.colorSpace,
    alphaMode: descriptor.alphaMode,
    colorFormat: descriptor.colorFormat,
    hasDepth: descriptor.hasDepth,
    hasMask: descriptor.hasMask,
  })
}

function maskOutputDescriptor(descriptor: CinemaTargetDescriptor): CinemaOutputDescriptor {
  return Object.freeze({
    colorSpace: descriptor.colorSpace,
    alphaMode: descriptor.alphaMode,
    colorFormat: 'r8',
    hasDepth: false,
    hasMask: false,
  })
}

function descriptorKey(
  descriptor: CinemaTargetDescriptor,
  lifetime: CinemaTargetLifetime,
  width: number,
  height: number,
): string {
  return JSON.stringify({
    width,
    height,
    lifetime,
    colorSpace: descriptor.colorSpace,
    alphaMode: descriptor.alphaMode,
    colorFormat: descriptor.colorFormat,
    hasDepth: descriptor.hasDepth,
    hasMask: descriptor.hasMask,
    filter: descriptor.filter,
    wrap: descriptor.wrap,
    clearColor: descriptor.clearColor,
  })
}

function resolveTargetSize(
  viewport: CinemaViewport,
  descriptor: CinemaTargetDescriptor,
  maximumTextureSize: number,
): { width: number; height: number } {
  return {
    width: Math.min(maximumTextureSize, Math.max(1, Math.round(viewport.width * descriptor.widthScale))),
    height: Math.min(maximumTextureSize, Math.max(1, Math.round(viewport.height * descriptor.heightScale))),
  }
}

function normalizeViewport(viewport: CinemaViewport): CinemaViewport {
  return {
    width: Math.max(1, Math.floor(Number.isFinite(viewport.width) ? viewport.width : 1)),
    height: Math.max(1, Math.floor(Number.isFinite(viewport.height) ? viewport.height : 1)),
    dpr: Math.max(0.1, Number.isFinite(viewport.dpr) ? viewport.dpr : 1),
  }
}

function sameViewport(left: CinemaViewport, right: CinemaViewport): boolean {
  return left.width === right.width && left.height === right.height && Math.abs(left.dpr - right.dpr) < 1e-6
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.max(1, Math.floor(Number(value))) : fallback
}

function finiteScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(4, value)
}

function normalizeClearColor(color: CinemaColor): CinemaColor {
  return Object.freeze([
    clamp01(color[0]),
    clamp01(color[1]),
    clamp01(color[2]),
    clamp01(color[3]),
  ]) as CinemaColor
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function configureTexture(
  gl: WebGL2RenderingContext,
  filter: CinemaTextureFilter,
  wrap: CinemaTextureWrap,
): void {
  const glFilter = filter === 'nearest' ? gl.NEAREST : gl.LINEAR
  const glWrap = wrap === 'repeat' ? gl.REPEAT : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrap)
}

function allocateTextureStorage(
  gl: WebGL2RenderingContext,
  format: CinemaTargetFormat,
  width: number,
  height: number,
): void {
  switch (format) {
    case 'rgba8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return
    case 'rgba16f': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null); return
    case 'rgba32f': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null); return
    case 'r8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null); return
    case 'rg8': gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, null); return
    case 'depth16': gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null); return
    case 'depth24': gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null); return
  }
}

function isDepthFormat(format: CinemaTargetFormat): boolean {
  return format === 'depth16' || format === 'depth24'
}
