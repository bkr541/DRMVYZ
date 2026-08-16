import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import { Badge } from '../react/controls/Badge'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { loadSavedTrackIntoEngine, SavedTrackLoadCancelledError } from '../../../audio/savedTrackLoader'
import { setShowManagerLinkedAudioTrackId } from '../../../audio/audioSourcePolicy'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { computeViewportRangeLayout, computeWaveformViewport, resolvePositiveDuration, type TimelineViewport } from '../../../features/timeline/timelineViewport'
import { adaptMIAnalysis } from '../../../features/trackIntelligence/trackMapAdapter'
import { navigateBoundaryAlternative, snapBoundaryTime, type SectionBoundarySnapMode } from '../../../features/trackIntelligence/sectionBoundaryDrag'
import { resolveSectionAtTime } from '../../../features/trackIntelligence/authoritativeTimeline'
import type { BeatMarkerMI, BoundaryAlternative } from '../../../features/musicIntelligence/types'
import { useReactStore } from '../../../stores/reactStore'
import { useAudioStore, type SavedAudioTrack } from '../../../stores/audioStore'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../react/ReactControlRows'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import { NoticeCard } from '../react/controls/NoticeCard'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { MoreVerticalIcon } from 'hugeicons-react'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import { PixGridDesignPanel } from '../react/pixGrid/PixGridDesignPanel'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  LASER_DMX_SHOW_DIRECTOR_DEPTH_LAYER_LABELS,
  DEFAULT_REACT_PRESETS,
  LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS,
  type LaserDmxShowDirectorAudioBand,
  type LaserDmxShowDirectorBeatDivision,
  type LaserDmxShowDirectorDepthLayer,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorGoboPattern,
  type LaserDmxShowDirectorLedDirection,
  type LaserDmxShowDirectorMovingHeadPanTiltStyle,
  type LaserDmxShowDirectorScannerConfig,
  type LaserDmxShowDirectorScannerDirection,
  type LaserDmxShowDirectorScannerPatternType,
  type LaserDmxShowDirectorTriggerRetrigger,
  type ReactEngineId,
  type ReactPreset,
  type ReactSectionType,
  type ReactTrackSection,
} from '../react/ReactTypes'
import { FixtureIcon } from '../react/LaserDmxShowDirectorPalette'
import {
  LASER_DMX_SCANNER_PATTERN_OPTIONS,
  createLaserDmxScannerPattern,
  scannerPointsToBeamTargets,
} from '../react/laserDmxScannerAuthoring'
import { ReactPlaceholderCanvas } from '../react/ReactPlaceholderCanvas'
import { CanvasEngineSurface } from '../react/ReactCanvasEngineShell'
import { ReactPersistenceStatus } from '../react/ReactPersistenceStatus'
import { EditSectionForm, SectionTimeline, drawBeatGridCanvas } from '../react/ReactTrackMapStrip'
import type { PixGridLayer } from '../react/pixGrid/PixGridTypes'
import { applyPixGridPresetSettings } from '../react/pixGrid/PixGridState'
import {
  createPixGridDeckGeneratedPreset,
  resolvePixGridDeckPresetReadiness,
} from '../react/pixGrid/PixGridDeckPreset'
import { usePixGridDeckCompilerStore } from '../react/pixGrid/PixGridDeckCompilerRuntime'
import { ingestPixGridDeckSourceFiles } from '../react/pixGrid/PixGridDeckMediaService'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { MediaLibraryBrowser } from '../media/MediaLibraryBrowser'
import { MediaUploadModal } from '../MediaUploadModal'
import { CANVAS_MEDIA_LIBRARY_CAPABILITIES } from '../media/mediaLibraryCapabilities'
import { getCanvasLibraryDisabledReason, getCanvasLibraryMediaType } from '../react/canvasMediaLibraryContract'
import {
  PixGridDeckBuilderInspector,
  PixGridDeckBuilderLibrary,
  PixGridDeckPresetSummary,
  PixGridDeckSequenceStrip,
  type PixGridDeckUploadUiState,
} from './PixGridDeckBuilder'
import {
  LASER_DMX_SHOW_MANAGER_GRID_SIZE,
  LASER_DMX_SHOW_MANAGER_QUALITY,
  LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS,
  createLaserDmxShowManagerEmptyRuntimeShowDirector,
  createLaserDmxShowManagerRuntimeSectionPrograms,
  getEligibleLaserDmxShowManagerFixtureCopySources,
  isLaserDmxShowManagerFixtureKindEnabled,
  parseLaserDmxShowManagerFixtureKind,
  resolveLaserDmxShowManagerGridCell,
  resolveLaserDmxShowManagerTriggerOption,
  describeLaserDmxShowManagerStoredTrigger,
  triggerPatchForLaserDmxShowManagerOption,
  type LaserDmxShowManagerTriggerOption,
  type LaserDmxShowManagerGridCell,
  type LaserDmxShowManagerSection,
  type LaserDmxShowManagerWorkspaceSettingsPatch,
} from './LaserDmxShowManagerDomain'
import {
  getCanvasShowManagerSectionRanges,
  getCanvasShowManagerTotalDuration,
  canvasShowManagerRangeOverlaps,
  type CanvasShowManagerLayer,
  type CanvasShowManagerMediaElement,
  type CanvasShowManagerMediaElementPatch,
  type CanvasShowManagerSectionRange,
  type CanvasShowManagerShow,
  type CanvasShowManagerTransitionDirection,
  type CanvasShowManagerTransitionType,
} from './CanvasShowManagerDomain'
import '../../../styles/reactView.css'
import {
  isShowManagerShowNameAvailable,
  isSupportedShowManagerAudioLibraryItem,
  normalizeShowManagerShowName,
  type ShowManagerEngineId,
  type ShowManagerShowRecord,
} from './ShowManagerDomain'
import '../../../styles/showManager.css'

const COMPONENTS = [
  ['▦', 'Pixel Grid', '12'],
  ['▥', 'Bars', '8'],
  ['✦', 'Lights', '16'],
  ['·', 'Particles', '24'],
  ['ϟ', 'Strobe', '6'],
  ['T', 'Text', '10'],
] as const

const ASSETS = [
  ['▧', 'Textures', '28'],
  ['◇', 'Materials', '14'],
  ['▶', 'Media', '36'],
  ['◈', 'Shaders', '18'],
  ['Aa', 'Fonts', '9'],
] as const

const SHOW_MANAGER_SECTION_COLORS: Record<ReactSectionType, string> = {
  intro: '#61d6aa',
  verse: '#4ac7db',
  build: '#d8b95a',
  preDrop: '#f0a060',
  drop: '#c0314a',
  breakdown: '#b84fc9',
  bridge: '#5b8def',
  outro: '#80dfc0',
  unknown: '#6a7a8a',
}

interface ShowManagerSectionSegment {
  id: string
  label: string
  type: ReactSectionType
  startSec: number
  endSec: number
}

const SHOW_MANAGER_ENGINE_OPTIONS = REACT_ENGINE_IDS.map(engineId => ({
  value: engineId,
  label: REACT_ENGINE_CATALOG[engineId].label,
  description: REACT_ENGINE_CATALOG[engineId].description,
  disabled: engineId !== 'pixGrid' && engineId !== 'laserDmx' && engineId !== 'canvas',
}))

const SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE = 'showManager:pixGridDeckBuilder' as const

type ShowManagerRightInspectorTab = 'inspector' | 'design' | 'react'

const SHOW_MANAGER_RIGHT_INSPECTOR_TABS: RailTabOption<ShowManagerRightInspectorTab>[] = [
  { id: 'inspector', label: 'INSPECTOR' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
]

const TRACK_MAP_TABS = [{ id: 'trackMap' as const, label: 'Track Map' }]

interface ShowBrowserEntry {
  id: string
  name: string
  audioLabel: string
  tagsLabel: string
  groupLabel: string
  copyDisabledReason: string | null
}

interface ShowBrowserActionResult {
  ok: boolean
  error?: string
}

type PendingSectionEngineReplacement = {
  sectionId: string
  sectionLabel: string
  currentEngineId: ShowManagerEngineId
  targetEngineId: Extract<ShowManagerEngineId, 'canvas' | 'laserDmx'>
  action:
    | { type: 'laserFixture'; kind: LaserDmxShowDirectorFixtureKind; cell: LaserDmxShowManagerGridCell }
    | { type: 'laserSettings'; patch: LaserDmxShowManagerWorkspaceSettingsPatch }
    | { type: 'laserFixtureCopy'; sourceSectionId: string }
    | { type: 'canvasMedia'; mediaId: string; layer: CanvasShowManagerLayer }
}

/** In-app replacement for window.confirm() — matches the canonical NewShowDialog chrome. */
function ConfirmDeleteDialog({
  title = 'Delete Show',
  message,
  busy = false,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  onCancel,
  onConfirm,
}: {
  title?: string
  message: string
  busy?: boolean
  confirmLabel?: string
  busyLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const headingId = useId()
  return (
    <div
      className="sm-canvas-dialog-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="sm-canvas-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) onCancel()
        }}
      >
        <h2 id={headingId}>{title}</h2>
        <p>{message}</p>
        <div className="sm-canvas-dialog-actions">
          <IconChipButton type="button" onClick={onCancel} disabled={busy}>Cancel</IconChipButton>
          <IconChipButton type="button" className="dv-icon-chip--danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}

interface ShowBrowserDialogProps {
  shows: readonly ShowBrowserEntry[]
  onClose: () => void
  onOpen: (showId: string) => Promise<ShowBrowserActionResult>
  onCopy: (showId: string) => void
  onDelete: (showId: string) => Promise<ShowBrowserActionResult>
}

function ShowBrowserDialog({
  shows,
  onClose,
  onOpen,
  onCopy,
  onDelete,
}: ShowBrowserDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null)
  const [busyShowId, setBusyShowId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDeleteShow, setPendingDeleteShow] = useState<ShowBrowserEntry | null>(null)
  const busyRef = useRef(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const filteredShows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return shows
    return shows.filter(show => (
      `${show.name} ${show.audioLabel} ${show.tagsLabel} ${show.groupLabel}`.toLowerCase().includes(normalizedQuery)
    ))
  }, [query, shows])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!selectedShowId || filteredShows.some(show => show.id === selectedShowId)) return
    setSelectedShowId(null)
  }, [filteredShows, selectedShowId])

  const openShow = async (showId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusyShowId(showId)
    setActionError(null)
    try {
      const result = await onOpen(showId)
      if (!result.ok) setActionError(result.error ?? 'The Show could not be opened.')
    } finally {
      busyRef.current = false
      setBusyShowId(null)
    }
  }

  const openSelectedShow = () => {
    if (!selectedShowId) return
    void openShow(selectedShowId)
  }

  const deleteShow = (show: ShowBrowserEntry) => {
    if (busyRef.current) return
    setPendingDeleteShow(show)
  }

  const confirmDeleteShow = async () => {
    const show = pendingDeleteShow
    if (!show) return
    setPendingDeleteShow(null)
    busyRef.current = true
    setBusyShowId(show.id)
    setActionError(null)
    try {
      const result = await onDelete(show.id)
      if (!result.ok) setActionError(result.error ?? 'The Show could not be deleted.')
      else if (selectedShowId === show.id) setSelectedShowId(null)
    } finally {
      busyRef.current = false
      setBusyShowId(null)
    }
  }

  return (
    <>
    <div
      className="sm-show-browser-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.currentTarget === event.target && !busyShowId) onClose()
      }}
    >
      <section
        className="sm-show-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="show-browser-heading"
        onKeyDown={event => {
          if (event.key === 'Escape' && !busyShowId) onClose()
          if (event.key === 'Enter' && event.target === searchRef.current && selectedShowId) {
            event.preventDefault()
            openSelectedShow()
          }
        }}
      >
        <header className="sm-show-browser-header">
          <div>
            <span className="sm-show-browser-kicker">Show Manager</span>
            <h2 id="show-browser-heading">Open Show</h2>
          </div>
          <button type="button" className="sm-show-browser-close" onClick={onClose} disabled={Boolean(busyShowId)} aria-label="Close Open Show window">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="sm-show-browser-body">
          <nav className="sm-show-browser-sidebar" aria-label="Show locations">
            <span className="sm-show-browser-sidebar-label">Workspace</span>
            <button type="button" className="is-active">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 6.5h6l2 2h9v10h-17z" />
              </svg>
              <span>All Shows</span>
              <small>{shows.length}</small>
            </button>
          </nav>

          <div className="sm-show-browser-directory">
            <div className="sm-show-browser-toolbar">
              <div className="sm-show-browser-breadcrumb" aria-label="Current folder">
                <span>All Shows</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                <strong>Show Library</strong>
              </div>
              <label className="sm-show-browser-search">
                <span className="sr-only">Search Shows</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
                <DreamVizTextInput
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search Shows"
                  onChange={event => setQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="sm-show-browser-list-header" aria-hidden="true">
              <span>Name</span>
              <span>Audio Track</span>
              <span>Tags</span>
              <span>Group</span>
              <span>Actions</span>
            </div>
            <div className="sm-show-browser-list" role="listbox" aria-label="All Shows">
              {filteredShows.length > 0 ? filteredShows.map(show => (
                <div
                  key={show.id}
                  role="option"
                  aria-selected={show.id === selectedShowId}
                  className={`sm-show-browser-row${show.id === selectedShowId ? ' is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="sm-show-browser-row-main"
                    disabled={Boolean(busyShowId)}
                    onClick={() => {
                      setActionError(null)
                      setSelectedShowId(show.id)
                    }}
                    onDoubleClick={() => void openShow(show.id)}
                    aria-label={`Select Show ${show.name}`}
                  >
                    <span className="sm-show-browser-folder-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3.5 6.5h6l2 2h9v10h-17z" />
                      </svg>
                    </span>
                    <strong>{show.name}</strong>
                  </button>
                  <small title={show.audioLabel}>{show.audioLabel}</small>
                  <small title={show.tagsLabel}>{show.tagsLabel}</small>
                  <small title={show.groupLabel}>{show.groupLabel}</small>
                  <span className="sm-show-browser-row-actions">
                    <button
                      type="button"
                      disabled={Boolean(busyShowId) || Boolean(show.copyDisabledReason)}
                      title={show.copyDisabledReason ?? `Copy ${show.name}`}
                      aria-label={`Copy Show ${show.name}`}
                      onClick={event => {
                        event.stopPropagation()
                        if (busyRef.current) return
                        setActionError(null)
                        onCopy(show.id)
                      }}
                    >Copy</button>
                    <button
                      type="button"
                      disabled={Boolean(busyShowId)}
                      aria-label={`Delete Show ${show.name}`}
                      onClick={event => {
                        event.stopPropagation()
                        deleteShow(show)
                      }}
                    >Delete</button>
                  </span>
                </div>
              )) : (
                <div className="sm-show-browser-empty">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.5 6.5h6l2 2h9v10h-17z" />
                  </svg>
                  <strong>{shows.length === 0 ? 'No Shows yet' : 'No matching Shows'}</strong>
                  <span>{shows.length === 0 ? 'Create a new Show to begin authoring.' : 'Try a different search.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="sm-show-browser-footer">
          <span>{filteredShows.length} {filteredShows.length === 1 ? 'Show' : 'Shows'}</span>
          {actionError && <p className="sm-show-browser-error" role="alert">{actionError}</p>}
          <div>
            <button type="button" onClick={onClose} disabled={Boolean(busyShowId)}>Cancel</button>
            <button type="button" className="is-primary" disabled={!selectedShowId || Boolean(busyShowId)} onClick={openSelectedShow}>
              {busyShowId === selectedShowId ? 'Opening…' : 'Open Show'}
            </button>
          </div>
        </footer>
      </section>
    </div>
    {pendingDeleteShow && (
      <ConfirmDeleteDialog
        message={`Delete Show “${pendingDeleteShow.name}”? This removes only the Show and its authored data. Linked media and audio remain in the library.`}
        busy={busyShowId === pendingDeleteShow.id}
        onCancel={() => setPendingDeleteShow(null)}
        onConfirm={() => void confirmDeleteShow()}
      />
    )}
    </>
  )
}

function formatClock(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function ShowManagerSectionStrip({
  sections,
  durationSec,
  viewport,
  selectedSectionId = null,
  onSelect,
  onContextMenu,
}: {
  sections: readonly ShowManagerSectionSegment[]
  durationSec: number
  viewport: TimelineViewport
  selectedSectionId?: string | null
  onSelect?: (sectionId: string) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>, sectionId: string) => void
}) {
  const safeDuration = Math.max(0.001, durationSec)
  return (
    <div className="rv-section-timeline sm-section-strip" aria-label="Section timeline">
      {sections.map(section => {
        const startSec = Math.max(0, Math.min(safeDuration, section.startSec))
        const endSec = Math.max(startSec, Math.min(safeDuration, section.endSec))
        const layout = computeViewportRangeLayout({ startSec, endSec }, viewport)
        const isSelected = section.id === selectedSectionId
        const selectSection = () => onSelect?.(section.id)
        return (
          <div
            key={section.id}
            data-section-region
            data-start-sec={startSec}
            data-end-sec={endSec}
            className={`rv-section-region${isSelected ? ' rv-section-region--selected' : ''}`}
            title={`${section.label} · ${formatClock(startSec)}–${formatClock(endSec)}`}
            style={{
              display: layout.visible ? undefined : 'none',
              left: `${layout.leftPct}%`,
              width: `${layout.widthPct}%`,
              '--section-color': SHOW_MANAGER_SECTION_COLORS[section.type] ?? SHOW_MANAGER_SECTION_COLORS.unknown,
            } as CSSProperties}
          >
            <div
              className="rv-section-body"
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${section.label}, ${formatClock(startSec)} to ${formatClock(endSec)}`}
              aria-pressed={onSelect ? isSelected : undefined}
              onClick={selectSection}
              onContextMenu={event => {
                if (!onContextMenu) return
                event.preventDefault()
                event.stopPropagation()
                onContextMenu(event, section.id)
              }}
              onKeyDown={event => {
                if (!onSelect || (event.key !== 'Enter' && event.key !== ' ')) return
                event.preventDefault()
                selectSection()
              }}
            >
              <div className="rv-section-header">
                <span className="rv-section-label">{section.label.toUpperCase()}</span>
              </div>
              <span className="rv-section-color-bar" aria-hidden="true" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ShowManagerTrackMapSectionEditor({
  showId,
  section,
  durationSec,
  effectiveBpm,
  beatGrid,
  boundaryAlternatives,
}: {
  showId: string
  section: ReactTrackSection
  durationSec: number
  effectiveBpm: number | null
  beatGrid: BeatMarkerMI[]
  boundaryAlternatives: BoundaryAlternative[]
}) {
  const updateSection = useReactStore(state => state.updateShowManagerTrackMapSection)
  const updateBoundary = useReactStore(state => state.updateShowManagerTrackMapBoundary)
  const [snapMode, setSnapMode] = useState<SectionBoundarySnapMode>(beatGrid.length > 0 ? 'beat' : 'free')
  const [draftRevision, setDraftRevision] = useState(0)

  useEffect(() => {
    setSnapMode(beatGrid.length > 0 ? 'beat' : 'free')
    setDraftRevision(revision => revision + 1)
  }, [beatGrid.length, section.id, showId])

  const commitBoundaryTool = (edge: 'start' | 'end', proposedTime: number) => {
    updateBoundary(showId, section.id, edge, proposedTime, null, null)
  }

  return (
    <EditSectionForm
      key={`${section.id}:${draftRevision}`}
      section={section}
      durationSec={durationSec}
      effectiveBpm={effectiveBpm}
      snapMode={snapMode}
      onSnapModeChange={setSnapMode}
      boundaryAlternatives={boundaryAlternatives}
      onNavigateAlternative={(edge, direction) => {
        const currentTime = edge === 'start' ? section.startSec : section.endSec
        const alternative = navigateBoundaryAlternative(currentTime, boundaryAlternatives, direction)
        if (alternative) commitBoundaryTool(edge, alternative.timeSec)
      }}
      onSnapBoundary={edge => {
        const currentTime = edge === 'start' ? section.startSec : section.endSec
        commitBoundaryTool(edge, snapBoundaryTime(currentTime, beatGrid, snapMode))
      }}
      onCancel={() => setDraftRevision(revision => revision + 1)}
      onSave={patch => updateSection(showId, section.id, patch)}
    />
  )
}

interface NewShowDialogProps {
  copySource?: ShowManagerShowRecord | null
  onClose: () => void
}

function NewShowDialog({ copySource = null, onClose }: NewShowDialogProps) {
  const shows = useReactStore(state => state.showManagerShows)
  const createShow = useReactStore(state => state.createShowManagerShow)
  const duplicateShow = useReactStore(state => state.duplicateShowManagerShow)
  const savedAudioTracks = useAudioStore(state => state.savedTracks)
  const audioLoading = useAudioStore(state => state.loading)
  const audioLoadError = useAudioStore(state => state.loadError)
  const loadSavedTracks = useAudioStore(state => state.loadSavedTracks)
  const collections = useMediaStore(state => state.collections)
  const loadCollections = useMediaStore(state => state.loadCollections)
  const copyMode = Boolean(copySource)
  const [name, setName] = useState(copySource?.name ?? '')
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState(copySource?.linkedAudioTrackId ?? '')
  const [tags, setTags] = useState<string[]>(copySource?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [groupId, setGroupId] = useState(copySource?.groupId ?? '')
  const [nameTouched, setNameTouched] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const headingId = useId()

  useEffect(() => {
    void loadSavedTracks()
    void loadCollections()
  }, [loadCollections, loadSavedTracks])

  // TextInputRow doesn't expose autoFocus, so focus the Show Name field imperatively on mount.
  useEffect(() => {
    document.getElementById('show-manager-new-show-name')?.focus()
  }, [])

  const normalizedName = normalizeShowManagerShowName(name)
  const nameAvailable = isShowManagerShowNameAvailable(shows, name)
  const selectedTrack = savedAudioTracks.find(track => track.dbId === selectedAudioTrackId && isSupportedShowManagerAudioLibraryItem(track)) ?? null
  const copyHasAudioIdentity = Boolean(copySource?.linkedAudioTrackId)
  const selectedGroup = groupId ? collections.find(collection => collection.id === groupId) ?? null : null
  const canCreate = Boolean(normalizedName && nameAvailable && (copyMode ? copyHasAudioIdentity : selectedTrack) && !submitting)

  const addTag = (raw: string) => {
    const next = raw.trim().replace(/\s+/g, ' ')
    if (!next) return
    setTags(current => current.some(tag => tag.toLowerCase() === next.toLowerCase()) ? current : [...current, next])
    setTagDraft('')
  }

  const commit = async () => {
    if (submittingRef.current) return
    setNameTouched(true)
    setSubmitError(null)
    if (!normalizedName || !nameAvailable || (copyMode ? !copyHasAudioIdentity : !selectedTrack)) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const showId = copySource
        ? await duplicateShow(copySource.id, {
            name: normalizedName,
            tags,
            groupId: groupId || null,
          })
        : await createShow({
            name: normalizedName,
            linkedAudioTrackId: selectedTrack!.dbId,
            tags,
            groupId: groupId || null,
            // The left engine picker is a component-library choice. A section is
            // not authored by an engine until the first element/component lands.
            initialEngineId: null,
          })
      if (!showId) {
        setSubmitError(copyMode
          ? 'The Show copy could not be created. Verify the source Show is complete and the new name is unique.'
          : 'The Show could not be created. Check the name and persistence status, then try again.')
        return
      }
      onClose()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="sm-canvas-dialog-backdrop"
        role="presentation"
        onMouseDown={event => {
          if (event.target === event.currentTarget && !submitting) onClose()
        }}
      >
        <form
          className="sm-canvas-dialog sm-new-show-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          onKeyDown={event => {
            if (event.key === 'Escape' && !submitting) onClose()
          }}
          onSubmit={event => {
            event.preventDefault()
            void commit()
          }}
        >
          <h2 id={headingId}>{copyMode ? 'Copy Show' : 'New Show'}</h2>
          <p>{copyMode
            ? 'The complete authored Show will be duplicated. Only Show Name, Tags, and Group can be changed.'
            : 'Every Show requires a unique name and a linked Audio Library track.'}</p>

          <TextInputRow
            id="show-manager-new-show-name"
            label="Show Name *"
            value={name}
            onBlur={() => setNameTouched(true)}
            onChange={value => {
              setName(value)
              setSubmitError(null)
            }}
          />
          {nameTouched && !normalizedName && <p className="sm-canvas-form-error" role="alert">Show Name is required.</p>}
          {nameTouched && normalizedName && !nameAvailable && <p className="sm-canvas-form-error" role="alert">A Show with this name already exists.</p>}

          <div className="sm-new-show-audio-row">
            <SelectRow
              id="show-manager-new-show-audio"
              label="Audio Track *"
              value={selectedAudioTrackId}
              disabled={copyMode || audioLoading || submitting}
              onChange={value => {
                setSelectedAudioTrackId(value)
                setSubmitError(null)
              }}
              options={[
                { value: '', label: audioLoading ? 'Loading Audio Library…' : 'Choose from Audio Library' },
                ...(copyMode && selectedAudioTrackId && !selectedTrack
                  ? [{ value: selectedAudioTrackId, label: `Unavailable linked track · ${selectedAudioTrackId}` }]
                  : []),
                ...savedAudioTracks.filter(isSupportedShowManagerAudioLibraryItem).map(track => ({
                  value: track.dbId, label: track.title || track.fileName,
                })),
              ]}
            />
            {!copyMode && <IconChipButton type="button" onClick={() => setUploadOpen(true)} disabled={submitting}>Upload New Audio</IconChipButton>}
          </div>
          {copyMode && <p className="sm-new-show-field-note">Audio Track is locked to the source Show.</p>}
          {audioLoadError && <p className="sm-new-show-field-note" role="status">{audioLoadError}</p>}

          <div className="rv-ctrl-row">
            <span className="rv-ctrl-label-cluster">
              <label className="rv-ctrl-label" htmlFor="show-manager-new-show-tags">Tags <span className="sm-new-show-optional">Optional</span></label>
            </span>
            <DreamVizTextInput
              id="show-manager-new-show-tags"
              className="rv-ctrl-text-input"
              value={tagDraft}
              placeholder="Type a tag and press Enter"
              onChange={event => setTagDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ',') return
                event.preventDefault()
                addTag(tagDraft)
              }}
              onBlur={() => addTag(tagDraft)}
            />
          </div>
          {tags.length > 0 && (
            <div className="sm-new-show-tags" aria-label="Show tags">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  label={tag}
                  tone="#4ac7db"
                  onRemove={() => setTags(current => current.filter(value => value !== tag))}
                  removeLabel="Remove tag"
                />
              ))}
            </div>
          )}

          <SelectRow
            id="show-manager-new-show-group"
            label="Group (Optional)"
            value={groupId}
            disabled={submitting}
            onChange={setGroupId}
            options={[
              { value: '', label: 'No group' },
              ...(copyMode && groupId && !selectedGroup ? [{ value: groupId, label: `Unavailable group · ${groupId}` }] : []),
              ...collections.map(collection => ({ value: collection.id, label: collection.name })),
            ]}
          />

          {submitError && <p className="sm-canvas-form-error" role="alert">{submitError}</p>}
          <div className="sm-canvas-dialog-actions">
            <IconChipButton type="button" onClick={onClose} disabled={submitting}>Cancel</IconChipButton>
            <IconChipButton type="submit" tone="primary" disabled={!canCreate}>{submitting ? 'Creating…' : (copyMode ? 'Create Copy' : 'Create Show')}</IconChipButton>
          </div>
        </form>
      </div>
      {!copyMode && uploadOpen && (
        <MediaUploadModal
          audioOnly
          onClose={() => setUploadOpen(false)}
          onAudioUploaded={(tracks: SavedAudioTrack[]) => {
            const track = tracks[0]
            if (track && isSupportedShowManagerAudioLibraryItem(track)) setSelectedAudioTrackId(track.dbId)
          }}
        />
      )}
    </>
  )
}

