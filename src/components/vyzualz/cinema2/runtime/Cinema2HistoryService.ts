import type { Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2RenderTargetBinding,
  Cinema2RenderTargetLease,
  Cinema2ResourceManager,
} from './Cinema2ResourceManager'

export type Cinema2HistoryResetReason =
  | 'activation'
  | 'manual'
  | 'discontinuity'
  | 'resize'
  | 'context-lost'
  | 'context-restored'
  | 'size-change'
  | 'deactivation'

export interface Cinema2HistoryFrame {
  readonly name: string
  readonly valid: boolean
  readonly read: Readonly<Cinema2RenderTargetBinding>
  readonly write: Readonly<Cinema2RenderTargetBinding>
}

export interface Cinema2HistoryBufferSnapshot {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly valid: boolean
  readonly readSurfaceIndex: number
  readonly estimatedGpuMemoryBytes: number
}

export interface Cinema2HistoryServiceSnapshot {
  readonly disposed: boolean
  readonly contextAvailable: boolean
  readonly activeBufferCount: number
  readonly validBufferCount: number
  readonly activeSurfaceCount: number
  readonly estimatedGpuMemoryBytes: number
  readonly maximumBufferCount: number
  readonly maximumEstimatedGpuMemoryBytes: number
  readonly resetCount: number
  readonly lastResetReason: Cinema2HistoryResetReason
  readonly lastDiagnostic: string | null
  readonly buffers: readonly Readonly<Cinema2HistoryBufferSnapshot>[]
}

export interface Cinema2HistoryServiceOptions {
  maximumBufferCount?: number
  maximumEstimatedGpuMemoryBytes?: number
}

interface HistoryRecord {
  name: string
  lease: Cinema2RenderTargetLease
  width: number
  height: number
  readSurfaceIndex: 0 | 1
  valid: boolean
  estimatedGpuMemoryBytes: number
}

const DEFAULT_MAXIMUM_BUFFER_COUNT = 8
const DEFAULT_MAXIMUM_ESTIMATED_GPU_MEMORY_BYTES = 128 * 1024 * 1024
const RGBA8_BYTES_PER_PIXEL = 4
const PAIRED_SURFACE_COUNT = 2

/**
 * Canonical Cinema 2.0 temporal-buffer owner.
 *
 * Effects/modules may request named ping-pong frames, but all framebuffer and
 * texture ownership stays in the Resource Manager. History owns only temporal
 * identity, ping-pong direction, reset semantics and budget/accounting.
 */
