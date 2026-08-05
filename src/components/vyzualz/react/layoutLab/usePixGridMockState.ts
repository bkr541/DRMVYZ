import { useCallback, useMemo, useState } from 'react'
import { PIX_GRID_BUILT_IN_ASSETS } from '../pixGrid/PixGridArtwork'
import { PIX_GRID_PRESETS } from '../pixGrid/PixGridPresets'

export type PixGridMockDesignSurface = 'grid' | 'scene' | 'layer' | 'selection' | 'tool'
export type PixGridMockReactSurface = 'routing' | 'events' | 'choreography' | 'analysis'
export type PixGridMockPresetFilter = 'current' | 'favorites' | 'all'
export type PixGridMockMediaFilter = 'all' | 'collections' | 'favorites' | 'images' | 'svg'
export type PixGridMockRouteKind = 'continuous' | 'event'
export type PixGridMockTargetScope = 'output' | 'scene' | 'layer' | 'group' | 'background' | 'transition' | 'palette'

export interface PixGridMockLayer {
  id: string
  name: string
  sourceKind: 'builtIn' | 'media'
  sourceId: string
  sourceLabel: string
  visible: boolean
  locked: boolean
  opacity: number
  position: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
}

export interface PixGridMockScene {
  id: string
  name: string
  layerIds: string[]
  pixelOverrideCount: number
}

export interface PixGridMockMediaItem {
  id: string
  name: string
  kind: 'image' | 'svg' | 'video'
  dimensions: string
  favorite: boolean
  disabledReason: string | null
  collection: string | null
  selected: boolean
}

export interface PixGridMockPreset {
  id: string
  name: string
  description: string
  palette: string[]
  favorite: boolean
  modified: boolean
}

export interface PixGridMockGroup {
  id: string
  name: string
  origin: 'preset' | 'user'
  memberCount: number
  enabled: boolean
  showMaskOverlay: boolean
}

export interface PixGridMockRoute {
  id: string
  name: string
  kind: PixGridMockRouteKind
  origin: 'preset' | 'user' | 'program'
  enabled: boolean
  source: string
  targetScope: PixGridMockTargetScope
  targetId: string | null
  operation: string
  amount: number
  inputMinimum: number
  inputMaximum: number
  outputMinimum: number
  outputMaximum: number
  polarity: string
  curve: string
  decayCurve: string
  threshold: number
  hysteresis: number
  smoothing: number
  attack: number
  hold: number
  release: number
  cooldown: number
  quantization: string
  retrigger: string
  bassReactivity: boolean
  minimumConfidence: number
  fallback: string
  includeSection: string
  excludeSection: string
  sectionPhase: string
  phraseSegment: string
  autoPerformanceOnly: boolean
  activeLayerId: string | null
  activeGroupId: string | null
  minimumEnergy: number
  maximumEnergy: number
  sectionOccurrences: string
  dropOccurrences: string
  priority: number
  blend: string
  previewRevision: number
  modified: boolean
}

export interface PixGridMockStateValue {
  editOpen: boolean
  scenes: PixGridMockScene[]
  layers: PixGridMockLayer[]
  activeSceneId: string
  selectedLayerId: string | null
  previewSceneMode: 'followTrack' | 'selectedScene'
  designSurface: PixGridMockDesignSurface
  selection: { x: number; y: number; width: number; height: number } | null
  undoCount: number
  redoCount: number
  grid: {
    qualityMode: 'adaptive' | 'fixed'
    quality: string
    cellGap: number
    cellRoundness: number
    cellBrightness: number
    glow: number
    diffusion: number
    rgbSubpixels: boolean
    cellGuides: boolean
  }
  tool: {
    tool: string
    paintColor: string
    paintOpacity: number
    eraserMode: string
    zoom: number
  }
  mediaItems: PixGridMockMediaItem[]
  mediaFilter: PixGridMockMediaFilter
  mediaSearch: string
  mediaView: 'grid' | 'list'
  mediaNotice: string | null
  presets: PixGridMockPreset[]
  presetFilter: PixGridMockPresetFilter
  activePresetId: string | null
  groups: PixGridMockGroup[]
  selectedGroupId: string | null
  routes: PixGridMockRoute[]
  selectedContinuousRouteId: string | null
  selectedEventRouteId: string | null
  choreography: {
    programId: string
    autoPerformance: boolean
    intensity: number
    sectionPlan: string
    sectionEnabled: boolean
    densityArc: number
    paletteArc: number
    motionArc: number
    negativeSpace: number
    fourBarMotifs: boolean
    eightBarRecruitment: boolean
    sixteenBarEvolution: boolean
    transitionIn: string
    transitionOut: string
    overrideActive: boolean
  }
  recording: {
    state: 'idle' | 'recording'
    fps: 30 | 60
  }
  nextSceneSerial: number
  nextLayerSerial: number
  nextRouteSerial: number
}

