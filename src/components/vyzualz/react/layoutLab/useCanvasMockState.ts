import { useMemo, useState } from 'react'
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_ENGINE_SETTINGS,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
  type CanvasEngineSettings,
  type CanvasMediaItemType,
  type CanvasPresetId,
  type CanvasPresetSettings,
  type CanvasSectionTriggerType,
  type CanvasVideoTimingSettings,
} from '../ReactTypes'

export type CanvasMockRightTab = 'presets' | 'design' | 'react' | 'output'
export type CanvasMockDesignSurface = 'engine' | 'selection'
export type CanvasMockReactSurface = 'routing' | 'analysis'
export type CanvasMockOutputSurface = 'recording' | 'production'
export type CanvasMockPresetFilter = 'current' | 'favorites' | 'all'
export type CanvasMockMediaRole =
  | 'hero'
  | 'alternateHero'
  | 'background'
  | 'texture'
  | 'foregroundAccent'
  | 'mask'
  | 'transition'
  | 'dropAsset'
  | 'breakdownAsset'
  | 'buildAsset'
  | 'introAsset'
  | 'outroAsset'
export type CanvasMockLayerRole = 'background' | 'hero' | 'texture' | 'foregroundAccent' | 'mask' | 'transition' | 'feedback'

export interface CanvasMockMediaItem {
  id: string
  name: string
  type: CanvasMediaItemType
  source: 'library' | 'legacySession'
  sizeLabel: string
  dimensions: string
  durationSec?: number
  favorite: boolean
  collection: string
  automaticRoles: CanvasMockMediaRole[]
}

export interface CanvasMockPreset {
  id: CanvasPresetId
  name: string
  description: string
  accent: string
  rendererKind: 'standard' | 'particleAura' | 'fragmentCollage'
  favorite: boolean
  modified: boolean
}

export interface CanvasMockOrchestrationSettings {
  enabled: boolean
  autoRoleEnabled: boolean
  mediaPoolIds: string[]
  mediaRolesById: Record<string, CanvasMockMediaRole[]>
  mediaLocksByLayer: Partial<Record<CanvasMockLayerRole, string>>
  layerLocks: Partial<Record<CanvasMockLayerRole, boolean>>
  mediaLock: boolean
  complexity: number
  transitionDensity: number
  effectIntensity: number
  motionIntensity: number
  cutDensity: number
  compositionPreference: string
  programId: string
}

export interface CanvasMockPresetOverride {
  source: 'manual' | 'auto'
  label: string
}

export interface CanvasMockState {
  rightTab: CanvasMockRightTab
  designSurface: CanvasMockDesignSurface
  reactSurface: CanvasMockReactSurface
  outputSurface: CanvasMockOutputSurface
  presetFilter: CanvasMockPresetFilter
  mediaItems: CanvasMockMediaItem[]
  libraryItems: CanvasMockMediaItem[]
  legacyItems: CanvasMockMediaItem[]
  libraryEmpty: boolean
  mediaNotice: string | null
  activeMediaId: string | null
  activeMedia: CanvasMockMediaItem | null
  activeMediaIsVideo: boolean
  manualMediaOverrideId: string | null
  manualMediaOverrideActive: boolean
  engineSettings: CanvasEngineSettings
  orchestration: CanvasMockOrchestrationSettings
  activePoolMedia: CanvasMockMediaItem | null
  presets: CanvasMockPreset[]
  activePresetId: CanvasPresetId
  activePreset: CanvasMockPreset
  presetSettings: CanvasPresetSettings
  presetOverride: CanvasMockPresetOverride | null
  isFractures: boolean
  activeVideoTiming: CanvasVideoTimingSettings
  restartVideoRevision: number
  autoPreviewRevision: number
  recordingActive: boolean
  recordingFps: 30 | 60
  recordingRevision: number
  setRightTab: (tab: CanvasMockRightTab) => void
  setDesignSurface: (surface: CanvasMockDesignSurface) => void
  setReactSurface: (surface: CanvasMockReactSurface) => void
  setOutputSurface: (surface: CanvasMockOutputSurface) => void
  setPresetFilter: (filter: CanvasMockPresetFilter) => void
  selectMedia: (id: string) => void
  clearMediaOverride: () => void
  removeMedia: (id: string) => void
  showEmptyLibrary: () => void
  restoreSampleLibrary: () => void
  setMediaNotice: (notice: string | null) => void
  addToPool: (id: string) => void
  removeFromPool: (id: string) => void
  selectPoolMedia: (id: string) => void
  toggleMediaRole: (id: string, role: CanvasMockMediaRole) => void
  selectPreset: (id: CanvasPresetId) => void
  togglePresetFavorite: (id: CanvasPresetId) => void
  clearPresetOverride: () => void
  setAutoSelectEnabled: (enabled: boolean) => void
  runLocalAutoSelect: () => void
  updateEngineSettings: (patch: Partial<CanvasEngineSettings>) => void
  updateOrchestration: (patch: Partial<CanvasMockOrchestrationSettings>) => void
  setLayerLock: (role: CanvasMockLayerRole, locked: boolean) => void
  setLockedMedia: (role: CanvasMockLayerRole, mediaId: string | null) => void
  resetOrchestration: () => void
  updatePresetSettings: (patch: Partial<CanvasPresetSettings>) => void
  resetPresetSettings: () => void
  updateVideoTiming: (patch: Partial<CanvasVideoTimingSettings>) => void
  toggleSectionTrigger: (section: CanvasSectionTriggerType) => void
  restartVideo: () => void
  setRecordingActive: (active: boolean) => void
  setRecordingFps: (fps: 30 | 60) => void
  exportPngMock: () => void
}