function EmptyShowManagerWorkspace({
  selectedEngineId,
  onEngineChange,
}: {
  selectedEngineId: ReactEngineId
  onEngineChange: (engineId: ReactEngineId) => void
}) {
  return (
    <>
      <aside className="sm-library" aria-label="Show Manager component library">
        <div className="sm-engine-picker">
          <Dropdown
            id="show-manager-engine"
            ariaLabel="Show Manager engine"
            value={selectedEngineId}
            onChange={value => onEngineChange(value as ReactEngineId)}
            options={SHOW_MANAGER_ENGINE_OPTIONS}
            size="compact"
            maxMenuHeight={360}
            className="sm-engine-dropdown"
            menuClassName="sm-engine-dropdown-menu"
          />
        </div>
        <div className="sm-panel-blank" data-testid="show-manager-empty-library" />
      </aside>
      <main className="sm-center" aria-label="Show Manager visualizer and Track Map">
        <div className="sm-stage-frame sm-stage-frame--empty" data-testid="show-manager-empty-visualizer" aria-label="Blank Show Manager visualizer" />
        <div className="sm-timeline sm-timeline--empty" data-testid="show-manager-empty-track-map" aria-label="Empty Show Manager Track Map" />
      </main>
      <aside className="sm-inspector" aria-label={`Show Manager ${REACT_ENGINE_CATALOG[selectedEngineId].label} inspector`}>
        <div className="sm-panel-heading sm-panel-heading--inspector">
          <strong>INSPECTOR</strong>
          <span>No Show open</span>
        </div>
        <div className="sm-panel-blank" data-testid="show-manager-empty-inspector" />
      </aside>
    </>
  )
}

function findPixGridPreset(
  presets: readonly ReactPreset[],
  preferredId: string | null,
): ReactPreset | null {
  const pixGridPresets = presets.filter(preset => preset.engine === 'pixGrid')
  return pixGridPresets.find(preset => preset.id === preferredId) ?? pixGridPresets[0] ?? null
}

