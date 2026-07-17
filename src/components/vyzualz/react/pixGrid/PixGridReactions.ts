import type { ReactPalette } from '../ReactTypes'
import type { PixGridCompiledGroupMaskResolver } from './PixGridGroupCompiler'
import { MAX_PIX_GRID_ACTIVE_REACTIONS } from './PixGridLimits'
import { isPixGridContinuousReactionSource, PixGridReactionRuntime } from './PixGridAudioRouting'
import { activePixGridGroups, compilePixGridGroupMask, pixGridMaskHasCell, pixGridSetMaskCell } from './PixGridGroups'
import type { PixGridAudioFrame, PixGridGroup, PixGridLayer, PixGridPaletteRole, PixGridReactionAssignment } from './PixGridTypes'

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function randomUnit(value: string): number {
  return hash(value) / 0xffffffff
}

function hexRgb(
  value: string | undefined,
  fallback: readonly [number, number, number] = [255, 255, 255],
): readonly [number, number, number] {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return fallback
  return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)]
}

function paletteColor(palette: ReactPalette, role: PixGridPaletteRole | undefined): readonly [number, number, number] {
  if (!role) return hexRgb(palette.accent)
  return hexRgb(palette[role])
}

function blendScalar(base: number, value: number, assignment: PixGridReactionAssignment): number {
  switch (assignment.blend) {
    case 'replace':
      return value
    case 'multiply':
      return base * value
    case 'max':
      return Math.max(base, value)
    default:
      return base + value
  }
}

function isBorder(bits: Uint32Array, index: number, x: number, y: number, width: number, height: number): boolean {
  if (!pixGridMaskHasCell(bits, index)) return false
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true
  return (
    !pixGridMaskHasCell(bits, index - 1) ||
    !pixGridMaskHasCell(bits, index + 1) ||
    !pixGridMaskHasCell(bits, index - width) ||
    !pixGridMaskHasCell(bits, index + width)
  )
}

function stableSeed(frame: PixGridAudioFrame, group: PixGridGroup, assignment: PixGridReactionAssignment, index: number): string {
  return [
    frame.trackIdentity ?? 'none',
    frame.sectionOccurrence ?? 0,
    frame.barIndex ?? 0,
    frame.beatIndex ?? 0,
    group.id,
    assignment.id,
    assignment.seedOffset ?? 0,
    index,
  ].join(':')
}

function transformMaskedPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  bits: Uint32Array,
  assignment: PixGridReactionAssignment,
  strength: number,
  frame: PixGridAudioFrame,
  group: PixGridGroup,
): void {
  const source = new Uint8Array(pixels)
  const selected: number[] = []
  let sumX = 0
  let sumY = 0
  for (let index = 0; index < width * height; index += 1) {
    if (!pixGridMaskHasCell(bits, index)) continue
    selected.push(index)
    sumX += index % width
    sumY += Math.floor(index / width)
    pixels[index * 4 + 3] = 0
  }
  if (selected.length === 0) return
  const centerX = sumX / selected.length
  const centerY = sumY / selected.length
  const scale = assignment.target === 'scale' ? Math.max(0.05, 1 + strength) : 1
  const offsetX = assignment.target === 'positionX' ? strength * width * 0.25 : 0
  const offsetY = assignment.target === 'positionY' ? strength * height * 0.25 : 0
  const displacement = assignment.target === 'pixelDisplacement' ? Math.round(Math.abs(strength) * 5) : 0
  for (const sourceIndex of selected) {
    const x = sourceIndex % width
    const y = Math.floor(sourceIndex / width)
    let targetX = Math.round(centerX + (x - centerX) * scale + offsetX)
    let targetY = Math.round(centerY + (y - centerY) * scale + offsetY)
    if (displacement > 0) {
      const angle = randomUnit(`${stableSeed(frame, group, assignment, sourceIndex)}:angle`) * Math.PI * 2
      const distance = randomUnit(`${stableSeed(frame, group, assignment, sourceIndex)}:distance`) * displacement
      targetX += Math.round(Math.cos(angle) * distance)
      targetY += Math.round(Math.sin(angle) * distance)
    }
    if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue
    const targetOffset = (targetY * width + targetX) * 4
    const sourceOffset = sourceIndex * 4
    pixels[targetOffset] = source[sourceOffset]
    pixels[targetOffset + 1] = source[sourceOffset + 1]
    pixels[targetOffset + 2] = source[sourceOffset + 2]
    pixels[targetOffset + 3] = Math.max(pixels[targetOffset + 3], source[sourceOffset + 3])
  }
}

