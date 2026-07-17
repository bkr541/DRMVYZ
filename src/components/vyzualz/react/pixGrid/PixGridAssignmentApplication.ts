import type { ReactPalette } from '../ReactTypes'
import type { PixGridResolvedTransition } from './PixGridActionCues'
import { PixGridReactionRuntime } from './PixGridAudioRouting'
import type {
  PixGridAudioFrame,
  PixGridLayer,
  PixGridPaletteRole,
  PixGridReactionAssignment,
  PixGridState,
} from './PixGridTypes'

const PALETTE_ROLES: readonly PixGridPaletteRole[] = ['primary', 'secondary', 'accent', 'highlight', 'background']
const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))

function blend(base: number, value: number, assignment: PixGridReactionAssignment): number {
  switch (assignment.blend) {
    case 'replace': return value
    case 'multiply': return base * value
    case 'max': return Math.max(base, value)
    default: return base + value
  }
}

function rotatePaletteMap(layer: PixGridLayer, offset: number): PixGridLayer['paletteMap'] {
  if (offset === 0) return layer.paletteMap
  const map: PixGridLayer['paletteMap'] = {}
  for (const role of PALETTE_ROLES) {
    const current = layer.paletteMap[role] ?? role
    const index = PALETTE_ROLES.indexOf(current)
    const next = (index + offset) % PALETTE_ROLES.length
    map[role] = PALETTE_ROLES[next < 0 ? next + PALETTE_ROLES.length : next]
  }
  return map
}

function assignmentTargetsLayer(assignment: PixGridReactionAssignment, layer: PixGridLayer): boolean {
  return !assignment.targetId || assignment.targetId === layer.id
}

function applyLayerStateAssignment(layer: PixGridLayer, assignment: PixGridReactionAssignment, strength: number): PixGridLayer {
  if (!assignmentTargetsLayer(assignment, layer)) return layer
  switch (assignment.target) {
    case 'brightness':
    case 'opacity':
      return { ...layer, opacity: clamp(blend(layer.opacity, strength, assignment)) }
    case 'positionX':
      return { ...layer, position: { ...layer.position, x: clamp(blend(layer.position.x, strength * 0.25, assignment)) } }
    case 'positionY':
      return { ...layer, position: { ...layer.position, y: clamp(blend(layer.position.y, strength * 0.25, assignment)) } }
    case 'scale': {
      const multiplier = Math.max(0.05, 1 + strength)
      return { ...layer, scale: { x: clamp(layer.scale.x * multiplier, 0.01, 2), y: clamp(layer.scale.y * multiplier, 0.01, 2) } }
    }
    case 'discreteRotation':
      return { ...layer, rotation: layer.rotation + Math.round(strength * 4) * 90 }
    case 'animationSpeed':
    case 'scrollRate':
      return { ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: clamp(blend(animation.speed, strength, assignment), -20, 20) })) }
    case 'bounceAmount':
      return { ...layer, animations: layer.animations.map(animation => ({ ...animation, amount: clamp(blend(animation.amount, strength, assignment), -4, 4) })) }
    case 'frameAdvance':
      return { ...layer, animations: layer.animations.map(animation => ({ ...animation, phase: animation.phase + strength })) }
    case 'frameIndex':
      return { ...layer, animations: layer.animations.map(animation => ({ ...animation, phase: clamp(strength) })) }
    case 'direction':
    case 'reverse':
    case 'directionReverse':
      return Math.abs(strength) >= 0.5
        ? { ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: -animation.speed })) }
        : layer
    case 'freeze':
      return strength >= 0.5 ? { ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: 0 })) } : layer
    case 'layerRecruitment':
      return { ...layer, visible: layer.visible && strength >= 0.5 }
    case 'paletteIndex':
    case 'paletteCycle':
      return { ...layer, paletteMap: rotatePaletteMap(layer, Math.round(strength * 4)) }
    default:
      return layer
  }
}