export function ShowManagerView() {
  const engine = useSharedAudio()
  const showManagerAudioEngineRef = useRef(engine)
  showManagerAudioEngineRef.current = engine
  const reactPresets = useReactStore(state => state.reactPresets)
  const activeReactPresetId = useReactStore(state => state.activeReactPresetId)
  const selectReactEngine = useReactStore(state => state.selectReactEngine)
  const pixGridState = useReactStore(state => state.pixGridState)
  const pixGridDecks = useReactStore(state => state.pixGridDecks)
  const renamePixGridDeck = useReactStore(state => state.renamePixGridDeck)
  const updatePixGridDeck = useReactStore(state => state.updatePixGridDeck)
  const deletePixGridDeck = useReactStore(state => state.deletePixGridDeck)
  const createPixGridDeckPreset = useReactStore(state => state.createPixGridDeckPreset)
  const reactIntensity = useReactStore(state => state.reactIntensity)
  const reactMotion = useReactStore(state => state.reactMotion)
  const reactGlow = useReactStore(state => state.reactGlow)
  const reactBassReactivity = useReactStore(state => state.reactBassReactivity)
  const pixGridActionCuesByTrackId = useReactStore(state => state.pixGridActionCuesByTrackId)
  const showManagerShows = useReactStore(state => state.showManagerShows)
  const loadShowManagerShowsFromCloud = useReactStore(state => state.loadShowManagerShowsFromCloud)
  const showManagerEditingShowId = useReactStore(state => state.showManagerEditingShowId)
  const deleteShowManagerShow = useReactStore(state => state.deleteShowManagerShow)
  const selectShowManagerShow = useReactStore(state => state.selectShowManagerShow)
  const ensureShowManagerAuthoringMirrors = useReactStore(state => state.ensureShowManagerAuthoringMirrors)
  const replaceShowManagerSectionEngine = useReactStore(state => state.replaceShowManagerSectionEngine)
  const resetShowManagerSession = useReactStore(state => state.resetShowManagerSession)
  const reconcileShowManagerTrackMapFromAnalysis = useReactStore(state => state.reconcileShowManagerTrackMapFromAnalysis)
  const updateShowManagerTrackMapBoundary = useReactStore(state => state.updateShowManagerTrackMapBoundary)
  const laserDmxShowManagerShows = useReactStore(state => state.laserDmxShowManagerShows)
  const laserDmxShowManagerEditingShowId = useReactStore(state => state.laserDmxShowManagerEditingShowId)
  const selectLaserDmxShowManagerShow = useReactStore(state => state.selectLaserDmxShowManagerShow)
  const selectLaserDmxShowManagerSection = useReactStore(state => state.selectLaserDmxShowManagerSection)
  const updateLaserDmxShowManagerSectionWorkspaceSettings = useReactStore(state => state.updateLaserDmxShowManagerSectionWorkspaceSettings)
  const addLaserDmxShowManagerFixture = useReactStore(state => state.addLaserDmxShowManagerFixture)
  const updateLaserDmxShowManagerFixture = useReactStore(state => state.updateLaserDmxShowManagerFixture)
  const removeLaserDmxShowManagerFixture = useReactStore(state => state.removeLaserDmxShowManagerFixture)
  const duplicateLaserDmxShowManagerFixture = useReactStore(state => state.duplicateLaserDmxShowManagerFixture)
  const mirrorLaserDmxShowManagerFixture = useReactStore(state => state.mirrorLaserDmxShowManagerFixture)
  const copyLaserDmxShowManagerFixturesFromSection = useReactStore(state => state.copyLaserDmxShowManagerFixturesFromSection)
  const undoLaserDmxShowManagerEdit = useReactStore(state => state.undoLaserDmxShowManagerEdit)
  const redoLaserDmxShowManagerEdit = useReactStore(state => state.redoLaserDmxShowManagerEdit)
  const beginLaserDmxShowManagerHistoryTransaction = useReactStore(state => state.beginLaserDmxShowManagerHistoryTransaction)
  const commitLaserDmxShowManagerHistoryTransaction = useReactStore(state => state.commitLaserDmxShowManagerHistoryTransaction)
  const cancelLaserDmxShowManagerHistoryTransaction = useReactStore(state => state.cancelLaserDmxShowManagerHistoryTransaction)
  const laserShowUndoDepth = useReactStore(state => state.showManagerUndoStack.length)
  const laserShowRedoDepth = useReactStore(state => state.showManagerRedoStack.length)
  const saveLaserDmxShowManagerShow = useReactStore(state => state.saveLaserDmxShowManagerShow)
  const canvasShowManagerShows = useReactStore(state => state.canvasShowManagerShows)
  const canvasShowManagerActiveShowId = useReactStore(state => state.canvasShowManagerActiveShowId)
  const canvasShowManagerEditingShowId = useReactStore(state => state.canvasShowManagerEditingShowId)
  const canvasShowManagerEditingElementId = useReactStore(state => state.canvasShowManagerEditingElementId)
  const selectCanvasShowManagerShow = useReactStore(state => state.selectCanvasShowManagerShow)
  const selectCanvasShowManagerSection = useReactStore(state => state.selectCanvasShowManagerSection)
  const selectCanvasShowManagerMediaElement = useReactStore(state => state.selectCanvasShowManagerMediaElement)
  const renameCanvasShowManagerShow = useReactStore(state => state.renameCanvasShowManagerShow)
  const addCanvasShowManagerMediaElement = useReactStore(state => state.addCanvasShowManagerMediaElement)
  const updateCanvasShowManagerMediaElement = useReactStore(state => state.updateCanvasShowManagerMediaElement)
  const removeCanvasShowManagerMediaElement = useReactStore(state => state.removeCanvasShowManagerMediaElement)
  const undoCanvasShowManagerEdit = useReactStore(state => state.undoCanvasShowManagerEdit)
  const redoCanvasShowManagerEdit = useReactStore(state => state.redoCanvasShowManagerEdit)
  const canvasShowUndoDepth = useReactStore(state => state.canvasShowManagerUndoStack.length)
  const canvasShowRedoDepth = useReactStore(state => state.canvasShowManagerRedoStack.length)
  const beginCanvasShowManagerHistoryTransaction = useReactStore(state => state.beginCanvasShowManagerHistoryTransaction)
  const commitCanvasShowManagerHistoryTransaction = useReactStore(state => state.commitCanvasShowManagerHistoryTransaction)
  const saveCanvasShowManagerShow = useReactStore(state => state.saveCanvasShowManagerShow)
  const sharedMediaItems = useMediaStore(state => state.items)
  const mediaCollections = useMediaStore(state => state.collections)
  const loadMediaCollections = useMediaStore(state => state.loadCollections)
  const savedAudioTracks = useAudioStore(state => state.savedTracks)
  const loadSavedAudioTracks = useAudioStore(state => state.loadSavedTracks)
  const getSavedAudioSignedUrl = useAudioStore(state => state.getSignedUrl)
  const waveformZoom = useVisualStore(state => state.waveformZoom)
  const [showManagerSessionReady, setShowManagerSessionReady] = useState(false)
  const [rightInspectorTab, setRightInspectorTab] = useState<ShowManagerRightInspectorTab>('inspector')
  const [selectedEngineId, setSelectedEngineId] = useState<ReactEngineId>('pixGrid')
  const [selectedShowManagerSectionId, setSelectedShowManagerSectionId] = useState<string | null>(null)
  const [selectedLightingComponentKind, setSelectedLightingComponentKind] = useState<LaserDmxShowDirectorFixtureKind | null>(null)
  const [selectedLaserFixtureId, setSelectedLaserFixtureId] = useState<string | null>(null)
  const [laserFixtureContextMenu, setLaserFixtureContextMenu] = useState<{ fixtureId: string; x: number; y: number } | null>(null)
  const [laserSectionContextMenu, setLaserSectionContextMenu] = useState<{ sectionId: string; x: number; y: number } | null>(null)
  const [laserSectionCopyMenu, setLaserSectionCopyMenu] = useState<{ sectionId: string; x: number; y: number } | null>(null)
  const [laserEndpointTargetingFixtureId, setLaserEndpointTargetingFixtureId] = useState<string | null>(null)
  const [copyLaserFixturesEnabled, setCopyLaserFixturesEnabled] = useState(false)
  const [copyLaserFixturesSourceSectionId, setCopyLaserFixturesSourceSectionId] = useState<string | null>(null)
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'default' | typeof SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE>('default')
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [deckDraftName, setDeckDraftName] = useState('Untitled Deck')
  const [deckNameError, setDeckNameError] = useState<string | null>(null)
  const [previewDeckItemId, setPreviewDeckItemId] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<PixGridDeckUploadUiState>({
    active: false,
    phase: 'Ready',
    error: null,
    warnings: [],
  })
  const deckBuilderHeadingRef = useRef<HTMLDivElement | null>(null)
  const deckBuilderReturnTargetRef = useRef<'create' | 'edit'>('create')
  const uploadAbortRef = useRef<AbortController | null>(null)
  const uploadOperationRef = useRef(0)
  const [laserSavePending, setLaserSavePending] = useState<'save' | 'active' | null>(null)
  const [laserSaveStatus, setLaserSaveStatus] = useState<string | null>(null)
  const [canvasSavePending, setCanvasSavePending] = useState<'save' | 'active' | null>(null)
  const [canvasSaveStatus, setCanvasSaveStatus] = useState<string | null>(null)
  const [showBrowserOpen, setShowBrowserOpen] = useState(false)
  const [newShowOpen, setNewShowOpen] = useState(false)
  const [copySourceShowId, setCopySourceShowId] = useState<string | null>(null)
  const [canvasRenameDraft, setCanvasRenameDraft] = useState('')
  const [canvasRenameError, setCanvasRenameError] = useState<string | null>(null)
  const [canvasLibraryMediaId, setCanvasLibraryMediaId] = useState<string | null>(null)
  const [canvasAuthoringError, setCanvasAuthoringError] = useState<string | null>(null)
  const [pixGridCanvasDragActive, setPixGridCanvasDragActive] = useState(false)
  const [pixGridHoveredCanvasLayer, setPixGridHoveredCanvasLayer] = useState<CanvasShowManagerLayer | null>(null)
  const [pendingSectionEngineReplacement, setPendingSectionEngineReplacement] = useState<PendingSectionEngineReplacement | null>(null)
  const [pendingDeleteCanvasShow, setPendingDeleteCanvasShow] = useState<{ id: string; name: string } | null>(null)
  const [deletingCanvasShow, setDeletingCanvasShow] = useState(false)
  const [canvasPlayheadSec, setCanvasPlayheadSec] = useState(0)
  const [linkedAudioLoadError, setLinkedAudioLoadError] = useState<string | null>(null)
  const showOpenOperationRef = useRef(0)
  const compilerStatuses = usePixGridDeckCompilerStore(state => state.statuses)
  const transitionStatuses = usePixGridDeckCompilerStore(state => state.transitionStatuses)
  const activeShowManagerShow = useMemo(
    () => showManagerSessionReady
      ? showManagerShows.find(show => show.id === showManagerEditingShowId) ?? null
      : null,
    [showManagerEditingShowId, showManagerSessionReady, showManagerShows],
  )
  const showTrackMap = activeShowManagerShow?.trackMap ?? null
  const resolvedTrackSections = useMemo(() => showTrackMap?.sections ?? [], [showTrackMap])
  const selectedShowManagerSection = resolvedTrackSections.find(section => section.id === selectedShowManagerSectionId)
    ?? resolvedTrackSections[0]
    ?? null
  const activeSectionEngineId = selectedShowManagerSection?.engineId ?? null

  useLayoutEffect(() => {
    setShowManagerLinkedAudioTrackId(activeShowManagerShow?.linkedAudioTrackId ?? null)
    return () => setShowManagerLinkedAudioTrackId(null)
  }, [activeShowManagerShow?.linkedAudioTrackId])
  const showManagerLinkedAudioReady = Boolean(
    activeShowManagerShow?.linkedAudioTrackId
      && engine.currentAudioTrackId === activeShowManagerShow.linkedAudioTrackId,
  )
  const hasOpenShow = activeShowManagerShow !== null
  const activeLaserDmxShow = useMemo(
    () => activeShowManagerShow
      ? laserDmxShowManagerShows.find(show => show.id === activeShowManagerShow.id) ?? null
      : null,
    [activeShowManagerShow, laserDmxShowManagerShows],
  )
  const activeCanvasShow = useMemo(
    () => activeShowManagerShow
      ? canvasShowManagerShows.find(show => show.id === activeShowManagerShow.id) ?? null
      : null,
    [activeShowManagerShow, canvasShowManagerShows],
  )
  const activeCanvasSection = useMemo(
    () => activeCanvasShow?.sections.find(section => section.id === selectedShowManagerSection?.id)
      ?? activeCanvasShow?.sections[0]
      ?? null,
    [activeCanvasShow, selectedShowManagerSection?.id],
  )
  const canvasSectionRanges = useMemo(
    () => activeCanvasShow ? getCanvasShowManagerSectionRanges(activeCanvasShow) : [],
    [activeCanvasShow],
  )
  const canvasTotalDuration = useMemo(
    () => activeCanvasShow ? getCanvasShowManagerTotalDuration(activeCanvasShow) : 0,
    [activeCanvasShow],
  )
  const showBrowserEntries = useMemo<ShowBrowserEntry[]>(() => showManagerShows.map(show => {
    const linkedTrack = show.linkedAudioTrackId
      ? savedAudioTracks.find(track => track.dbId === show.linkedAudioTrackId) ?? null
      : null
    const group = show.groupId
      ? mediaCollections.find(collection => collection.id === show.groupId) ?? null
      : null
    return {
      id: show.id,
      name: show.name,
      audioLabel: linkedTrack
        ? (linkedTrack.title || linkedTrack.fileName)
        : (show.linkedAudioTrackId ? `Unavailable · ${show.linkedAudioTrackId}` : 'Legacy · audio link missing'),
      tagsLabel: show.tags.length ? show.tags.join(', ') : 'No tags',
      groupLabel: group?.name ?? (show.groupId ? `Unavailable · ${show.groupId}` : 'No group'),
      copyDisabledReason: show.linkedAudioTrackId ? null : 'Legacy Shows without a linked audio track cannot be copied.',
    }
  }), [mediaCollections, savedAudioTracks, showManagerShows])
  const copySourceShow = useMemo(
    () => copySourceShowId ? showManagerShows.find(show => show.id === copySourceShowId) ?? null : null,
    [copySourceShowId, showManagerShows],
  )
  const selectedCanvasElement = useMemo(
    () => activeCanvasShow?.mediaElements.find(element => element.id === canvasShowManagerEditingElementId) ?? null,
    [activeCanvasShow, canvasShowManagerEditingElementId],
  )
  const selectedCanvasElementMedia = useMemo(
    () => selectedCanvasElement ? sharedMediaItems.find(media => media.id === selectedCanvasElement.mediaId) ?? null : null,
    [selectedCanvasElement, sharedMediaItems],
  )
  const activeLaserDmxSection = useMemo(
    () => activeLaserDmxShow?.sections.find(section => section.id === selectedShowManagerSection?.id)
      ?? activeLaserDmxShow?.sections[0]
      ?? null,
    [activeLaserDmxShow, selectedShowManagerSection?.id],
  )
  const laserDmxRuntimePrograms = useMemo(
    () => createLaserDmxShowManagerRuntimeSectionPrograms(activeLaserDmxShow),
    [activeLaserDmxShow],
  )
  const laserDmxEmptyRuntimeShowDirector = useMemo(
    () => activeLaserDmxShow ? createLaserDmxShowManagerEmptyRuntimeShowDirector(activeLaserDmxShow) : null,
    [activeLaserDmxShow],
  )
  const laserDmxRuntimePreset = useMemo(
    () => reactPresets.find(preset => preset.engine === 'laserDmx')
      ?? DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'laserDmx')
      ?? null,
    [reactPresets],
  )
  const selectedLaserFixture = useMemo(
    () => activeLaserDmxSection?.fixtures.find(fixture => fixture.id === selectedLaserFixtureId) ?? null,
    [activeLaserDmxSection, selectedLaserFixtureId],
  )
  const eligibleLaserFixtureCopySources = useMemo(
    () => activeLaserDmxShow && activeLaserDmxSection
      ? getEligibleLaserDmxShowManagerFixtureCopySources(activeLaserDmxShow, activeLaserDmxSection.id)
      : [],
    [activeLaserDmxSection, activeLaserDmxShow],
  )
  const laserTimelineDuration = useMemo(
    () => activeShowManagerShow?.trackMap?.durationSec ?? Math.max(1, ...(activeLaserDmxShow?.sections.map(section => section.endSec) ?? [1])),
    [activeLaserDmxShow, activeShowManagerShow?.trackMap?.durationSec],
  )
  useEffect(() => {
    resetShowManagerSession()
    setPreviewPresetId(null)
    setSelectedLaserFixtureId(null)
    setCanvasLibraryMediaId(null)
    setShowManagerSessionReady(true)
    void loadShowManagerShowsFromCloud()
    return () => {
      showOpenOperationRef.current += 1
      resetShowManagerSession()
    }
  }, [loadShowManagerShowsFromCloud, resetShowManagerSession])

  useEffect(() => {
    if (!showBrowserOpen) return
    void loadSavedAudioTracks()
    void loadMediaCollections()
  }, [loadMediaCollections, loadSavedAudioTracks, showBrowserOpen])

  useEffect(() => {
    const show = activeShowManagerShow
    if (!show?.linkedAudioTrackId) {
      setLinkedAudioLoadError(null)
      return
    }
    const audioEngine = showManagerAudioEngineRef.current
    if (audioEngine.currentAudioTrackId === show.linkedAudioTrackId) {
      setLinkedAudioLoadError(null)
      return
    }

    let disposed = false
    const operation = ++showOpenOperationRef.current
    setLinkedAudioLoadError(null)
    void (async () => {
      let linkedTrack = useAudioStore.getState().savedTracks.find(track => track.dbId === show.linkedAudioTrackId) ?? null
      if (!linkedTrack) {
        await loadSavedAudioTracks()
        linkedTrack = useAudioStore.getState().savedTracks.find(track => track.dbId === show.linkedAudioTrackId) ?? null
      }
      if (disposed || showOpenOperationRef.current !== operation) return
      if (!linkedTrack) {
        setLinkedAudioLoadError(`The linked Audio Library record is unavailable (${show.linkedAudioTrackId}).`)
        return
      }
      if (!linkedTrack.storagePath?.trim()) {
        setLinkedAudioLoadError(`The linked track “${linkedTrack.title || linkedTrack.fileName}” has no recorded source location.`)
        return
      }
      try {
        await loadSavedTrackIntoEngine(
          audioEngine,
          linkedTrack,
          { getSignedUrl: getSavedAudioSignedUrl },
          {
            shouldCommit: () => !disposed && showOpenOperationRef.current === operation,
            sourceMutationAuthority: 'showManagerLinkedTrack',
          },
        )
      } catch (error) {
        if (disposed || error instanceof SavedTrackLoadCancelledError) return
        const reason = error instanceof Error ? error.message : 'The linked audio source is unavailable.'
        setLinkedAudioLoadError(`The linked track “${linkedTrack.title || linkedTrack.fileName}” could not be loaded. ${reason}`)
      }
    })()

    return () => {
      disposed = true
      if (showOpenOperationRef.current === operation) showOpenOperationRef.current += 1
    }
  }, [
    activeShowManagerShow?.id,
    activeShowManagerShow?.linkedAudioTrackId,
    getSavedAudioSignedUrl,
    loadSavedAudioTracks,
  ])

  useEffect(() => {
    const show = activeShowManagerShow
    const analysis = engine.currentAnalysis
    if (!show?.linkedAudioTrackId || !analysis) return
    if (engine.currentAudioTrackId !== show.linkedAudioTrackId || engine.currentAnalysisStatus !== 'complete') return
    const canonicalSections = adaptMIAnalysis(analysis)
    if (canonicalSections.length === 0) return
    const analysisDurationSec = (analysis.durationMs ?? 0) / 1000
    const canonicalDurationSec = Math.max(engine.duration, analysisDurationSec, canonicalSections[canonicalSections.length - 1]?.endSec ?? 0)
    if (!(canonicalDurationSec > 0)) return
    reconcileShowManagerTrackMapFromAnalysis({
      showId: show.id,
      linkedAudioTrackId: show.linkedAudioTrackId,
      analysisVersion: analysis.analysisVersion,
      durationSec: canonicalDurationSec,
      canonicalSections,
    })
  }, [
    activeShowManagerShow?.id,
    activeShowManagerShow?.linkedAudioTrackId,
    engine.currentAnalysis,
    engine.currentAnalysisStatus,
    engine.currentAudioTrackId,
    engine.duration,
    reconcileShowManagerTrackMapFromAnalysis,
  ])

  useEffect(() => {
    setCanvasRenameDraft(activeCanvasShow?.name ?? '')
    setCanvasRenameError(null)
    setCanvasAuthoringError(null)
    setCanvasPlayheadSec(0)
  }, [activeCanvasShow?.id, activeCanvasShow?.name])

  useEffect(() => {
    if (!activeShowManagerShow) {
      setSelectedShowManagerSectionId(null)
      return
    }
    ensureShowManagerAuthoringMirrors(activeShowManagerShow.id)
    setSelectedShowManagerSectionId(current => resolvedTrackSections.some(section => section.id === current)
      ? current
      : resolvedTrackSections[0]?.id ?? null)
  }, [activeShowManagerShow?.id, ensureShowManagerAuthoringMirrors, resolvedTrackSections])

  useEffect(() => {
    if (!activeShowManagerShow || !selectedShowManagerSection) return
    selectCanvasShowManagerShow(activeShowManagerShow.id)
    selectLaserDmxShowManagerShow(activeShowManagerShow.id)
    selectCanvasShowManagerSection(selectedShowManagerSection.id)
    selectLaserDmxShowManagerSection(selectedShowManagerSection.id)
    if (selectedShowManagerSection.engineId === 'canvas'
      || selectedShowManagerSection.engineId === 'laserDmx'
      || selectedShowManagerSection.engineId === 'pixGrid') {
      setSelectedEngineId(selectedShowManagerSection.engineId)
    }
  }, [
    activeShowManagerShow?.id,
    selectedShowManagerSection?.engineId,
    selectedShowManagerSection?.id,
    selectCanvasShowManagerSection,
    selectCanvasShowManagerShow,
    selectLaserDmxShowManagerSection,
    selectLaserDmxShowManagerShow,
  ])

  useEffect(() => {
    if (activeSectionEngineId !== 'canvas' || !showManagerLinkedAudioReady || !engine.isPlaying || canvasTotalDuration <= 0) return
    setCanvasPlayheadSec(engine.currentTime % canvasTotalDuration)
  }, [activeSectionEngineId, canvasTotalDuration, engine.currentTime, engine.isPlaying, showManagerLinkedAudioReady])

  useEffect(() => {
    if (activeSectionEngineId === 'laserDmx' && showManagerLinkedAudioReady && engine.isPlaying) return
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [activeSectionEngineId, engine.isPlaying, showManagerLinkedAudioReady])

  useEffect(() => () => {
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [])

  const handleLaserDmxPlaybackSectionChange = (sectionId: string | null) => {
    const state = useReactStore.getState()
    const sectionIsValid = sectionId == null
      || activeLaserDmxShow?.sections.some(section => section.id === sectionId)
    if (!sectionIsValid) return

    const playbackIsAlreadyCurrent = state.laserDmxShowManagerPlaybackSectionId === sectionId
    const editingIsAlreadyCurrent = sectionId == null || state.laserDmxShowManagerEditingSectionId === sectionId
    if (!playbackIsAlreadyCurrent || !editingIsAlreadyCurrent) {
      useReactStore.setState({
        laserDmxShowManagerPlaybackSectionId: sectionId,
        ...(sectionId == null ? {} : { laserDmxShowManagerEditingSectionId: sectionId }),
      })
    }

    if (sectionId != null) {
      setSelectedShowManagerSectionId(current => current === sectionId ? current : sectionId)
    }
  }

  useEffect(() => {
    if (selectedLaserFixtureId && !activeLaserDmxSection?.fixtures.some(fixture => fixture.id === selectedLaserFixtureId)) {
      setSelectedLaserFixtureId(null)
    }
  }, [activeLaserDmxSection, selectedLaserFixtureId])

  useEffect(() => {
    setCopyLaserFixturesEnabled(false)
    setCopyLaserFixturesSourceSectionId(null)
  }, [activeLaserDmxSection?.id, activeLaserDmxShow?.id])

  useEffect(() => {
    if (copyLaserFixturesSourceSectionId
      && !eligibleLaserFixtureCopySources.some(section => section.id === copyLaserFixturesSourceSectionId)) {
      setCopyLaserFixturesSourceSectionId(null)
    }
  }, [copyLaserFixturesSourceSectionId, eligibleLaserFixtureCopySources])

  const pixGridPresets = useMemo(
    () => reactPresets.filter(preset => preset.engine === 'pixGrid'),
    [reactPresets],
  )
  const editingDeck = useMemo(
    () => pixGridDecks.find(deck => deck.id === editingDeckId) ?? null,
    [editingDeckId, pixGridDecks],
  )
  const deckReadiness = useMemo(() => editingDeck
    ? resolvePixGridDeckPresetReadiness(
        editingDeck,
        compilerStatuses[editingDeck.id],
        transitionStatuses[editingDeck.id],
      )
    : null, [compilerStatuses, editingDeck, transitionStatuses])
  const deckPreviewPreset = useMemo(
    () => editingDeck ? createPixGridDeckGeneratedPreset(editingDeck) : null,
    [editingDeck],
  )

  useEffect(() => {
    if (workspaceMode !== SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE) return
    setDeckDraftName(editingDeck?.name ?? 'Untitled Deck')
    setDeckNameError(null)
    setPreviewDeckItemId(current => (
      editingDeck?.items.some(item => item.id === current && item.enabled)
        ? current
        : editingDeck?.items.find(item => item.enabled)?.id ?? null
    ))
  }, [editingDeck, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE) return
    deckBuilderHeadingRef.current?.focus()
  }, [workspaceMode])

  useEffect(() => {
    const preferred = findPixGridPreset(reactPresets, activeReactPresetId)
    setPreviewPresetId(current => {
      if (current && pixGridPresets.some(preset => preset.id === current)) return current
      return preferred?.id ?? null
    })
  }, [activeReactPresetId, pixGridPresets, reactPresets])

  useEffect(() => () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }, [])

  const activePreset = useMemo(
    () => findPixGridPreset(reactPresets, previewPresetId),
    [previewPresetId, reactPresets],
  )
  const displayedPreset = workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && deckPreviewPreset
    ? deckPreviewPreset
    : activePreset
  const displayedPixGridState = useMemo(() => (
    workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && deckPreviewPreset
      ? applyPixGridPresetSettings(pixGridState, deckPreviewPreset.id, deckPreviewPreset.pixGridSettings)
      : pixGridState
  ), [deckPreviewPreset, pixGridState, workspaceMode])
  const selectedScene = displayedPixGridState.scenes.find(scene => scene.id === displayedPixGridState.selectedSceneId)
    ?? displayedPixGridState.scenes[0]
    ?? null
  const selectedLayers = selectedScene
    ? selectedScene.layerIds
      .map(layerId => displayedPixGridState.layers.find(layer => layer.id === layerId))
      .filter((layer): layer is PixGridLayer => Boolean(layer))
    : []
  const showRuntimeAudioReady = showManagerLinkedAudioReady
  const showRuntimeIsPlaying = showRuntimeAudioReady && engine.isPlaying
  const showRuntimeCurrentTime = showRuntimeAudioReady ? engine.currentTime : 0
  const showRuntimeTrackId = showRuntimeAudioReady ? engine.currentTrackId : null
  const showRuntimeAnalyser = showRuntimeAudioReady ? engine.analyserMaster : null
  const showRuntimeBpm = showRuntimeAudioReady ? engine.currentEffectiveBpm : null
  const showRuntimeBeatGrid = showRuntimeAudioReady ? engine.currentEffectiveBeatGrid : null
  const showRuntimeAnalysis = showRuntimeAudioReady ? engine.currentAnalysis : null

  // Playback-follow belongs to the shared Track Map, not to whichever engine preview
  // happens to be mounted. This lets playback enter a LaserDMX section from an
  // unassigned/PixGrid/Canvas section and switch the authoring surface immediately.
  useEffect(() => {
    if (!showRuntimeIsPlaying || resolvedTrackSections.length === 0) return
    const playbackSection = resolveSectionAtTime(resolvedTrackSections, showRuntimeCurrentTime)
    if (!playbackSection) return
    setSelectedShowManagerSectionId(current => current === playbackSection.id ? current : playbackSection.id)
  }, [resolvedTrackSections, showRuntimeCurrentTime, showRuntimeIsPlaying])
  const activeCues = showRuntimeTrackId
    ? (pixGridActionCuesByTrackId[showRuntimeTrackId] ?? [])
    : []
  const activeCanvasTrackSection = selectedShowManagerSection
  const durationSec = showTrackMap?.durationSec
    ?? resolvePositiveDuration(
      Math.max(showRuntimeAudioReady ? engine.duration : 0, (showRuntimeAnalysis?.durationMs ?? 0) / 1000),
      1,
    )
  const timelineViewport = useMemo<TimelineViewport>(
    () => computeWaveformViewport(durationSec, showRuntimeCurrentTime, waveformZoom),
    [durationSec, showRuntimeCurrentTime, waveformZoom],
  )
  const laserTimelineViewport = useMemo<TimelineViewport>(
    () => computeWaveformViewport(laserTimelineDuration, showRuntimeCurrentTime, waveformZoom),
    [laserTimelineDuration, showRuntimeCurrentTime, waveformZoom],
  )
  const laserTimelineViewportRef = useRef<TimelineViewport>(laserTimelineViewport)
  laserTimelineViewportRef.current = laserTimelineViewport
  const canvasTimelineViewport = useMemo<TimelineViewport>(
    () => computeWaveformViewport(resolvePositiveDuration(canvasTotalDuration, 1), showRuntimeCurrentTime, waveformZoom),
    [canvasTotalDuration, showRuntimeCurrentTime, waveformZoom],
  )
  const activeLaserTrackSection = selectedShowManagerSection
  const showTrackMapStatusMessage = linkedAudioLoadError
    ?? (engine.currentAudioTrackId === activeShowManagerShow?.linkedAudioTrackId && engine.currentAnalysisStatus === 'failed'
      ? `Linked-track analysis is unavailable.${engine.currentAnalysisError ? ` ${engine.currentAnalysisError}` : ''}`
      : engine.currentAudioTrackId === activeShowManagerShow?.linkedAudioTrackId && engine.currentAnalysisStatus === 'complete'
        ? 'Linked-track analysis completed without a usable Track Map.'
        : 'Linked-track analysis is loading. No placeholder sections are created while analysis is unavailable.')
  const selectedPixGridTrackSection = selectedShowManagerSection
  const effectiveTrackAnalysis = useMemo(() => {
    const analysis = showRuntimeAnalysis
    const beatGrid = showRuntimeBeatGrid
    const bpm = showRuntimeBpm
    if (!analysis || !beatGrid || bpm == null || bpm <= 0) return analysis
    return {
      ...analysis,
      bpmUsedForGrid: bpm,
      beatGridOffsetSec: beatGrid[0]?.timeSec ?? analysis.beatGridOffsetSec,
      beatGrid,
      downbeats: beatGrid.filter(marker => marker.isDownbeat),
    }
  }, [showRuntimeAnalysis, showRuntimeBeatGrid, showRuntimeBpm])
  const matrixLabel = `${displayedPixGridState.matrixWidth}×${displayedPixGridState.matrixHeight}`
  const activeDeck = activePreset?.pixGridDeck
    ? pixGridDecks.find(deck => deck.id === activePreset.pixGridDeck?.deckId) ?? null
    : null
  const activeDeckReadiness = activeDeck
    ? resolvePixGridDeckPresetReadiness(
        activeDeck,
        compilerStatuses[activeDeck.id],
        transitionStatuses[activeDeck.id],
      )
    : null
  const presetOptions = pixGridPresets.map(preset => {
    const deck = preset.pixGridDeck
      ? pixGridDecks.find(candidate => candidate.id === preset.pixGridDeck?.deckId) ?? null
      : null
    return {
      value: preset.id,
      label: preset.name,
      description: preset.description,
      disabled: Boolean(preset.pixGridDeck && (!deck || !resolvePixGridDeckPresetReadiness(
        deck,
        compilerStatuses[deck.id],
        transitionStatuses[deck.id],
      ).ready)),
    }
  })
  const previewEnabledItems = editingDeck?.items.filter(item => item.enabled) ?? []
  const previewDeckIndex = Math.max(0, previewEnabledItems.findIndex(item => item.id === previewDeckItemId))
  const previewBpm = showRuntimeBpm && showRuntimeBpm > 0 ? showRuntimeBpm : 120
  const builderPreviewTime = editingDeck
    ? (previewDeckIndex * editingDeck.configuration.defaultItemDurationBeats * 60) / previewBpm + 0.01
    : showRuntimeCurrentTime

  const enterDeckBuilder = (deckId: string | null) => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    deckBuilderReturnTargetRef.current = deckId ? 'edit' : 'create'
    setEditingDeckId(deckId)
    setWorkspaceMode(SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE)
    setUploadState({ active: false, phase: 'Ready', error: null, warnings: [] })
  }

  const exitDeckBuilder = () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    const returnTarget = deckBuilderReturnTargetRef.current
    setWorkspaceMode('default')
    setEditingDeckId(null)
    setPreviewDeckItemId(null)
    window.setTimeout(() => {
      const preferred = returnTarget === 'edit'
        ? document.querySelector<HTMLButtonElement>('.sm-deck-preset-summary button')
        : document.querySelector<HTMLButtonElement>('.sm-create-deck-button')
      console.log('DEBUG exitDeckBuilder timeout', { returnTarget, preferred, all: document.querySelectorAll('.sm-create-deck-button').length })
      ;(preferred ?? document.querySelector<HTMLButtonElement>('.sm-create-deck-button'))?.focus()
    }, 0)
  }

  const handleDeckFiles = async (files: File[]) => {
    const name = deckDraftName.trim()
    if (!editingDeck && !name) {
      setDeckNameError('Deck name is required.')
      return
    }

    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    const operationId = uploadOperationRef.current + 1
    uploadOperationRef.current = operationId
    uploadAbortRef.current = controller
    setUploadState({ active: true, phase: 'Validating…', error: null, warnings: [] })

    const result = await ingestPixGridDeckSourceFiles({
      target: editingDeck
        ? { kind: 'append', deckId: editingDeck.id }
        : { kind: 'create', name },
      files,
      signal: controller.signal,
      onUploadPhase: (fileName, phase) => {
        if (uploadOperationRef.current !== operationId || controller.signal.aborted) return
        setUploadState(current => ({ ...current, phase: `${fileName}: ${phase}` }))
      },
    })
    if (uploadOperationRef.current !== operationId) return
    uploadAbortRef.current = null

    if (!result.ok) {
      const phase = result.error.code === 'cancelled'
        ? 'Cancelled'
        : result.error.code === 'project-replaced' || result.error.code === 'deck-conflict'
          ? 'Conflict'
          : 'Failed'
      setUploadState({ active: false, phase, error: result.error.message, warnings: [] })
      return
    }
    setEditingDeckId(result.deckId)
    setDeckNameError(null)
    const resultWarnings = result.rejected?.map(entry => `${entry.fileName}: ${entry.message}`) ?? []
    setUploadState({
      active: false,
      phase: resultWarnings.length > 0 ? 'Ready with warnings' : 'Ready',
      error: null,
      warnings: resultWarnings,
    })
  }

  const handleDeckRename = () => {
    if (!editingDeck || deckDraftName.trim() === editingDeck.name) return
    const result = renamePixGridDeck(editingDeck.id, deckDraftName)
    if (!result.ok) setDeckNameError(result.error.message)
    else setDeckNameError(null)
  }

  const handleDeckUpdate = (patch: Parameters<typeof updatePixGridDeck>[1]) => {
    if (!editingDeck) return
    const result = updatePixGridDeck(editingDeck.id, patch)
    if (!result.ok) setUploadState(current => ({ ...current, error: result.error.message }))
  }

  const moveDeckItem = (itemId: string, direction: -1 | 1) => {
    if (!editingDeck) return
    const items = [...editingDeck.items].sort((left, right) => left.order - right.order)
    const index = items.findIndex(item => item.id === itemId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    handleDeckUpdate({ items: items.map((item, order) => ({ ...item, order })) })
  }

  const toggleDeckItem = (itemId: string) => {
    if (!editingDeck) return
    handleDeckUpdate({
      items: editingDeck.items.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item),
    })
  }

  const removeDeckItem = (itemId: string) => {
    if (!editingDeck || editingDeck.items.length <= 2) return
    handleDeckUpdate({ items: editingDeck.items.filter(item => item.id !== itemId) })
  }

  const stepPreview = (direction: -1 | 1) => {
    if (previewEnabledItems.length === 0) return
    const nextIndex = (previewDeckIndex + direction + previewEnabledItems.length) % previewEnabledItems.length
    setPreviewDeckItemId(previewEnabledItems[nextIndex]?.id ?? null)
  }

  const undoLaserShowEdit = () => {
    if (laserShowUndoDepth === 0) return
    undoLaserDmxShowManagerEdit()
    setSelectedLaserFixtureId(current => {
      if (!current) return null
      const state = useReactStore.getState()
      const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === state.laserDmxShowManagerEditingShowId)
      const section = show?.sections.find(candidate => candidate.id === state.laserDmxShowManagerEditingSectionId)
      return section?.fixtures.some(fixture => fixture.id === current) ? current : null
    })
  }

  const redoLaserShowEdit = () => {
    if (laserShowRedoDepth === 0) return
    redoLaserDmxShowManagerEdit()
    setSelectedLaserFixtureId(current => {
      if (!current) return null
      const state = useReactStore.getState()
      const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === state.laserDmxShowManagerEditingShowId)
      const section = show?.sections.find(candidate => candidate.id === state.laserDmxShowManagerEditingSectionId)
      return section?.fixtures.some(fixture => fixture.id === current) ? current : null
    })
  }

  const commitLaserWorkspaceSettings = (patch: LaserDmxShowManagerWorkspaceSettingsPatch) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection || !selectedShowManagerSection) return
    if (activeSectionEngineId && activeSectionEngineId !== 'laserDmx') {
      setPendingSectionEngineReplacement({
        sectionId: selectedShowManagerSection.id,
        sectionLabel: selectedShowManagerSection.label,
        currentEngineId: activeSectionEngineId as ShowManagerEngineId,
        targetEngineId: 'laserDmx',
        action: { type: 'laserSettings', patch },
      })
      return
    }
    // Display/renderer settings may be preconfigured on an empty section, but
    // they do not claim engine ownership. The first placed component does that.
    updateLaserDmxShowManagerSectionWorkspaceSettings(activeLaserDmxShow.id, activeLaserDmxSection.id, patch)
  }

  const commitLaserShowSave = async (makeActive: boolean) => {
    if (!activeLaserDmxShow || laserSavePending) return
    setLaserSavePending(makeActive ? 'active' : 'save')
    setLaserSaveStatus(null)
    try {
      const saved = await saveLaserDmxShowManagerShow(activeLaserDmxShow.id, { makeActive })
      setLaserSaveStatus(saved
        ? (makeActive ? 'Saved and made active.' : 'Saved.')
        : (makeActive ? 'Could not complete Save + Make Active.' : 'Could not save Show.'))
    } finally {
      setLaserSavePending(null)
    }
  }

  const commitCanvasRename = () => {
    if (!activeCanvasShow) return
    if (!renameCanvasShowManagerShow(activeCanvasShow.id, canvasRenameDraft)) {
      setCanvasRenameError(canvasRenameDraft.trim() ? 'A Canvas Show with this name already exists.' : 'Show name is required.')
      return
    }
    setCanvasRenameError(null)
  }

  const commitCanvasShowSave = async (makeActive: boolean) => {
    if (!activeCanvasShow || canvasSavePending) return
    setCanvasSavePending(makeActive ? 'active' : 'save')
    setCanvasSaveStatus(null)
    try {
      const saved = await saveCanvasShowManagerShow(activeCanvasShow.id, { makeActive })
      setCanvasSaveStatus(saved
        ? (makeActive ? 'Saved and made active.' : 'Saved.')
        : (makeActive ? 'Could not complete Save + Make Active.' : 'Could not save Show.'))
    } finally {
      setCanvasSavePending(null)
    }
  }

  const openSelectedShow = async (showId: string): Promise<ShowBrowserActionResult> => {
    const show = showManagerShows.find(candidate => candidate.id === showId)
    if (!show) return { ok: false, error: 'That Show is no longer available.' }
    if (!show.linkedAudioTrackId) {
      return { ok: false, error: `“${show.name}” is a legacy Show with no linked audio track and cannot be opened safely.` }
    }

    const preferredEngine = show.trackMap?.sections.find(section => section.engineId)?.engineId
      ?? show.engineIds[0]
      ?? selectedEngineId

    let linkedTrack = savedAudioTracks.find(track => track.dbId === show.linkedAudioTrackId) ?? null
    if (!linkedTrack) {
      await loadSavedAudioTracks()
      linkedTrack = useAudioStore.getState().savedTracks.find(track => track.dbId === show.linkedAudioTrackId) ?? null
    }
    if (!linkedTrack) {
      return {
        ok: false,
        error: `The linked Audio Library record for “${show.name}” is unavailable (${show.linkedAudioTrackId}). The Show was not opened.`,
      }
    }
    const recordedLocation = linkedTrack.storagePath?.trim() ?? ''
    if (!recordedLocation) {
      return {
        ok: false,
        error: `The linked track “${linkedTrack.title || linkedTrack.fileName}” has no recorded source location and cannot be loaded. The Show was not opened.`,
      }
    }

    const operation = ++showOpenOperationRef.current
    try {
      await loadSavedTrackIntoEngine(
        engine,
        linkedTrack,
        { getSignedUrl: getSavedAudioSignedUrl },
        {
          shouldCommit: () => showOpenOperationRef.current === operation,
          sourceMutationAuthority: 'showManagerLinkedTrack',
        },
      )
    } catch (error) {
      if (error instanceof SavedTrackLoadCancelledError) return { ok: false, error: 'The Show open request was superseded.' }
      const reason = error instanceof Error ? error.message : 'The linked audio source is unavailable.'
      return {
        ok: false,
        error: `The linked track “${linkedTrack.title || linkedTrack.fileName}” cannot be loaded because it no longer exists or is unavailable at its recorded location: ${recordedLocation}. ${reason}`,
      }
    }
    if (showOpenOperationRef.current !== operation) return { ok: false, error: 'The Show open request was superseded.' }

    selectReactEngine(preferredEngine)
    setSelectedEngineId(preferredEngine)
    selectShowManagerShow(show.id)
    selectCanvasShowManagerShow(show.id)
    selectLaserDmxShowManagerShow(show.id)
    setPreviewPresetId(null)
    setShowBrowserOpen(false)
    return { ok: true }
  }

  const createSelectedShow = () => {
    setCopySourceShowId(null)
    setNewShowOpen(true)
  }

  const copySelectedShow = (showId: string) => {
    setCopySourceShowId(showId)
    setShowBrowserOpen(false)
    setNewShowOpen(true)
  }

  const deleteSelectedShow = async (showId: string): Promise<ShowBrowserActionResult> => {
    const deleted = await deleteShowManagerShow(showId)
    return deleted
      ? { ok: true }
      : { ok: false, error: 'The Show could not be deleted. Its Show data and linked media were left unchanged.' }
  }

  const confirmDeleteCanvasShow = async () => {
    const show = pendingDeleteCanvasShow
    if (!show) return
    setPendingDeleteCanvasShow(null)
    setDeletingCanvasShow(true)
    try {
      const deleted = await deleteShowManagerShow(show.id)
      if (!deleted) setCanvasAuthoringError('The Show could not be deleted. Its Show data and linked media were left unchanged.')
    } finally {
      setDeletingCanvasShow(false)
    }
  }

  const saveEngineId = activeSectionEngineId === 'canvas' || activeSectionEngineId === 'laserDmx'
    ? activeSectionEngineId
    : resolvedTrackSections.find(section => section.engineId === 'canvas' || section.engineId === 'laserDmx')?.engineId ?? null

  const saveAndActivateSelectedShow = () => {
    if (saveEngineId === 'canvas') void commitCanvasShowSave(true)
    else if (saveEngineId === 'laserDmx') void commitLaserShowSave(true)
  }

  const saveAndActivatePending = saveEngineId === 'canvas'
    ? canvasSavePending === 'active'
    : saveEngineId === 'laserDmx' && laserSavePending === 'active'
  const saveAndActivateDisabled = saveEngineId === 'canvas'
    ? !activeCanvasShow || canvasSavePending !== null
    : saveEngineId === 'laserDmx'
      ? !activeLaserDmxShow || laserSavePending !== null
      : true

  const performCanvasMediaPlacement = (mediaId: string, layer: CanvasShowManagerLayer) => {
    if (!activeCanvasShow || !selectedShowManagerSection) {
      setCanvasAuthoringError('Create or open a Canvas Show and select a section before adding media.')
      return false
    }
    const media = sharedMediaItems.find(candidate => candidate.id === mediaId)
    if (!media) {
      setCanvasAuthoringError('That shared media item is unavailable. Refresh the Media Library and try again.')
      return false
    }
    const disabledReason = getCanvasLibraryDisabledReason(media)
    const mediaType = getCanvasLibraryMediaType(media)
    if (disabledReason || !mediaType) {
      setCanvasAuthoringError(disabledReason ?? 'That media type is not supported in CANVAS.')
      return false
    }
    const result = addCanvasShowManagerMediaElement({
      showId: activeCanvasShow.id,
      sectionId: selectedShowManagerSection.id,
      mediaId,
      layer,
      timedVideo: mediaType === 'video',
      sourceDurationSec: media.metadata.duration ?? null,
    })
    if (!result.ok) {
      setCanvasAuthoringError(result.message)
      return false
    }
    setCanvasLibraryMediaId(mediaId)
    setCanvasAuthoringError(null)
    return true
  }

  const commitCanvasMediaPlacement = (mediaId: string, layer: CanvasShowManagerLayer) => {
    if (!selectedShowManagerSection) return false
    if (activeSectionEngineId && activeSectionEngineId !== 'canvas') {
      setPendingSectionEngineReplacement({
        sectionId: selectedShowManagerSection.id,
        sectionLabel: selectedShowManagerSection.label,
        currentEngineId: activeSectionEngineId as ShowManagerEngineId,
        targetEngineId: 'canvas',
        action: { type: 'canvasMedia', mediaId, layer },
      })
      return false
    }
    return performCanvasMediaPlacement(mediaId, layer)
  }

  const commitCanvasElementPatch = (
    elementId: string,
    patch: CanvasShowManagerMediaElementPatch,
  ) => {
    if (!activeCanvasShow) return false
    const element = activeCanvasShow.mediaElements.find(candidate => candidate.id === elementId)
    const media = element ? sharedMediaItems.find(candidate => candidate.id === element.mediaId) ?? null : null
    const result = updateCanvasShowManagerMediaElement(
      activeCanvasShow.id,
      elementId,
      patch,
      media?.metadata.duration ?? null,
    )
    if (!result.ok) {
      setCanvasAuthoringError(result.message)
      return false
    }
    setCanvasAuthoringError(null)
    return true
  }

  const deleteSelectedCanvasElement = () => {
    if (!activeCanvasShow || !selectedCanvasElement) return
    if (removeCanvasShowManagerMediaElement(activeCanvasShow.id, selectedCanvasElement.id)) {
      setCanvasAuthoringError(null)
    }
  }

  const activateLaserComponent = (kind: LaserDmxShowDirectorFixtureKind) => {
    if (!isLaserDmxShowManagerFixtureKindEnabled(kind)) return
    setSelectedLightingComponentKind(kind)
  }

  const beginLaserComponentDrag = (event: DragEvent<HTMLButtonElement>, kind: LaserDmxShowDirectorFixtureKind) => {
    if (!isLaserDmxShowManagerFixtureKindEnabled(kind)) {
      event.preventDefault()
      return
    }
    setSelectedLightingComponentKind(kind)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-drmvyz-laserdmx-fixture-kind', kind)
    event.dataTransfer.setData('text/plain', kind)
  }

  const performLaserFixturePlacement = (
    kind: LaserDmxShowDirectorFixtureKind,
    cell: LaserDmxShowManagerGridCell,
  ) => {
    if (!activeLaserDmxShow || !selectedShowManagerSection) return false
    const fixtureId = addLaserDmxShowManagerFixture(activeLaserDmxShow.id, selectedShowManagerSection.id, kind, cell)
    if (!fixtureId) return false
    setSelectedLaserFixtureId(fixtureId)
    return true
  }

  const commitLaserFixtureDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!activeLaserDmxShow || !selectedShowManagerSection) return
    const rawKind = event.dataTransfer.getData('application/x-drmvyz-laserdmx-fixture-kind')
      || event.dataTransfer.getData('text/plain')
    const kind = parseLaserDmxShowManagerFixtureKind(rawKind)
    if (!kind) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const cell = resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds)
    if (!cell) return
    if (activeSectionEngineId && activeSectionEngineId !== 'laserDmx') {
      setPendingSectionEngineReplacement({
        sectionId: selectedShowManagerSection.id,
        sectionLabel: selectedShowManagerSection.label,
        currentEngineId: activeSectionEngineId as ShowManagerEngineId,
        targetEngineId: 'laserDmx',
        action: { type: 'laserFixture', kind, cell },
      })
      return
    }
    performLaserFixturePlacement(kind, cell)
  }

  const commitLaserFixturePatch = (patch: LaserDmxShowDirectorFixturePatch) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection || !selectedLaserFixture) return
    updateLaserDmxShowManagerFixture(
      activeLaserDmxShow.id,
      activeLaserDmxSection.id,
      selectedLaserFixture.id,
      patch,
    )
  }

  const beginLaserFixtureReposition = (fixtureId: string) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    if (!activeLaserDmxSection.fixtures.some(fixture => fixture.id === fixtureId)) return
    setLaserFixtureContextMenu(null)
    setLaserEndpointTargetingFixtureId(null)
    setSelectedLaserFixtureId(fixtureId)
    beginLaserDmxShowManagerHistoryTransaction()
  }

  const updateLaserFixtureReposition = (fixtureId: string, cell: LaserDmxShowManagerGridCell) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    updateLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, fixtureId, cell)
  }

  const commitLaserFixtureReposition = () => commitLaserDmxShowManagerHistoryTransaction()
  const cancelLaserFixtureReposition = () => cancelLaserDmxShowManagerHistoryTransaction()

  const deleteSelectedLaserFixture = () => {
    if (!activeLaserDmxShow || !activeLaserDmxSection || !selectedLaserFixture) return
    removeLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, selectedLaserFixture.id)
    setSelectedLaserFixtureId(null)
  }

  const handleLaserFixtureContextMenu = (event: MouseEvent<HTMLButtonElement>, fixtureId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setLaserEndpointTargetingFixtureId(null)
    setSelectedLaserFixtureId(fixtureId)
    setLaserFixtureContextMenu({ fixtureId, x: event.clientX, y: event.clientY })
  }

  const closeLaserFixtureContextMenu = () => setLaserFixtureContextMenu(null)

  const duplicateFixtureFromContextMenu = (fixtureId: string) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    const fixtureIdCopy = duplicateLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, fixtureId)
    if (fixtureIdCopy) setSelectedLaserFixtureId(fixtureIdCopy)
    closeLaserFixtureContextMenu()
  }

  const mirrorFixtureFromContextMenu = (fixtureId: string, axis: 'horizontal' | 'vertical') => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    mirrorLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, fixtureId, axis)
    closeLaserFixtureContextMenu()
  }

  const deleteFixtureFromContextMenu = (fixtureId: string) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    removeLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, fixtureId)
    if (selectedLaserFixtureId === fixtureId) setSelectedLaserFixtureId(null)
    closeLaserFixtureContextMenu()
  }

  const beginLaserEndpointTargeting = (fixtureId: string) => {
    setLaserEndpointTargetingFixtureId(fixtureId)
    closeLaserFixtureContextMenu()
  }

  const commitLaserEndpointTarget = (event: MouseEvent<HTMLDivElement>) => {
    if (!laserEndpointTargetingFixtureId || !activeLaserDmxShow || !activeLaserDmxSection) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const cell = resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds)
    setLaserEndpointTargetingFixtureId(null)
    if (!cell) return
    updateLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, laserEndpointTargetingFixtureId, {
      beam: { targetMode: 'fixed', targetX: cell.x, targetY: cell.y },
    })
  }

  const commitLaserFixtureCopyToSection = (sourceSectionId: string, destinationSectionId: string) => {
    if (!activeLaserDmxShow || sourceSectionId === destinationSectionId) return
    const sourceSection = activeLaserDmxShow.sections.find(section => section.id === sourceSectionId)
    const destinationSection = activeLaserDmxShow.sections.find(section => section.id === destinationSectionId)
    if (!sourceSection || sourceSection.fixtures.length === 0 || !destinationSection) return
    const copiedFixtureIds = copyLaserDmxShowManagerFixturesFromSection(
      activeLaserDmxShow.id,
      sourceSectionId,
      destinationSectionId,
    )
    if (copiedFixtureIds.length === 0) return
    setSelectedShowManagerSectionId(destinationSectionId)
    setSelectedEngineId('laserDmx')
    selectLaserDmxShowManagerSection(destinationSectionId)
    setSelectedLaserFixtureId(null)
    setCopyLaserFixturesSourceSectionId(null)
    setLaserSectionContextMenu(null)
    setLaserSectionCopyMenu(null)
  }

  const commitLaserFixtureCopy = (sourceSectionId: string) => {
    if (!activeLaserDmxSection) return
    if (!eligibleLaserFixtureCopySources.some(section => section.id === sourceSectionId)) return
    commitLaserFixtureCopyToSection(sourceSectionId, activeLaserDmxSection.id)
  }

  const handleLaserSectionContextMenu = (event: MouseEvent<HTMLDivElement>, sectionId: string) => {
    if (!activeLaserDmxShow?.sections.some(section => section.fixtures.length > 0)) return
    event.preventDefault()
    event.stopPropagation()
    setLaserSectionCopyMenu(null)
    setLaserSectionContextMenu({ sectionId, x: event.clientX, y: event.clientY })
  }

  const openLaserSectionCopyMenu = (sectionId: string, x: number, y: number) => {
    setLaserSectionCopyMenu({ sectionId, x: x + 196, y })
  }

  const requestLaserFixtureCopyToSection = (sourceSectionId: string, destinationSectionId: string) => {
    if (!activeShowManagerShow) return
    const destination = resolvedTrackSections.find(section => section.id === destinationSectionId)
    if (!destination) return
    if (destination.engineId === 'pixGrid' || destination.engineId === 'canvas') {
      setPendingSectionEngineReplacement({
        sectionId: destination.id,
        sectionLabel: destination.label,
        currentEngineId: destination.engineId,
        targetEngineId: 'laserDmx',
        action: { type: 'laserFixtureCopy', sourceSectionId },
      })
      setLaserSectionCopyMenu(null)
      return
    }
    commitLaserFixtureCopyToSection(sourceSectionId, destinationSectionId)
  }

  const selectShowManagerSectionForEditing = (sectionId: string | null) => {
    if (!sectionId) return
    if (sectionId === selectedShowManagerSectionId) {
      setSelectedShowManagerSectionId(null)
      setSelectedLaserFixtureId(null)
      selectCanvasShowManagerMediaElement(null)
      selectCanvasShowManagerSection(null)
      selectLaserDmxShowManagerSection(null)
      return
    }
    const section = resolvedTrackSections.find(candidate => candidate.id === sectionId)
    if (!section) return
    setSelectedShowManagerSectionId(sectionId)
    setSelectedLaserFixtureId(null)
    selectCanvasShowManagerMediaElement(null)
    setCanvasPlayheadSec(section.startSec)
    selectCanvasShowManagerSection(sectionId)
    selectLaserDmxShowManagerSection(sectionId)
    if (section.engineId === 'canvas' || section.engineId === 'laserDmx' || section.engineId === 'pixGrid') {
      setSelectedEngineId(section.engineId)
    }
  }

  const confirmSectionEngineReplacement = () => {
    const pending = pendingSectionEngineReplacement
    if (!pending || !activeShowManagerShow) return
    const replaced = replaceShowManagerSectionEngine(
      activeShowManagerShow.id,
      pending.sectionId,
      pending.targetEngineId,
    )
    if (!replaced) {
      setPendingSectionEngineReplacement(null)
      return
    }
    setPendingSectionEngineReplacement(null)
    setSelectedEngineId(pending.targetEngineId)
    setSelectedLaserFixtureId(null)
    selectCanvasShowManagerMediaElement(null)
    if (pending.action.type === 'laserFixture') {
      performLaserFixturePlacement(pending.action.kind, pending.action.cell)
    } else if (pending.action.type === 'laserSettings') {
      updateLaserDmxShowManagerSectionWorkspaceSettings(
        activeShowManagerShow.id,
        pending.sectionId,
        pending.action.patch,
      )
    } else if (pending.action.type === 'laserFixtureCopy') {
      commitLaserFixtureCopyToSection(pending.action.sourceSectionId, pending.sectionId)
    } else {
      performCanvasMediaPlacement(pending.action.mediaId, pending.action.layer)
    }
  }

  const commitLaserSectionBoundary = (
    sectionId: string,
    edge: 'start' | 'end',
    newTime: number,
    neighborId: string | null,
    neighborTime: number | null,
  ) => {
    if (!activeLaserDmxShow) return
    updateShowManagerTrackMapBoundary(
      activeLaserDmxShow.id,
      sectionId,
      edge,
      newTime,
      neighborId,
      neighborTime,
    )
  }

  return (
    <section className="sm-root rv-shell" aria-label="Show Manager workspace">
      <header className="sm-topbar">
        <div className="sm-title-block" tabIndex={-1} ref={deckBuilderHeadingRef}>
          <strong>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'DECK BUILDER' : 'SHOW MANAGER'}</strong>
          <span>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'PixGrid image sequence authoring' : hasOpenShow ? 'Show authoring workspace' : 'Use New Show or Open Show to begin'}</span>
        </div>

        {workspaceMode === 'default' && (
          <div className="sm-header-show-actions" aria-label="Show file actions">
            <button
              type="button"
              className="sm-header-icon-button"
              onClick={createSelectedShow}
              aria-label="New Show"
              title="New Show"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3.5h9l5 5v12H5z" />
                <path d="M14 3.5v5h5M12 11v6M9 14h6" />
              </svg>
            </button>
            <button
              type="button"
              className="sm-header-icon-button"
              onClick={() => setShowBrowserOpen(true)}
              aria-label="Open Show"
              title="Open Show"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 7h6l2 2h9l-2 10h-15z" />
              </svg>
            </button>
            <button
              type="button"
              className="sm-header-icon-button sm-header-icon-button--primary"
              onClick={saveAndActivateSelectedShow}
              disabled={saveAndActivateDisabled}
              aria-label={saveAndActivatePending
                ? 'Saving and making Show active'
                : 'Save + Make Active'}
              title={saveAndActivatePending
                ? 'Saving and making active…'
                : 'Save + Make Active'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3.5h12l2 2v15H5z" />
                <path d="M8 3.5v6h8v-6M8 20.5v-7h8v7" />
                <path className="sm-header-icon-button__active-mark" d="M18.5 11l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" />
              </svg>
            </button>
          </div>
        )}

        <div className="sm-topbar-spacer" />
        <div className="sm-stage-tools sm-stage-tools--header" aria-label="Show Manager stage tools">
          {(activeSectionEngineId === 'laserDmx' || activeSectionEngineId === 'canvas') && workspaceMode === 'default' ? (
            <>
              <button
                type="button"
                onClick={activeSectionEngineId === 'canvas' ? undoCanvasShowManagerEdit : undoLaserShowEdit}
                disabled={(activeSectionEngineId === 'canvas' ? canvasShowUndoDepth : laserShowUndoDepth) === 0}
                title="Undo Show edit"
              >↶</button>
              <button
                type="button"
                onClick={activeSectionEngineId === 'canvas' ? redoCanvasShowManagerEdit : redoLaserShowEdit}
                disabled={(activeSectionEngineId === 'canvas' ? canvasShowRedoDepth : laserShowRedoDepth) === 0}
                title="Redo Show edit"
              >↷</button>
              {['↖', '✥', '⌗', '▦', '◫'].map(tool => (
                <button key={tool} type="button" disabled>{tool}</button>
              ))}
            </>
          ) : (
            ['↖', '✥', '↻', '⌗', '▦', '◫', '20'].map(tool => (
              <button key={tool} type="button" disabled>{tool}</button>
            ))
          )}
        </div>
        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && (
          <button type="button" className="sm-header-button" onClick={exitDeckBuilder}>Back to Show Manager</button>
        )}
        <button type="button" className="sm-header-button" disabled>Show Lyrics</button>
        <button
          type="button"
          className="sm-header-button"
          onClick={() => void (saveEngineId === 'canvas' ? commitCanvasShowSave(false) : commitLaserShowSave(false))}
          disabled={(saveEngineId !== 'laserDmx' && saveEngineId !== 'canvas')
            || (saveEngineId === 'canvas' ? !activeCanvasShow || canvasSavePending !== null : !activeLaserDmxShow || laserSavePending !== null)}
        >{(saveEngineId === 'canvas' ? canvasSavePending : laserSavePending) === 'save' ? 'Saving…' : 'Save'}</button>
        {(activeSectionEngineId === 'laserDmx' || activeSectionEngineId === 'canvas' || activeSectionEngineId === 'pixGrid') && (
          <>
            <ReactPersistenceStatus />
            {activeSectionEngineId !== 'pixGrid' && (activeSectionEngineId === 'canvas' ? canvasSaveStatus : laserSaveStatus) && (
              <span className="sm-header-save-status" role="status">
                {activeSectionEngineId === 'canvas' ? canvasSaveStatus : laserSaveStatus}
              </span>
            )}
          </>
        )}
        <VyzualzHeaderActions />
      </header>

      <div className="sm-workspace">
        {workspaceMode === 'default' && !hasOpenShow ? (
          <EmptyShowManagerWorkspace selectedEngineId={selectedEngineId} onEngineChange={setSelectedEngineId} />
        ) : (
          <>
        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? (
          <aside className="sm-library sm-library--deck" aria-label="Show Manager Deck images">
            <PixGridDeckBuilderLibrary
              deck={editingDeck}
              draftName={deckDraftName}
              upload={uploadState}
              previewItemId={previewDeckItemId}
              onFiles={handleDeckFiles}
              onPreview={setPreviewDeckItemId}
              onMove={moveDeckItem}
              onReorder={(sourceItemId, targetItemId) => {
                if (!editingDeck) return
                const items = [...editingDeck.items].sort((left, right) => left.order - right.order)
                const sourceIndex = items.findIndex(item => item.id === sourceItemId)
                if (sourceIndex < 0 || !items.some(item => item.id === targetItemId)) return
                const [sourceItem] = items.splice(sourceIndex, 1)
                const targetIndex = items.findIndex(item => item.id === targetItemId)
                if (!sourceItem || targetIndex < 0) return
                items.splice(targetIndex, 0, sourceItem)
                handleDeckUpdate({ items: items.map((item, order) => ({ ...item, order })) })
              }}
              onToggle={toggleDeckItem}
              onRemove={removeDeckItem}
            />
          </aside>
        ) : (
        <aside className="sm-library" aria-label="Show Manager component library">
          <div className="sm-engine-picker">
            <Dropdown
              id="show-manager-engine"
              ariaLabel="Show Manager engine"
              value={selectedEngineId}
              onChange={value => setSelectedEngineId(value as ReactEngineId)}
              options={SHOW_MANAGER_ENGINE_OPTIONS}
              size="compact"
              maxMenuHeight={360}
              className="sm-engine-dropdown"
              menuClassName="sm-engine-dropdown-menu"
            />
          </div>

          {selectedEngineId === 'pixGrid' ? (
            <>
              <label className="sm-search-field">
                <span className="sr-only">Search Show Manager components</span>
                <DreamVizTextInput type="search" placeholder="Search components…" disabled />
              </label>

              <LibrarySection title="Components" count={COMPONENTS.length}>
                {COMPONENTS.map(([icon, label, count], index) => (
                  <button key={label} type="button" className={`sm-library-row${index === 0 ? ' is-active' : ''}`} disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-library-icon">{icon}</span>
                    <span>{label}</span>
                    <small>{count}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Assets" count={ASSETS.length}>
                {ASSETS.map(([icon, label, count]) => (
                  <button key={label} type="button" className="sm-library-row" disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-library-icon">{icon}</span>
                    <span>{label}</span>
                    <small>{count}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Scenes" count={pixGridState.scenes.length}>
                {pixGridState.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`sm-library-row sm-scene-row${scene.id === selectedScene?.id ? ' is-active' : ''}`}
                    disabled
                  >
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-scene-index">{String(index + 1).padStart(2, '0')}</span>
                    <span>{scene.name}</span>
                    <small>{scene.layerIds.length}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Layers" count={selectedLayers.length}>
                {selectedLayers.slice(0, 6).map(layer => (
                  <button key={layer.id} type="button" className="sm-library-row" disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-layer-dot" />
                    <span>{layer.name}</span>
                    <small>{layer.visible ? '●' : '○'}</small>
                  </button>
                ))}
                {selectedLayers.length === 0 && <div className="sm-library-empty">No layers in this scene.</div>}
              </LibrarySection>
            </>
          ) : selectedEngineId === 'laserDmx' ? (
            <div className="sm-laser-library-groups">
              <Collapsible label="Lighting Components" defaultOpen bodyClassName="rv-show-director-lighting-body" headerAccessory={<small>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.length}</small>}>
                {LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.map(kind => {
                  const enabled = isLaserDmxShowManagerFixtureKindEnabled(kind)
                  const active = enabled && selectedLightingComponentKind === kind
                  return (
                    <button
                      key={kind}
                      type="button"
                      className={`sm-library-row sm-library-row--fixture${active ? ' is-active' : ''}${enabled ? '' : ' is-disabled'}`}
                      disabled={!enabled}
                      aria-disabled={!enabled}
                      aria-pressed={enabled ? active : undefined}
                      draggable={enabled}
                      onClick={() => activateLaserComponent(kind)}
                      onDragStart={event => beginLaserComponentDrag(event, kind)}
                    >
                      <span className="sm-library-grip" aria-hidden="true">⋮⋮</span>
                      <span className="sm-library-icon sm-library-fixture-icon" aria-hidden="true"><FixtureIcon kind={kind} /></span>
                      <span>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]}</span>
                      <small>{enabled ? 'Ready' : 'Disabled'}</small>
                    </button>
                  )
                })}
              </Collapsible>

              <Collapsible label="Workspace" defaultOpen headerAccessory={<small>2</small>}>
                <Collapsible label="Display Settings" defaultOpen headerAccessory={<small>4</small>}>
                  <ToggleRow
                    label="Show Grid"
                    value={activeLaserDmxSection?.settings?.showGrid ?? true}
                    disabled={!activeLaserDmxShow || !selectedShowManagerSection}
                    onChange={showGrid => commitLaserWorkspaceSettings({ showGrid })}
                  />
                  <ToggleRow
                    label="Show Labels"
                    value={activeLaserDmxSection?.settings?.showLabels ?? true}
                    disabled={!activeLaserDmxShow || !selectedShowManagerSection}
                    onChange={showLabels => commitLaserWorkspaceSettings({ showLabels })}
                  />
                  <ToggleRow
                    label="Show Beams"
                    value={activeLaserDmxSection?.settings?.showBeams ?? true}
                    disabled={!activeLaserDmxShow || !selectedShowManagerSection}
                    onChange={showBeams => commitLaserWorkspaceSettings({ showBeams })}
                  />
                  <ToggleRow
                    label="Highlight Grid"
                    value={activeLaserDmxSection?.settings?.highlightGrid ?? true}
                    disabled={!activeLaserDmxShow || !selectedShowManagerSection}
                    onChange={highlightGrid => commitLaserWorkspaceSettings({ highlightGrid })}
                  />
                </Collapsible>

                <Collapsible label="Render Settings" defaultOpen headerAccessory={<small>3</small>}>
                  <SelectRow
                    label="Grid Size"
                    value="18x12"
                    disabled
                    onChange={() => undefined}
                    options={[{ value: '18x12', label: '18 × 12' }]}
                  />
                  <SelectRow
                    label="Lighting Renderer"
                    value={activeLaserDmxSection?.settings?.rendererMode ?? 'auto'}
                    disabled={!activeLaserDmxShow || !selectedShowManagerSection}
                    onChange={value => {
                      const option = LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS.find(candidate => candidate.value === value)
                      if (option) commitLaserWorkspaceSettings({ rendererMode: option.value })
                    }}
                    options={LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS.map(option => ({ ...option }))}
                  />
                  <SelectRow
                    label="Quality"
                    value={LASER_DMX_SHOW_MANAGER_QUALITY}
                    disabled
                    onChange={() => undefined}
                    options={[{ value: LASER_DMX_SHOW_MANAGER_QUALITY, label: 'High' }]}
                  />
                </Collapsible>
              </Collapsible>
            </div>
          ) : selectedEngineId === 'canvas' ? (
            <LibrarySection title="Components" count={1}>
              <div className="sm-canvas-media-library" data-testid="canvas-show-manager-media-library">
                <MediaLibraryBrowser
                  activeMediaId={canvasLibraryMediaId}
                  onSelect={mediaId => {
                    setCanvasLibraryMediaId(mediaId)
                    setCanvasAuthoringError(null)
                  }}
                  context="canvas"
                  title="Media"
                  capabilities={CANVAS_MEDIA_LIBRARY_CAPABILITIES}
                  getDisabledReason={media => activeCanvasShow
                    ? getCanvasLibraryDisabledReason(media)
                    : 'Create or open a Canvas Show before adding media.'}
                />
              </div>
            </LibrarySection>
          ) : (
            <div className="sm-panel-blank" />
          )}
        </aside>
        )}

        <main className="sm-center">
          <div
            className="sm-stage-frame"
            onDragEnter={event => {
              if (activeSectionEngineId === 'pixGrid' && Array.from(event.dataTransfer.types).includes('vz/mediaId')) {
                setPixGridCanvasDragActive(true)
              }
            }}
            onDragOver={event => {
              if (activeSectionEngineId !== 'pixGrid') return
              const types = Array.from(event.dataTransfer.types)
              if (!types.includes('application/x-drmvyz-laserdmx-fixture-kind') && !types.includes('vz/mediaId')) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              if (types.includes('vz/mediaId')) setPixGridCanvasDragActive(true)
            }}
            onDragLeave={event => {
              if (activeSectionEngineId !== 'pixGrid') return
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setPixGridCanvasDragActive(false)
                setPixGridHoveredCanvasLayer(null)
              }
            }}
            onDrop={event => {
              if (activeSectionEngineId !== 'pixGrid') return
              if (!Array.from(event.dataTransfer.types).includes('application/x-drmvyz-laserdmx-fixture-kind')) return
              commitLaserFixtureDrop(event)
            }}
          >
            {activeSectionEngineId === 'laserDmx' && workspaceMode === 'default' ? (
              <>
              <LaserDmxShowManagerStage
                section={activeLaserDmxSection}
                selectedFixtureId={selectedLaserFixtureId}
                showGrid={activeLaserDmxSection?.settings?.showGrid ?? true}
                showLabels={activeLaserDmxSection?.settings?.showLabels ?? true}
                highlightGrid={activeLaserDmxSection?.settings?.highlightGrid ?? true}
                runtimePreview={laserDmxRuntimePreset && activeLaserDmxShow ? (
                  <ReactPlaceholderCanvas
                    analyser={showRuntimeAnalyser}
                    engine="laserDmx"
                    activePreset={laserDmxRuntimePreset}
                    intensity={reactIntensity}
                    motion={reactMotion}
                    glow={reactGlow}
                    bassReactivity={reactBassReactivity}
                    isPlaying={showRuntimeIsPlaying}
                    analysisActive={showRuntimeIsPlaying}
                    isPaused={!showRuntimeIsPlaying}
                    trackSections={resolvedTrackSections}
                    trackAnalysis={effectiveTrackAnalysis}
                    laserDmxSectionRuntimePrograms={laserDmxRuntimePrograms}
                    laserDmxEmptyRuntimeShowDirector={laserDmxEmptyRuntimeShowDirector}
                    laserDmxAuthoringSectionId={activeLaserDmxSection?.id ?? null}
                    onLaserDmxPlaybackSectionChange={handleLaserDmxPlaybackSectionChange}
                    getAudioTime={showRuntimeAudioReady ? engine.getCurrentTime : () => 0}
                    effectiveBpm={showRuntimeBpm ?? undefined}
                    activeAudioTrackId={showRuntimeTrackId}
                    durationSec={durationSec}
                  />
                ) : null}
                onDropFixture={commitLaserFixtureDrop}
                selectedCanvasMediaId={selectedEngineId === 'canvas' ? canvasLibraryMediaId : null}
                onPlaceCanvasMedia={commitCanvasMediaPlacement}
                onSelectFixture={setSelectedLaserFixtureId}
                onFixtureRepositionStart={beginLaserFixtureReposition}
                onFixtureReposition={updateLaserFixtureReposition}
                onFixtureRepositionEnd={commitLaserFixtureReposition}
                onFixtureRepositionCancel={cancelLaserFixtureReposition}
                onFixtureContextMenu={handleLaserFixtureContextMenu}
                endpointTargetingFixtureId={laserEndpointTargetingFixtureId}
                onCommitEndpointTarget={commitLaserEndpointTarget}
              />
              {laserFixtureContextMenu && (() => {
                const menuFixture = activeLaserDmxSection?.fixtures.find(fixture => fixture.id === laserFixtureContextMenu.fixtureId)
                if (!menuFixture) return null
                const supportsEndpoint = menuFixture.kind === 'laser' || menuFixture.kind === 'movingHead'
                return (
                  <ContextActionMenu
                    x={laserFixtureContextMenu.x}
                    y={laserFixtureContextMenu.y}
                    ariaLabel={`${menuFixture.label} actions`}
                    header={{ title: menuFixture.label }}
                    onClose={closeLaserFixtureContextMenu}
                    items={[
                      { id: 'duplicate', label: 'Duplicate', onSelect: () => duplicateFixtureFromContextMenu(menuFixture.id) },
                      { id: 'mirror-h', label: 'Mirror Horizontally', onSelect: () => mirrorFixtureFromContextMenu(menuFixture.id, 'horizontal') },
                      { id: 'mirror-v', label: 'Mirror Vertically', onSelect: () => mirrorFixtureFromContextMenu(menuFixture.id, 'vertical') },
                      ...(supportsEndpoint ? [{ id: 'set-endpoint', label: 'Set Endpoint', onSelect: () => beginLaserEndpointTargeting(menuFixture.id) }] : []),
                      { id: 'delete', label: 'Delete', danger: true, dividerBefore: true, onSelect: () => deleteFixtureFromContextMenu(menuFixture.id) },
                    ]}
                  />
                )
              })()}
              </>
            ) : activeSectionEngineId === 'canvas' ? (
              <CanvasShowManagerStage
                show={activeCanvasShow}
                selectedSectionId={activeCanvasSection?.id ?? null}
                selectedElementId={selectedCanvasElement?.id ?? null}
                selectedLibraryMediaId={selectedEngineId === 'canvas' ? canvasLibraryMediaId : null}
                mediaItems={sharedMediaItems}
                sectionRanges={canvasSectionRanges}
                onSelectElement={selectCanvasShowManagerMediaElement}
                onPlaceMedia={commitCanvasMediaPlacement}
                onDropLaserFixture={commitLaserFixtureDrop}
                onCreate={createSelectedShow}
                runtimePreview={activeCanvasShow ? (
                  <CanvasEngineSurface
                    isPlaying={showRuntimeIsPlaying}
                    isPaused={!showRuntimeIsPlaying}
                    analyser={showRuntimeAnalyser}
                    trackAnalysis={effectiveTrackAnalysis}
                    trackSections={resolvedTrackSections}
                    getAudioTime={() => canvasPlayheadSec}
                    activeAudioTrackId={showRuntimeTrackId}
                    previewShow={activeCanvasShow}
                    previewShowTimeSec={canvasPlayheadSec}
                    previewSelectedElementId={selectedCanvasElement?.id ?? null}
                    showRuntimeStatus={false}
                  />
                ) : null}
              />
            ) : activeSectionEngineId === 'pixGrid' ? (
              <PixGridSurface
                analyser={showRuntimeAnalyser}
                activePreset={displayedPreset}
                pixGridState={displayedPixGridState}
                pixGridDecks={pixGridDecks}
                pixGridActionCues={activeCues}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                isPlaying={showRuntimeIsPlaying}
                isPaused={!showRuntimeIsPlaying}
                trackSections={resolvedTrackSections}
                trackAnalysis={effectiveTrackAnalysis}
                trackIdentity={showRuntimeTrackId}
                durationSec={durationSec}
                audioTimeSec={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? builderPreviewTime : showRuntimeCurrentTime}
                getAudioTime={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? () => builderPreviewTime : showRuntimeAudioReady ? engine.getCurrentTime : () => 0}
                effectiveBpm={showRuntimeBpm ?? undefined}
              />
            ) : (
              <UnownedShowManagerStage
                section={selectedShowManagerSection}
                selectedCanvasMediaId={selectedEngineId === 'canvas' ? canvasLibraryMediaId : null}
                onDropLaserFixture={commitLaserFixtureDrop}
                onPlaceCanvasMedia={commitCanvasMediaPlacement}
              />
            )}
            {activeSectionEngineId === 'pixGrid' && selectedShowManagerSection && (pixGridCanvasDragActive || (selectedEngineId === 'canvas' && canvasLibraryMediaId != null)) && (
              <div className="sm-canvas-layer-targets" role="group" aria-label="Canvas media layer drop targets">
                {([3, 2, 1, 0] as const).map(layer => (
                  <button
                    key={layer}
                    type="button"
                    className={pixGridHoveredCanvasLayer === layer ? 'is-hovered' : ''}
                    aria-label={`Clear ${selectedShowManagerSection.label}, assign it to Canvas, and place media on Layer ${layer + 1}`}
                    onDragOver={event => {
                      if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                      event.preventDefault()
                      event.stopPropagation()
                      setPixGridHoveredCanvasLayer(layer)
                    }}
                    onDragLeave={() => setPixGridHoveredCanvasLayer(current => current === layer ? null : current)}
                    onDrop={event => {
                      if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                      event.preventDefault()
                      event.stopPropagation()
                      const mediaId = event.dataTransfer.getData('vz/mediaId')
                      if (mediaId) commitCanvasMediaPlacement(mediaId, layer)
                      setPixGridCanvasDragActive(false)
                      setPixGridHoveredCanvasLayer(null)
                    }}
                    onClick={() => {
                      if (canvasLibraryMediaId) commitCanvasMediaPlacement(canvasLibraryMediaId, layer)
                    }}
                  >
                    <span>Layer {layer + 1}</span>
                    <strong>{layer === 3 ? 'TOP / FRONT' : layer === 0 ? 'BOTTOM / BACK' : `STACK ${layer + 1}`}</strong>
                    <small>Replace section with Canvas</small>
                  </button>
                ))}
              </div>
            )}
            {(activeSectionEngineId === 'canvas' || selectedEngineId === 'canvas') && canvasAuthoringError && (
              <NoticeCard className="sm-stage-authoring-feedback" tone="error" role="alert" title="Canvas authoring failed">{canvasAuthoringError}</NoticeCard>
            )}
          </div>

          {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && editingDeck ? (
            <PixGridDeckSequenceStrip
              deck={editingDeck}
              previewItemId={previewDeckItemId}
              onPreview={setPreviewDeckItemId}
              onPrevious={() => stepPreview(-1)}
              onNext={() => stepPreview(1)}
            />
          ) : activeSectionEngineId === 'laserDmx' ? (
            <LaserDmxShowManagerTimeline
              sections={resolvedTrackSections}
              selectedSectionId={selectedShowManagerSection?.id ?? null}
              durationSec={laserTimelineDuration}
              viewport={laserTimelineViewport}
              viewportRef={laserTimelineViewportRef}
              beatGrid={showRuntimeBeatGrid ?? showRuntimeAnalysis?.beatGrid ?? []}
              effectiveBpm={showRuntimeBpm}
              onSelect={selectShowManagerSectionForEditing}
              onContextMenu={activeLaserDmxShow?.sections.some(section => section.fixtures.length > 0) ? handleLaserSectionContextMenu : undefined}
              onCommitBoundary={commitLaserSectionBoundary}
            />
          ) : activeSectionEngineId === 'canvas' ? (
            <CanvasShowManagerTimeline
              show={activeCanvasShow}
              selectedSectionId={selectedShowManagerSection?.id ?? null}
              selectedElementId={selectedCanvasElement?.id ?? null}
              mediaItems={sharedMediaItems}
              sectionRanges={canvasSectionRanges}
              totalDurationSec={canvasTotalDuration}
              viewport={canvasTimelineViewport}
              beatGrid={showRuntimeBeatGrid ?? showRuntimeAnalysis?.beatGrid ?? []}
              playheadSec={canvasPlayheadSec}
              onSelect={selectShowManagerSectionForEditing}
              onContextMenu={activeLaserDmxShow?.sections.some(section => section.fixtures.length > 0) ? handleLaserSectionContextMenu : undefined}
              onSelectElement={selectCanvasShowManagerMediaElement}
              onPatchElement={commitCanvasElementPatch}
            />
          ) : (
            <ShowManagerTimeline
              currentTime={showRuntimeCurrentTime}
              duration={durationSec}
              viewport={timelineViewport}
              sections={resolvedTrackSections}
              beatGrid={showRuntimeBeatGrid ?? showRuntimeAnalysis?.beatGrid ?? []}
              effectiveBpm={showRuntimeBpm}
              selectedSectionId={selectedShowManagerSection?.id ?? null}
              onSelectSection={selectShowManagerSectionForEditing}
              onContextMenu={activeLaserDmxShow?.sections.some(section => section.fixtures.length > 0) ? handleLaserSectionContextMenu : undefined}
              onCommitBoundary={(sectionId, edge, newTime, neighborId, neighborTime) => {
                if (!activeShowManagerShow) return
                updateShowManagerTrackMapBoundary(activeShowManagerShow.id, sectionId, edge, newTime, neighborId, neighborTime)
              }}
              statusMessage={showTrackMapStatusMessage}
            />
          )}
        </main>

        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? (
          <aside className="sm-inspector sm-inspector--deck" aria-label="Show Manager Deck Builder inspector">
            <PixGridDeckBuilderInspector
              deck={editingDeck}
              draftName={deckDraftName}
              readiness={deckReadiness}
              upload={uploadState}
              nameError={deckNameError}
              onDraftName={setDeckDraftName}
              onRename={handleDeckRename}
              onUpdate={handleDeckUpdate}
              onCreatePreset={() => {
                if (!editingDeck || !deckReadiness) return
                const result = createPixGridDeckPreset(editingDeck.id, deckReadiness)
                if (!result.ok) {
                  setUploadState(current => ({ ...current, error: result.error.message }))
                  return
                }
                setPreviewPresetId(editingDeck.generatedPresetId)
                exitDeckBuilder()
              }}
              onDelete={() => {
                if (!editingDeck) return
                if (!window.confirm('Deleting this Deck will delete the Preset too. Are you sure?')) return
                const result = deletePixGridDeck(editingDeck.id)
                if (!result.ok) {
                  setUploadState(current => ({ ...current, error: result.error.message }))
                  return
                }
                exitDeckBuilder()
              }}
            />
          </aside>
        ) : (
        <aside className="sm-inspector" aria-label={`Show Manager ${activeSectionEngineId ? REACT_ENGINE_CATALOG[activeSectionEngineId].label : 'section'} inspector`}>
          <RailTabs
            tabs={SHOW_MANAGER_RIGHT_INSPECTOR_TABS}
            activeTab={rightInspectorTab}
            onChange={setRightInspectorTab}
            ariaLabel="Show Manager inspector tabs"
            className="rv-main-workspace-tabs"
            variant="underline"
          />
          {rightInspectorTab === 'inspector' && (
          activeSectionEngineId === 'pixGrid' ? (
            <div className="sm-inspector-scroll">
              <Collapsible label="Preset" defaultOpen>
                <div className="sm-preset-browser">
                  <div className="sm-preset-browser-heading">
                    <span aria-hidden="true">{REACT_ENGINE_CATALOG.pixGrid.icon}</span>
                    <div>
                      <strong>PixGrid Presets</strong>
                      <small>{pixGridPresets.length} preset{pixGridPresets.length === 1 ? '' : 's'} available</small>
                    </div>
                  </div>
                  <Dropdown
                    id="show-manager-pix-grid-preset"
                    ariaLabel="Show Manager PixGrid preset"
                    menuLabel="PixGrid presets"
                    value={activePreset?.id ?? null}
                    onChange={value => {
                      const preset = pixGridPresets.find(candidate => candidate.id === value)
                      if (!preset) return
                      if (preset.pixGridDeck) {
                        const deck = pixGridDecks.find(candidate => candidate.id === preset.pixGridDeck?.deckId)
                        if (!deck || !resolvePixGridDeckPresetReadiness(
                          deck,
                          compilerStatuses[deck.id],
                          transitionStatuses[deck.id],
                        ).ready) return
                      }
                      setPreviewPresetId(value)
                    }}
                    options={presetOptions}
                    placeholder="No PixGrid presets"
                    emptyMessage="No PixGrid presets"
                    disabled={pixGridPresets.length === 0}
                    size="compact"
                    className="sm-preset-dropdown"
                  />
                  <button type="button" className="sm-create-deck-button" onClick={() => enterDeckBuilder(null)}>
                    Create Deck
                  </button>
                  {activeDeck && activePreset && activeDeckReadiness && (
                    <PixGridDeckPresetSummary
                      deck={activeDeck}
                      preset={activePreset}
                      readiness={activeDeckReadiness}
                      onEdit={() => enterDeckBuilder(activeDeck.id)}
                    />
                  )}
                </div>
              </Collapsible>
              <div className="sm-inspector-context">
                <div>
                  <span>Component</span>
                  <strong>Pixel Grid</strong>
                </div>
                <div>
                  <span>Matrix</span>
                  <strong>{matrixLabel}</strong>
                </div>
              </div>
              <PixGridDesignPanel groupedSections />
              <Collapsible label="Show Track Map" defaultOpen>
                {selectedPixGridTrackSection && activeShowManagerShow ? (
                  <ShowManagerTrackMapSectionEditor
                    showId={activeShowManagerShow.id}
                    section={selectedPixGridTrackSection}
                    durationSec={durationSec}
                    effectiveBpm={showRuntimeBpm}
                    beatGrid={showRuntimeBeatGrid ?? []}
                    boundaryAlternatives={showRuntimeAnalysis?.boundaryAlternatives ?? []}
                  />
                ) : (
                  <p className="sm-new-show-field-note">{linkedAudioLoadError ?? 'Linked-track analysis is loading.'}</p>
                )}
              </Collapsible>
              <Collapsible label="Validation" defaultOpen={false}>
                <NoticeCard tone="success" title="PixGrid document · OK">
                  <p>No blocking PixGrid issues detected.</p>
                  <p>Preset controls are connected to the existing PixGrid state.</p>
                </NoticeCard>
              </Collapsible>
              <Collapsible label="Document Stats" defaultOpen={false}>
                <section className="sm-document-stats">
                  <div><span>Scenes</span><strong>{displayedPixGridState.scenes.length}</strong></div>
                  <div><span>Layers</span><strong>{displayedPixGridState.layers.length}</strong></div>
                  <div><span>Groups</span><strong>{displayedPixGridState.groups.length}</strong></div>
                  <div><span>Cues</span><strong>{activeCues.length}</strong></div>
                </section>
              </Collapsible>
            </div>
          ) : activeSectionEngineId === 'laserDmx' ? (
            <div className="sm-inspector-scroll sm-laser-section-inspector">
              <div className="sm-inspector-context">
                <div><span>Show</span><strong>{activeLaserDmxShow?.name ?? 'Untitled Show'}</strong></div>
                <div><span>Grid</span><strong>{LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns} × {LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows}</strong></div>
              </div>
              {activeLaserDmxShow && activeLaserDmxSection ? (
                selectedLaserFixture ? (
                  <LaserDmxShowManagerFixtureInspector
                    fixture={selectedLaserFixture}
                    onPatch={commitLaserFixturePatch}
                    onInteractionStart={beginLaserDmxShowManagerHistoryTransaction}
                    onInteractionEnd={commitLaserDmxShowManagerHistoryTransaction}
                    onDelete={deleteSelectedLaserFixture}
                  />
                ) : <>
                  <NoticeCard tone="info" title="Show Track Map · linked audio">
                    Section order and count come from this Show’s linked-track analysis. Edit labels, types, intensity, or shared boundaries below; the underlying audio analysis is not modified.
                  </NoticeCard>
                  <section className="sm-laser-copy-fixtures" data-testid="laser-dmx-copy-fixtures-controls">
                    <ToggleRow
                      id="show-manager-laser-copy-fixtures"
                      label="Copy Fixtures From Another Section"
                      value={copyLaserFixturesEnabled}
                      onChange={enabled => {
                        setCopyLaserFixturesEnabled(enabled)
                        if (!enabled) setCopyLaserFixturesSourceSectionId(null)
                      }}
                    />
                    {copyLaserFixturesEnabled && (
                      <div className="sm-laser-copy-fixtures-picker">
                        <Dropdown
                          id="show-manager-laser-copy-fixtures-source"
                          ariaLabel="Copy fixtures source section"
                          menuLabel="Sections with LaserDMX fixtures"
                          value={copyLaserFixturesSourceSectionId}
                          onChange={sourceSectionId => {
                            setCopyLaserFixturesSourceSectionId(sourceSectionId)
                            commitLaserFixtureCopy(sourceSectionId)
                          }}
                          options={eligibleLaserFixtureCopySources.map(section => ({
                            value: section.id,
                            label: section.label,
                            description: `${section.fixtures.length} fixture${section.fixtures.length === 1 ? '' : 's'}`,
                          }))}
                          placeholder={eligibleLaserFixtureCopySources.length > 0 ? 'Choose source section' : 'No eligible sections'}
                          emptyMessage="No other sections contain fixtures"
                          disabled={eligibleLaserFixtureCopySources.length === 0}
                          size="compact"
                          className="sm-laser-copy-fixtures-dropdown"
                        />
                        {eligibleLaserFixtureCopySources.length === 0 && (
                          <p>No other section in this Show currently contains LaserDMX fixtures.</p>
                        )}
                      </div>
                    )}
                  </section>
                  {activeLaserTrackSection && (
                    <ShowManagerTrackMapSectionEditor
                      showId={activeLaserDmxShow.id}
                      section={activeLaserTrackSection}
                      durationSec={laserTimelineDuration}
                      effectiveBpm={showRuntimeBpm}
                      beatGrid={showRuntimeBeatGrid ?? []}
                      boundaryAlternatives={showRuntimeAnalysis?.boundaryAlternatives ?? []}
                    />
                  )}
                  <NoticeCard tone="success" title="Section fixture ownership · READY">
                    {activeLaserDmxSection.fixtures.length} fixture{activeLaserDmxSection.fixtures.length === 1 ? '' : 's'} owned by this section. Select a fixture on the grid to edit its Part 1 controls.
                  </NoticeCard>
                </>
              ) : activeLaserDmxShow ? (
                <div className="sm-laser-empty-section">
                  <p>{showTrackMapStatusMessage}</p>
                </div>
              ) : (
                <div className="sm-panel-blank" />
              )}
            </div>
          ) : activeSectionEngineId === 'canvas' ? (
            <CanvasShowManagerInspector
              show={activeCanvasShow}
              trackSection={activeCanvasTrackSection}
              element={selectedCanvasElement}
              elementMedia={selectedCanvasElementMedia}
              totalDurationSec={canvasTotalDuration}
              effectiveBpm={showRuntimeBpm}
              beatGrid={showRuntimeBeatGrid ?? []}
              boundaryAlternatives={showRuntimeAnalysis?.boundaryAlternatives ?? []}
              trackMapStatusMessage={showTrackMapStatusMessage}
              renameDraft={canvasRenameDraft}
              renameError={canvasRenameError}
              onRenameDraft={setCanvasRenameDraft}
              onRename={commitCanvasRename}
              onPatchElement={patch => selectedCanvasElement
                ? commitCanvasElementPatch(selectedCanvasElement.id, patch)
                : false}
              onInteractionStart={beginCanvasShowManagerHistoryTransaction}
              onInteractionEnd={commitCanvasShowManagerHistoryTransaction}
              onDeleteElement={deleteSelectedCanvasElement}
              onDelete={() => {
                if (!activeCanvasShow) return
                setPendingDeleteCanvasShow({ id: activeCanvasShow.id, name: activeCanvasShow.name })
              }}
              onCreate={createSelectedShow}
            />
          ) : (
            <div className="sm-inspector-scroll">
              <div className="sm-inspector-context">
                <div><span>Section</span><strong>{selectedShowManagerSection?.label ?? 'No section selected'}</strong></div>
                <div><span>Engine</span><strong>Unassigned</strong></div>
              </div>
              {selectedShowManagerSection && activeShowManagerShow && (
                <ShowManagerTrackMapSectionEditor
                  showId={activeShowManagerShow.id}
                  section={selectedShowManagerSection}
                  durationSec={durationSec}
                  effectiveBpm={showRuntimeBpm}
                  beatGrid={showRuntimeBeatGrid ?? []}
                  boundaryAlternatives={showRuntimeAnalysis?.boundaryAlternatives ?? []}
                />
              )}
            </div>
          )
          )}
          {rightInspectorTab === 'design' && <div className="sm-panel-blank" data-testid="show-manager-inspector-design-empty" />}
          {rightInspectorTab === 'react' && <div className="sm-panel-blank" data-testid="show-manager-inspector-react-empty" />}
        </aside>
        )}
          </>
        )}
      </div>

      {laserSectionContextMenu && (() => {
        const destination = resolvedTrackSections.find(section => section.id === laserSectionContextMenu.sectionId)
        if (!destination || !activeLaserDmxShow) return null
        const sources = getEligibleLaserDmxShowManagerFixtureCopySources(activeLaserDmxShow, destination.id)
        return (
          <ContextActionMenu
            x={laserSectionContextMenu.x}
            y={laserSectionContextMenu.y}
            ariaLabel={`${destination.label} section actions`}
            header={{ title: destination.label }}
            onClose={() => setLaserSectionContextMenu(null)}
            items={[{
              id: 'copy-fixtures',
              label: 'Copy Fixtures ›',
              disabled: sources.length === 0,
              onSelect: () => openLaserSectionCopyMenu(
                destination.id,
                laserSectionContextMenu.x,
                laserSectionContextMenu.y,
              ),
            }]}
          />
        )
      })()}
      {laserSectionCopyMenu && (() => {
        const destination = resolvedTrackSections.find(section => section.id === laserSectionCopyMenu.sectionId)
        if (!destination || !activeLaserDmxShow) return null
        const sources = getEligibleLaserDmxShowManagerFixtureCopySources(activeLaserDmxShow, destination.id)
        return (
          <ContextActionMenu
            x={laserSectionCopyMenu.x}
            y={laserSectionCopyMenu.y}
            ariaLabel={`Copy fixtures into ${destination.label}`}
            header={{ title: 'Copy Fixtures', subtitle: `Into ${destination.label}` }}
            onClose={() => setLaserSectionCopyMenu(null)}
            items={sources.map(source => ({
              id: `copy-fixtures-${source.id}`,
              label: `${source.label} (${source.fixtures.length} fixture${source.fixtures.length === 1 ? '' : 's'})`,
              onSelect: () => requestLaserFixtureCopyToSection(source.id, destination.id),
            }))}
          />
        )
      })()}

      {/* Shared application Audio Dock. Loading or selecting a track here updates
          the same AudioEngineContext consumed by the Show Manager preview. */}
      <VyzualzAudioDock
        expandable
        unifiedTimeline
        waveformAppearance="deck"
      />
      {showBrowserOpen && (
        <ShowBrowserDialog
          shows={showBrowserEntries}
          onClose={() => setShowBrowserOpen(false)}
          onOpen={openSelectedShow}
          onCopy={copySelectedShow}
          onDelete={deleteSelectedShow}
        />
      )}
      {newShowOpen && (
        <NewShowDialog
          copySource={copySourceShow}
          onClose={() => {
            setNewShowOpen(false)
            setCopySourceShowId(null)
          }}
        />
      )}
      {pendingSectionEngineReplacement && (
        <ConfirmDeleteDialog
          title="Change Section Engine?"
          message={`“${pendingSectionEngineReplacement.sectionLabel}” is already used by ${REACT_ENGINE_CATALOG[pendingSectionEngineReplacement.currentEngineId].label}. Using ${REACT_ENGINE_CATALOG[pendingSectionEngineReplacement.targetEngineId].label} here will clear the existing elements and settings from this section.`}
          confirmLabel={`Clear Section & Use ${REACT_ENGINE_CATALOG[pendingSectionEngineReplacement.targetEngineId].label}`}
          onCancel={() => setPendingSectionEngineReplacement(null)}
          onConfirm={confirmSectionEngineReplacement}
        />
      )}
      {pendingDeleteCanvasShow && (
        <ConfirmDeleteDialog
          message={`Delete Show “${pendingDeleteCanvasShow.name}”? This removes only the Show and its authored data. Linked media and audio remain in the library.`}
          busy={deletingCanvasShow}
          onCancel={() => setPendingDeleteCanvasShow(null)}
          onConfirm={() => void confirmDeleteCanvasShow()}
        />
      )}
    </section>
  )
}

