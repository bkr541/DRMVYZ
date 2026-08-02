import { PIX_GRID_BUILT_IN_ASSETS } from './PixGridArtwork'
import { clonePixGridLayer } from './PixGridDefaults'
import { MAX_PIX_GRID_LAYERS, MAX_PIX_GRID_SCENES } from './PixGridLimits'
import type {
  PixGridBuiltInAssetId,
  PixGridCellRect,
  PixGridLayer,
  PixGridPixelOverride,
  PixGridScene,
  PixGridState,
} from './PixGridTypes'
import { normalizePixGridState } from './PixGridValidation'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'

export interface PixGridViewport {
  viewportWidth: number
  viewportHeight: number
  matrixWidth: number
  matrixHeight: number
  zoom: number
  panX: number
  panY: number
}

export interface PixGridOutputRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PixGridCellPoint { x: number; y: number }

export type PixGridOverrideEdit =
  | { kind: 'paint'; color: string; opacity: number }
  | { kind: 'off' }
  | { kind: 'restore' }

function generatedId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function activeScene(state: PixGridState): PixGridScene {
  return state.scenes.find(scene => scene.id === state.selectedSceneId) ?? state.scenes[0]
}

export function getPixGridActiveScene(state: PixGridState): PixGridScene {
  return activeScene(normalizePixGridState(state))
}

export function getPixGridActiveLayers(state: PixGridState): PixGridLayer[] {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const byId = new Map(safe.layers.map(layer => [layer.id, layer]))
  return scene.layerIds.flatMap(id => {
    const layer = byId.get(id)
    return layer ? [layer] : []
  })
}

export function unpackPixGridOverride(override: PixGridPixelOverride): readonly [number, number, 0 | 1, string, number] {
  return typeof override[2] === 'string'
    ? [override[0], override[1], 1, override[2], override[3]]
    : [override[0], override[1], override[2], override[3], override[4]]
}

function overrideKey(x: number, y: number): string {
  return `${x}:${y}`
}

function withActiveScene(state: PixGridState, updater: (scene: PixGridScene) => PixGridScene): PixGridState {
  const safe = normalizePixGridState(state)
  const current = activeScene(safe)
  const nextScene = updater(current)
  return normalizePixGridState({
    ...safe,
    scenes: safe.scenes.map(scene => scene.id === current.id ? nextScene : scene),
    pixelOverrides: nextScene.pixelOverrides,
  })
}

export function resolvePixGridOutputRect(view: PixGridViewport): PixGridOutputRect {
  const vw = Math.max(1, view.viewportWidth)
  const vh = Math.max(1, view.viewportHeight)
  const aspect = Math.max(1, view.matrixWidth) / Math.max(1, view.matrixHeight)
  let width = vw
  let height = width / aspect
  if (height > vh) {
    height = vh
    width = height * aspect
  }
  const zoom = Math.max(0.25, Math.min(16, view.zoom))
  width *= zoom
  height *= zoom
  return {
    left: (vw - width) * 0.5 + view.panX * width,
    top: (vh - height) * 0.5 + view.panY * height,
    width,
    height,
  }
}

export function pixGridViewPointToCell(
  px: number,
  py: number,
  view: PixGridViewport,
  clampToBounds = false,
): PixGridCellPoint | null {
  const rect = resolvePixGridOutputRect(view)
  const u = (px - rect.left) / rect.width
  const v = (py - rect.top) / rect.height
  if (!clampToBounds && (u < 0 || u >= 1 || v < 0 || v >= 1)) return null
  return {
    x: Math.max(0, Math.min(view.matrixWidth - 1, Math.floor(u * view.matrixWidth))),
    y: Math.max(0, Math.min(view.matrixHeight - 1, Math.floor(v * view.matrixHeight))),
  }
}

export function pixGridCellRectToView(rectangle: PixGridCellRect, view: PixGridViewport): PixGridOutputRect {
  const output = resolvePixGridOutputRect(view)
  return {
    left: output.left + rectangle.x / view.matrixWidth * output.width,
    top: output.top + rectangle.y / view.matrixHeight * output.height,
    width: rectangle.width / view.matrixWidth * output.width,
    height: rectangle.height / view.matrixHeight * output.height,
  }
}