function applyPixelReaction(
  pixels: Uint8Array,
  width: number,
  height: number,
  bits: Uint32Array,
  assignment: PixGridReactionAssignment,
  strength: number,
  frame: PixGridAudioFrame,
  group: PixGridGroup,
  palette: ReactPalette,
  claimed: Uint32Array,
  claim: boolean,
): void {
  if (
    assignment.target === 'scale' ||
    assignment.target === 'positionX' ||
    assignment.target === 'positionY' ||
    assignment.target === 'pixelDisplacement'
  ) {
    transformMaskedPixels(pixels, width, height, bits, assignment, strength, frame, group)
    if (claim)
      for (let index = 0; index < width * height; index += 1) if (pixGridMaskHasCell(bits, index)) pixGridSetMaskCell(claimed, index)
    return
  }
  const tint =
    assignment.target === 'paletteRole'
      ? paletteColor(palette, assignment.paletteRole)
      : hexRgb(assignment.color, paletteColor(palette, assignment.paletteRole))
  const absoluteStrength = Math.abs(strength)
  for (let index = 0; index < width * height; index += 1) {
    if (!pixGridMaskHasCell(bits, index) || pixGridMaskHasCell(claimed, index)) continue
    const x = index % width
    const y = Math.floor(index / width)
    const offset = index * 4
    const alpha = pixels[offset + 3] / 255
    if (claim) pixGridSetMaskCell(claimed, index)
    switch (assignment.target) {
      case 'brightness': {
        const factor = clamp(blendScalar(1, strength, assignment), 0, 4)
        pixels[offset] = Math.min(255, Math.round(pixels[offset] * factor))
        pixels[offset + 1] = Math.min(255, Math.round(pixels[offset + 1] * factor))
        pixels[offset + 2] = Math.min(255, Math.round(pixels[offset + 2] * factor))
        break
      }
      case 'opacity':
        pixels[offset + 3] = Math.round(clamp(blendScalar(alpha, strength, assignment)) * 255)
        break
      case 'color':
      case 'paletteRole': {
        const mix = clamp(absoluteStrength)
        pixels[offset] = Math.round(pixels[offset] + (tint[0] - pixels[offset]) * mix)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (tint[1] - pixels[offset + 1]) * mix)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (tint[2] - pixels[offset + 2]) * mix)
        break
      }
      case 'reveal':
        if ((y + 0.5) / height > clamp(absoluteStrength)) pixels[offset + 3] = 0
        break
      case 'hide':
        pixels[offset + 3] = Math.round(alpha * (1 - clamp(absoluteStrength)) * 255)
        break
      case 'blink':
        if (absoluteStrength < 0.5) pixels[offset + 3] = 0
        break
      case 'outlineFlash': {
        if (!isBorder(bits, index, x, y, width, height)) break
        pixels[offset] = Math.round(pixels[offset] + (tint[0] - pixels[offset]) * clamp(absoluteStrength))
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (tint[1] - pixels[offset + 1]) * clamp(absoluteStrength))
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (tint[2] - pixels[offset + 2]) * clamp(absoluteStrength))
        pixels[offset + 3] = Math.max(pixels[offset + 3], Math.round(clamp(absoluteStrength) * 255))
        break
      }
      case 'sparkle': {
        const selected = randomUnit(stableSeed(frame, group, assignment, index)) < clamp(absoluteStrength * 0.25)
        if (selected) {
          pixels[offset] = 255
          pixels[offset + 1] = 255
          pixels[offset + 2] = 255
          pixels[offset + 3] = 255
        }
        break
      }
      case 'dissolveThreshold': {
        if (randomUnit(stableSeed(frame, group, assignment, index)) > clamp(absoluteStrength)) pixels[offset + 3] = 0
        break
      }
      case 'invert': {
        const amount = clamp(absoluteStrength)
        pixels[offset] = Math.round(pixels[offset] + (255 - pixels[offset] * 2) * amount)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (255 - pixels[offset + 1] * 2) * amount)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (255 - pixels[offset + 2] * 2) * amount)
        break
      }
      case 'posterize': {
        const levels = Math.max(2, Math.round(16 - clamp(absoluteStrength) * 12))
        const step = 255 / (levels - 1)
        pixels[offset] = Math.round(pixels[offset] / step) * step
        pixels[offset + 1] = Math.round(pixels[offset + 1] / step) * step
        pixels[offset + 2] = Math.round(pixels[offset + 2] / step) * step
        break
      }
      default:
        break
    }
  }
}