function CanvasShowManagerInspector({
  show,
  trackSection,
  element,
  elementMedia,
  totalDurationSec,
  effectiveBpm,
  beatGrid,
  boundaryAlternatives,
  trackMapStatusMessage,
  renameDraft,
  renameError,
  onRenameDraft,
  onRename,
  onPatchElement,
  onInteractionStart,
  onInteractionEnd,
  onDeleteElement,
  onDelete,
  onCreate,
}: {
  show: CanvasShowManagerShow | null
  trackSection: ReactTrackSection | null
  element: CanvasShowManagerMediaElement | null
  elementMedia: UploadedMedia | null
  totalDurationSec: number
  effectiveBpm: number | null
  beatGrid: BeatMarkerMI[]
  boundaryAlternatives: BoundaryAlternative[]
  trackMapStatusMessage: string
  renameDraft: string
  renameError: string | null
  onRenameDraft: (value: string) => void
  onRename: () => void
  onPatchElement: (patch: CanvasShowManagerMediaElementPatch) => boolean
  onInteractionStart: () => void
  onInteractionEnd: () => void
  onDeleteElement: () => void
  onDelete: () => void
  onCreate: () => void
}) {
  useEffect(() => () => onInteractionEnd(), [element?.id, onInteractionEnd])
  if (!show) {
    return (
      <div className="sm-inspector-scroll sm-canvas-inspector">
        <div className="sm-canvas-inspector-empty">
          <p>Select a Canvas Show to edit it.</p>
          <button type="button" onClick={onCreate}>New Show</button>
        </div>
      </div>
    )
  }
  if (element) {
    const transitionOptions = [
      { value: 'hardCut', label: 'None / Hard Cut' },
      { value: 'fade', label: 'Fade' },
      { value: 'slide', label: 'Slide' },
      { value: 'zoom', label: 'Zoom' },
    ]
    const directionOptions = [
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
    ]
    const sliderGesture = { onInteractionStart, onInteractionEnd }
    const renderTransition = (edge: 'in' | 'out', label: string) => {
      const transition = element.transitions[edge]
      return (
        <div className="sm-canvas-transition-subgroup" data-transition-edge={edge}>
          <strong>{label}</strong>
          <SelectRow
            label={`${label} Type`}
            value={transition.type}
            options={transitionOptions}
            onChange={type => onPatchElement({
              transitions: { [edge]: { type: type as CanvasShowManagerTransitionType } },
            })}
          />
          {transition.type !== 'hardCut' && (
            <SliderRow
              label={`${label} Duration`}
              value={transition.durationSec}
              min={0}
              max={Math.max(0.001, element.showEndSec - element.showStartSec)}
              step={0.01}
              description="Seconds inside this element's Show cue range."
              onChange={durationSec => onPatchElement({ transitions: { [edge]: { durationSec } } })}
              {...sliderGesture}
            />
          )}
          {transition.type === 'slide' && (
            <SelectRow
              label={`${label} Direction`}
              value={transition.direction}
              options={directionOptions}
              onChange={direction => onPatchElement({
                transitions: { [edge]: { direction: direction as CanvasShowManagerTransitionDirection } },
              })}
            />
          )}
        </div>
      )
    }
    return (
      <div className="sm-inspector-scroll sm-canvas-inspector" data-testid="canvas-show-manager-element-inspector">
        <div className="sm-inspector-context">
          <div><span>Element</span><strong>{elementMedia?.title?.trim() || elementMedia?.name || 'Missing media'}</strong></div>
          <div><span>Layer</span><strong>{element.layer + 1}</strong></div>
        </div>
        {!elementMedia && <p className="sm-canvas-form-error" role="status">This shared media item is unavailable. Its authored reference has been preserved.</p>}
        <Collapsible label="Display" defaultOpen>
          <div className="sm-canvas-element-controls" data-testid="canvas-inspector-group-display">
            <SliderRow label="Scale" value={element.display.scale} min={0.1} max={4} step={0.01} onChange={scale => onPatchElement({ display: { scale } })} {...sliderGesture} />
            <SliderRow label="X" value={element.display.x} min={-2} max={2} step={0.01} onChange={x => onPatchElement({ display: { x } })} {...sliderGesture} />
            <SliderRow label="Y" value={element.display.y} min={-2} max={2} step={0.01} onChange={y => onPatchElement({ display: { y } })} {...sliderGesture} />
            <SliderRow label="Brightness" value={element.display.brightness} min={0} max={2} step={0.01} onChange={brightness => onPatchElement({ display: { brightness } })} {...sliderGesture} />
            <SliderRow label="Opacity" value={element.display.opacity} min={0} max={1} step={0.01} onChange={opacity => onPatchElement({ display: { opacity } })} {...sliderGesture} />
            <SliderRow label="Rotation" value={element.display.rotation} min={-180} max={180} step={1} onChange={rotation => onPatchElement({ display: { rotation } })} {...sliderGesture} />
          </div>
        </Collapsible>
        <Collapsible label="Transitions" defaultOpen>
          <div className="sm-canvas-element-controls" data-testid="canvas-inspector-group-transitions">
            {renderTransition('in', 'In')}
            {renderTransition('out', 'Out')}
          </div>
        </Collapsible>
        <Collapsible label="FX" defaultOpen>
          <div className="sm-canvas-element-controls" data-testid="canvas-inspector-group-fx">
            <SliderRow label="Blur" value={element.fx.blur} min={0} max={20} step={0.1} onChange={blur => onPatchElement({ fx: { blur } })} {...sliderGesture} />
            <SliderRow label="Contrast" value={element.fx.contrast} min={0} max={2} step={0.01} onChange={contrast => onPatchElement({ fx: { contrast } })} {...sliderGesture} />
            <SliderRow label="Saturation" value={element.fx.saturation} min={0} max={2} step={0.01} onChange={saturation => onPatchElement({ fx: { saturation } })} {...sliderGesture} />
            <SliderRow label="Hue" value={element.fx.hue} min={-180} max={180} step={1} onChange={hue => onPatchElement({ fx: { hue } })} {...sliderGesture} />
            <SliderRow label="Glow" value={element.fx.glow} min={0} max={1} step={0.01} onChange={glow => onPatchElement({ fx: { glow } })} {...sliderGesture} />
          </div>
        </Collapsible>
        <button type="button" className="sm-canvas-delete" onClick={onDeleteElement}>Remove Element</button>
      </div>
    )
  }
  return (
    <div className="sm-inspector-scroll sm-canvas-inspector">
      <div className="sm-inspector-context">
        <div><span>Show</span><strong>{show.name}</strong></div>
        <div><span>Duration</span><strong>{formatClock(totalDurationSec)}</strong></div>
      </div>
      <Collapsible label="Show" defaultOpen>
        <form
          className="sm-canvas-form"
          onSubmit={event => {
            event.preventDefault()
            onRename()
          }}
        >
          <label htmlFor="canvas-show-name">Show Name</label>
          <DreamVizTextInput
            id="canvas-show-name"
            value={renameDraft}
            onChange={event => onRenameDraft(event.target.value)}
          />
          {renameError && <p className="sm-canvas-form-error" role="alert">{renameError}</p>}
          <button type="submit">Update Name</button>
        </form>
      </Collapsible>
      {trackSection ? (
        <Collapsible label="Show Track Map Section" defaultOpen>
          <ShowManagerTrackMapSectionEditor
            showId={show.id}
            section={trackSection}
            durationSec={totalDurationSec}
            effectiveBpm={effectiveBpm}
            beatGrid={beatGrid}
            boundaryAlternatives={boundaryAlternatives}
          />
        </Collapsible>
      ) : (
        <NoticeCard tone="info" title="Show Track Map">{trackMapStatusMessage}</NoticeCard>
      )}
      <button type="button" className="sm-canvas-delete" onClick={onDelete}>Delete Show</button>
    </div>
  )
}