export function addPixGridScene(state: PixGridState, name?: string): PixGridState {
  const safe = normalizePixGridState(state)
  if (safe.scenes.length >= MAX_PIX_GRID_SCENES) return safe
  const scene: PixGridScene = {
    id: generatedId('pix-grid-scene'),
    name: name?.trim().slice(0, 96) || `Scene ${safe.scenes.length + 1}`,
    layerIds: [],
    pixelOverrides: [],
  }
  return normalizePixGridState({
    ...safe,
    scenes: [...safe.scenes, scene],
    selectedSceneId: scene.id,
    editor: { ...safe.editor, selectedLayerId: null, selection: null },
    pixelOverrides: [],
  })
}

export function duplicatePixGridScene(state: PixGridState, sceneId = state.selectedSceneId): PixGridState {
  const safe = normalizePixGridState(state)
  if (safe.scenes.length >= MAX_PIX_GRID_SCENES) return safe
  const source = safe.scenes.find(scene => scene.id === sceneId)
  if (!source) return safe
  const layerById = new Map(safe.layers.map(layer => [layer.id, layer]))
  const copies: PixGridLayer[] = []
  const layerIds = source.layerIds.flatMap(id => {
    const layer = layerById.get(id)
    if (!layer || safe.layers.length + copies.length >= MAX_PIX_GRID_LAYERS) return []
    const copy = clonePixGridLayer(layer)
    copy.id = generatedId('pix-grid-layer')
    copy.name = `${layer.name} Copy`.slice(0, 96)
    copy.zIndex = copies.length
    copies.push(copy)
    return [copy.id]
  })
  const scene: PixGridScene = {
    id: generatedId('pix-grid-scene'),
    name: `${source.name} Copy`.slice(0, 96),
    layerIds,
    pixelOverrides: source.pixelOverrides.map(override => [...unpackPixGridOverride(override)] as PixGridPixelOverride),
  }
  return normalizePixGridState({
    ...safe,
    layers: [...safe.layers, ...copies],
    scenes: [...safe.scenes, scene],
    selectedSceneId: scene.id,
    editor: { ...safe.editor, selectedLayerId: layerIds[0] ?? null, selection: null },
    pixelOverrides: scene.pixelOverrides,
  })
}

export function renamePixGridScene(state: PixGridState, sceneId: string, name: string): PixGridState {
  const safe = normalizePixGridState(state)
  const clean = name.trim().slice(0, 96)
  if (!clean) return safe
  return normalizePixGridState({ ...safe, scenes: safe.scenes.map(scene => scene.id === sceneId ? { ...scene, name: clean } : scene) })
}

export function selectPixGridScene(state: PixGridState, sceneId: string): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = safe.scenes.find(candidate => candidate.id === sceneId)
  if (!scene) return safe
  const selectedLayerId = safe.editor.selectedLayerId === null
    ? null
    : scene.layerIds.includes(safe.editor.selectedLayerId)
      ? safe.editor.selectedLayerId
      : scene.layerIds[0] ?? null

  return normalizePixGridState({
    ...safe,
    selectedSceneId: scene.id,
    editor: { ...safe.editor, selectedLayerId, selection: null },
    pixelOverrides: scene.pixelOverrides,
  })
}

export function deletePixGridScene(state: PixGridState, sceneId = state.selectedSceneId): PixGridState {
  const safe = normalizePixGridState(state)
  if (safe.scenes.length <= 1) return safe
  const index = safe.scenes.findIndex(scene => scene.id === sceneId)
  if (index < 0) return safe
  const scenes = safe.scenes.filter(scene => scene.id !== sceneId)
  const next = scenes[Math.min(index, scenes.length - 1)] ?? scenes[0]
  const referenced = new Set(scenes.flatMap(scene => scene.layerIds))
  return normalizePixGridState({
    ...safe,
    scenes,
    layers: safe.layers.filter(layer => referenced.has(layer.id)),
    selectedSceneId: next.id,
    editor: { ...safe.editor, selectedLayerId: next.layerIds[0] ?? null, selection: null },
    pixelOverrides: next.pixelOverrides,
  })
}

