import { MAX_PIX_GRID_ACTIVE_GROUPS } from './PixGridLimits'
import { activePixGridGroups, compilePixGridGroupMask, type PixGridCompiledMask, type PixGridMaskPixelSource } from './PixGridGroups'
import type { PixGridGroup } from './PixGridTypes'

const SOURCE_MASK_KINDS = new Set<PixGridGroup['mask']['kind']>([
  'layerAlpha',
  'colorRange',
  'luminanceRange',
  'connectedRegion',
  'svgMetadata',
])

export interface PixGridCompiledGroupMaskResolver {
  compile(group: PixGridGroup): PixGridCompiledMask
  readonly compiledGroupIds: readonly string[]
}

interface SourceTarget {
  group: PixGridGroup
  pixels: Uint8Array
}

let nextFrameGroupCompilerInstanceId = 1

/**
 * Builds renderer-native group masks from the same layer samples used by the
 * logical compositor. Buffers are retained and cleared between frames, so
 * source-derived masks do not require per-cell React state or per-frame object
 * graphs. Static run/geometric masks continue through the shared mask cache.
 */
export class PixGridFrameGroupCompiler implements PixGridCompiledGroupMaskResolver {
  private readonly instanceId = nextFrameGroupCompilerInstanceId++
  private width = 1
  private height = 1
  private revision = 0
  private readonly sourceBuffers = new Map<string, Uint8Array>()
  private readonly sourceTargets = new Map<string, SourceTarget>()
  private readonly targetsByLayerId = new Map<string, SourceTarget[]>()
  private globalTargets: SourceTarget[] = []
  private readonly compiled = new Map<string, PixGridCompiledMask>()

  beginFrame(groups: readonly PixGridGroup[], width: number, height: number, activeLayerIds?: ReadonlySet<string>): void {
    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
    this.revision += 1
    this.sourceTargets.clear()
    this.targetsByLayerId.clear()
    this.globalTargets = []
    this.compiled.clear()

    const requiredBytes = this.width * this.height * 4
    const activeIds = new Set<string>()
    for (const group of activePixGridGroups(groups).slice(0, MAX_PIX_GRID_ACTIVE_GROUPS)) {
      if (!SOURCE_MASK_KINDS.has(group.mask.kind)) continue
      const scope = group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : []
      if (activeLayerIds && scope.length > 0 && !scope.some((layerId) => activeLayerIds.has(layerId))) continue
      let pixels = this.sourceBuffers.get(group.id)
      if (!pixels || pixels.length !== requiredBytes) {
        pixels = new Uint8Array(requiredBytes)
        this.sourceBuffers.set(group.id, pixels)
      } else {
        pixels.fill(0)
      }
      const target = { group, pixels }
      activeIds.add(group.id)
      this.sourceTargets.set(group.id, target)
      if (scope.length === 0) {
        this.globalTargets.push(target)
      } else {
        for (const layerId of scope) {
          const targets = this.targetsByLayerId.get(layerId) ?? []
          targets.push(target)
          this.targetsByLayerId.set(layerId, targets)
        }
      }
    }

    for (const groupId of this.sourceBuffers.keys()) {
      if (!activeIds.has(groupId)) this.sourceBuffers.delete(groupId)
    }
  }

  recordPixel(layerId: string | null, index: number, color: readonly [number, number, number], alpha: number): void {
    if (index < 0 || index >= this.width * this.height || alpha <= 0) return
    const layerTargets = layerId == null ? undefined : this.targetsByLayerId.get(layerId)
    if ((!layerTargets || layerTargets.length === 0) && this.globalTargets.length === 0) return
    const offset = index * 4
    const sourceAlpha = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    if (layerTargets) {
      for (const target of layerTargets) {
        const previousAlpha = target.pixels[offset + 3]
        if (sourceAlpha >= previousAlpha) {
          target.pixels[offset] = color[0]
          target.pixels[offset + 1] = color[1]
          target.pixels[offset + 2] = color[2]
        }
        target.pixels[offset + 3] = Math.max(previousAlpha, sourceAlpha)
      }
    }
    for (const target of this.globalTargets) {
      const previousAlpha = target.pixels[offset + 3]
      if (sourceAlpha >= previousAlpha) {
        target.pixels[offset] = color[0]
        target.pixels[offset + 1] = color[1]
        target.pixels[offset + 2] = color[2]
      }
      target.pixels[offset + 3] = Math.max(previousAlpha, sourceAlpha)
    }
  }

  compile(group: PixGridGroup): PixGridCompiledMask {
    const cached = this.compiled.get(group.id)
    if (cached) return cached
    const target = this.sourceTargets.get(group.id)
    const source: PixGridMaskPixelSource | null = target
      ? {
          width: this.width,
          height: this.height,
          pixels: target.pixels,
          key: `pix-grid-frame-mask:${this.instanceId}:${this.revision}:${group.id}`,
          mediaRevision: this.revision,
        }
      : null
    const compiled = compilePixGridGroupMask(group, this.width, this.height, source)
    this.compiled.set(group.id, compiled)
    return compiled
  }

  get compiledGroupIds(): readonly string[] {
    return [...this.compiled.entries()]
      .filter(([, compiled]) => compiled.cellCount > 0)
      .map(([groupId]) => groupId)
      .sort()
  }

  reset(): void {
    this.sourceBuffers.clear()
    this.sourceTargets.clear()
    this.targetsByLayerId.clear()
    this.globalTargets = []
    this.compiled.clear()
    this.revision = 0
  }
}