const builtIns = PIX_GRID_BUILT_IN_ASSETS.slice(0, 4)

function builtIn(index: number) {
  return builtIns[index] ?? PIX_GRID_BUILT_IN_ASSETS[0]
}

function createInitialState(): PixGridMockStateValue {
  const layerA: PixGridMockLayer = {
    id: 'mock-layer-reactor',
    name: 'Reactor Core',
    sourceKind: 'builtIn',
    sourceId: builtIn(0)?.id ?? 'pix-grid-built-in',
    sourceLabel: builtIn(0)?.name ?? 'Built-in Artwork',
    visible: true,
    locked: false,
    opacity: 0.92,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 0.68, y: 0.68 },
    rotation: 0,
  }
  const layerB: PixGridMockLayer = {
    id: 'mock-layer-logo',
    name: 'DVYDRM Mark',
    sourceKind: 'media',
    sourceId: 'mock-media-logo',
    sourceLabel: 'Media Library artwork',
    visible: true,
    locked: true,
    opacity: 0.74,
    position: { x: 0.5, y: 0.48 },
    scale: { x: 0.42, y: 0.42 },
    rotation: 0,
  }
  const layerC: PixGridMockLayer = {
    id: 'mock-layer-chevrons',
    name: 'Drop Chevrons',
    sourceKind: 'builtIn',
    sourceId: builtIn(1)?.id ?? builtIn(0)?.id ?? 'pix-grid-built-in',
    sourceLabel: builtIn(1)?.name ?? builtIn(0)?.name ?? 'Built-in Artwork',
    visible: true,
    locked: false,
    opacity: 0.86,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 0.82, y: 0.66 },
    rotation: 0,
  }

  return {
    editOpen: false,
    scenes: [
      { id: 'mock-scene-intro', name: 'Intro Scene', layerIds: [layerA.id, layerB.id], pixelOverrideCount: 12 },
      { id: 'mock-scene-drop', name: 'Drop Scene', layerIds: [layerC.id], pixelOverrideCount: 48 },
    ],
    layers: [layerA, layerB, layerC],
    activeSceneId: 'mock-scene-intro',
    selectedLayerId: layerA.id,
    previewSceneMode: 'followTrack',
    designSurface: 'grid',
    selection: { x: 18, y: 10, width: 12, height: 8 },
    undoCount: 3,
    redoCount: 1,
    grid: {
      qualityMode: 'adaptive',
      quality: 'high',
      cellGap: 0.18,
      cellRoundness: 0.2,
      cellBrightness: 0.9,
      glow: 0.36,
      diffusion: 0.12,
      rgbSubpixels: false,
      cellGuides: true,
    },
    tool: {
      tool: 'select',
      paintColor: '#36d9ff',
      paintOpacity: 0.9,
      eraserMode: 'restore',
      zoom: 1,
    },
    mediaItems: [
      { id: 'mock-media-logo', name: 'DVYDRM Mark.svg', kind: 'svg', dimensions: '1536 × 1024', favorite: true, disabledReason: null, collection: 'Brand Kit', selected: true },
      { id: 'mock-media-poster', name: 'Neon Poster.png', kind: 'image', dimensions: '1200 × 800', favorite: false, disabledReason: null, collection: 'Show Visuals', selected: false },
      { id: 'mock-media-mask', name: 'Diamond Mask.svg', kind: 'svg', dimensions: '512 × 512', favorite: false, disabledReason: null, collection: null, selected: false },
      { id: 'mock-media-video', name: 'Tour Loop.mp4', kind: 'video', dimensions: '1920 × 1080', favorite: false, disabledReason: 'PixGrid accepts still images and SVGs, not video.', collection: 'Show Visuals', selected: false },
    ],
    mediaFilter: 'all',
    mediaSearch: '',
    mediaView: 'grid',
    mediaNotice: null,
    presets: PIX_GRID_PRESETS.map((preset, index) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      palette: Object.values(preset.palette).slice(0, 5),
      favorite: index === 1,
      modified: index === 0,
    })),
    presetFilter: 'current',
    activePresetId: PIX_GRID_PRESETS[0]?.id ?? null,
    groups: [
      { id: 'mock-group-hero', name: 'Hero Typography', origin: 'preset', memberCount: 284, enabled: true, showMaskOverlay: true },
      { id: 'mock-group-accents', name: 'Percussion Accents', origin: 'preset', memberCount: 96, enabled: true, showMaskOverlay: false },
      { id: 'mock-group-user', name: 'Custom Highlight Mask', origin: 'user', memberCount: 42, enabled: true, showMaskOverlay: false },
    ],
    selectedGroupId: 'mock-group-hero',
    routes: [
      {
        id: 'mock-route-bass', name: 'Bass Pressure', kind: 'continuous', origin: 'program', enabled: true,
        source: 'Bass', targetScope: 'group', targetId: 'mock-group-hero', operation: 'Brightness', amount: 1.35,
        inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1, polarity: 'Positive', curve: 'Smoothstep', decayCurve: 'Ease Out',
        threshold: 0.12, hysteresis: 0.04, smoothing: 0.18, attack: 0.02, hold: 0.08, release: 0.28, cooldown: 0.1,
        quantization: 'None', retrigger: 'Restart', bassReactivity: true, minimumConfidence: 0.35, fallback: 'Energy',
        includeSection: 'All sections', excludeSection: 'All sections', sectionPhase: 'Any section phase', phraseSegment: 'Any phrase segment', autoPerformanceOnly: true, activeLayerId: null, activeGroupId: 'mock-group-hero', minimumEnergy: 0.18, maximumEnergy: 1,
        sectionOccurrences: '', dropOccurrences: '', priority: 120, blend: 'Add', previewRevision: 0, modified: false,
      },
      {
        id: 'mock-route-motion', name: 'Phrase Motion Lift', kind: 'continuous', origin: 'user', enabled: true,
        source: 'Phrase Progress', targetScope: 'output', targetId: null, operation: 'Motion', amount: 0.72,
        inputMinimum: 0, inputMaximum: 1, outputMinimum: 0.2, outputMaximum: 1, polarity: 'Positive', curve: 'Ease In Out', decayCurve: 'Ease Out',
        threshold: 0, hysteresis: 0, smoothing: 0.22, attack: 0.02, hold: 0.08, release: 0.2, cooldown: 0,
        quantization: 'None', retrigger: 'Restart', bassReactivity: false, minimumConfidence: 0.2, fallback: 'Beat',
        includeSection: 'All sections', excludeSection: 'Outro', sectionPhase: 'Body', phraseSegment: 'Middle', autoPerformanceOnly: false, activeLayerId: null, activeGroupId: null, minimumEnergy: 0.1, maximumEnergy: 1,
        sectionOccurrences: '', dropOccurrences: '', priority: 80, blend: 'Add', previewRevision: 0, modified: true,
      },
      {
        id: 'mock-route-snare', name: 'Snare Impact', kind: 'event', origin: 'program', enabled: true,
        source: 'Snare Hit', targetScope: 'group', targetId: 'mock-group-accents', operation: 'Flash', amount: 1.8,
        inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1, polarity: 'Positive', curve: 'Linear', decayCurve: 'Ease Out',
        threshold: 0.34, hysteresis: 0.08, smoothing: 0.04, attack: 0.01, hold: 0.06, release: 0.32, cooldown: 0.12,
        quantization: 'Beat', retrigger: 'Extend', bassReactivity: false, minimumConfidence: 0.48, fallback: 'Transient',
        includeSection: 'Build', excludeSection: 'All sections', sectionPhase: 'Any section phase', phraseSegment: 'Late', autoPerformanceOnly: true, activeLayerId: null, activeGroupId: 'mock-group-accents', minimumEnergy: 0.35, maximumEnergy: 1,
        sectionOccurrences: '1, 2, 3', dropOccurrences: '1, 2', priority: 240, blend: 'Max', previewRevision: 0, modified: false,
      },
    ],
    selectedContinuousRouteId: 'mock-route-bass',
    selectedEventRouteId: 'mock-route-snare',
    choreography: {
      programId: 'pix-grid-bass-beacon-performance',
      autoPerformance: true,
      intensity: 0.86,
      sectionPlan: 'drop-body',
      sectionEnabled: true,
      densityArc: 0.92,
      paletteArc: 0.64,
      motionArc: 0.82,
      negativeSpace: 0.24,
      fourBarMotifs: true,
      eightBarRecruitment: true,
      sixteenBarEvolution: true,
      transitionIn: 'Pixel Dissolve',
      transitionOut: 'Palette Fade',
      overrideActive: false,
    },
    recording: { state: 'idle', fps: 30 },
    nextSceneSerial: 3,
    nextLayerSerial: 4,
    nextRouteSerial: 4,
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeState(input: PixGridMockStateValue): PixGridMockStateValue {
  const scenes = input.scenes.length > 0 ? input.scenes : [{ id: 'mock-scene-empty', name: 'Untitled Scene', layerIds: [], pixelOverrideCount: 0 }]
  const activeScene = scenes.find(scene => scene.id === input.activeSceneId) ?? scenes[0]
  const activeLayerIds = new Set(activeScene.layerIds)
  const selectedLayerId = input.selectedLayerId && activeLayerIds.has(input.selectedLayerId)
    ? input.selectedLayerId
    : activeScene.layerIds[0] ?? null
  let designSurface = input.designSurface
  if (designSurface === 'layer' && !selectedLayerId) designSurface = 'grid'
  if (designSurface === 'selection' && !input.selection) designSurface = 'tool'
  const sceneIds = new Set(scenes.map(scene => scene.id))
  const layerIds = new Set(input.layers.map(layer => layer.id))
  const groupIds = new Set(input.groups.map(group => group.id))
  const routes = input.routes.map(route => {
    let targetId = route.targetId
    if (route.targetScope === 'scene' && (!targetId || !sceneIds.has(targetId))) targetId = activeScene.id
    else if (route.targetScope === 'layer' && (!targetId || !activeLayerIds.has(targetId))) targetId = selectedLayerId
    else if (route.targetScope === 'group' && (!targetId || !groupIds.has(targetId))) targetId = input.groups[0]?.id ?? null
    else if (!['scene', 'layer', 'group'].includes(route.targetScope)) targetId = null
    return {
      ...route,
      targetId,
      activeLayerId: route.activeLayerId && layerIds.has(route.activeLayerId) ? route.activeLayerId : null,
      activeGroupId: route.activeGroupId && groupIds.has(route.activeGroupId) ? route.activeGroupId : null,
    }
  })
  const routeIds = new Set(routes.map(route => route.id))
  const continuous = routes.find(route => route.kind === 'continuous')
  const event = routes.find(route => route.kind === 'event')
  return {
    ...input,
    scenes,
    routes,
    activeSceneId: activeScene.id,
    selectedLayerId,
    designSurface,
    selectedContinuousRouteId: input.selectedContinuousRouteId && routeIds.has(input.selectedContinuousRouteId) ? input.selectedContinuousRouteId : continuous?.id ?? null,
    selectedEventRouteId: input.selectedEventRouteId && routeIds.has(input.selectedEventRouteId) ? input.selectedEventRouteId : event?.id ?? null,
    selectedGroupId: input.selectedGroupId && groupIds.has(input.selectedGroupId) ? input.selectedGroupId : null,
  }
}