const INITIAL_MEDIA: CanvasMockMediaItem[] = [
  {
    id: 'layout-lab-canvas-aurora-image',
    name: 'Aurora Portrait.png',
    type: 'image',
    source: 'library',
    sizeLabel: '2.4 MB',
    dimensions: '2400 × 1600',
    favorite: true,
    collection: 'DreamVis Visuals',
    automaticRoles: ['hero', 'background'],
  },
  {
    id: 'layout-lab-canvas-prism-video',
    name: 'Prism Tunnel Loop.mp4',
    type: 'video',
    source: 'library',
    sizeLabel: '18.7 MB',
    dimensions: '1920 × 1080',
    durationSec: 12,
    favorite: false,
    collection: 'Performance Loops',
    automaticRoles: ['hero', 'alternateHero', 'dropAsset'],
  },
  {
    id: 'layout-lab-canvas-dvydrm-svg',
    name: 'DVYDRM Mark.svg',
    type: 'svg',
    source: 'legacySession',
    sizeLabel: '86 KB',
    dimensions: '1536 × 1024',
    favorite: false,
    collection: 'Legacy Session',
    automaticRoles: ['foregroundAccent', 'mask'],
  },
]

const DEFAULT_ORCHESTRATION: CanvasMockOrchestrationSettings = {
  enabled: false,
  autoRoleEnabled: true,
  mediaPoolIds: [INITIAL_MEDIA[0].id, INITIAL_MEDIA[1].id],
  mediaRolesById: {},
  mediaLocksByLayer: {},
  layerLocks: {},
  mediaLock: false,
  complexity: 0.5,
  transitionDensity: 0.45,
  effectIntensity: 0.55,
  motionIntensity: 0.5,
  cutDensity: 0.45,
  compositionPreference: 'auto',
  programId: 'canvas-cinematic-bass-editor',
}

const INITIAL_VIDEO_TIMING: Record<string, CanvasVideoTimingSettings> = {
  [INITIAL_MEDIA[1].id]: {
    ...DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
    clipEndSec: 12,
    loopClipRange: true,
    restartOnDrop: true,
  },
}

