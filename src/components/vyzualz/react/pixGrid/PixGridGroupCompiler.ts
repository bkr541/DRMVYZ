import { MAX_PIX_GRID_ACTIVE_GROUPS } from './PixGridLimits'
import { activePixGridGroups, compilePixGridGroupMask, pixGridMaskHasCell, type PixGridCompiledMask, type PixGridMaskPixelSource } from './PixGridGroups'
import type { PixGridGroup } from './PixGridTypes'

const SOURCE_MASK_KINDS = new Set<PixGridGroup['mask']['kind']>([
  'layerAlpha',
  'colorRange',
  'luminanceRange',
  'connectedRegion',
  'svgMetadata',
])

export type PixGridGroupMembership = 'rendered' | 'canonical'

export interface PixGridCompiledGroupMaskResolver {
  compile(group: PixGridGroup, membership?: PixGridGroupMembership): PixGridCompiledMask
  restorePixels(
    group: PixGridGroup,
    targetPixels: Uint8Array,
    bits: Uint32Array,
    opacityScale?: number,
  ): number
  readonly compiledGroupIds: readonly string[]
}

interface SourceTarget {
  group: PixGridGroup
  renderedPixels: Uint8Array
  canonicalPixels: Uint8Array
}

let nextFrameGroupCompilerInstanceId = 1

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function recordTargetPixel(
  pixels: Uint8Array,
  offset: number,
  color: readonly [number, number, number],
  sourceAlpha: number,
): void {
  const previousAlpha = pixels[offset + 3]
  if (sourceAlpha >= previousAlpha) {
    pixels[offset] = color[0]
    pixels[offset + 1] = color[1]
    pixels[offset + 2] = color[2]
  }
  pixels[offset + 3] = Math.max(previousAlpha, sourceAlpha)
}

/**
 * Builds two renderer-native views of every source-derived Smart Group:
 *
 * - rendered membership records only pixels that survived authored animation,
 *   reveal, opacity, and compositing gates;
 * - canonical membership records the frame-aware semantic component before
 *   those authored visibility gates hide it.
 *
 * Both views share the same transforms and frame identity. Recruitment effects
 * can therefore restore exact source colors without inferring membership from
 * the post-animation framebuffer, while ordinary modifiers retain the previous
 * rendered-only behavior. Buffers are retained and cleared between frames.
 */
export class PixGridFrameGroupCompiler implements PixGridCompiledGroupMaskResolver {
  private readonly instanceId = nextFrameGroupCompilerInstanceId++
  private width = 1
  private height = 1
  private revision = 0
  private readonly renderedSourceBuffers = new Map<string, Uint8Array>()
  private readonly canonicalSourceBuffers = new Map<string, Uint8Array>()
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
      let renderedPixels = this.renderedSourceBuffers.get(group.id)
      if (!renderedPixels || renderedPixels.length !== requiredBytes) {
        renderedPixels = new Uint8Array(requiredBytes)
        this.renderedSourceBuffers.set(group.id, renderedPixels)
      } else {
        renderedPixels.fill(0)
      }
      let canonicalPixels = this.canonicalSourceBuffers.get(group.id)
      if (!canonicalPixels || canonicalPixels.length !== requiredBytes) {
        canonicalPixels = new Uint8Array(requiredBytes)
        this.canonicalSourceBuffers.set(group.id, canonicalPixels)
      } else {
        canonicalPixels.fill(0)
      }
      const target = { group, renderedPixels, canonicalPixels }
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