export interface PixGridMockState extends PixGridMockStateValue {
  activeScene: PixGridMockScene
  activeLayers: PixGridMockLayer[]
  selectedLayer: PixGridMockLayer | null
  selectedGroup: PixGridMockGroup | null
  selectedContinuousRoute: PixGridMockRoute | null
  selectedEventRoute: PixGridMockRoute | null
  setEditOpen: (value: boolean) => void
  selectScene: (sceneId: string) => void
  renameScene: (name: string) => void
  addScene: () => void
  duplicateScene: () => void
  deleteScene: () => void
  selectLayer: (layerId: string | null) => void
  addBuiltInLayer: (sourceId: string, sourceLabel: string) => void
  addMediaLayer: (mediaId: string) => void
  updateLayer: (layerId: string, patch: Partial<PixGridMockLayer>) => void
  moveLayer: (layerId: string, direction: -1 | 1) => void
  duplicateLayer: (layerId: string) => void
  deleteLayer: (layerId: string) => void
  setPreviewSceneMode: (value: 'followTrack' | 'selectedScene') => void
  setDesignSurface: (surface: PixGridMockDesignSurface) => void
  setSelection: (selection: PixGridMockStateValue['selection']) => void
  setGrid: (patch: Partial<PixGridMockStateValue['grid']>) => void
  setTool: (patch: Partial<PixGridMockStateValue['tool']>) => void
  undo: () => void
  redo: () => void
  setMediaFilter: (filter: PixGridMockMediaFilter) => void
  setMediaSearch: (value: string) => void
  setMediaView: (view: 'grid' | 'list') => void
  selectMedia: (id: string) => void
  toggleMediaFavorite: (id: string) => void
  setMediaNotice: (message: string | null) => void
  setPresetFilter: (filter: PixGridMockPresetFilter) => void
  selectPreset: (id: string) => void
  togglePresetFavorite: (id: string) => void
  selectGroup: (id: string | null) => void
  updateGroup: (id: string, patch: Partial<PixGridMockGroup>) => void
  selectRoute: (kind: PixGridMockRouteKind, id: string) => void
  updateRoute: (id: string, patch: Partial<PixGridMockRoute>) => void
  addRoute: (kind: PixGridMockRouteKind) => void
  duplicateRoute: (id: string) => void
  deleteRoute: (id: string) => void
  previewRoute: (id: string) => void
  resetRoute: (id: string) => void
  setChoreography: (patch: Partial<PixGridMockStateValue['choreography']>) => void
  clearOverride: () => void
  resetPerformance: () => void
  setRecordingState: (value: 'idle' | 'recording') => void
  setRecordingFps: (fps: 30 | 60) => void
}