function UnownedShowManagerStage({
  section,
  selectedCanvasMediaId,
  onDropLaserFixture,
  onPlaceCanvasMedia,
}: {
  section: ReactTrackSection | null
  selectedCanvasMediaId: string | null
  onDropLaserFixture: (event: DragEvent<HTMLDivElement>) => void
  onPlaceCanvasMedia: (mediaId: string, layer: CanvasShowManagerLayer) => boolean
}) {
  const [mediaDragActive, setMediaDragActive] = useState(false)
  const mediaTargetsVisible = mediaDragActive || selectedCanvasMediaId != null
  const hasMediaPayload = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes('vz/mediaId')
  const hasLaserPayload = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes('application/x-drmvyz-laserdmx-fixture-kind')

  return (
    <div className="sm-laser-stage sm-canvas-stage" aria-label="Unassigned Show section authoring surface">
      <div
        className="sm-laser-stage-grid-surface sm-canvas-authoring-surface"
        data-testid="show-manager-unassigned-authoring-surface"
        onDragEnter={event => {
          if (hasMediaPayload(event)) setMediaDragActive(true)
        }}
        onDragOver={event => {
          if (!hasMediaPayload(event) && !hasLaserPayload(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          if (hasMediaPayload(event)) setMediaDragActive(true)
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMediaDragActive(false)
        }}
        onDrop={event => {
          if (!hasLaserPayload(event)) return
          onDropLaserFixture(event)
        }}
      >
        <div className="sm-canvas-authored-elements" aria-hidden={mediaTargetsVisible}>
          <p>Drag the first component or element into this section to assign its engine.</p>
        </div>
        {mediaTargetsVisible && section && (
          <div className="sm-canvas-layer-targets" role="group" aria-label="Canvas media layer drop targets">
            {([3, 2, 1, 0] as const).map(layer => (
              <button
                key={layer}
                type="button"
                data-testid={`unassigned-canvas-layer-drop-target-${layer + 1}`}
                aria-label={`Assign this section to Canvas and place media on Layer ${layer + 1}`}
                onDragOver={event => {
                  if (!hasMediaPayload(event)) return
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onDrop={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  const mediaId = event.dataTransfer.getData('vz/mediaId')
                  if (mediaId) onPlaceCanvasMedia(mediaId, layer)
                  setMediaDragActive(false)
                }}
                onClick={() => {
                  if (selectedCanvasMediaId) onPlaceCanvasMedia(selectedCanvasMediaId, layer)
                }}
              >
                <span>Layer {layer + 1}</span>
                <strong>{layer === 3 ? 'TOP / FRONT' : layer === 0 ? 'BOTTOM / BACK' : `STACK ${layer + 1}`}</strong>
                <small>Drop here</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CanvasShowManagerStage({
  show,
  selectedSectionId,
  selectedElementId,
  selectedLibraryMediaId,
  mediaItems,
  sectionRanges,
  onSelectElement,
  onPlaceMedia,
  onDropLaserFixture,
  onCreate,
  runtimePreview,
}: {
  show: CanvasShowManagerShow | null
  selectedSectionId: string | null
  selectedElementId: string | null
  selectedLibraryMediaId: string | null
  mediaItems: readonly UploadedMedia[]
  sectionRanges: readonly CanvasShowManagerSectionRange[]
  onSelectElement: (elementId: string | null) => void
  onPlaceMedia: (mediaId: string, layer: CanvasShowManagerLayer) => boolean
  onDropLaserFixture: (event: DragEvent<HTMLDivElement>) => void
  onCreate: () => void
  runtimePreview?: ReactNode
}) {
  const [dragActive, setDragActive] = useState(false)
  const [hoveredLayer, setHoveredLayer] = useState<CanvasShowManagerLayer | null>(null)
  if (!show) {
    return (
      <div className="sm-canvas-stage sm-canvas-stage--empty" data-testid="canvas-show-manager-empty-state">
        <span aria-hidden="true">▣</span>
        <strong>No Canvas Show open</strong>
        <p>Create a Show or open one using the header actions.</p>
        <button type="button" onClick={onCreate}>New Show</button>
      </div>
    )
  }
  const selectedRange = sectionRanges.find(range => range.sectionId === selectedSectionId) ?? sectionRanges[0] ?? null
  const selectedSection = show.sections.find(section => section.id === selectedRange?.sectionId) ?? null
  const visibleElements = selectedRange
    ? show.mediaElements.filter(element => element.showStartSec < selectedRange.endSec && element.showEndSec > selectedRange.startSec)
    : []
  const targetsVisible = dragActive || selectedLibraryMediaId != null
  const resolveMedia = (mediaId: string) => mediaItems.find(media => media.id === mediaId) ?? null
  return (
    <div
      className="sm-canvas-stage"
      aria-label="Canvas Show editor"
      onDragEnter={event => {
        if (Array.from(event.dataTransfer.types).includes('vz/mediaId')) setDragActive(true)
      }}
      onDragOver={event => {
        if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDragActive(true)
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false)
          setHoveredLayer(null)
        }
      }}
    >
      <div
        className="sm-canvas-authoring-surface"
        data-testid="canvas-show-manager-authoring-surface"
        onDragOver={event => {
          if (!Array.from(event.dataTransfer.types).includes('application/x-drmvyz-laserdmx-fixture-kind')) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={event => {
          if (!Array.from(event.dataTransfer.types).includes('application/x-drmvyz-laserdmx-fixture-kind')) return
          event.stopPropagation()
          onDropLaserFixture(event)
        }}
      >
        {runtimePreview && <div className="sm-canvas-runtime-preview" data-testid="canvas-show-runtime-preview">{runtimePreview}</div>}
        <div
          className="sm-canvas-authored-elements"
          aria-label="Authored media visible in selected section"
          onClick={event => {
            if (event.target === event.currentTarget) onSelectElement(null)
          }}
        >
          {visibleElements.map(element => {
            const media = resolveMedia(element.mediaId)
            return (
              <button
                key={element.id}
                type="button"
                className={`sm-canvas-authored-element${element.id === selectedElementId ? ' is-selected' : ''}${media ? '' : ' is-missing'}`}
                style={{ zIndex: element.layer + 1 }}
                onClick={() => onSelectElement(element.id)}
                aria-label={`Select ${media?.title?.trim() || media?.name || 'missing media'} on Layer ${element.layer + 1}`}
              >
                <span>Layer {element.layer + 1}</span>
                <strong>{media?.title?.trim() || media?.name || 'Media unavailable'}</strong>
                <small>{element.showStartSec.toFixed(2)}–{element.showEndSec.toFixed(2)}s</small>
              </button>
            )
          })}
          {visibleElements.length === 0 && <p>Drag compatible media here, then choose an exact layer.</p>}
        </div>
        {targetsVisible && selectedRange && (
          <div className="sm-canvas-layer-targets" role="group" aria-label="Canvas media layer drop targets">
            {([3, 2, 1, 0] as const).map(layer => {
              const invalid = canvasShowManagerRangeOverlaps(
                show.mediaElements,
                layer,
                selectedRange.startSec,
                selectedRange.endSec,
              )
              return (
                <button
                  key={layer}
                  type="button"
                  className={`${hoveredLayer === layer ? 'is-hovered' : ''}${invalid ? ' is-invalid' : ''}`}
                  data-testid={`canvas-layer-drop-target-${layer + 1}`}
                  aria-label={`Place selected media on Layer ${layer + 1}${layer === 3 ? ', top front' : layer === 0 ? ', bottom back' : ''}`}
                  onDragOver={event => {
                    if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                    event.preventDefault()
                    event.stopPropagation()
                    setHoveredLayer(layer)
                  }}
                  onDragLeave={() => setHoveredLayer(current => current === layer ? null : current)}
                  onDrop={event => {
                    if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                    event.preventDefault()
                    event.stopPropagation()
                    const mediaId = event.dataTransfer.getData('vz/mediaId')
                    if (mediaId) onPlaceMedia(mediaId, layer)
                    setDragActive(false)
                    setHoveredLayer(null)
                  }}
                  onClick={() => {
                    if (selectedLibraryMediaId) onPlaceMedia(selectedLibraryMediaId, layer)
                  }}
                >
                  <span>Layer {layer + 1}</span>
                  <strong>{layer === 3 ? 'TOP / FRONT' : layer === 0 ? 'BOTTOM / BACK' : `STACK ${layer + 1}`}</strong>
                  <small>{invalid ? 'Overlaps selected section' : 'Drop here'}</small>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ShowManagerBeatGrid({
  beatGrid,
  durationSec,
  viewport,
}: {
  beatGrid: readonly BeatMarkerMI[]
  durationSec: number
  viewport: TimelineViewport
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawBeatGridCanvas(canvas, beatGrid, durationSec, viewport)
  }, [beatGrid, durationSec, viewport])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => drawBeatGridCanvas(canvas, beatGrid, durationSec, viewport))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [beatGrid, durationSec, viewport])

  return <canvas ref={canvasRef} className="sm-track-map-beat-canvas" aria-hidden="true" />
}

function ShowManagerTimeRow({
  viewport,
  divisions = 6,
}: {
  viewport: TimelineViewport
  divisions?: number
}) {
  const count = Math.max(1, Math.floor(divisions))
  const span = Math.max(0, viewport.endSec - viewport.startSec)
  return (
    <TimelineRow label="Time" className="sm-timeline-row--time">
      <div className="sm-timeline-ruler">
        {Array.from({ length: count + 1 }, (_, index) => {
          const ratio = index / count
          const timeSec = viewport.startSec + span * ratio
          return <span key={index}>{formatClock(timeSec)}</span>
        })}
      </div>
    </TimelineRow>
  )
}

function CanvasShowManagerTimeline({
  show,
  selectedSectionId,
  selectedElementId,
  mediaItems,
  sectionRanges,
  totalDurationSec,
  viewport,
  beatGrid,
  playheadSec,
  onSelect,
  onContextMenu,
  onSelectElement,
  onPatchElement,
}: {
  show: CanvasShowManagerShow | null
  selectedSectionId: string | null
  selectedElementId: string | null
  mediaItems: readonly UploadedMedia[]
  sectionRanges: readonly CanvasShowManagerSectionRange[]
  totalDurationSec: number
  viewport: TimelineViewport
  beatGrid: readonly BeatMarkerMI[]
  playheadSec: number
  onSelect: (sectionId: string | null) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>, sectionId: string) => void
  onSelectElement: (elementId: string | null) => void
  onPatchElement: (elementId: string, patch: CanvasShowManagerMediaElementPatch) => boolean
}) {
  const canvasTimelineSections = useMemo<ShowManagerSectionSegment[]>(() => (
    show?.sections.map((section, index) => ({
      id: section.id,
      label: section.label,
      type: section.type,
      startSec: sectionRanges[index]?.startSec ?? 0,
      endSec: sectionRanges[index]?.endSec ?? section.durationSec,
    })) ?? []
  ), [sectionRanges, show])
  const viewportDurationSec = Math.max(0.001, viewport.endSec - viewport.startSec)
  const playheadVisible = playheadSec >= viewport.startSec && playheadSec <= viewport.endSec
  const playheadLeftPct = ((playheadSec - viewport.startSec) / viewportDurationSec) * 100
  const beginPointerCueEdit = (
    event: ReactPointerEvent<HTMLButtonElement>,
    element: CanvasShowManagerMediaElement,
    edge: 'start' | 'end',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const lane = event.currentTarget.closest<HTMLElement>('.sm-canvas-media-lane__track')
    const width = lane?.getBoundingClientRect().width ?? 0
    if (width <= 0 || totalDurationSec <= 0) return
    const originX = event.clientX
    const finish = (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointerup', finish)
      const deltaSec = ((pointerEvent.clientX - originX) / width) * viewportDurationSec
      if (edge === 'start') {
        onPatchElement(element.id, { showStartSec: Math.max(0, Math.min(element.showEndSec - 0.001, element.showStartSec + deltaSec)) })
      } else {
        onPatchElement(element.id, { showEndSec: Math.min(totalDurationSec, Math.max(element.showStartSec + 0.001, element.showEndSec + deltaSec)) })
      }
    }
    window.addEventListener('pointerup', finish, { once: true })
  }
  const nudgeCue = (element: CanvasShowManagerMediaElement, edge: 'start' | 'end', deltaSec: number) => {
    if (edge === 'start') {
      onPatchElement(element.id, { showStartSec: Math.max(0, Math.min(element.showEndSec - 0.001, element.showStartSec + deltaSec)) })
    } else {
      onPatchElement(element.id, { showEndSec: Math.min(totalDurationSec, Math.max(element.showStartSec + 0.001, element.showEndSec + deltaSec)) })
    }
  }
  const selectedElement = show?.mediaElements.find(element => element.id === selectedElementId) ?? null
  const selectedMedia = selectedElement ? mediaItems.find(media => media.id === selectedElement.mediaId) ?? null : null
  const selectedMediaType = selectedMedia ? getCanvasLibraryMediaType(selectedMedia) : null
  const selectedSourceDuration = selectedMedia?.metadata.duration ?? null
  return (
    <section className="sm-timeline sm-canvas-timeline" aria-label="Show Manager Canvas media timeline">
      <header className="sm-timeline-tabs">
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="Canvas timeline surfaces" className="rv-lower-workspace-tabs" />
        <span className="sm-timeline-meta">{show ? `${formatClock(totalDurationSec)} total` : 'No Canvas Show open'}</span>
      </header>
      {show ? (
        <>
          <div className="sm-timeline-grid sm-canvas-section-map">
            <TimelineRow label="Beats" className="sm-timeline-row--beats">
              <ShowManagerBeatGrid beatGrid={beatGrid} durationSec={totalDurationSec} viewport={viewport} />
            </TimelineRow>
            <TimelineRow label="Section" className="sm-timeline-row--sections">
              <ShowManagerSectionStrip
                sections={canvasTimelineSections}
                durationSec={totalDurationSec}
                viewport={viewport}
                selectedSectionId={selectedSectionId}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
              />
            </TimelineRow>
            <ShowManagerTimeRow viewport={viewport} />
          </div>
          <div className="sm-canvas-timeline-body">
            <div className="sm-canvas-media-lanes">
              {([3, 2, 1, 0] as const).map(layer => (
                <div className="sm-canvas-media-lane" key={layer}>
                  <span className="sm-canvas-media-lane__label">L{layer + 1}</span>
                  <div className="sm-canvas-media-lane__track">
                    <span
                      className="sm-canvas-playhead"
                      style={{ display: playheadVisible ? undefined : 'none', left: `${playheadLeftPct}%` }}
                      aria-hidden="true"
                    />
                    {show.mediaElements.filter(element => element.layer === layer).map(element => {
                      const media = mediaItems.find(candidate => candidate.id === element.mediaId) ?? null
                      const layout = computeViewportRangeLayout(
                        { startSec: element.showStartSec, endSec: element.showEndSec },
                        viewport,
                      )
                      const handleKey = (edge: 'start' | 'end', event: ReactKeyboardEvent<HTMLButtonElement>) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                        event.preventDefault()
                        nudgeCue(element, edge, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1))
                      }
                      return (
                        <div
                          key={element.id}
                          className={`sm-canvas-media-clip${element.id === selectedElementId ? ' is-selected' : ''}${media ? '' : ' is-missing'}`}
                          style={{
                            display: layout.visible ? undefined : 'none',
                            left: `${layout.leftPct}%`,
                            width: `${layout.widthPct}%`,
                          }}
                        >
                          <button
                            className="sm-canvas-clip-handle is-start"
                            type="button"
                            style={{ display: layout.startEdgeVisible ? undefined : 'none' }}
                            aria-label={`Adjust start cue for ${media?.name ?? 'missing media'}`}
                            onPointerDown={event => beginPointerCueEdit(event, element, 'start')}
                            onKeyDown={event => handleKey('start', event)}
                          />
                          <button className="sm-canvas-media-clip__body" type="button" onClick={() => onSelectElement(element.id)} title={`${media?.name ?? 'Missing media'} · ${element.showStartSec.toFixed(2)}–${element.showEndSec.toFixed(2)}s`}>
                            {media?.title?.trim() || media?.name || 'Unavailable'}
                          </button>
                          <button
                            className="sm-canvas-clip-handle is-end"
                            type="button"
                            style={{ display: layout.endEdgeVisible ? undefined : 'none' }}
                            aria-label={`Adjust end cue for ${media?.name ?? 'missing media'}`}
                            onPointerDown={event => beginPointerCueEdit(event, element, 'end')}
                            onKeyDown={event => handleKey('end', event)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {selectedElement && (
              <div className="sm-canvas-selected-clip-authoring" data-testid="canvas-selected-clip-authoring">
              <div className="sm-canvas-selected-clip-authoring__heading">
                <strong>{selectedMedia?.title?.trim() || selectedMedia?.name || 'Missing media'}</strong>
                <small>Show cues and source trim</small>
              </div>
              <div className="sm-canvas-selected-clip-authoring__fields">
                <label htmlFor="canvas-element-layer">Layer</label>
                <Dropdown
                  id="canvas-element-layer"
                  ariaLabel="Canvas media element layer"
                  value={String(selectedElement.layer)}
                  onChange={value => onPatchElement(selectedElement.id, { layer: Number(value) })}
                  options={[3, 2, 1, 0].map(layer => ({ value: String(layer), label: `Layer ${layer + 1}` }))}
                  size="compact"
                />
                <label htmlFor="canvas-element-show-start">Show Start</label>
                <DreamVizTextInput
                  id="canvas-element-show-start"
                  key={`${selectedElement.id}:start:${selectedElement.showStartSec}`}
                  type="number"
                  min="0"
                  max={selectedElement.showEndSec - 0.001}
                  step="0.01"
                  defaultValue={selectedElement.showStartSec}
                  onBlur={event => {
                    if (!onPatchElement(selectedElement.id, { showStartSec: Number(event.target.value) })) event.target.value = String(selectedElement.showStartSec)
                  }}
                />
                <label htmlFor="canvas-element-show-end">Show End</label>
                <DreamVizTextInput
                  id="canvas-element-show-end"
                  key={`${selectedElement.id}:end:${selectedElement.showEndSec}`}
                  type="number"
                  min={selectedElement.showStartSec + 0.001}
                  max={totalDurationSec}
                  step="0.01"
                  defaultValue={selectedElement.showEndSec}
                  onBlur={event => {
                    if (!onPatchElement(selectedElement.id, { showEndSec: Number(event.target.value) })) event.target.value = String(selectedElement.showEndSec)
                  }}
                />
              </div>
              {selectedMediaType === 'video' && (
                selectedSourceDuration && selectedSourceDuration > 0 ? (
                  selectedElement.sourceOutSec == null ? (
                    <button type="button" onClick={() => onPatchElement(selectedElement.id, { sourceInSec: 0, sourceOutSec: selectedSourceDuration })}>
                      Initialize Video Trim
                    </button>
                  ) : (
                    <div className="sm-canvas-selected-clip-authoring__fields" data-testid="canvas-video-source-trim">
                      <label htmlFor="canvas-element-source-in">Source In</label>
                      <DreamVizTextInput
                        id="canvas-element-source-in"
                        key={`${selectedElement.id}:source-in:${selectedElement.sourceInSec}`}
                        type="number"
                        min="0"
                        max={selectedElement.sourceOutSec - 0.001}
                        step="0.01"
                        defaultValue={selectedElement.sourceInSec ?? 0}
                        onBlur={event => {
                          if (!onPatchElement(selectedElement.id, { sourceInSec: Number(event.target.value) })) event.target.value = String(selectedElement.sourceInSec ?? 0)
                        }}
                      />
                      <label htmlFor="canvas-element-source-out">Source Out</label>
                      <DreamVizTextInput
                        id="canvas-element-source-out"
                        key={`${selectedElement.id}:source-out:${selectedElement.sourceOutSec}`}
                        type="number"
                        min={(selectedElement.sourceInSec ?? 0) + 0.001}
                        max={selectedSourceDuration}
                        step="0.01"
                        defaultValue={selectedElement.sourceOutSec}
                        onBlur={event => {
                          if (!onPatchElement(selectedElement.id, { sourceOutSec: Number(event.target.value) })) event.target.value = String(selectedElement.sourceOutSec)
                        }}
                      />
                    </div>
                  )
                ) : <small>Video duration is still resolving. Source trim will be available when metadata is known.</small>
              )}
              </div>
            )}
          </div>
        </>
      ) : <div className="sm-laser-timeline-empty">Create or open a Canvas Show to edit its sections.</div>}
    </section>
  )
}

// Same vocabulary/labels as the Beam Matrix fixture inspector's Audio band
// and Beat division rows (LaserDmxShowDirectorInspector.tsx) — mirrored here
// rather than reinvented so the two inspectors describe the same real
// trigger fields the same way.
const SHOW_MANAGER_AUDIO_BAND_OPTIONS: Array<{ value: LaserDmxShowDirectorAudioBand; label: string }> = [
  { value: 'sub', label: 'Sub' },
  { value: 'bass', label: 'Bass' },
  { value: 'lowMid', label: 'Low-mid' },
  { value: 'mid', label: 'Mid' },
  { value: 'highMid', label: 'High-mid' },
  { value: 'high', label: 'High' },
]

const SHOW_MANAGER_BEAT_DIVISION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0.25', label: '1/4 beat' },
  { value: '0.5', label: '1/2 beat' },
  { value: '1', label: '1 beat' },
  { value: '2', label: '2 beats' },
  { value: '4', label: '4 beats' },
  { value: '8', label: '8 beats' },
]

function parseShowManagerBeatDivision(value: string): LaserDmxShowDirectorBeatDivision {
  const numeric = Number(value)
  if (numeric === 0.25 || numeric === 0.5 || numeric === 2 || numeric === 4 || numeric === 8) return numeric
  return 1
}

const SHOW_MANAGER_RETRIGGER_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerRetrigger; label: string }> = [
  { value: 'allow', label: 'Always' },
  { value: 'oncePerBeat', label: 'Once per Beat' },
  { value: 'oncePerBar', label: 'Once per Bar' },
  { value: 'oncePerPhrase', label: 'Once per Phrase' },
]

function LaserDmxShowManagerFixtureInspector({
  fixture,
  onPatch,
  onInteractionStart,
  onInteractionEnd,
  onDelete,
}: {
  fixture: LaserDmxShowDirectorFixture
  onPatch: (patch: LaserDmxShowDirectorFixturePatch) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
  onDelete: () => void
}) {
  useEffect(() => () => onInteractionEnd(), [fixture.id, onInteractionEnd])
  const [fixtureMenuAnchor, setFixtureMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const triggerOption = resolveLaserDmxShowManagerTriggerOption(fixture.trigger)
  const storedTriggerValue = `stored:${fixture.trigger.mode}`
  const triggerSelectValue = triggerOption ?? storedTriggerValue
  const triggerOptions = triggerOption == null
    ? [
        { value: storedTriggerValue, label: describeLaserDmxShowManagerStoredTrigger(fixture.trigger), disabled: true },
        ...LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => ({ ...option })),
      ]
    : LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => ({ ...option }))
  const sliderGesture = { onInteractionStart, onInteractionEnd }
  const beamTargetOptions = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'fan', label: 'Fan' },
    { value: 'sweep', label: 'Sweep' },
    { value: 'cross', label: 'Cross' },
    { value: 'mirror', label: 'Mirror' },
    { value: 'audioReactive', label: 'Audio Reactive' },
  ]
  const movingHeadStyleOptions: Array<{ value: LaserDmxShowDirectorMovingHeadPanTiltStyle; label: string }> = [
    { value: 'locked', label: 'Locked aim' },
    { value: 'smoothSweep', label: 'Smooth sweep' },
    { value: 'snap', label: 'Snap turns' },
    { value: 'figureEight', label: 'Figure eight' },
    { value: 'audioReactive', label: 'Audio reactive' },
  ]
  const ledDirectionOptions: Array<{ value: LaserDmxShowDirectorLedDirection; label: string }> = [
    { value: 'leftToRight', label: 'Left to right' },
    { value: 'rightToLeft', label: 'Right to left' },
    { value: 'centerOut', label: 'Center out' },
    { value: 'edgesIn', label: 'Edges in' },
    { value: 'chase', label: 'Chase' },
  ]
  const movingHeadGoboOptions: Array<{ value: LaserDmxShowDirectorGoboPattern; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'circle', label: 'Circle' },
    { value: 'dots', label: 'Dots' },
    { value: 'bars', label: 'Bars' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'star', label: 'Star' },
    { value: 'breakup', label: 'Breakup' },
    { value: 'radial', label: 'Radial' },
    { value: 'grid', label: 'Grid' },
  ]
  const movingHeadPrismOptions = [
    { value: '1', label: 'Open / single image' },
    { value: '3', label: '3-facet prism' },
    { value: '5', label: '5-facet prism' },
  ]
  const targetDepthOptions = (Object.entries(LASER_DMX_SHOW_DIRECTOR_DEPTH_LAYER_LABELS) as Array<[LaserDmxShowDirectorDepthLayer, string]>)
    .map(([value, label]) => ({ value, label }))
  const isLaser = fixture.kind === 'laser'
  const isMovingHead = fixture.kind === 'movingHead'
  const isLedBar = fixture.kind === 'ledBar'
  const isStrobe = fixture.kind === 'strobe'
  const manualTargetCoordinatesActive = fixture.beam.targetMode === 'fixed'
  const scannerDirectionOptions: Array<{ value: LaserDmxShowDirectorScannerDirection; label: string }> = [
    { value: 'forward', label: 'Forward' },
    { value: 'reverse', label: 'Reverse' },
    { value: 'alternating', label: 'Alternating' },
  ]
  const scannerPatternValue = fixture.scanner?.patternType ?? 'legacyTargetMode'
  const scannerPatternOptions: Array<{ value: string; label: string; disabled?: boolean }> = fixture.scanner
    ? LASER_DMX_SCANNER_PATTERN_OPTIONS.map(option => ({ ...option }))
    : [
        { value: 'legacyTargetMode', label: 'Legacy Target Mode', disabled: true },
        ...LASER_DMX_SCANNER_PATTERN_OPTIONS.map(option => ({ ...option })),
      ]

  const commitScanner = (nextScanner: LaserDmxShowDirectorScannerConfig) => {
    const targets = scannerPointsToBeamTargets(nextScanner)
    const primary = targets[0]
    onPatch({
      scanner: nextScanner,
      beam: {
        targets,
        ...(primary ? {
          targetX: primary.x,
          targetY: primary.y,
          ...(primary.z == null ? {} : { targetZ: primary.z }),
        } : {}),
      },
    })
  }

  const changeScannerPattern = (patternType: LaserDmxShowDirectorScannerPatternType) => {
    const next = createLaserDmxScannerPattern(fixture, patternType, LASER_DMX_SHOW_MANAGER_GRID_SIZE)
    if (fixture.scanner) {
      next.scanRatePps = fixture.scanner.scanRatePps
      next.durationBeats = fixture.scanner.durationBeats
      next.phase = fixture.scanner.phase
      next.depthLayer = fixture.scanner.depthLayer
      next.advanced = { ...fixture.scanner.advanced }
    }
    commitScanner(next)
  }

  const patchScanner = (patch: Partial<LaserDmxShowDirectorScannerConfig>) => {
    if (!fixture.scanner) return
    commitScanner({ ...fixture.scanner, ...patch })
  }

  return (
    <div className="sm-laser-fixture-inspector" data-testid="laser-dmx-fixture-inspector">
      <div className="sm-inspector-fixture-card">
        <span className="sm-inspector-fixture-icon" aria-hidden="true"><FixtureIcon kind={fixture.kind} /></span>
        <div className="sm-inspector-fixture-copy">
          <strong>{fixture.label}</strong>
          <span>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]}</span>
        </div>
        <span className="sm-inspector-fixture-dot" style={{ background: fixture.color }} title={fixture.color} aria-hidden="true" />
        <IconChipButton
          className="sm-inspector-fixture-menu"
          aria-label={`${fixture.label} actions`}
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            setFixtureMenuAnchor({ x: rect.right, y: rect.bottom })
          }}
        >
          <MoreVerticalIcon size={14} color="currentColor" />
        </IconChipButton>
        {fixtureMenuAnchor && (
          <ContextActionMenu
            x={fixtureMenuAnchor.x}
            y={fixtureMenuAnchor.y}
            ariaLabel={`${fixture.label} actions`}
            onClose={() => setFixtureMenuAnchor(null)}
            items={[
              {
                id: 'delete',
                label: 'Delete Fixture',
                danger: true,
                onSelect: () => {
                  setFixtureMenuAnchor(null)
                  onDelete()
                },
              },
            ]}
          />
        )}
      </div>

      <Collapsible label="Transform" defaultOpen>
        <div className="sm-inspector-triple-row">
          <NumberInputRow
            label="X"
            value={fixture.x}
            min={0}
            max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1}
            step={1}
            onChange={x => onPatch({ x })}
          />
          <NumberInputRow
            label="Y"
            value={fixture.y}
            min={0}
            max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1}
            step={1}
            onChange={y => onPatch({ y })}
          />
          <NumberInputRow label="Z" value={fixture.z} min={-1} max={1} step={0.05} onChange={z => onPatch({ z })} />
        </div>
        <div className="sm-laser-depth-note">X/Y/Z are grid cells, not meters — Z controls renderer depth only; the 2D grid marker remains positioned by X/Y.</div>
        {isLaser ? (
          !manualTargetCoordinatesActive && (
            <NumberInputRow label="Yaw" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => onPatch({ rotation })} />
          )
        ) : (
          (!isMovingHead || !manualTargetCoordinatesActive) && (
            <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => onPatch({ rotation })} />
          )
        )}
      </Collapsible>

      <Collapsible label="Appearance" defaultOpen>
        <ColorRow label="Color" value={fixture.color} onChange={color => onPatch({ color })} />
        <SelectRow
          label="Color Mode"
          value="fixed"
          disabled
          options={[{ value: 'fixed', label: 'Static' }]}
          onChange={() => undefined}
        />
        <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => onPatch({ brightness })} {...sliderGesture} />
      </Collapsible>

      {isMovingHead ? (
        <Collapsible label="Moving Head" defaultOpen>
          <ToggleRow label="Beam Enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => onPatch({ beam: { beamEnabled } })} />
          <SelectRow
            label="Pan / tilt style"
            value={fixture.component.movingHeadPanTiltStyle}
            options={movingHeadStyleOptions}
            onChange={movingHeadPanTiltStyle => onPatch({ component: { movingHeadPanTiltStyle: movingHeadPanTiltStyle as LaserDmxShowDirectorMovingHeadPanTiltStyle } })}
          />
          <SelectRow
            label="Aiming Mode"
            value={fixture.beam.targetMode}
            options={beamTargetOptions}
            onChange={targetMode => onPatch({ beam: { targetMode: targetMode as LaserDmxShowDirectorFixture['beam']['targetMode'] } })}
          />
          {manualTargetCoordinatesActive ? (
            <>
              <NumberInputRow
                label="Target X"
                value={fixture.beam.targetX ?? fixture.x}
                min={0}
                max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1}
                step={1}
                onChange={targetX => onPatch({ beam: { targetX } })}
              />
              <NumberInputRow
                label="Target Y"
                value={fixture.beam.targetY ?? fixture.y}
                min={0}
                max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1}
                step={1}
                onChange={targetY => onPatch({ beam: { targetY } })}
              />
            </>
          ) : (
            <NumberInputRow label="Beam Angle" value={fixture.beam.beamAngle} min={-360} max={360} step={1} unit="°" onChange={beamAngle => onPatch({ beam: { beamAngle } })} />
          )}
          <SelectRow
            label="Target depth"
            value={fixture.beam.targetDepthLayer ?? 'auto'}
            options={targetDepthOptions}
            onChange={targetDepthLayer => onPatch({ beam: { targetDepthLayer: targetDepthLayer as LaserDmxShowDirectorDepthLayer } })}
          />
          <SliderRow label="Zoom" value={fixture.optics.zoom} min={0} max={1} step={0.01} onChange={zoom => onPatch({ optics: { zoom } })} {...sliderGesture} />
          <SliderRow label="Spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} onChange={beamSpread => onPatch({ beam: { beamSpread } })} {...sliderGesture} />
          <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => onPatch({ beam: { focus } })} {...sliderGesture} />
          <SliderRow label="Iris" value={fixture.optics.iris} min={0} max={1} step={0.01} onChange={iris => onPatch({ optics: { iris } })} {...sliderGesture} />
          <SliderRow label="Frost" value={fixture.optics.frost} min={0} max={1} step={0.01} onChange={frost => onPatch({ optics: { frost } })} {...sliderGesture} />
          <SelectRow
            label="Gobo pattern"
            value={fixture.optics.goboPattern}
            options={movingHeadGoboOptions}
            onChange={goboPattern => onPatch({ optics: { goboPattern: goboPattern as LaserDmxShowDirectorGoboPattern } })}
          />
          <SliderRow label="Gobo amount" value={fixture.optics.goboAmount} min={0} max={1} step={0.01} onChange={goboAmount => onPatch({ optics: { goboAmount } })} {...sliderGesture} />
          <NumberInputRow label="Gobo rotation" value={fixture.optics.goboRotation} min={-360} max={360} step={1} unit="°" onChange={goboRotation => onPatch({ optics: { goboRotation } })} />
          <SelectRow
            label="Prism"
            value={String(fixture.optics.prismFacets)}
            options={movingHeadPrismOptions}
            onChange={value => onPatch({ optics: { prismFacets: value === '5' ? 5 : value === '3' ? 3 : 1 } })}
          />
        </Collapsible>
      ) : isLaser ? (
        <Collapsible label="Beam" defaultOpen>
          <ToggleRow label="Beam Enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => onPatch({ beam: { beamEnabled } })} />
          {!fixture.scanner && (
            <SelectRow
              label="Target Mode"
              value={fixture.beam.targetMode}
              options={beamTargetOptions}
              description="Controls legacy endpoint generation. Choosing a Scanner Pattern below switches this fixture to the production scanner path."
              onChange={targetMode => onPatch({ beam: { targetMode: targetMode as LaserDmxShowDirectorFixture['beam']['targetMode'] } })}
            />
          )}
          {!fixture.scanner && !manualTargetCoordinatesActive && <NumberInputRow label="Beam Angle" value={fixture.beam.beamAngle} min={-360} max={360} step={1} unit="°" onChange={beamAngle => onPatch({ beam: { beamAngle } })} />}
          {!fixture.scanner && manualTargetCoordinatesActive && (
            <>
              <NumberInputRow
                label="Target X"
                value={fixture.beam.targetX ?? fixture.x}
                min={0}
                max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1}
                step={1}
                onChange={targetX => onPatch({ beam: { targetX } })}
              />
              <NumberInputRow
                label="Target Y"
                value={fixture.beam.targetY ?? fixture.y}
                min={0}
                max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1}
                step={1}
                onChange={targetY => onPatch({ beam: { targetY } })}
              />
            </>
          )}
          <SliderRow label="Spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} onChange={beamSpread => onPatch({ beam: { beamSpread } })} {...sliderGesture} />
          <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => onPatch({ beam: { focus } })} {...sliderGesture} />
        </Collapsible>
      ) : isLedBar ? (
        <Collapsible label="LED Bar" defaultOpen>
          <ToggleRow label="Beam enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => onPatch({ beam: { beamEnabled } })} />
          <NumberInputRow
            label="Cell count"
            value={fixture.component.ledCellCount}
            min={1}
            max={64}
            step={1}
            onChange={ledCellCount => onPatch({ component: { ledCellCount: Math.max(1, Math.min(64, Math.round(ledCellCount))) } })}
          />
          <SelectRow
            label="Direction"
            value={fixture.component.ledDirection}
            options={ledDirectionOptions}
            onChange={ledDirection => onPatch({ component: { ledDirection: ledDirection as LaserDmxShowDirectorLedDirection } })}
          />
        </Collapsible>
      ) : isStrobe ? (
        <Collapsible label="Strobe" defaultOpen>
          <ToggleRow label="Beam enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => onPatch({ beam: { beamEnabled } })} />
          <NumberInputRow
            label="Strobe rate"
            value={fixture.component.strobeRate}
            min={0}
            max={30}
            step={0.5}
            unit="Hz"
            onChange={strobeRate => onPatch({ component: { strobeRate: Math.max(0, Math.min(30, strobeRate)) } })}
          />
        </Collapsible>
      ) : null}

      {isLaser && (
        <Collapsible label="Scanner" defaultOpen>
          <SelectRow
            label="Scanner Pattern"
            value={scannerPatternValue}
            options={scannerPatternOptions}
            description={fixture.scanner ? 'Uses the production physical-scanner path.' : 'Choose a scanner pattern to opt this legacy target-mode fixture into physical scanner authoring.'}
            onChange={value => {
              if (value === 'legacyTargetMode') return
              changeScannerPattern(value as LaserDmxShowDirectorScannerPatternType)
            }}
          />
          {fixture.scanner && (
            <>
              <NumberInputRow label="Scan Rate" value={fixture.scanner.scanRatePps} min={10} max={100000} step={100} unit="pps" onChange={scanRatePps => patchScanner({ scanRatePps })} />
              <SelectRow label="Scan Direction" value={fixture.scanner.direction} options={scannerDirectionOptions} onChange={direction => patchScanner({ direction: direction as LaserDmxShowDirectorScannerDirection })} />
            </>
          )}
        </Collapsible>
      )}

      <Collapsible label="Reactivity" defaultOpen>
        <SelectRow
          label="Trigger"
          value={triggerSelectValue}
          options={triggerOptions}
          description={triggerOption == null ? 'This saved trigger is preserved as-is. Choose a supported Trigger value to convert it.' : undefined}
          onChange={value => {
            if (value === storedTriggerValue) return
            onPatch({ trigger: triggerPatchForLaserDmxShowManagerOption(value as LaserDmxShowManagerTriggerOption) })
          }}
        />
        <SelectRow
          label="Audio band"
          value={fixture.trigger.audioBand}
          options={SHOW_MANAGER_AUDIO_BAND_OPTIONS}
          description="Used when the Trigger is driven by a kick/snare hit or an audio band."
          onChange={audioBand => onPatch({ trigger: { audioBand: audioBand as LaserDmxShowDirectorAudioBand } })}
        />
        <SelectRow
          label="Beat division"
          value={String(fixture.trigger.beatDivision)}
          options={SHOW_MANAGER_BEAT_DIVISION_OPTIONS}
          description="Applies when the Trigger is beat-quantized."
          onChange={value => onPatch({ trigger: { beatDivision: parseShowManagerBeatDivision(value) } })}
        />
        <SliderRow
          label="Threshold"
          value={fixture.trigger.audioThreshold}
          min={0}
          max={1}
          step={0.01}
          description="How hard the source must hit to fire."
          onChange={audioThreshold => onPatch({ trigger: { audioThreshold } })}
          {...sliderGesture}
        />
        <NumberInputRow label="Fade in" value={fixture.trigger.fadeInMs} min={0} max={10000} step={25} unit="ms" onChange={fadeInMs => onPatch({ trigger: { fadeInMs: Math.max(0, Math.round(fadeInMs)) } })} />
        <NumberInputRow label="Fade out" value={fixture.trigger.fadeOutMs} min={0} max={10000} step={25} unit="ms" onChange={fadeOutMs => onPatch({ trigger: { fadeOutMs: Math.max(0, Math.round(fadeOutMs)) } })} />
        <SelectRow
          label="Retrigger"
          value={fixture.trigger.retrigger}
          options={SHOW_MANAGER_RETRIGGER_OPTIONS}
          onChange={retrigger => onPatch({ trigger: { retrigger: retrigger as LaserDmxShowDirectorTriggerRetrigger } })}
        />
      </Collapsible>

      <p className="sm-inspector-hint">What should this fixture do, when, and how strong?</p>
    </div>
  )
}