export class Cinema2HistoryService {
  private readonly records = new Map<string, HistoryRecord>()
  private readonly ownerId: string
  private readonly maximumBufferCount: number
  private readonly maximumEstimatedGpuMemoryBytes: number
  private disposed = false
  private contextAvailable = true
  private resetCount = 1
  private lastResetReason: Cinema2HistoryResetReason = 'activation'
  private lastDiagnostic: string | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly resources: Cinema2ResourceManager,
    presetId: Cinema2PresetId,
    options: Cinema2HistoryServiceOptions = {},
  ) {
    this.ownerId = `cinema2.history.${String(presetId)}`
    this.maximumBufferCount = positiveInteger(options.maximumBufferCount, DEFAULT_MAXIMUM_BUFFER_COUNT)
    this.maximumEstimatedGpuMemoryBytes = positiveInteger(
      options.maximumEstimatedGpuMemoryBytes,
      DEFAULT_MAXIMUM_ESTIMATED_GPU_MEMORY_BYTES,
    )
  }

  beginFrame(name: string, width: number, height: number): Readonly<Cinema2HistoryFrame> | null {
    if (this.disposed || !this.contextAvailable) return null
    const normalizedName = normalizeName(name)
    const safeWidth = positiveInteger(width, 1)
    const safeHeight = positiveInteger(height, 1)
    let record = this.records.get(normalizedName) ?? null
    if (record && (record.width !== safeWidth || record.height !== safeHeight)) {
      this.releaseRecord(record)
      this.records.delete(normalizedName)
      this.noteReset('size-change')
      record = null
    }
    if (!record) {
      record = this.allocateRecord(normalizedName, safeWidth, safeHeight)
      if (!record) return null
      this.records.set(normalizedName, record)
    }

    const read = this.resources.getRenderTargetBinding(record.lease, record.readSurfaceIndex)
    const writeIndex = record.readSurfaceIndex === 0 ? 1 : 0
    const write = this.resources.getRenderTargetBinding(record.lease, writeIndex)
    return Object.freeze({ name: normalizedName, valid: record.valid, read, write })
  }

  commit(name: string): boolean {
    if (this.disposed) return false
    const record = this.records.get(normalizeName(name))
    if (!record) return false
    record.readSurfaceIndex = record.readSurfaceIndex === 0 ? 1 : 0
    record.valid = true
    return true
  }

  resetBuffer(name: string, reason: Cinema2HistoryResetReason = 'manual'): boolean {
    if (this.disposed) return false
    const record = this.records.get(normalizeName(name))
    if (!record) {
      this.noteReset(reason)
      return false
    }
    record.valid = false
    record.readSurfaceIndex = 0
    if (this.contextAvailable) this.clearRecord(record)
    this.noteReset(reason)
    return true
  }

  resetAll(reason: Cinema2HistoryResetReason): void {
    if (this.disposed) return
    for (const record of this.records.values()) {
      record.valid = false
      record.readSurfaceIndex = 0
      if (this.contextAvailable) this.clearRecord(record)
    }
    this.noteReset(reason)
  }

  handleResize(): void {
    if (this.disposed) return
    this.releaseAllRecords()
    this.noteReset('resize')
  }

  handleContextLost(): void {
    if (this.disposed || !this.contextAvailable) return
    this.contextAvailable = false
    for (const record of this.records.values()) {
      record.valid = false
      record.readSurfaceIndex = 0
    }
    this.noteReset('context-lost')
  }

  handleContextRestored(): void {
    if (this.disposed) return
    this.contextAvailable = true
    for (const record of this.records.values()) {
      record.valid = false
      record.readSurfaceIndex = 0
      this.clearRecord(record)
    }
    this.noteReset('context-restored')
  }

  releaseBuffer(name: string): boolean {
    if (this.disposed) return false
    const normalizedName = normalizeName(name)
    const record = this.records.get(normalizedName)
    if (!record) return false
    this.releaseRecord(record)
    this.records.delete(normalizedName)
    return true
  }

  getSnapshot(): Readonly<Cinema2HistoryServiceSnapshot> {
    const buffers = [...this.records.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(record => Object.freeze({
        name: record.name,
        width: record.width,
        height: record.height,
        valid: record.valid,
        readSurfaceIndex: record.readSurfaceIndex,
        estimatedGpuMemoryBytes: record.estimatedGpuMemoryBytes,
      }))
    return Object.freeze({
      disposed: this.disposed,
      contextAvailable: this.contextAvailable,
      activeBufferCount: buffers.length,
      validBufferCount: buffers.filter(buffer => buffer.valid).length,
      activeSurfaceCount: buffers.length * PAIRED_SURFACE_COUNT,
      estimatedGpuMemoryBytes: buffers.reduce((sum, buffer) => sum + buffer.estimatedGpuMemoryBytes, 0),
      maximumBufferCount: this.maximumBufferCount,
      maximumEstimatedGpuMemoryBytes: this.maximumEstimatedGpuMemoryBytes,
      resetCount: this.resetCount,
      lastResetReason: this.lastResetReason,
      lastDiagnostic: this.lastDiagnostic,
      buffers: Object.freeze(buffers),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.resetAll('deactivation')
    this.releaseAllRecords()
    this.disposed = true
    this.contextAvailable = false
  }

  private allocateRecord(name: string, width: number, height: number): HistoryRecord | null {
    const bytes = estimateBytes(width, height)
    const snapshot = this.getSnapshot()
    if (snapshot.activeBufferCount >= this.maximumBufferCount) {
      this.lastDiagnostic = `History buffer "${name}" was bypassed because the ${this.maximumBufferCount}-buffer budget is exhausted.`
      return null
    }
    if (snapshot.estimatedGpuMemoryBytes + bytes > this.maximumEstimatedGpuMemoryBytes) {
      this.lastDiagnostic = `History buffer "${name}" was bypassed because its allocation would exceed the temporal GPU-memory budget.`
      return null
    }

    const lease = this.resources.acquireRenderTarget(this.ownerId, {
      size: { kind: 'fixed', width, height },
      colorFormat: 'rgba8',
      depthFormat: 'none',
      filter: 'linear',
      wrap: 'clamp',
      surfaceLayout: 'paired',
    }, 'persistent')
    const record: HistoryRecord = {
      name,
      lease,
      width,
      height,
      readSurfaceIndex: 0,
      valid: false,
      estimatedGpuMemoryBytes: bytes,
    }
    this.clearRecord(record)
    this.lastDiagnostic = null
    return record
  }

  private clearRecord(record: HistoryRecord): void {
    for (let surfaceIndex = 0; surfaceIndex < PAIRED_SURFACE_COUNT; surfaceIndex += 1) {
      const binding = this.resources.getRenderTargetBinding(record.lease, surfaceIndex)
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, binding.framebuffer)
      this.gl.viewport(0, 0, binding.width, binding.height)
      this.gl.disable(this.gl.SCISSOR_TEST)
      this.gl.disable(this.gl.BLEND)
      this.gl.disable(this.gl.DEPTH_TEST)
      this.gl.colorMask(true, true, true, true)
      this.gl.clearColor(0, 0, 0, 0)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  private releaseRecord(record: HistoryRecord): void {
    this.resources.release(record.lease, { pool: false })
  }

  private releaseAllRecords(): void {
    for (const record of this.records.values()) this.releaseRecord(record)
    this.records.clear()
  }

  private noteReset(reason: Cinema2HistoryResetReason): void {
    this.resetCount += 1
    this.lastResetReason = reason
  }
}

function normalizeName(name: string): string {
  const normalized = String(name ?? '').trim()
  if (!normalized) throw new Error('Cinema 2.0 history buffer name must be non-empty.')
  return normalized
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.max(1, Math.floor(Number(value))) : fallback
}

function estimateBytes(width: number, height: number): number {
  return width * height * RGBA8_BYTES_PER_PIXEL * PAIRED_SURFACE_COUNT
}