function createLayer(assetId: PixGridBuiltInAssetId, name: string, index: number, mediaId: string | null): PixGridLayer {
  return {
    id: generatedId('pix-grid-layer'),
    name: name.slice(0, 96),
    assetId,
    mediaId,
    locked: false,
    visible: true,
    opacity: 1,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    flipX: false,
    flipY: false,
    blendMode: 'normal',
    paletteMap: {},
    zIndex: index,
    clipMode: 'clip',
    maskAssetId: null,
    animations: [],
    densityRank: 0,
    seed: Math.max(1, index + 1),
  }
}

export function addPixGridBuiltInLayer(state: PixGridState, assetId: PixGridBuiltInAssetId): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  if (safe.layers.length >= MAX_PIX_GRID_LAYERS || scene.layerIds.length >= MAX_PIX_GRID_LAYERS) return safe
  const asset = PIX_GRID_BUILT_IN_ASSETS.find(candidate => candidate.id === assetId)
  if (!asset) return safe
  const layer = createLayer(asset.id, asset.name, scene.layerIds.length, null)
  return normalizePixGridState({
    ...safe,
    layers: [...safe.layers, layer],
    scenes: safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds: [...candidate.layerIds, layer.id] } : candidate),
    editor: { ...safe.editor, selectedLayerId: layer.id },
  })
}

export function addPixGridMediaLayer(state: PixGridState, mediaId: string, name = 'Media Artwork'): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const cleanMediaId = mediaId.trim().slice(0, 128)
  if (!cleanMediaId || safe.layers.length >= MAX_PIX_GRID_LAYERS || scene.layerIds.length >= MAX_PIX_GRID_LAYERS) return safe
  const layer = createLayer('pix-bass-word', name, scene.layerIds.length, cleanMediaId)
  return normalizePixGridState({
    ...safe,
    conversion: { ...safe.conversion, selectedMediaId: null },
    layers: [...safe.layers, layer],
    scenes: safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds: [...candidate.layerIds, layer.id] } : candidate),
    editor: { ...safe.editor, selectedLayerId: layer.id },
  })
}

export function updatePixGridLayer(state: PixGridState, layerId: string, patch: Partial<PixGridLayer>): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const current = safe.layers.find(layer => layer.id === layerId)
  if (!current || !scene.layerIds.includes(layerId) || current.locked && !Object.prototype.hasOwnProperty.call(patch, 'locked')) return safe
  const next = clonePixGridLayer({
    ...current,
    ...patch,
    position: patch.position ? { ...patch.position } : current.position,
    scale: patch.scale ? { ...patch.scale } : current.scale,
    paletteMap: patch.paletteMap ? { ...patch.paletteMap } : current.paletteMap,
    animations: patch.animations ? patch.animations.map(animation => ({ ...animation })) : current.animations,
  })
  const referenceCount = safe.scenes.reduce((count, candidate) => count + (candidate.layerIds.includes(layerId) ? 1 : 0), 0)
  const presetId = safe.selectedPresetId ?? safe.configuration.sourcePresetId
  const canonicalLayerIds = new Set(
    (presetId ? PIX_GRID_PRESET_BY_ID.get(presetId)?.pixGridSettings?.layers : undefined)
      ?.map(candidate => candidate.id)
      ?? [],
  )
  // Canonical first-party layers are shared by design. Editing one mutates the
  // stable canonical layer instead of entering generic scene-local copy-on-write,
  // which would otherwise manufacture a new layer on every slider input event.
  if (referenceCount <= 1 || canonicalLayerIds.has(layerId)) {
    return normalizePixGridState({ ...safe, layers: safe.layers.map(layer => layer.id === layerId ? next : layer) })
  }
  if (safe.layers.length >= MAX_PIX_GRID_LAYERS) return safe
  next.id = generatedId('pix-grid-layer')
  const layerIds = scene.layerIds.map(id => id === layerId ? next.id : id)
  return normalizePixGridState({
    ...safe,
    layers: [...safe.layers, next],
    scenes: safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds } : candidate),
    editor: { ...safe.editor, selectedLayerId: next.id },
  })
}

export function resetPixGridLayerTransform(state: PixGridState, layerId: string): PixGridState {
  return updatePixGridLayer(state, layerId, {
    position: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    flipX: false,
    flipY: false,
  })
}

