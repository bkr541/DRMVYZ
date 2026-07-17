import type { ReactPalette } from '../ReactTypes'
import { compilePixGridGroupMask, pixGridMaskHasCell } from './PixGridGroups'
import type { PixGridAudioFrame, PixGridGroup, PixGridPaletteRole } from './PixGridTypes'
import type { PixGridCompiledGroupMaskResolver } from './PixGridGroupCompiler'

export type PixGridFrameEffectSource = 'performance' | 'cue' | 'manual'
export type PixGridFrameEffectStage = 'persistent' | 'event' | 'manual'
export type PixGridGroupFrameEffectKind =
  | 'brightness'
  | 'opacity'
  | 'flash'
  | 'visibility'
  | 'color'
  | 'dissolve'
  | 'revealRows'
  | 'revealColumns'
  | 'shift'
  | 'invert'
  | 'sparkle'
  | 'outline'

export interface PixGridGroupFrameEffect {
  id: string
  groupId: string
  kind: PixGridGroupFrameEffectKind
  source: PixGridFrameEffectSource
  stage: PixGridFrameEffectStage
  priority: number
  amount: number
  blend?: 'add' | 'multiply' | 'replace' | 'max'
  paletteRole?: PixGridPaletteRole
  color?: string
  x?: number
  y?: number
  from?: 'start' | 'end' | 'center'
  seed?: number
}

export const MAX_PIX_GRID_FRAME_GROUP_EFFECTS = 64

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function randomUnit(value: string): number {
  return hash(value) / 0xffffffff
}

function rgb(value: string | undefined, fallback: readonly [number, number, number]): readonly [number, number, number] {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return fallback
  return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)]
}

function paletteRgb(palette: ReactPalette, role?: PixGridPaletteRole): readonly [number, number, number] {
  return rgb(role ? palette[role] : palette.highlight, [255, 255, 255])
}

function isBorder(bits: Uint32Array, index: number, x: number, y: number, width: number, height: number): boolean {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true
  return (
    !pixGridMaskHasCell(bits, index - 1) ||
    !pixGridMaskHasCell(bits, index + 1) ||
    !pixGridMaskHasCell(bits, index - width) ||
    !pixGridMaskHasCell(bits, index + width)
  )
}

function effectAppliesToActiveLayers(group: PixGridGroup, activeLayerIds?: ReadonlySet<string>): boolean {
  if (!activeLayerIds) return true
  const scope = group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : []
  return scope.length === 0 || scope.some((layerId) => activeLayerIds.has(layerId))
}

function applyShift(pixels: Uint8Array, width: number, height: number, bits: Uint32Array, effect: PixGridGroupFrameEffect): void {
  let count = 0
  for (let index = 0; index < width * height; index += 1) {
    if (pixGridMaskHasCell(bits, index)) count += 1
  }
  if (!count) return
  const source = new Uint8Array(pixels)
  const dx = Math.round((effect.x ?? 0) * width)
  const dy = Math.round((effect.y ?? 0) * height)
  for (let index = 0; index < width * height; index += 1) {
    if (!pixGridMaskHasCell(bits, index)) continue
    pixels[index * 4 + 3] = 0
  }
  for (let index = 0; index < width * height; index += 1) {
    if (!pixGridMaskHasCell(bits, index)) continue
    const x = index % width
    const y = Math.floor(index / width)
    const targetX = x + dx
    const targetY = y + dy
    if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue
    const targetIndex = targetY * width + targetX
    if (!pixGridMaskHasCell(bits, targetIndex)) continue
    const sourceOffset = index * 4
    const targetOffset = targetIndex * 4
    pixels[targetOffset] = source[sourceOffset]
    pixels[targetOffset + 1] = source[sourceOffset + 1]
    pixels[targetOffset + 2] = source[sourceOffset + 2]
    pixels[targetOffset + 3] = Math.max(pixels[targetOffset + 3], source[sourceOffset + 3])
  }
}