function LaserDmxShowManagerStage({
  section,
  selectedFixtureId,
  showGrid,
  showLabels,
  highlightGrid,
  runtimePreview,
  onDropFixture,
  selectedCanvasMediaId,
  onPlaceCanvasMedia,
  onSelectFixture,
  onFixtureRepositionStart,
  onFixtureReposition,
  onFixtureRepositionEnd,
  onFixtureRepositionCancel,
  onFixtureContextMenu,
  endpointTargetingFixtureId,
  onCommitEndpointTarget,
}: {
  section: LaserDmxShowManagerSection | null
  selectedFixtureId: string | null
  showGrid: boolean
  showLabels: boolean
  highlightGrid: boolean
  runtimePreview: ReactNode
  onDropFixture: (event: DragEvent<HTMLDivElement>) => void
  selectedCanvasMediaId: string | null
  onPlaceCanvasMedia: (mediaId: string, layer: CanvasShowManagerLayer) => boolean
  onSelectFixture: (fixtureId: string | null) => void
  onFixtureRepositionStart: (fixtureId: string) => void
  onFixtureReposition: (fixtureId: string, cell: LaserDmxShowManagerGridCell) => void
  onFixtureRepositionEnd: () => void
  onFixtureRepositionCancel: () => void
  onFixtureContextMenu: (event: MouseEvent<HTMLButtonElement>, fixtureId: string) => void
  endpointTargetingFixtureId: string | null
  onCommitEndpointTarget: (event: MouseEvent<HTMLDivElement>) => void
}) {
  const fixtures = section?.fixtures ?? []
  const collisionOrdinals = new Map<string, number>()
  const [canvasDragActive, setCanvasDragActive] = useState(false)
  const [hoveredCanvasLayer, setHoveredCanvasLayer] = useState<CanvasShowManagerLayer | null>(null)
  const [draggingFixtureId, setDraggingFixtureId] = useState<string | null>(null)
  const gridSurfaceRef = useRef<HTMLDivElement>(null)
  const fixtureDragRef = useRef<{ fixtureId: string; pointerId: number; x: number; y: number } | null>(null)
  const canvasTargetsVisible = canvasDragActive || selectedCanvasMediaId != null

  return (
    <div className="sm-laser-stage" aria-label="LaserDMX Part 1 authoring grid">
      {endpointTargetingFixtureId && (
        <div className="sm-laser-stage-instruction">Click the grid to set the beam endpoint</div>
      )}
      <div
        ref={gridSurfaceRef}
        className={`sm-laser-stage-grid-surface${showGrid ? ' is-grid-visible' : ''}${highlightGrid ? ' is-highlighted' : ''}${endpointTargetingFixtureId ? ' is-targeting-endpoint' : ''}`}
        data-testid="laser-dmx-authoring-grid"
        onDragEnter={event => {
          if (Array.from(event.dataTransfer.types).includes('vz/mediaId')) setCanvasDragActive(true)
        }}
        onDragOver={event => {
          const types = Array.from(event.dataTransfer.types)
          if (!types.includes('application/x-drmvyz-laserdmx-fixture-kind') && !types.includes('vz/mediaId')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          if (types.includes('vz/mediaId')) setCanvasDragActive(true)
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setCanvasDragActive(false)
            setHoveredCanvasLayer(null)
          }
        }}
        onDrop={event => {
          const transferTypes = event.dataTransfer.types ? Array.from(event.dataTransfer.types) : []
          const hasLaserPayload = transferTypes.includes('application/x-drmvyz-laserdmx-fixture-kind')
            || Boolean(event.dataTransfer.getData('application/x-drmvyz-laserdmx-fixture-kind'))
          if (!hasLaserPayload) return
          onDropFixture(event)
        }}
        onClick={event => endpointTargetingFixtureId ? onCommitEndpointTarget(event) : onSelectFixture(null)}
      >
        {runtimePreview && (
          <div className="sm-laser-runtime-preview" aria-hidden="true">
            {runtimePreview}
          </div>
        )}
        {canvasTargetsVisible && section && (
          <div className="sm-canvas-layer-targets" role="group" aria-label="Canvas media layer drop targets">
            {([3, 2, 1, 0] as const).map(layer => (
              <button
                key={layer}
                type="button"
                className={hoveredCanvasLayer === layer ? 'is-hovered' : ''}
                aria-label={`Clear ${section.label}, assign it to Canvas, and place media on Layer ${layer + 1}`}
                onDragOver={event => {
                  if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                  event.preventDefault()
                  event.stopPropagation()
                  setHoveredCanvasLayer(layer)
                }}
                onDragLeave={() => setHoveredCanvasLayer(current => current === layer ? null : current)}
                onDrop={event => {
                  if (!Array.from(event.dataTransfer.types).includes('vz/mediaId')) return
                  event.preventDefault()
                  event.stopPropagation()
                  const mediaId = event.dataTransfer.getData('vz/mediaId')
                  if (mediaId) onPlaceCanvasMedia(mediaId, layer)
                  setCanvasDragActive(false)
                  setHoveredCanvasLayer(null)
                }}
                onClick={event => {
                  event.stopPropagation()
                  if (selectedCanvasMediaId) onPlaceCanvasMedia(selectedCanvasMediaId, layer)
                }}
              >
                <span>Layer {layer + 1}</span>
                <strong>{layer === 3 ? 'TOP / FRONT' : layer === 0 ? 'BOTTOM / BACK' : `STACK ${layer + 1}`}</strong>
                <small>Replace section with Canvas</small>
              </button>
            ))}
          </div>
        )}
        {fixtures.map(fixture => {
          const collisionKey = `${fixture.x}:${fixture.y}`
          const collisionOrdinal = collisionOrdinals.get(collisionKey) ?? 0
          collisionOrdinals.set(collisionKey, collisionOrdinal + 1)
          const collisionOffset = collisionOrdinal % 4
          const left = ((fixture.x + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
          const top = ((fixture.y + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
          const isSelected = fixture.id === selectedFixtureId
          const showsOrientation = fixture.kind !== 'laser'
            && (fixture.kind !== 'movingHead' || fixture.beam.targetMode !== 'fixed')
          return (
            <button
              key={fixture.id}
              type="button"
              className={`sm-laser-fixture${isSelected ? ' is-selected' : ''}${draggingFixtureId === fixture.id ? ' is-dragging' : ''}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                marginLeft: collisionOffset * 4,
                marginTop: collisionOffset * 4,
              }}
              aria-pressed={isSelected}
              aria-label={`${fixture.label} at column ${fixture.x + 1}, row ${fixture.y + 1}`}
              data-fixture-id={fixture.id}
              data-grid-x={fixture.x}
              data-grid-y={fixture.y}
              onPointerDown={event => {
                if (endpointTargetingFixtureId || event.button !== 0) return
                event.preventDefault()
                event.stopPropagation()
                fixtureDragRef.current = { fixtureId: fixture.id, pointerId: event.pointerId, x: fixture.x, y: fixture.y }
                setDraggingFixtureId(fixture.id)
                onSelectFixture(fixture.id)
                onFixtureRepositionStart(fixture.id)
                event.currentTarget.setPointerCapture?.(event.pointerId)
              }}
              onPointerMove={event => {
                const drag = fixtureDragRef.current
                if (!drag || drag.fixtureId !== fixture.id || drag.pointerId !== event.pointerId) return
                const bounds = gridSurfaceRef.current?.getBoundingClientRect()
                if (!bounds) return
                const cell = resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds)
                if (!cell || (cell.x === drag.x && cell.y === drag.y)) return
                event.preventDefault()
                event.stopPropagation()
                drag.x = cell.x
                drag.y = cell.y
                onFixtureReposition(fixture.id, cell)
              }}
              onPointerUp={event => {
                const drag = fixtureDragRef.current
                if (!drag || drag.fixtureId !== fixture.id || drag.pointerId !== event.pointerId) return
                const bounds = gridSurfaceRef.current?.getBoundingClientRect()
                const cell = bounds ? resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds) : null
                if (cell && (cell.x !== drag.x || cell.y !== drag.y)) onFixtureReposition(fixture.id, cell)
                event.preventDefault()
                event.stopPropagation()
                fixtureDragRef.current = null
                setDraggingFixtureId(null)
                onFixtureRepositionEnd()
              }}
              onPointerCancel={event => {
                const drag = fixtureDragRef.current
                if (!drag || drag.fixtureId !== fixture.id || drag.pointerId !== event.pointerId) return
                fixtureDragRef.current = null
                setDraggingFixtureId(null)
                onFixtureRepositionCancel()
              }}
              onLostPointerCapture={event => {
                const drag = fixtureDragRef.current
                if (!drag || drag.fixtureId !== fixture.id || drag.pointerId !== event.pointerId) return
                fixtureDragRef.current = null
                setDraggingFixtureId(null)
                onFixtureRepositionCancel()
              }}
              onClick={event => {
                event.stopPropagation()
                onSelectFixture(fixture.id)
              }}
              onContextMenu={event => onFixtureContextMenu(event, fixture.id)}
            >
              <span
                className={`sm-laser-fixture-icon${showsOrientation ? ' is-orientation-aware' : ''}`}
                style={showsOrientation ? { transform: `rotate(${fixture.rotation}deg)` } : undefined}
                data-orientation-deg={showsOrientation ? fixture.rotation : undefined}
                aria-hidden="true"
              ><FixtureIcon kind={fixture.kind} /></span>
              {showLabels && <span className="sm-laser-fixture-label">{fixture.label}</span>}
            </button>
          )
        })}
        {fixtures.length === 0 && (
          <div className="sm-laser-stage-empty" aria-hidden="true">
            Drag a lighting component onto the grid
          </div>
        )}
      </div>
    </div>
  )
}

function LaserDmxShowManagerTimeline({
  sections,
  selectedSectionId,
  durationSec,
  viewport,
  viewportRef,
  beatGrid,
  effectiveBpm,
  onSelect,
  onContextMenu,
  onRemove,
  onCommitBoundary,
}: {
  sections: ReactTrackSection[]
  selectedSectionId: string | null
  durationSec: number
  viewport: TimelineViewport
  viewportRef: MutableRefObject<TimelineViewport>
  beatGrid: BeatMarkerMI[]
  effectiveBpm: number | null
  onSelect: (sectionId: string) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>, sectionId: string) => void
  onRemove?: (sectionId: string) => void
  onCommitBoundary: (
    sectionId: string,
    edge: 'start' | 'end',
    newTime: number,
    neighborId: string | null,
    neighborTime: number | null,
  ) => void
}) {
  return (
    <section className="sm-timeline sm-laser-timeline" aria-label="Show Manager LaserDMX section timeline">
      <header className="sm-timeline-tabs">
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="LaserDMX timeline surfaces" className="rv-lower-workspace-tabs" />
        <span className="sm-timeline-meta">Linked Track Map · Show-specific</span>
      </header>
      <div className="sm-timeline-grid">
        <TimelineRow label="Beats" className="sm-timeline-row--beats">
          <ShowManagerBeatGrid beatGrid={beatGrid} durationSec={durationSec} viewport={viewport} />
        </TimelineRow>
        <TimelineRow label="Section" className="sm-timeline-row--sections">
          {sections.length > 0 ? (
            <SectionTimeline
              sections={sections}
              durationSec={durationSec}
              viewport={viewport}
              viewportRef={viewportRef}
              beatGrid={beatGrid}
              effectiveBpm={effectiveBpm}
              snapMode={beatGrid.length > 0 ? 'beat' : 'free'}
              selectedId={selectedSectionId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onRemove={onRemove}
              onCommitBoundary={onCommitBoundary}
            />
          ) : (
            <div className="sm-laser-timeline-empty">No sections</div>
          )}
        </TimelineRow>
        <ShowManagerTimeRow viewport={viewport} divisions={7} />
      </div>
    </section>
  )
}

function LibrarySection({
  title,
  count,
  defaultCollapsed = false,
  children,
}: {
  title: string
  count: number
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  return (
    <DualRailCollapsible
      className="sm-library-section"
      bodyClassName="sm-library-section-body"
      headerClassName="sm-library-section-toggle"
      defaultOpen={!defaultCollapsed}
      label={<strong>{title}</strong>}
      headerAccessory={<small>{count}</small>}
    >
      {children}
    </DualRailCollapsible>
  )
}

function ShowManagerTimeline({
  currentTime,
  duration,
  viewport,
  sections,
  beatGrid,
  effectiveBpm,
  selectedSectionId,
  onSelectSection,
  onContextMenu,
  onCommitBoundary,
  statusMessage,
}: {
  currentTime: number
  duration: number
  viewport: TimelineViewport
  sections: readonly ReactTrackSection[]
  beatGrid?: BeatMarkerMI[]
  effectiveBpm?: number | null
  selectedSectionId: string | null
  onSelectSection: (id: string) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>, sectionId: string) => void
  onCommitBoundary: (sectionId: string, edge: 'start' | 'end', newTime: number, neighborId: string | null, neighborTime: number | null) => void
  statusMessage: string
}) {
  const viewportRef = useRef<TimelineViewport>(viewport)
  viewportRef.current = viewport
  const viewportDurationSec = Math.max(0.001, viewport.endSec - viewport.startSec)
  const playheadPercent = Math.max(0, Math.min(100, ((currentTime - viewport.startSec) / viewportDurationSec) * 100))
  return (
    <section className="sm-timeline sm-pixgrid-timeline" aria-label="Show Manager track map preview">
      <header className="sm-timeline-tabs">
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="PixGrid timeline surfaces" className="rv-lower-workspace-tabs" />
        <span className="sm-timeline-meta">Snap 1/4</span>
      </header>
      <div className="sm-timeline-grid">
        <TimelineRow label="Beats" className="sm-timeline-row--beats">
          <ShowManagerBeatGrid beatGrid={beatGrid ?? []} durationSec={duration} viewport={viewport} />
        </TimelineRow>
        <TimelineRow label="Section" className="sm-timeline-row--sections">
          {sections.length > 0 ? (
            <SectionTimeline
              sections={[...sections]}
              durationSec={duration}
              viewport={viewport}
              viewportRef={viewportRef}
              beatGrid={beatGrid}
              effectiveBpm={effectiveBpm}
              snapMode={beatGrid && beatGrid.length > 0 ? 'beat' : 'free'}
              selectedId={selectedSectionId}
              onSelect={onSelectSection}
              onContextMenu={onContextMenu}
              onCommitBoundary={onCommitBoundary}
            />
          ) : (
            <p className="sm-new-show-field-note" role="status">{statusMessage}</p>
          )}
        </TimelineRow>
        <div className="sm-timeline-row-spacer" aria-hidden="true" />
        <ShowManagerTimeRow viewport={viewport} />
        <div className="sm-playhead" style={{ left: `calc(${playheadPercent}% + ${76 * (1 - playheadPercent / 100)}px)` }}>
          <span>{formatClock(currentTime)}</span>
        </div>
      </div>
    </section>
  )
}

function TimelineRow({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`sm-timeline-row${className ? ` ${className}` : ''}`}>
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  )
}