export function resolvePixGridAuthoredAssignmentState(
  state: PixGridState,
  frame: PixGridAudioFrame,
  runtime: PixGridReactionRuntime,
): PixGridState {
  if (state.audioAssignments.length === 0) return state
  const activeLayerIds = new Set(state.layers.filter(layer => layer.visible).map(layer => layer.id))
  const activeGroupIds = new Set(state.groups.filter(group => group.enabled).map(group => group.id))
  let result = state
  let layers = state.layers
  let groups = state.groups
  for (const assignment of [...state.audioAssignments].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id))) {
    const compiled = runtime.compile(assignment, frame, 'output')
    const pixelMaskScope = compiled.targetScope === 'group' || compiled.targetScope === 'pixels'
    const outputPostProcess = (compiled.targetScope === 'output' || compiled.targetScope === 'palette')
      && (compiled.target.runtimeHandler === 'postProcess' || compiled.target.runtimeHandler === 'pixel')
    if (pixelMaskScope || outputPostProcess || compiled.target.runtimeHandler === 'transition') continue
    const resolved = runtime.resolveCompiled(compiled, frame, false, { activeLayerIds, activeGroupIds })
    if (!resolved.supported || resolved.blockedByCondition || resolved.blockedByConfidence || !resolved.active) continue
    const strength = compiled.amount * resolved.value
    switch (compiled.targetScope) {
      case 'output':
      case 'scene':
        if (assignment.target === 'globalIntensity' || assignment.target === 'sceneEmphasis' || assignment.target === 'brightness') {
          const globalIntensity = clamp(blend(result.globalIntensity, strength, assignment))
          if (globalIntensity !== result.globalIntensity) result = { ...result, globalIntensity }
        } else if (assignment.target === 'glow') {
          const glowAmount = clamp(blend(result.glowAmount, strength, assignment))
          if (glowAmount !== result.glowAmount) result = { ...result, glowAmount }
        } else if (assignment.target === 'backgroundIntensity') {
          const backgroundBrightness = clamp(blend(result.backgroundBrightness, strength, assignment))
          if (backgroundBrightness !== result.backgroundBrightness) result = { ...result, backgroundBrightness }
        } else if (assignment.target === 'density') {
          const density = clamp(strength)
          const next = layers.map(layer => layer.densityRank <= density ? layer : { ...layer, visible: false })
          if (next.some((layer, index) => layer !== layers[index])) layers = next
        } else if (assignment.target === 'layerRecruitment' || assignment.target === 'freeze' || assignment.target === 'reverse') {
          const next = layers.map(layer => applyLayerStateAssignment(layer, assignment, strength))
          if (next.some((layer, index) => layer !== layers[index])) layers = next
        } else if (assignment.target === 'groupRecruitment') {
          const next = groups.map(group => !assignment.targetId || assignment.targetId === group.id
            ? { ...group, contentVisible: group.contentVisible !== false && strength >= 0.5 }
            : group)
          if (next.some((group, index) => group !== groups[index])) groups = next
        }
        break
      case 'background':
        if (assignment.target === 'backgroundIntensity' || assignment.target === 'brightness' || assignment.target === 'opacity') {
          const backgroundBrightness = clamp(blend(result.backgroundBrightness, strength, assignment))
          if (backgroundBrightness !== result.backgroundBrightness) result = { ...result, backgroundBrightness }
        } else if (assignment.target === 'backgroundColor' && assignment.color && strength >= 0.5) {
          result = { ...result, backgroundColor: assignment.color }
        }
        break
      case 'layer':
      case 'animation':
      case 'palette': {
        const next = layers.map(layer => applyLayerStateAssignment(layer, assignment, strength))
        if (next.some((layer, index) => layer !== layers[index])) layers = next
        break
      }
      case 'group':
        if (assignment.target === 'groupRecruitment') {
          const next = groups.map(group => !assignment.targetId || assignment.targetId === group.id
            ? { ...group, contentVisible: group.contentVisible !== false && strength >= 0.5 }
            : group)
          if (next.some((group, index) => group !== groups[index])) groups = next
        }
        break
      default:
        break
    }
  }
  if (layers !== state.layers) result = { ...result, layers }
  if (groups !== state.groups) result = { ...result, groups }
  return result
}

function hexRgb(value: string): [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'
  return [Number.parseInt(safe.slice(1, 3), 16), Number.parseInt(safe.slice(3, 5), 16), Number.parseInt(safe.slice(5, 7), 16)]
}

function hueRotate(r: number, g: number, b: number, offset: number): [number, number, number] {
  const angle = offset * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    Math.round(clamp((0.213 + cos * 0.787 - sin * 0.213) * r + (0.715 - cos * 0.715 - sin * 0.715) * g + (0.072 - cos * 0.072 + sin * 0.928) * b, 0, 255)),
    Math.round(clamp((0.213 - cos * 0.213 + sin * 0.143) * r + (0.715 + cos * 0.285 + sin * 0.14) * g + (0.072 - cos * 0.072 - sin * 0.283) * b, 0, 255)),
    Math.round(clamp((0.213 - cos * 0.213 - sin * 0.787) * r + (0.715 - cos * 0.715 + sin * 0.715) * g + (0.072 + cos * 0.928 + sin * 0.072) * b, 0, 255)),
  ]
}