function applyEffect(
  pixels: Uint8Array,
  width: number,
  height: number,
  bits: Uint32Array,
  effect: PixGridGroupFrameEffect,
  palette: ReactPalette,
  frame: PixGridAudioFrame,
): void {
  if (effect.kind === 'shift') {
    applyShift(pixels, width, height, bits, effect)
    return
  }
  const amount = Math.max(0, Number.isFinite(effect.amount) ? effect.amount : 0)
  const tint = rgb(effect.color, paletteRgb(palette, effect.paletteRole))
  for (let index = 0; index < width * height; index += 1) {
    if (!pixGridMaskHasCell(bits, index)) continue
    const x = index % width
    const y = Math.floor(index / width)
    const offset = index * 4
    const alpha = pixels[offset + 3] / 255
    switch (effect.kind) {
      case 'brightness': {
        const factor = effect.blend === 'replace' ? amount : effect.blend === 'add' ? 1 + amount : amount
        pixels[offset] = Math.min(255, Math.round(pixels[offset] * clamp(factor, 0, 4)))
        pixels[offset + 1] = Math.min(255, Math.round(pixels[offset + 1] * clamp(factor, 0, 4)))
        pixels[offset + 2] = Math.min(255, Math.round(pixels[offset + 2] * clamp(factor, 0, 4)))
        break
      }
      case 'opacity':
        pixels[offset + 3] = Math.round(clamp(effect.blend === 'replace' ? amount : alpha * amount) * 255)
        break
      case 'flash': {
        const mix = clamp(amount)
        pixels[offset] = Math.min(255, Math.round(pixels[offset] * (1 + amount * 0.75) + (tint[0] - pixels[offset]) * mix))
        pixels[offset + 1] = Math.min(255, Math.round(pixels[offset + 1] * (1 + amount * 0.75) + (tint[1] - pixels[offset + 1]) * mix))
        pixels[offset + 2] = Math.min(255, Math.round(pixels[offset + 2] * (1 + amount * 0.75) + (tint[2] - pixels[offset + 2]) * mix))
        pixels[offset + 3] = Math.max(pixels[offset + 3], Math.round(mix * 255))
        break
      }
      case 'visibility':
        if (amount < 0.5) pixels[offset + 3] = 0
        break
      case 'color': {
        const mix = clamp(amount)
        pixels[offset] = Math.round(pixels[offset] + (tint[0] - pixels[offset]) * mix)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (tint[1] - pixels[offset + 1]) * mix)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (tint[2] - pixels[offset + 2]) * mix)
        break
      }
      case 'dissolve': {
        const identity = `${frame.trackIdentity ?? 'none'}:${effect.seed ?? 0}:${index}`
        if (randomUnit(identity) < clamp(amount)) pixels[offset + 3] = 0
        break
      }
      case 'revealRows': {
        const coordinate = (y + 0.5) / Math.max(1, height)
        const distance = effect.from === 'center' ? Math.abs(coordinate - 0.5) * 2 : effect.from === 'end' ? 1 - coordinate : coordinate
        if (distance > clamp(amount)) pixels[offset + 3] = 0
        break
      }
      case 'revealColumns': {
        const coordinate = (x + 0.5) / Math.max(1, width)
        const distance = effect.from === 'center' ? Math.abs(coordinate - 0.5) * 2 : effect.from === 'end' ? 1 - coordinate : coordinate
        if (distance > clamp(amount)) pixels[offset + 3] = 0
        break
      }
      case 'invert': {
        const mix = clamp(amount)
        pixels[offset] = Math.round(pixels[offset] + (255 - pixels[offset] * 2) * mix)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (255 - pixels[offset + 1] * 2) * mix)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (255 - pixels[offset + 2] * 2) * mix)
        break
      }
      case 'sparkle': {
        const identity = `${frame.trackIdentity ?? 'none'}:${frame.beatIndex ?? 0}:${effect.seed ?? 0}:${index}`
        if (randomUnit(identity) < clamp(amount) * 0.25) {
          pixels[offset] = 255
          pixels[offset + 1] = 255
          pixels[offset + 2] = 255
          pixels[offset + 3] = 255
        }
        break
      }
      case 'outline': {
        if (!isBorder(bits, index, x, y, width, height)) break
        const mix = clamp(amount)
        pixels[offset] = Math.round(pixels[offset] + (tint[0] - pixels[offset]) * mix)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (tint[1] - pixels[offset + 1]) * mix)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (tint[2] - pixels[offset + 2]) * mix)
        pixels[offset + 3] = Math.max(pixels[offset + 3], Math.round(mix * 255))
        break
      }
    }
  }
}

export function sortPixGridGroupFrameEffects(effects: readonly PixGridGroupFrameEffect[]): PixGridGroupFrameEffect[] {
  const stageOrder: Record<PixGridFrameEffectStage, number> = {
    persistent: 0,
    event: 1,
    manual: 2,
  }
  return [...effects]
    .slice(0, MAX_PIX_GRID_FRAME_GROUP_EFFECTS)
    .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage] || a.priority - b.priority || a.id.localeCompare(b.id))
}

export function applyPixGridGroupFrameEffects(
  pixels: Uint8Array,
  width: number,
  height: number,
  groups: readonly PixGridGroup[],
  effects: readonly PixGridGroupFrameEffect[],
  palette: ReactPalette,
  frame: PixGridAudioFrame,
  activeLayerIds?: ReadonlySet<string>,
  maskResolver?: PixGridCompiledGroupMaskResolver,
): void {
  if (!effects.length) return
  const groupById = new Map(groups.map((group) => [group.id, group] as const))
  const compiledByGroupId = new Map<string, ReturnType<typeof compilePixGridGroupMask>>()
  const stageOrder: Record<PixGridFrameEffectStage, number> = {
    persistent: 0,
    event: 1,
    manual: 2,
  }
  const ordered = [...effects].slice(0, MAX_PIX_GRID_FRAME_GROUP_EFFECTS).sort((a, b) => {
    const stage = stageOrder[a.stage] - stageOrder[b.stage]
    const groupPriority = (groupById.get(b.groupId)?.priority ?? 0) - (groupById.get(a.groupId)?.priority ?? 0)
    return stage || groupPriority || a.priority - b.priority || a.id.localeCompare(b.id)
  })
  for (const effect of ordered) {
    const group = groupById.get(effect.groupId)
    if (!group || !group.enabled || !effectAppliesToActiveLayers(group, activeLayerIds)) continue
    let compiled = compiledByGroupId.get(group.id)
    if (!compiled) {
      compiled = maskResolver?.compile(group) ?? compilePixGridGroupMask(group, width, height)
      compiledByGroupId.set(group.id, compiled)
    }
    if (!compiled.cellCount) continue
    applyEffect(pixels, width, height, compiled.bits, effect, palette, frame)
  }
}