function isPixGridPixelReactionTarget(target: PixGridReactionAssignment['target']): boolean {
  return target !== 'animationSpeed' && target !== 'directionReverse' && target !== 'frameAdvance'
}

function groupAppliesToActiveLayers(group: PixGridGroup, activeLayerIds?: ReadonlySet<string>): boolean {
  if (!activeLayerIds) return true
  const scope = group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : []
  return scope.length === 0 || scope.some((layerId) => activeLayerIds.has(layerId))
}

export function applyPixGridGroupReactions(
  pixels: Uint8Array,
  width: number,
  height: number,
  groups: readonly PixGridGroup[],
  frame: PixGridAudioFrame,
  runtime: PixGridReactionRuntime,
  palette: ReactPalette,
  previewReactionAssignmentId: string | null = null,
  activeLayerIds?: ReadonlySet<string>,
  maskResolver?: PixGridCompiledGroupMaskResolver,
): void {
  const claimed = new Uint32Array(Math.ceil((width * height) / 32))
  let activeReactionCount = 0
  for (const group of activePixGridGroups(groups)) {
    if (activeReactionCount >= MAX_PIX_GRID_ACTIVE_REACTIONS) break
    if (!groupAppliesToActiveLayers(group, activeLayerIds)) continue
    const compiled = maskResolver?.compile(group) ?? compilePixGridGroupMask(group, width, height)
    if (compiled.cellCount === 0) continue
    const claim = group.overlapBehavior === 'exclusive' || group.overlapBehavior === 'replace'
    const assignments = [...group.reactions].sort((a, b) => {
      const sourceOrder = Number(!isPixGridContinuousReactionSource(a.source)) - Number(!isPixGridContinuousReactionSource(b.source))
      return sourceOrder || (a.eventPriority ?? 0) - (b.eventPriority ?? 0) || a.id.localeCompare(b.id)
    })
    for (const assignment of assignments) {
      if (activeReactionCount >= MAX_PIX_GRID_ACTIVE_REACTIONS) break
      if (!assignment.enabled || !isPixGridPixelReactionTarget(assignment.target)) continue
      activeReactionCount += 1
      const resolved = runtime.resolve(assignment, frame, assignment.id === previewReactionAssignmentId)
      if (!resolved.active) continue
      const strength = assignment.amount * resolved.value
      applyPixelReaction(pixels, width, height, compiled.bits, assignment, strength, frame, group, palette, claimed, claim)
    }
  }
}

export function resolvePixGridLayerReactionFrame(
  layer: PixGridLayer,
  groups: readonly PixGridGroup[],
  frame: PixGridAudioFrame,
  runtime: PixGridReactionRuntime,
  previewReactionAssignmentId: string | null = null,
): PixGridAudioFrame {
  let speed = 1
  let direction = 1
  let frameAdvance = 0
  let count = 0
  for (const group of activePixGridGroups(groups)) {
    const hasScope = Boolean(group.layerId) || Boolean(group.layerScope?.length)
    const scoped = !hasScope || group.layerId === layer.id || group.layerScope?.includes(layer.id)
    if (!scoped) continue
    const assignments = [...group.reactions].sort((a, b) => {
      const sourceOrder = Number(!isPixGridContinuousReactionSource(a.source)) - Number(!isPixGridContinuousReactionSource(b.source))
      return sourceOrder || (a.eventPriority ?? 0) - (b.eventPriority ?? 0) || a.id.localeCompare(b.id)
    })
    for (const assignment of assignments) {
      if (!assignment.enabled || count >= MAX_PIX_GRID_ACTIVE_REACTIONS) continue
      if (assignment.target !== 'animationSpeed' && assignment.target !== 'directionReverse' && assignment.target !== 'frameAdvance')
        continue
      count += 1
      const resolved = runtime.resolve(assignment, frame, assignment.id === previewReactionAssignmentId)
      if (!resolved.active) continue
      const value = assignment.amount * resolved.value
      if (assignment.target === 'animationSpeed') speed = Math.max(0, speed + value)
      else if (assignment.target === 'directionReverse' && Math.abs(value) >= 0.5) direction *= -1
      else if (assignment.target === 'frameAdvance') frameAdvance += value
    }
  }
  if (speed === 1 && direction === 1 && frameAdvance === 0) return frame
  return {
    ...frame,
    audioTime: frame.audioTime * speed * direction + frameAdvance,
  }
}
