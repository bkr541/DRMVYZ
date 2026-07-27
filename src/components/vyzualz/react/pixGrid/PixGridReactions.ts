import type { ReactPalette } from '../ReactTypes'
import type { PixGridCompiledAssignment } from './PixGridAssignmentCompiler'
import type { PixGridCompiledGroupMaskResolver } from './PixGridGroupCompiler'
import { MAX_PIX_GRID_ACTIVE_REACTIONS } from './PixGridLimits'
import { isPixGridContinuousReactionSource, PixGridReactionRuntime } from './PixGridAudioRouting'
import { resolvePixGridPerceptualStrength } from './PixGridPerceptualCalibration'
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

function hueRotate(r: number, g: number, b: number, offset: number): readonly [number, number, number] {
  const angle = offset * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    Math.round(clamp((0.213 + cos * 0.787 - sin * 0.213) * r + (0.715 - cos * 0.715 - sin * 0.715) * g + (0.072 - cos * 0.072 + sin * 0.928) * b, 0, 255)),
    Math.round(clamp((0.213 - cos * 0.213 + sin * 0.143) * r + (0.715 + cos * 0.285 + sin * 0.14) * g + (0.072 - cos * 0.072 - sin * 0.283) * b, 0, 255)),
    Math.round(clamp((0.213 - cos * 0.213 - sin * 0.787) * r + (0.715 - cos * 0.715 + sin * 0.715) * g + (0.072 + cos * 0.928 + sin * 0.072) * b, 0, 255)),
  ]
}