function settingsForPreset(id: CanvasPresetId): CanvasPresetSettings {
  const preset = CANVAS_PRESETS.find(candidate => candidate.id === id) ?? CANVAS_PRESETS[0]
  return {
    ...DEFAULT_CANVAS_PRESET_SETTINGS,
    ...preset.settings,
    fractureEffectRoleWeights: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS.fractureEffectRoleWeights,
      ...(preset.settings.fractureEffectRoleWeights ?? {}),
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function useCanvasMockState(): CanvasMockState {
  const [rightTab, setRightTab] = useState<CanvasMockRightTab>('design')
  const [designSurface, setDesignSurface] = useState<CanvasMockDesignSurface>('engine')
  const [reactSurface, setReactSurface] = useState<CanvasMockReactSurface>('routing')
  const [outputSurface, setOutputSurface] = useState<CanvasMockOutputSurface>('recording')
  const [presetFilter, setPresetFilter] = useState<CanvasMockPresetFilter>('current')
  const [mediaItems, setMediaItems] = useState<CanvasMockMediaItem[]>(INITIAL_MEDIA)
  const [libraryEmpty, setLibraryEmpty] = useState(false)
  const [mediaNotice, setMediaNotice] = useState<string | null>(null)
  const [activeMediaId, setActiveMediaId] = useState<string | null>(INITIAL_MEDIA[0].id)
  const [manualMediaOverrideId, setManualMediaOverrideId] = useState<string | null>(null)
  const [engineSettings, setEngineSettings] = useState<CanvasEngineSettings>({ ...DEFAULT_CANVAS_ENGINE_SETTINGS })
  const [orchestration, setOrchestration] = useState<CanvasMockOrchestrationSettings>(DEFAULT_ORCHESTRATION)
  const [activePoolMediaId, setActivePoolMediaId] = useState<string | null>(INITIAL_MEDIA[0].id)
  const [activePresetId, setActivePresetId] = useState<CanvasPresetId>('canvas-clean-playback')
  const [favoritePresetIds, setFavoritePresetIds] = useState<CanvasPresetId[]>(['canvas-bass-bloom'])
  const [modifiedPresetIds, setModifiedPresetIds] = useState<CanvasPresetId[]>([])
  const [presetSettings, setPresetSettings] = useState<CanvasPresetSettings>(() => settingsForPreset('canvas-clean-playback'))
  const [presetOverride, setPresetOverride] = useState<CanvasMockPresetOverride | null>(null)
  const [videoTimingById, setVideoTimingById] = useState<Record<string, CanvasVideoTimingSettings>>(INITIAL_VIDEO_TIMING)
  const [restartVideoRevision, setRestartVideoRevision] = useState(0)
  const [autoPreviewRevision, setAutoPreviewRevision] = useState(0)
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordingFps, setRecordingFps] = useState<30 | 60>(60)
  const [recordingRevision, setRecordingRevision] = useState(0)

  const libraryItems = useMemo(
    () => libraryEmpty ? [] : mediaItems.filter(item => item.source === 'library'),
    [libraryEmpty, mediaItems],
  )
  const legacyItems = useMemo(() => mediaItems.filter(item => item.source === 'legacySession'), [mediaItems])
  const activeMedia = useMemo(
    () => mediaItems.find(item => item.id === activeMediaId) ?? null,
    [activeMediaId, mediaItems],
  )
  const activePoolMedia = useMemo(
    () => mediaItems.find(item => item.id === activePoolMediaId && orchestration.mediaPoolIds.includes(item.id)) ?? null,
    [activePoolMediaId, mediaItems, orchestration.mediaPoolIds],
  )
  const presets = useMemo<CanvasMockPreset[]>(() => CANVAS_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    accent: preset.accent,
    rendererKind: preset.rendererKind,
    favorite: favoritePresetIds.includes(preset.id),
    modified: modifiedPresetIds.includes(preset.id),
  })), [favoritePresetIds, modifiedPresetIds])
  const activePreset = presets.find(preset => preset.id === activePresetId) ?? presets[0]
  const activeVideoTiming = activeMedia?.type === 'video'
    ? videoTimingById[activeMedia.id] ?? DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS
    : DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS

  const selectMedia = (id: string) => {
    if (!mediaItems.some(item => item.id === id)) return
    setActiveMediaId(id)
    setManualMediaOverrideId(id)
    setActivePoolMediaId(current => orchestration.mediaPoolIds.includes(id) ? id : current)
  }

  const clearMediaOverride = () => setManualMediaOverrideId(null)

  const removeMedia = (id: string) => {
    setMediaItems(current => current.filter(item => item.id !== id))
    setOrchestration(current => {
      const mediaPoolIds = current.mediaPoolIds.filter(candidate => candidate !== id)
      const mediaRolesById = { ...current.mediaRolesById }
      delete mediaRolesById[id]
      const mediaLocksByLayer = Object.fromEntries(
        Object.entries(current.mediaLocksByLayer).filter(([, mediaId]) => mediaId !== id),
      ) as CanvasMockOrchestrationSettings['mediaLocksByLayer']
      return { ...current, mediaPoolIds, mediaRolesById, mediaLocksByLayer }
    })
    setActiveMediaId(current => current === id ? null : current)
    setManualMediaOverrideId(current => current === id ? null : current)
    setActivePoolMediaId(current => current === id ? null : current)
    setVideoTimingById(current => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setMediaNotice('The sample item was removed from Layout Lab only.')
  }

  const showEmptyLibrary = () => {
    setLibraryEmpty(true)
    setActiveMediaId(null)
    setManualMediaOverrideId(null)
    setActivePoolMediaId(null)
    setOrchestration(current => ({ ...current, mediaPoolIds: [], mediaRolesById: {}, mediaLocksByLayer: {} }))
    setMediaNotice('Empty CANVAS library state enabled. No production media was changed.')
  }

  const restoreSampleLibrary = () => {
    setLibraryEmpty(false)
    setMediaItems(INITIAL_MEDIA)
    setActiveMediaId(INITIAL_MEDIA[0].id)
    setManualMediaOverrideId(null)
    setActivePoolMediaId(INITIAL_MEDIA[0].id)
    setOrchestration(DEFAULT_ORCHESTRATION)
    setVideoTimingById(INITIAL_VIDEO_TIMING)
    setMediaNotice('Deterministic Layout Lab samples restored.')
  }

  const addToPool = (id: string) => {
    if (!mediaItems.some(item => item.id === id)) return
    setOrchestration(current => current.mediaPoolIds.includes(id)
      ? current
      : { ...current, mediaPoolIds: [...current.mediaPoolIds, id] })
    setActivePoolMediaId(id)
  }

  const removeFromPool = (id: string) => {
    setOrchestration(current => {
      const mediaPoolIds = current.mediaPoolIds.filter(candidate => candidate !== id)
      const mediaRolesById = { ...current.mediaRolesById }
      delete mediaRolesById[id]
      const mediaLocksByLayer = Object.fromEntries(
        Object.entries(current.mediaLocksByLayer).filter(([, mediaId]) => mediaId !== id),
      ) as CanvasMockOrchestrationSettings['mediaLocksByLayer']
      return { ...current, mediaPoolIds, mediaRolesById, mediaLocksByLayer }
    })
    setActivePoolMediaId(current => current === id ? null : current)
  }

  const selectPoolMedia = (id: string) => {
    if (!orchestration.mediaPoolIds.includes(id)) return
    setActivePoolMediaId(id)
    setActiveMediaId(id)
  }

  const toggleMediaRole = (id: string, role: CanvasMockMediaRole) => {
    if (!orchestration.mediaPoolIds.includes(id)) return
    setOrchestration(current => {
      const existing = current.mediaRolesById[id] ?? []
      const nextRoles = existing.includes(role)
        ? existing.filter(candidate => candidate !== role)
        : [...existing, role]
      const mediaRolesById = { ...current.mediaRolesById }
      if (nextRoles.length > 0) mediaRolesById[id] = nextRoles
      else delete mediaRolesById[id]
      return { ...current, mediaRolesById }
    })
  }

  const selectPreset = (id: CanvasPresetId) => {
    if (!CANVAS_PRESETS.some(preset => preset.id === id)) return
    setActivePresetId(id)
    setPresetSettings(settingsForPreset(id))
    setPresetOverride({ source: 'manual', label: `${CANVAS_PRESETS.find(preset => preset.id === id)?.name ?? 'CANVAS preset'} is selected` })
    setRecordingActive(false)
    setOutputSurface('recording')
  }

  const togglePresetFavorite = (id: CanvasPresetId) => {
    setFavoritePresetIds(current => current.includes(id)
      ? current.filter(candidate => candidate !== id)
      : [...current, id])
  }

  const clearPresetOverride = () => setPresetOverride(null)

  const setAutoSelectEnabled = (enabled: boolean) => {
    setEngineSettings(current => ({ ...current, autoSelectEnabled: enabled }))
    if (!enabled) setPresetOverride(current => current?.source === 'auto' ? null : current)
  }

  const runLocalAutoSelect = () => {
    setAutoPreviewRevision(revision => revision + 1)
    setEngineSettings(current => ({ ...current, autoSelectEnabled: true }))
    if (mediaItems.length === 0 || libraryEmpty) {
      setPresetOverride(null)
      setMediaNotice('Auto Select preview is waiting for saved CANVAS media.')
      return
    }
    const presetId: CanvasPresetId = autoPreviewRevision % 2 === 0 ? 'canvas-bass-bloom' : 'canvas-glitch-pulse'
    const preset = CANVAS_PRESETS.find(candidate => candidate.id === presetId) ?? CANVAS_PRESETS[0]
    setActivePresetId(presetId)
    setPresetSettings(settingsForPreset(presetId))
    setPresetOverride({ source: 'auto', label: `${preset.name} is selected from the static Drop fixture` })
    if (!manualMediaOverrideId) {
      const video = mediaItems.find(item => item.type === 'video') ?? mediaItems[0]
      setActiveMediaId(video?.id ?? null)
    }
  }

  const updateEngineSettings = (patch: Partial<CanvasEngineSettings>) => {
    setEngineSettings(current => ({ ...current, ...patch }))
  }

  const updateOrchestration = (patch: Partial<CanvasMockOrchestrationSettings>) => {
    setOrchestration(current => ({ ...current, ...patch }))
  }

  const setLayerLock = (role: CanvasMockLayerRole, locked: boolean) => {
    setOrchestration(current => ({
      ...current,
      layerLocks: { ...current.layerLocks, [role]: locked },
    }))
  }

  const setLockedMedia = (role: CanvasMockLayerRole, mediaId: string | null) => {
    setOrchestration(current => {
      const mediaLocksByLayer = { ...current.mediaLocksByLayer }
      if (mediaId) mediaLocksByLayer[role] = mediaId
      else delete mediaLocksByLayer[role]
      return { ...current, mediaLocksByLayer }
    })
  }

  const resetOrchestration = () => {
    const availableIds = mediaItems.filter(item => item.source === 'library').slice(0, 2).map(item => item.id)
    setOrchestration({ ...DEFAULT_ORCHESTRATION, mediaPoolIds: libraryEmpty ? [] : availableIds })
    setActivePoolMediaId(libraryEmpty ? null : availableIds[0] ?? null)
  }

  const updatePresetSettings = (patch: Partial<CanvasPresetSettings>) => {
    setPresetSettings(current => ({
      ...current,
      ...patch,
      fractureEffectRoleWeights: patch.fractureEffectRoleWeights
        ? { ...current.fractureEffectRoleWeights, ...patch.fractureEffectRoleWeights }
        : current.fractureEffectRoleWeights,
    }))
    setModifiedPresetIds(current => current.includes(activePresetId) ? current : [...current, activePresetId])
    setPresetOverride({ source: 'manual', label: 'User-adjusted preset' })
  }

  const resetPresetSettings = () => {
    setPresetSettings(settingsForPreset(activePresetId))
    setModifiedPresetIds(current => current.filter(id => id !== activePresetId))
    setPresetOverride(null)
  }

  const updateVideoTiming = (patch: Partial<CanvasVideoTimingSettings>) => {
    if (!activeMedia || activeMedia.type !== 'video') return
    setVideoTimingById(current => {
      const previous = current[activeMedia.id] ?? DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS
      const clipStartSec = clamp(patch.clipStartSec ?? previous.clipStartSec, 0, 21600)
      const requestedEnd = clamp(patch.clipEndSec ?? previous.clipEndSec, 0, 21600)
      const clipEndSec = requestedEnd > 0 ? Math.max(clipStartSec, requestedEnd) : 0
      return {
        ...current,
        [activeMedia.id]: { ...previous, ...patch, clipStartSec, clipEndSec },
      }
    })
  }

  const toggleSectionTrigger = (section: CanvasSectionTriggerType) => {
    const current = activeVideoTiming.sectionTriggerTypes
    const next = current.includes(section)
      ? current.filter(candidate => candidate !== section)
      : [...current, section]
    if (next.length > 0) updateVideoTiming({ sectionTriggerTypes: next })
  }

  const restartVideo = () => {
    if (!activeMedia || activeMedia.type !== 'video') return
    setRestartVideoRevision(revision => revision + 1)
  }

  const exportPngMock = () => {
    setRecordingRevision(revision => revision + 1)
    setMediaNotice('PNG Frame was simulated locally. No canvas or file API was accessed.')
  }

  return {
    rightTab,
    designSurface,
    reactSurface,
    outputSurface,
    presetFilter,
    mediaItems,
    libraryItems,
    legacyItems,
    libraryEmpty,
    mediaNotice,
    activeMediaId,
    activeMedia,
    activeMediaIsVideo: activeMedia?.type === 'video',
    manualMediaOverrideId,
    manualMediaOverrideActive: Boolean(manualMediaOverrideId && mediaItems.some(item => item.id === manualMediaOverrideId)),
    engineSettings,
    orchestration,
    activePoolMedia,
    presets,
    activePresetId,
    activePreset,
    presetSettings,
    presetOverride,
    isFractures: activePreset.rendererKind === 'fragmentCollage',
    activeVideoTiming,
    restartVideoRevision,
    autoPreviewRevision,
    recordingActive,
    recordingFps,
    recordingRevision,
    setRightTab,
    setDesignSurface,
    setReactSurface,
    setOutputSurface,
    setPresetFilter,
    selectMedia,
    clearMediaOverride,
    removeMedia,
    showEmptyLibrary,
    restoreSampleLibrary,
    setMediaNotice,
    addToPool,
    removeFromPool,
    selectPoolMedia,
    toggleMediaRole,
    selectPreset,
    togglePresetFavorite,
    clearPresetOverride,
    setAutoSelectEnabled,
    runLocalAutoSelect,
    updateEngineSettings,
    updateOrchestration,
    setLayerLock,
    setLockedMedia,
    resetOrchestration,
    updatePresetSettings,
    resetPresetSettings,
    updateVideoTiming,
    toggleSectionTrigger,
    restartVideo,
    setRecordingActive,
    setRecordingFps,
    exportPngMock,
  }
}