export function applyPixGridOutputAssignments(
  pixels: Uint8Array,
  state: PixGridState,
  frame: PixGridAudioFrame,
  runtime: PixGridReactionRuntime,
  palette: ReactPalette,
): void {
  if (state.audioAssignments.length === 0) return
  const activeLayerIds = new Set(state.layers.filter(layer => layer.visible).map(layer => layer.id))
  const activeGroupIds = new Set(state.groups.filter(group => group.enabled).map(group => group.id))
  for (const assignment of state.audioAssignments) {
    const compiled = runtime.compile(assignment, frame, 'output')
    if (compiled.targetScope !== 'output' && compiled.targetScope !== 'palette') continue
    if (compiled.target.runtimeHandler !== 'postProcess' && compiled.target.runtimeHandler !== 'pixel') continue
    const resolved = runtime.resolveCompiled(compiled, frame, false, { activeLayerIds, activeGroupIds })
    if (!resolved.supported || resolved.blockedByCondition || resolved.blockedByConfidence) continue
    const strength = clamp(Math.abs(compiled.amount * resolved.value))
    const tint = hexRgb(assignment.color ?? palette[assignment.paletteRole ?? 'highlight'])
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const r = pixels[offset]
      const g = pixels[offset + 1]
      const b = pixels[offset + 2]
      switch (assignment.target) {
        case 'brightness': {
          const factor = Math.max(0, 1 + compiled.amount * resolved.value)
          pixels[offset] = Math.round(clamp(r * factor, 0, 255))
          pixels[offset + 1] = Math.round(clamp(g * factor, 0, 255))
          pixels[offset + 2] = Math.round(clamp(b * factor, 0, 255))
          break
        }
        case 'opacity': {
          const alpha = pixels[offset + 3] / 255
          pixels[offset + 3] = Math.round(clamp(blend(alpha, compiled.amount * resolved.value, assignment)) * 255)
          break
        }
        case 'contrast': {
          const factor = Math.max(0, 1 + compiled.amount * resolved.value)
          pixels[offset] = clamp((r - 128) * factor + 128, 0, 255)
          pixels[offset + 1] = clamp((g - 128) * factor + 128, 0, 255)
          pixels[offset + 2] = clamp((b - 128) * factor + 128, 0, 255)
          break
        }
        case 'saturation': {
          const gray = r * 0.2126 + g * 0.7152 + b * 0.0722
          const factor = Math.max(0, 1 + compiled.amount * resolved.value)
          pixels[offset] = clamp(gray + (r - gray) * factor, 0, 255)
          pixels[offset + 1] = clamp(gray + (g - gray) * factor, 0, 255)
          pixels[offset + 2] = clamp(gray + (b - gray) * factor, 0, 255)
          break
        }
        case 'threshold': {
          const luminance = (r + g + b) / (255 * 3)
          const value = luminance >= strength ? 255 : 0
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value
          break
        }
        case 'hueOffset': {
          const rotated = hueRotate(r, g, b, compiled.amount * resolved.value)
          pixels[offset] = rotated[0]
          pixels[offset + 1] = rotated[1]
          pixels[offset + 2] = rotated[2]
          break
        }
        case 'invert':
          pixels[offset] = Math.round(r + (255 - r * 2) * strength)
          pixels[offset + 1] = Math.round(g + (255 - g * 2) * strength)
          pixels[offset + 2] = Math.round(b + (255 - b * 2) * strength)
          break
        case 'posterize': {
          const levels = Math.max(2, Math.round(16 - strength * 12))
          const step = 255 / (levels - 1)
          pixels[offset] = Math.round(r / step) * step
          pixels[offset + 1] = Math.round(g / step) * step
          pixels[offset + 2] = Math.round(b / step) * step
          break
        }
        case 'highlightColor':
        case 'color':
        case 'paletteRole':
          pixels[offset] = Math.round(r + (tint[0] - r) * strength)
          pixels[offset + 1] = Math.round(g + (tint[1] - g) * strength)
          pixels[offset + 2] = Math.round(b + (tint[2] - b) * strength)
          break
        default:
          break
      }
    }
  }
}

export function resolvePixGridTransitionAssignment(
  transition: PixGridResolvedTransition | null | undefined,
  state: PixGridState,
  frame: PixGridAudioFrame,
  runtime: PixGridReactionRuntime,
): PixGridResolvedTransition | null | undefined {
  if (!transition) return transition
  let progress = transition.progress
  for (const assignment of state.audioAssignments) {
    if (assignment.target !== 'transitionStrength') continue
    const compiled = runtime.compile(assignment, frame, 'transition')
    if (compiled.targetScope !== 'transition') continue
    const resolved = runtime.resolveCompiled(compiled, frame)
    if (!resolved.supported || resolved.blockedByCondition || resolved.blockedByConfidence) continue
    progress = clamp(blend(progress, compiled.amount * resolved.value, assignment))
  }
  return progress === transition.progress ? transition : { ...transition, progress }
}