function isBorderBand(
  bits: Uint32Array,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
): boolean {
  if (!pixGridMaskHasCell(bits, index)) return false
  const radius = Math.max(1, Math.min(3, Math.round(thickness)))
  for (let distance = 1; distance <= radius; distance += 1) {
    if (x - distance < 0 || x + distance >= width || y - distance < 0 || y + distance >= height) return true
    if (
      !pixGridMaskHasCell(bits, index - distance) ||
      !pixGridMaskHasCell(bits, index + distance) ||
      !pixGridMaskHasCell(bits, index - distance * width) ||
      !pixGridMaskHasCell(bits, index + distance * width)
    ) return true
  }
  return false
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
  compiled: PixGridCompiledAssignment,
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
  const target = compiled.target.id
  const expands = target === 'scale' || target === 'maskExpansion'
  const contracts = target === 'maskContraction'
  const scale = expands ? Math.max(0.05, 1 + Math.abs(strength)) : contracts ? Math.max(0.05, 1 - Math.abs(strength)) : 1
  const rotation = target === 'discreteRotation' ? Math.round(strength * 4) * Math.PI * 0.5 : 0
  const offsetX = target === 'positionX' ? strength * width * 0.25 : 0
  const offsetY = target === 'positionY' ? strength * height * 0.25 : 0
  const displacement = target === 'pixelDisplacement' || target === 'pixelScatter' ? Math.round(Math.abs(strength) * 5) : 0
  for (const sourceIndex of selected) {
    const x = sourceIndex % width
    const y = Math.floor(sourceIndex / width)
    const relativeX = (x - centerX) * scale
    const relativeY = (y - centerY) * scale
    let targetX = Math.round(centerX + relativeX * Math.cos(rotation) - relativeY * Math.sin(rotation) + offsetX)
    let targetY = Math.round(centerY + relativeX * Math.sin(rotation) + relativeY * Math.cos(rotation) + offsetY)
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
  compiled: PixGridCompiledAssignment,
  strength: number,
  frame: PixGridAudioFrame,
  group: PixGridGroup,
  palette: ReactPalette,
  claimed: Uint32Array,
  claim: boolean,
): void {
  const target = compiled.target.id
  if (compiled.target.runtimeHandler === 'transform') {
    transformMaskedPixels(pixels, width, height, bits, assignment, compiled, strength, frame, group)
    if (claim)
      for (let index = 0; index < width * height; index += 1) if (pixGridMaskHasCell(bits, index)) pixGridSetMaskCell(claimed, index)
    return
  }
  const tint =
    target === 'paletteRole'
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
    switch (target) {
      case 'brightness': {
        const factor = clamp(blendScalar(1, strength, assignment), 0, 4)
        const red = Math.min(255, pixels[offset] * factor)
        const green = Math.min(255, pixels[offset + 1] * factor)
        const blue = Math.min(255, pixels[offset + 2] * factor)
        const calibrated = (assignment.perceptualGain ?? 1) > 1 || (assignment.minimumEffectiveStrength ?? 0) > 0
        if (strength > 0 && calibrated) {
          // Multiplication alone cannot reveal black or already-saturated preset art.
          // Canonical music routes therefore add a bounded palette-aware exposure lift.
          const sourcePeak = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) / 255
          const darkness = 1 - sourcePeak
          const tintMix = clamp(absoluteStrength * (0.16 + darkness * 0.18), 0, 0.5)
          const exposureLift = 255 * clamp(absoluteStrength * (0.035 + darkness * 0.075), 0, 0.22)
          pixels[offset] = Math.min(255, Math.round(red + (tint[0] - red) * tintMix + exposureLift))
          pixels[offset + 1] = Math.min(255, Math.round(green + (tint[1] - green) * tintMix + exposureLift))
          pixels[offset + 2] = Math.min(255, Math.round(blue + (tint[2] - blue) * tintMix + exposureLift))
        } else {
          pixels[offset] = Math.round(red)
          pixels[offset + 1] = Math.round(green)
          pixels[offset + 2] = Math.round(blue)
        }
        break
      }
      case 'opacity':
        pixels[offset + 3] = Math.round(clamp(blendScalar(alpha, strength, assignment)) * 255)
        break
      case 'color':
      case 'highlightColor':
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
      case 'outlineFlash':
      case 'outlineIntensity': {
        const bandThickness = target === 'outlineFlash'
          ? 1 + Math.min(2, Math.floor(absoluteStrength * 1.4))
          : 1
        if (!isBorderBand(bits, index, x, y, width, height, bandThickness)) break
        const mix = clamp(absoluteStrength * (target === 'outlineFlash' ? 1.2 : 1))
        const lift = target === 'outlineFlash' ? Math.round(255 * clamp(absoluteStrength * 0.12, 0, 0.2)) : 0
        pixels[offset] = Math.min(255, Math.round(pixels[offset] + (tint[0] - pixels[offset]) * mix) + lift)
        pixels[offset + 1] = Math.min(255, Math.round(pixels[offset + 1] + (tint[1] - pixels[offset + 1]) * mix) + lift)
        pixels[offset + 2] = Math.min(255, Math.round(pixels[offset + 2] + (tint[2] - pixels[offset + 2]) * mix) + lift)
        pixels[offset + 3] = Math.max(pixels[offset + 3], Math.round(clamp(absoluteStrength * 1.1) * 255))
        break
      }
      case 'sparkle':
      case 'sparkleDensity': {
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
      case 'hueOffset': {
        const rotated = hueRotate(pixels[offset], pixels[offset + 1], pixels[offset + 2], strength)
        pixels[offset] = rotated[0]
        pixels[offset + 1] = rotated[1]
        pixels[offset + 2] = rotated[2]
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
      case 'contrast': {
        const factor = Math.max(0, 1 + strength)
        pixels[offset] = Math.round(clamp((pixels[offset] - 128) * factor + 128, 0, 255))
        pixels[offset + 1] = Math.round(clamp((pixels[offset + 1] - 128) * factor + 128, 0, 255))
        pixels[offset + 2] = Math.round(clamp((pixels[offset + 2] - 128) * factor + 128, 0, 255))
        break
      }
      case 'saturation': {
        const gray = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
        const factor = Math.max(0, 1 + strength)
        pixels[offset] = Math.round(clamp(gray + (pixels[offset] - gray) * factor, 0, 255))
        pixels[offset + 1] = Math.round(clamp(gray + (pixels[offset + 1] - gray) * factor, 0, 255))
        pixels[offset + 2] = Math.round(clamp(gray + (pixels[offset + 2] - gray) * factor, 0, 255))
        break
      }
      case 'threshold': {
        const luminance = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / (255 * 3)
        const next = luminance >= clamp(absoluteStrength) ? 255 : 0
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = next
        break
      }
      case 'checkerAlternation':
        if (((x + y) & 1) !== (absoluteStrength >= 0.5 ? 1 : 0)) pixels[offset + 3] = 0
        break
      case 'rowRecruitment':
        if ((y + 0.5) / height > clamp(absoluteStrength)) pixels[offset + 3] = 0
        break
      case 'columnRecruitment':
        if ((x + 0.5) / width > clamp(absoluteStrength)) pixels[offset + 3] = 0
        break
      default:
        break
    }
  }
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
  authoredAssignments: readonly PixGridReactionAssignment[] = [],
): void {
  const claimed = new Uint32Array(Math.ceil((width * height) / 32))
  const activeGroups = activePixGridGroups(groups)
  const activeGroupIds = new Set(activeGroups.map(group => group.id))
  let activeReactionCount = 0
  for (const group of activeGroups) {
    if (activeReactionCount >= MAX_PIX_GRID_ACTIVE_REACTIONS) break
    if (!groupAppliesToActiveLayers(group, activeLayerIds)) continue
    const compiled = maskResolver?.compile(group) ?? compilePixGridGroupMask(group, width, height)
    if (compiled.cellCount === 0) continue
    const claim = group.overlapBehavior === 'exclusive' || group.overlapBehavior === 'replace'
    const assignments = [
      ...group.reactions.map(assignment => ({ assignment, routeId: `group:${group.id}:${assignment.id}`, defaultScope: 'group' as const })),
      ...authoredAssignments
        .filter(assignment => (assignment.targetScope === 'group' || assignment.targetScope === 'pixels') && (!assignment.targetId || assignment.targetId === group.id))
        .map(assignment => ({ assignment, routeId: `audio:${assignment.id}:${group.id}`, defaultScope: assignment.targetScope ?? 'group' })),
    ].sort((a, b) => {
      const aAssignment = a.assignment
      const bAssignment = b.assignment
      const sourceOrder = Number(!isPixGridContinuousReactionSource(aAssignment.source)) - Number(!isPixGridContinuousReactionSource(bAssignment.source))
      return sourceOrder || (aAssignment.priority ?? 0) - (bAssignment.priority ?? 0) || (aAssignment.eventPriority ?? 0) - (bAssignment.eventPriority ?? 0) || aAssignment.id.localeCompare(bAssignment.id)
    })
    for (const route of assignments) {
      const assignment = route.assignment
      if (activeReactionCount >= MAX_PIX_GRID_ACTIVE_REACTIONS) break
      if (!assignment.enabled) continue
      const compiledAssignment = runtime.compile(assignment, frame, route.defaultScope, route.routeId)
      if (compiledAssignment.targetScope !== 'group' && compiledAssignment.targetScope !== 'pixels') continue
      if (compiledAssignment.target.runtimeHandler !== 'pixel' && compiledAssignment.target.runtimeHandler !== 'transform' && compiledAssignment.target.runtimeHandler !== 'postProcess') continue
      activeReactionCount += 1
      const resolved = runtime.resolveCompiled(
        compiledAssignment,
        frame,
        assignment.id === previewReactionAssignmentId,
        { activeLayerIds, activeGroupIds, currentGroupId: group.id },
      )
      if (!resolved.active) continue
      const strength = resolvePixGridPerceptualStrength(compiledAssignment, resolved.value, compiled.cellCount, width * height)
      applyPixelReaction(pixels, width, height, compiled.bits, assignment, compiledAssignment, strength, frame, group, palette, claimed, claim)
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
  const activeGroups = activePixGridGroups(groups)
  const activeGroupIds = new Set(activeGroups.map(group => group.id))
  const activeLayerIds = new Set([layer.id])
  for (const group of activeGroups) {
    const hasScope = Boolean(group.layerId) || Boolean(group.layerScope?.length)
    const scoped = !hasScope || group.layerId === layer.id || group.layerScope?.includes(layer.id)
    if (!scoped) continue
    const assignments = [...group.reactions].sort((a, b) => {
      const sourceOrder = Number(!isPixGridContinuousReactionSource(a.source)) - Number(!isPixGridContinuousReactionSource(b.source))
      return sourceOrder || (a.eventPriority ?? 0) - (b.eventPriority ?? 0) || a.id.localeCompare(b.id)
    })
    for (const assignment of assignments) {
      if (!assignment.enabled || count >= MAX_PIX_GRID_ACTIVE_REACTIONS) continue
      const compiled = runtime.compile(assignment, frame, 'group', `group:${group.id}:${assignment.id}`)
      if (compiled.target.runtimeHandler !== 'animation') continue
      count += 1
      const resolved = runtime.resolveCompiled(compiled, frame, assignment.id === previewReactionAssignmentId, {
        currentGroupId: group.id,
        currentLayerId: layer.id,
        activeLayerIds,
        activeGroupIds,
      })
      if (!resolved.active) continue
      const value = resolvePixGridPerceptualStrength(compiled, resolved.value)
      if (compiled.target.id === 'animationSpeed') speed = Math.max(0, speed + value)
      else if ((compiled.target.id === 'directionReverse' || compiled.target.id === 'direction' || compiled.target.id === 'reverse') && Math.abs(value) >= 0.5) direction *= -1
      else if (compiled.target.id === 'frameAdvance' || compiled.target.id === 'frameIndex') frameAdvance += value
    }
  }
  if (speed === 1 && direction === 1 && frameAdvance === 0) return frame
  return {
    ...frame,
    audioTime: frame.audioTime * speed * direction + frameAdvance,
  }
}