export function reorderPixGridLayer(state: PixGridState, layerId: string, direction: -1 | 1): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const layer = safe.layers.find(candidate => candidate.id === layerId)
  const index = scene.layerIds.indexOf(layerId)
  const target = index + direction
  if (!layer || layer.locked || index < 0 || target < 0 || target >= scene.layerIds.length) return safe
  const layerIds = [...scene.layerIds]
  ;[layerIds[index], layerIds[target]] = [layerIds[target], layerIds[index]]
  return normalizePixGridState({
    ...safe,
    scenes: safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds } : candidate),
  })
}

export function duplicatePixGridLayer(state: PixGridState, layerId: string): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const source = safe.layers.find(layer => layer.id === layerId)
  if (!source || safe.layers.length >= MAX_PIX_GRID_LAYERS || scene.layerIds.length >= MAX_PIX_GRID_LAYERS) return safe
  const copy = clonePixGridLayer(source)
  copy.id = generatedId('pix-grid-layer')
  copy.name = `${source.name} Copy`.slice(0, 96)
  const index = scene.layerIds.indexOf(layerId)
  const layerIds = [...scene.layerIds]
  layerIds.splice(index + 1, 0, copy.id)
  return normalizePixGridState({
    ...safe,
    layers: [...safe.layers, copy],
    scenes: safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds } : candidate),
    editor: { ...safe.editor, selectedLayerId: copy.id },
  })
}

export function deletePixGridLayer(state: PixGridState, layerId: string): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const current = safe.layers.find(layer => layer.id === layerId)
  if (!current || current.locked || !scene.layerIds.includes(layerId)) return safe
  const layerIds = scene.layerIds.filter(id => id !== layerId)
  const scenes = safe.scenes.map(candidate => candidate.id === scene.id ? { ...candidate, layerIds } : candidate)
  const referenced = new Set(scenes.flatMap(candidate => candidate.layerIds))
  return normalizePixGridState({
    ...safe,
    scenes,
    layers: safe.layers.filter(layer => referenced.has(layer.id)),
    editor: { ...safe.editor, selectedLayerId: layerIds[0] ?? null },
  })
}

export function applyPixGridOverride(state: PixGridState, x: number, y: number, edit: PixGridOverrideEdit): PixGridState {
  const safe = normalizePixGridState(state)
  if (x < 0 || y < 0 || x >= safe.matrixWidth || y >= safe.matrixHeight) return safe
  return withActiveScene(safe, scene => {
    const map = new Map(scene.pixelOverrides.map(override => {
      const unpacked = unpackPixGridOverride(override)
      return [overrideKey(unpacked[0], unpacked[1]), unpacked] as const
    }))
    const key = overrideKey(x, y)
    if (edit.kind === 'restore') map.delete(key)
    else if (edit.kind === 'off') map.set(key, [x, y, 0, '#000000', 1])
    else map.set(key, [x, y, 1, edit.color, edit.opacity])
    return { ...scene, pixelOverrides: [...map.values()] }
  })
}

export function applyPixGridPoints(state: PixGridState, points: readonly PixGridCellPoint[], edit: PixGridOverrideEdit): PixGridState {
  const safe = normalizePixGridState(state)
  const bounded = points.filter(point => point.x >= 0 && point.y >= 0 && point.x < safe.matrixWidth && point.y < safe.matrixHeight)
  if (bounded.length === 0) return safe
  return withActiveScene(safe, scene => {
    const map = new Map(scene.pixelOverrides.map(override => {
      const unpacked = unpackPixGridOverride(override)
      return [overrideKey(unpacked[0], unpacked[1]), unpacked] as const
    }))
    for (const point of bounded) {
      const key = overrideKey(point.x, point.y)
      if (edit.kind === 'restore') map.delete(key)
      else if (edit.kind === 'off') map.set(key, [point.x, point.y, 0, '#000000', 1])
      else map.set(key, [point.x, point.y, 1, edit.color, edit.opacity])
    }
    return { ...scene, pixelOverrides: [...map.values()] }
  })
}

export function pixGridLinePoints(a: PixGridCellPoint, b: PixGridCellPoint): PixGridCellPoint[] {
  const points: PixGridCellPoint[] = []
  let x0 = a.x
  let y0 = a.y
  const dx = Math.abs(b.x - x0)
  const sx = x0 < b.x ? 1 : -1
  const dy = -Math.abs(b.y - y0)
  const sy = y0 < b.y ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push({ x: x0, y: y0 })
    if (x0 === b.x && y0 === b.y) break
    const e2 = 2 * error
    if (e2 >= dy) { error += dy; x0 += sx }
    if (e2 <= dx) { error += dx; y0 += sy }
  }
  return points
}