export function usePixGridMockState(): PixGridMockState {
  const [value, setValue] = useState<PixGridMockStateValue>(createInitialState)

  const update = useCallback((recipe: (current: PixGridMockStateValue) => PixGridMockStateValue) => {
    setValue(current => normalizeState(recipe(current)))
  }, [])

  const activeScene = value.scenes.find(scene => scene.id === value.activeSceneId) ?? value.scenes[0]
  const activeLayers = activeScene.layerIds.map(id => value.layers.find(layer => layer.id === id)).filter((layer): layer is PixGridMockLayer => Boolean(layer))
  const selectedLayer = activeLayers.find(layer => layer.id === value.selectedLayerId) ?? null
  const selectedGroup = value.groups.find(group => group.id === value.selectedGroupId) ?? null
  const selectedContinuousRoute = value.routes.find(route => route.id === value.selectedContinuousRouteId && route.kind === 'continuous') ?? null
  const selectedEventRoute = value.routes.find(route => route.id === value.selectedEventRouteId && route.kind === 'event') ?? null

  const actions = useMemo(() => ({
    setEditOpen: (editOpen: boolean) => update(current => ({ ...current, editOpen })),
    selectScene: (sceneId: string) => update(current => ({ ...current, activeSceneId: sceneId, selectedLayerId: current.scenes.find(scene => scene.id === sceneId)?.layerIds[0] ?? null, selection: null })),
    renameScene: (name: string) => update(current => ({ ...current, scenes: current.scenes.map(scene => scene.id === current.activeSceneId ? { ...scene, name: name.trim() || scene.name } : scene), undoCount: current.undoCount + 1, redoCount: 0 })),
    addScene: () => update(current => {
      const id = `mock-scene-${current.nextSceneSerial}`
      return { ...current, scenes: [...current.scenes, { id, name: `Scene ${current.nextSceneSerial}`, layerIds: [], pixelOverrideCount: 0 }], activeSceneId: id, selectedLayerId: null, selection: null, nextSceneSerial: current.nextSceneSerial + 1, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    duplicateScene: () => update(current => {
      const source = current.scenes.find(scene => scene.id === current.activeSceneId) ?? current.scenes[0]
      const sceneId = `mock-scene-${current.nextSceneSerial}`
      let nextLayerSerial = current.nextLayerSerial
      const clonedLayers: PixGridMockLayer[] = []
      const clonedLayerIds = source.layerIds.map(layerId => {
        const sourceLayer = current.layers.find(layer => layer.id === layerId)
        if (!sourceLayer) return layerId
        const id = `mock-layer-${nextLayerSerial++}`
        clonedLayers.push({ ...sourceLayer, id, name: `${sourceLayer.name} Copy`, locked: false })
        return id
      })
      return { ...current, scenes: [...current.scenes, { ...source, id: sceneId, name: `${source.name} Copy`, layerIds: clonedLayerIds }], layers: [...current.layers, ...clonedLayers], activeSceneId: sceneId, selectedLayerId: clonedLayerIds[0] ?? null, selection: null, nextSceneSerial: current.nextSceneSerial + 1, nextLayerSerial, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    deleteScene: () => update(current => {
      if (current.scenes.length <= 1) return current
      const removed = current.scenes.find(scene => scene.id === current.activeSceneId)
      const scenes = current.scenes.filter(scene => scene.id !== current.activeSceneId)
      const removedIds = new Set(removed?.layerIds ?? [])
      return { ...current, scenes, layers: current.layers.filter(layer => !removedIds.has(layer.id)), activeSceneId: scenes[0].id, selectedLayerId: scenes[0].layerIds[0] ?? null, selection: null, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    selectLayer: (selectedLayerId: string | null) => update(current => ({ ...current, selectedLayerId, selection: null })),
    addBuiltInLayer: (sourceId: string, sourceLabel: string) => update(current => {
      const id = `mock-layer-${current.nextLayerSerial}`
      const layer: PixGridMockLayer = { id, name: sourceLabel, sourceKind: 'builtIn', sourceId, sourceLabel, visible: true, locked: false, opacity: 1, position: { x: 0.5, y: 0.5 }, scale: { x: 1, y: 1 }, rotation: 0 }
      return { ...current, layers: [...current.layers, layer], scenes: current.scenes.map(scene => scene.id === current.activeSceneId ? { ...scene, layerIds: [...scene.layerIds, id] } : scene), selectedLayerId: id, designSurface: 'layer', nextLayerSerial: current.nextLayerSerial + 1, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    addMediaLayer: (mediaId: string) => update(current => {
      const media = current.mediaItems.find(item => item.id === mediaId)
      if (!media || media.disabledReason) return current
      const id = `mock-layer-${current.nextLayerSerial}`
      const layer: PixGridMockLayer = { id, name: media.name.replace(/\.[^.]+$/, ''), sourceKind: 'media', sourceId: media.id, sourceLabel: 'Media Library artwork', visible: true, locked: false, opacity: 1, position: { x: 0.5, y: 0.5 }, scale: { x: 1, y: 1 }, rotation: 0 }
      return { ...current, layers: [...current.layers, layer], scenes: current.scenes.map(scene => scene.id === current.activeSceneId ? { ...scene, layerIds: [...scene.layerIds, id] } : scene), selectedLayerId: id, designSurface: 'layer', nextLayerSerial: current.nextLayerSerial + 1, undoCount: current.undoCount + 1, redoCount: 0, mediaNotice: `${media.name} added to ${current.scenes.find(scene => scene.id === current.activeSceneId)?.name ?? 'scene'} locally.` }
    }),
    updateLayer: (layerId: string, patch: Partial<PixGridMockLayer>) => update(current => ({ ...current, layers: current.layers.map(layer => layer.id === layerId ? { ...layer, ...patch, opacity: patch.opacity == null ? layer.opacity : clamp(patch.opacity), rotation: patch.rotation == null ? layer.rotation : Math.max(-180, Math.min(180, patch.rotation)) } : layer), undoCount: current.undoCount + 1, redoCount: 0 })),
    moveLayer: (layerId: string, direction: -1 | 1) => update(current => ({ ...current, scenes: current.scenes.map(scene => {
      if (scene.id !== current.activeSceneId) return scene
      const index = scene.layerIds.indexOf(layerId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= scene.layerIds.length) return scene
      const layerIds = [...scene.layerIds]
      ;[layerIds[index], layerIds[target]] = [layerIds[target], layerIds[index]]
      return { ...scene, layerIds }
    }), undoCount: current.undoCount + 1, redoCount: 0 })),
    duplicateLayer: (layerId: string) => update(current => {
      const source = current.layers.find(layer => layer.id === layerId)
      if (!source || source.locked) return current
      const id = `mock-layer-${current.nextLayerSerial}`
      const layer = { ...source, id, name: `${source.name} Copy` }
      return { ...current, layers: [...current.layers, layer], scenes: current.scenes.map(scene => scene.id === current.activeSceneId ? { ...scene, layerIds: [...scene.layerIds, id] } : scene), selectedLayerId: id, nextLayerSerial: current.nextLayerSerial + 1, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    deleteLayer: (layerId: string) => update(current => {
      const source = current.layers.find(layer => layer.id === layerId)
      if (source?.locked) return current
      return { ...current, layers: current.layers.filter(layer => layer.id !== layerId), scenes: current.scenes.map(scene => ({ ...scene, layerIds: scene.layerIds.filter(id => id !== layerId) })), selectedLayerId: current.selectedLayerId === layerId ? null : current.selectedLayerId, selection: current.selectedLayerId === layerId ? null : current.selection, undoCount: current.undoCount + 1, redoCount: 0 }
    }),
    setPreviewSceneMode: (previewSceneMode: 'followTrack' | 'selectedScene') => update(current => ({ ...current, previewSceneMode })),
    setDesignSurface: (designSurface: PixGridMockDesignSurface) => update(current => ({ ...current, designSurface })),
    setSelection: (selection: PixGridMockStateValue['selection']) => update(current => ({ ...current, selection })),
    setGrid: (patch: Partial<PixGridMockStateValue['grid']>) => update(current => ({ ...current, grid: { ...current.grid, ...patch }, undoCount: current.undoCount + 1, redoCount: 0 })),
    setTool: (patch: Partial<PixGridMockStateValue['tool']>) => update(current => ({ ...current, tool: { ...current.tool, ...patch }, undoCount: current.undoCount + 1, redoCount: 0 })),
    undo: () => update(current => current.undoCount <= 0 ? current : ({ ...current, undoCount: current.undoCount - 1, redoCount: current.redoCount + 1 })),
    redo: () => update(current => current.redoCount <= 0 ? current : ({ ...current, undoCount: current.undoCount + 1, redoCount: current.redoCount - 1 })),
    setMediaFilter: (mediaFilter: PixGridMockMediaFilter) => update(current => ({ ...current, mediaFilter })),
    setMediaSearch: (mediaSearch: string) => update(current => ({ ...current, mediaSearch })),
    setMediaView: (mediaView: 'grid' | 'list') => update(current => ({ ...current, mediaView })),
    selectMedia: (id: string) => update(current => ({ ...current, mediaItems: current.mediaItems.map(item => ({ ...item, selected: item.id === id })), mediaNotice: `${current.mediaItems.find(item => item.id === id)?.name ?? 'Media'} selected locally.` })),
    toggleMediaFavorite: (id: string) => update(current => ({ ...current, mediaItems: current.mediaItems.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item) })),
    setMediaNotice: (mediaNotice: string | null) => update(current => ({ ...current, mediaNotice })),
    setPresetFilter: (presetFilter: PixGridMockPresetFilter) => update(current => ({ ...current, presetFilter })),
    selectPreset: (activePresetId: string) => update(current => ({ ...current, activePresetId, presets: current.presets.map(preset => ({ ...preset, modified: preset.id === activePresetId ? false : preset.modified })), choreography: { ...current.choreography, overrideActive: false } })),
    togglePresetFavorite: (id: string) => update(current => ({ ...current, presets: current.presets.map(preset => preset.id === id ? { ...preset, favorite: !preset.favorite } : preset) })),
    selectGroup: (selectedGroupId: string | null) => update(current => ({ ...current, selectedGroupId })),
    updateGroup: (id: string, patch: Partial<PixGridMockGroup>) => update(current => ({ ...current, groups: current.groups.map(group => group.id === id ? { ...group, ...patch } : group) })),
    selectRoute: (kind: PixGridMockRouteKind, id: string) => update(current => ({ ...current, ...(kind === 'continuous' ? { selectedContinuousRouteId: id } : { selectedEventRouteId: id }) })),
    updateRoute: (id: string, patch: Partial<PixGridMockRoute>) => update(current => ({ ...current, routes: current.routes.map(route => route.id === id ? { ...route, ...patch, modified: true } : route) })),
    addRoute: (kind: PixGridMockRouteKind) => update(current => {
      const id = `mock-route-${current.nextRouteSerial}`
      const route: PixGridMockRoute = {
        id, name: kind === 'continuous' ? `User Continuous Route ${current.nextRouteSerial}` : `User Event Route ${current.nextRouteSerial}`,
        kind, origin: 'user', enabled: true, source: kind === 'continuous' ? 'Energy' : 'Beat', targetScope: 'output', targetId: null,
        operation: kind === 'continuous' ? 'Intensity' : 'Flash', amount: 1, inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1,
        polarity: 'Positive', curve: 'Linear', decayCurve: 'Ease Out', threshold: kind === 'continuous' ? 0 : 0.1, hysteresis: 0, smoothing: 0.15,
        attack: 0.01, hold: 0.05, release: 0.25, cooldown: 0.1, quantization: 'None', retrigger: 'Restart', bassReactivity: false,
        minimumConfidence: 0, fallback: 'Energy', includeSection: 'All sections', excludeSection: 'All sections', sectionPhase: 'Any section phase',
        phraseSegment: 'Any phrase segment', autoPerformanceOnly: false, activeLayerId: null, activeGroupId: null, minimumEnergy: 0, maximumEnergy: 1, sectionOccurrences: '', dropOccurrences: '', priority: 0, blend: 'Add', previewRevision: 0, modified: true,
      }
      return { ...current, routes: [...current.routes, route], ...(kind === 'continuous' ? { selectedContinuousRouteId: id } : { selectedEventRouteId: id }), nextRouteSerial: current.nextRouteSerial + 1 }
    }),
    duplicateRoute: (id: string) => update(current => {
      const source = current.routes.find(route => route.id === id)
      if (!source) return current
      const nextId = `mock-route-${current.nextRouteSerial}`
      const route = { ...source, id: nextId, name: `${source.name} Copy`, origin: 'user' as const, modified: true }
      return { ...current, routes: [...current.routes, route], ...(route.kind === 'continuous' ? { selectedContinuousRouteId: nextId } : { selectedEventRouteId: nextId }), nextRouteSerial: current.nextRouteSerial + 1 }
    }),
    deleteRoute: (id: string) => update(current => {
      const route = current.routes.find(candidate => candidate.id === id)
      if (!route || route.origin !== 'user') return current
      return { ...current, routes: current.routes.filter(candidate => candidate.id !== id) }
    }),
    previewRoute: (id: string) => update(current => ({ ...current, routes: current.routes.map(route => route.id === id ? { ...route, previewRevision: route.previewRevision + 1 } : route) })),
    resetRoute: (id: string) => update(current => ({ ...current, routes: current.routes.map(route => route.id === id ? { ...route, modified: false, previewRevision: 0 } : route) })),
    setChoreography: (patch: Partial<PixGridMockStateValue['choreography']>) => update(current => ({ ...current, choreography: { ...current.choreography, ...patch, overrideActive: true } })),
    clearOverride: () => update(current => ({ ...current, choreography: { ...current.choreography, overrideActive: false }, layers: current.layers.map(layer => ({ ...layer, locked: false })) })),
    resetPerformance: () => update(current => ({ ...current, choreography: createInitialState().choreography })),
    setRecordingState: (state: 'idle' | 'recording') => update(current => ({ ...current, recording: { ...current.recording, state } })),
    setRecordingFps: (fps: 30 | 60) => update(current => ({ ...current, recording: { ...current.recording, fps } })),
  }), [update])

  return {
    ...value,
    activeScene,
    activeLayers,
    selectedLayer,
    selectedGroup,
    selectedContinuousRoute,
    selectedEventRoute,
    ...actions,
  }
}