    for (const groupId of this.renderedSourceBuffers.keys()) {
      if (!activeIds.has(groupId)) this.renderedSourceBuffers.delete(groupId)
    }
    for (const groupId of this.canonicalSourceBuffers.keys()) {
      if (!activeIds.has(groupId)) this.canonicalSourceBuffers.delete(groupId)
    }
  }

  recordPixel(
    layerId: string | null,
    index: number,
    color: readonly [number, number, number],
    alpha: number,
    membership: PixGridGroupMembership = 'rendered',
  ): void {
    if (index < 0 || index >= this.width * this.height || alpha <= 0) return
    const layerTargets = layerId == null ? undefined : this.targetsByLayerId.get(layerId)
    if ((!layerTargets || layerTargets.length === 0) && this.globalTargets.length === 0) return
    const offset = index * 4
    const sourceAlpha = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    const record = (target: SourceTarget) => recordTargetPixel(
      membership === 'canonical' ? target.canonicalPixels : target.renderedPixels,
      offset,
      color,
      sourceAlpha,
    )
    if (layerTargets) for (const target of layerTargets) record(target)
    for (const target of this.globalTargets) record(target)
  }

  compile(group: PixGridGroup, membership: PixGridGroupMembership = 'rendered'): PixGridCompiledMask {
    const cacheKey = `${membership}:${group.id}`
    const cached = this.compiled.get(cacheKey)
    if (cached) return cached
    const target = this.sourceTargets.get(group.id)
    const pixels = target
      ? membership === 'canonical' ? target.canonicalPixels : target.renderedPixels
      : null
    const source: PixGridMaskPixelSource | null = pixels
      ? {
          width: this.width,
          height: this.height,
          pixels,
          key: `pix-grid-frame-mask:${this.instanceId}:${this.revision}:${membership}:${group.id}`,
          mediaRevision: this.revision,
        }
      : null
    const compiled = compilePixGridGroupMask(group, this.width, this.height, source)
    this.compiled.set(cacheKey, compiled)
    return compiled
  }

  restorePixels(
    group: PixGridGroup,
    targetPixels: Uint8Array,
    bits: Uint32Array,
    opacityScale = 1,
  ): number {
    const source = this.sourceTargets.get(group.id)?.canonicalPixels
    if (!source || source.length !== targetPixels.length) return 0
    const scale = clamp01(opacityScale)
    if (scale <= 0) return 0
    let recruited = 0
    for (let index = 0; index < this.width * this.height; index += 1) {
      if (!pixGridMaskHasCell(bits, index)) continue
      const offset = index * 4
      const canonicalAlpha = source[offset + 3]
      if (canonicalAlpha <= 0) continue
      const previousAlpha = targetPixels[offset + 3]
      const sourceAlpha = Math.round(canonicalAlpha * scale)
      if (sourceAlpha <= 0) continue
      const colorMix = previousAlpha > 0 ? scale : 1
      const nextRed = Math.round(targetPixels[offset] + (source[offset] - targetPixels[offset]) * colorMix)
      const nextGreen = Math.round(targetPixels[offset + 1] + (source[offset + 1] - targetPixels[offset + 1]) * colorMix)
      const nextBlue = Math.round(targetPixels[offset + 2] + (source[offset + 2] - targetPixels[offset + 2]) * colorMix)
      const changed = previousAlpha === 0
        || nextRed !== targetPixels[offset]
        || nextGreen !== targetPixels[offset + 1]
        || nextBlue !== targetPixels[offset + 2]
      if (changed) recruited += 1
      targetPixels[offset] = nextRed
      targetPixels[offset + 1] = nextGreen
      targetPixels[offset + 2] = nextBlue
      targetPixels[offset + 3] = Math.max(previousAlpha, sourceAlpha)
    }
    return recruited
  }

  get compiledGroupIds(): readonly string[] {
    return [...new Set(
      [...this.compiled.entries()]
        .filter(([, compiled]) => compiled.cellCount > 0)
        .map(([key]) => key.slice(key.indexOf(':') + 1)),
    )].sort()
  }

  reset(): void {
    this.renderedSourceBuffers.clear()
    this.canonicalSourceBuffers.clear()
    this.sourceTargets.clear()
    this.targetsByLayerId.clear()
    this.globalTargets = []
    this.compiled.clear()
    this.revision = 0
  }
}