export function pixGridRectanglePoints(a: PixGridCellPoint, b: PixGridCellPoint): PixGridCellPoint[] {
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const bottom = Math.max(a.y, b.y)
  const points = new Map<string, PixGridCellPoint>()
  for (let x = left; x <= right; x += 1) {
    points.set(overrideKey(x, top), { x, y: top })
    points.set(overrideKey(x, bottom), { x, y: bottom })
  }
  for (let y = top; y <= bottom; y += 1) {
    points.set(overrideKey(left, y), { x: left, y })
    points.set(overrideKey(right, y), { x: right, y })
  }
  return [...points.values()]
}

function overrideSignature(override: PixGridPixelOverride | undefined): string {
  if (!override) return 'inherit'
  const [, , mode, color, opacity] = unpackPixGridOverride(override)
  return `${mode}:${color}:${opacity.toFixed(4)}`
}

export function fillPixGridRegion(state: PixGridState, start: PixGridCellPoint, edit: PixGridOverrideEdit): PixGridState {
  const safe = normalizePixGridState(state)
  if (start.x < 0 || start.y < 0 || start.x >= safe.matrixWidth || start.y >= safe.matrixHeight) return safe
  const scene = activeScene(safe)
  const byKey = new Map(scene.pixelOverrides.map(override => {
    const [x, y] = unpackPixGridOverride(override)
    return [overrideKey(x, y), override] as const
  }))
  const target = overrideSignature(byKey.get(overrideKey(start.x, start.y)))
  const queue = [start]
  let cursor = 0
  const seen = new Set<string>()
  const points: PixGridCellPoint[] = []
  while (cursor < queue.length && points.length < safe.matrixWidth * safe.matrixHeight) {
    const point = queue[cursor++]
    const key = overrideKey(point.x, point.y)
    if (seen.has(key)) continue
    seen.add(key)
    if (overrideSignature(byKey.get(key)) !== target) continue
    points.push(point)
    if (point.x > 0) queue.push({ x: point.x - 1, y: point.y })
    if (point.x + 1 < safe.matrixWidth) queue.push({ x: point.x + 1, y: point.y })
    if (point.y > 0) queue.push({ x: point.x, y: point.y - 1 })
    if (point.y + 1 < safe.matrixHeight) queue.push({ x: point.x, y: point.y + 1 })
  }
  return applyPixGridPoints(safe, points, edit)
}

export function createPixGridSelection(a: PixGridCellPoint, b: PixGridCellPoint): PixGridCellRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  }
}

export function movePixGridSelection(state: PixGridState, selection: PixGridCellRect, dx: number, dy: number): PixGridState {
  const safe = normalizePixGridState(state)
  const scene = activeScene(safe)
  const boundedDx = Math.max(-selection.x, Math.min(safe.matrixWidth - selection.x - selection.width, dx))
  const boundedDy = Math.max(-selection.y, Math.min(safe.matrixHeight - selection.y - selection.height, dy))
  const selected = new Set<string>()
  for (let y = selection.y; y < selection.y + selection.height; y += 1) {
    for (let x = selection.x; x < selection.x + selection.width; x += 1) selected.add(overrideKey(x, y))
  }
  const stationary: PixGridPixelOverride[] = []
  const moved: PixGridPixelOverride[] = []
  for (const override of scene.pixelOverrides) {
    const [x, y, mode, color, opacity] = unpackPixGridOverride(override)
    if (!selected.has(overrideKey(x, y))) stationary.push([x, y, mode, color, opacity])
    else {
      const nx = x + boundedDx
      const ny = y + boundedDy
      moved.push([nx, ny, mode, color, opacity])
    }
  }
  const nextSelection = {
    ...selection,
    x: selection.x + boundedDx,
    y: selection.y + boundedDy,
  }
  return normalizePixGridState({
    ...withActiveScene(safe, current => ({ ...current, pixelOverrides: [...stationary, ...moved] })),
    editor: { ...safe.editor, selection: nextSelection },
  })
}
