import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { resolvePositiveDuration, type TimelineViewport } from '../../../features/timeline/timelineViewport'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useReactStore } from '../../../stores/reactStore'
import { useAudioStore, type SavedAudioTrack } from '../../../stores/audioStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../react/ReactControlRows'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { NoticeCard } from '../react/controls/NoticeCard'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import { PixGridDesignPanel } from '../react/pixGrid/PixGridDesignPanel'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  DEFAULT_REACT_PRESETS,
  LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorFixtureKind,
  type ReactEngineId,
  type ReactPreset,
  type ReactSectionType,
  type ReactTrackSection,
} from '../react/ReactTypes'
import { FixtureIcon } from '../react/LaserDmxShowDirectorPalette'
import { ReactPlaceholderCanvas } from '../react/ReactPlaceholderCanvas'
import { CanvasEngineSurface } from '../react/ReactCanvasEngineShell'
import { ReactPersistenceStatus } from '../react/ReactPersistenceStatus'
import { EditSectionForm, SectionTimeline } from '../react/ReactTrackMapStrip'
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
  triggerPatchForLaserDmxShowManagerOption,
  type LaserDmxShowManagerTriggerOption,
  type LaserDmxShowManagerSection,
  type LaserDmxShowManagerShow,
  type LaserDmxShowManagerWorkspaceSettingsPatch,
} from './LaserDmxShowManagerDomain'
import {
  getCanvasShowManagerSectionRanges,
  getCanvasShowManagerTotalDuration,
  canvasShowManagerRangeOverlaps,
  normalizeCanvasShowManagerDuration,
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

const SECTION_SEGMENTS = [
  { type: 'intro', label: 'Intro' },
  { type: 'verse', label: 'Verse' },
  { type: 'build', label: 'Build' },
  { type: 'preDrop', label: 'Pre-Drop' },
  { type: 'drop', label: 'Drop' },
  { type: 'breakdown', label: 'Breakdown' },
  { type: 'outro', label: 'Outro' },
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

const STAGE_SCALE_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
  { value: '100', label: '100%' },
] as const

const SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE = 'showManager:pixGridDeckBuilder' as const

const TRACK_MAP_TABS = [{ id: 'trackMap' as const, label: 'Track Map' }]

interface ShowBrowserEntry {
  id: string
  name: string
  details: string
}

interface ShowBrowserDialogProps {
  engineLabel: string
  shows: readonly ShowBrowserEntry[]
  currentShowId: string | null
  onClose: () => void
  onOpen: (showId: string) => void
}

function ShowBrowserDialog({
  engineLabel,
  shows,
  currentShowId,
  onClose,
  onOpen,
}: ShowBrowserDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedShowId, setSelectedShowId] = useState<string | null>(
    currentShowId ?? shows[0]?.id ?? null,
  )
  const searchRef = useRef<HTMLInputElement | null>(null)
  const filteredShows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return shows
    return shows.filter(show => show.name.toLowerCase().includes(normalizedQuery))
  }, [query, shows])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (filteredShows.some(show => show.id === selectedShowId)) return
    setSelectedShowId(filteredShows[0]?.id ?? null)
  }, [filteredShows, selectedShowId])

  const openSelectedShow = () => {
    if (!selectedShowId) return
    onOpen(selectedShowId)
  }

  return (
    <div
      className="sm-show-browser-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        className="sm-show-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="show-browser-heading"
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
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
          <button type="button" className="sm-show-browser-close" onClick={onClose} aria-label="Close Open Show window">
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
                <strong>{engineLabel}</strong>
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
              <span>Contents</span>
            </div>
            <div className="sm-show-browser-list" role="listbox" aria-label={`${engineLabel} Shows`}>
              {filteredShows.length > 0 ? filteredShows.map(show => (
                <button
                  key={show.id}
                  type="button"
                  role="option"
                  aria-selected={show.id === selectedShowId}
                  className={show.id === selectedShowId ? 'is-selected' : ''}
                  onClick={() => setSelectedShowId(show.id)}
                  onDoubleClick={() => onOpen(show.id)}
                >
                  <span className="sm-show-browser-folder-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3.5 6.5h6l2 2h9v10h-17z" />
                    </svg>
                  </span>
                  <strong>{show.name}</strong>
                  <small>{show.details}</small>
                </button>
              )) : (
                <div className="sm-show-browser-empty">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.5 6.5h6l2 2h9v10h-17z" />
                  </svg>
                  <strong>{shows.length === 0 ? `No ${engineLabel} Shows yet` : 'No matching Shows'}</strong>
                  <span>{shows.length === 0 ? 'Create a new Show to begin authoring.' : 'Try a different search.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="sm-show-browser-footer">
          <span>{filteredShows.length} {filteredShows.length === 1 ? 'Show' : 'Shows'}</span>
          <div>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="is-primary" disabled={!selectedShowId} onClick={openSelectedShow}>Open Show</button>
          </div>
        </footer>
      </section>
    </div>
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
  selectedSectionId = null,
  onSelect,
}: {
  sections: readonly ShowManagerSectionSegment[]
  durationSec: number
  selectedSectionId?: string | null
  onSelect?: (sectionId: string) => void
}) {
  const safeDuration = Math.max(0.001, durationSec)
  return (
    <div className="rv-section-timeline sm-section-strip" aria-label="Section timeline">
      {sections.map(section => {
        const startSec = Math.max(0, Math.min(safeDuration, section.startSec))
        const endSec = Math.max(startSec, Math.min(safeDuration, section.endSec))
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
              left: `${(startSec / safeDuration) * 100}%`,
              width: `${((endSec - startSec) / safeDuration) * 100}%`,
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

interface NewShowDialogProps {
  engineId: ShowManagerEngineId
  onClose: () => void
}

function NewShowDialog({ engineId, onClose }: NewShowDialogProps) {
  const shows = useReactStore(state => state.showManagerShows)
  const createShow = useReactStore(state => state.createShowManagerShow)
  const savedAudioTracks = useAudioStore(state => state.savedTracks)
  const audioLoading = useAudioStore(state => state.loading)
  const audioLoadError = useAudioStore(state => state.loadError)
  const loadSavedTracks = useAudioStore(state => state.loadSavedTracks)
  const collections = useMediaStore(state => state.collections)
  const loadCollections = useMediaStore(state => state.loadCollections)
  const [name, setName] = useState('')
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [groupId, setGroupId] = useState('')
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

  const normalizedName = normalizeShowManagerShowName(name)
  const nameAvailable = isShowManagerShowNameAvailable(shows, name)
  const selectedTrack = savedAudioTracks.find(track => track.dbId === selectedAudioTrackId && isSupportedShowManagerAudioLibraryItem(track)) ?? null
  const canCreate = Boolean(normalizedName && nameAvailable && selectedTrack && !submitting)

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
    if (!normalizedName || !nameAvailable || !selectedTrack) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const showId = await createShow({
        name: normalizedName,
        linkedAudioTrackId: selectedTrack.dbId,
        tags,
        groupId: groupId || null,
        initialEngineId: engineId,
      })
      if (!showId) {
        setSubmitError('The Show could not be created. Check the name and persistence status, then try again.')
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
          <h2 id={headingId}>New Show</h2>
          <p>Every Show requires a unique name and a linked Audio Library track.</p>

          <label htmlFor="show-manager-new-show-name">Show Name <span aria-hidden="true">*</span></label>
          <DreamVizTextInput
            id="show-manager-new-show-name"
            autoFocus
            value={name}
            aria-invalid={nameTouched && (!normalizedName || !nameAvailable)}
            onBlur={() => setNameTouched(true)}
            onChange={event => {
              setName(event.target.value)
              setSubmitError(null)
            }}
          />
          {nameTouched && !normalizedName && <p className="sm-canvas-form-error" role="alert">Show Name is required.</p>}
          {nameTouched && normalizedName && !nameAvailable && <p className="sm-canvas-form-error" role="alert">A Show with this name already exists.</p>}

          <label htmlFor="show-manager-new-show-audio">Audio Track <span aria-hidden="true">*</span></label>
          <div className="sm-new-show-audio-row">
            <select
              id="show-manager-new-show-audio"
              value={selectedAudioTrackId}
              disabled={audioLoading || submitting}
              onChange={event => {
                setSelectedAudioTrackId(event.target.value)
                setSubmitError(null)
              }}
            >
              <option value="">{audioLoading ? 'Loading Audio Library…' : 'Choose from Audio Library'}</option>
              {savedAudioTracks.filter(isSupportedShowManagerAudioLibraryItem).map(track => (
                <option key={track.dbId} value={track.dbId}>{track.title || track.fileName}</option>
              ))}
            </select>
            <button type="button" onClick={() => setUploadOpen(true)} disabled={submitting}>Upload New Audio</button>
          </div>
          {audioLoadError && <p className="sm-new-show-field-note" role="status">{audioLoadError}</p>}

          <label htmlFor="show-manager-new-show-tags">Tags <span className="sm-new-show-optional">Optional</span></label>
          <DreamVizTextInput
            id="show-manager-new-show-tags"
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
          {tags.length > 0 && (
            <div className="sm-new-show-tags" aria-label="Show tags">
              {tags.map(tag => (
                <button key={tag} type="button" onClick={() => setTags(current => current.filter(value => value !== tag))} aria-label={`Remove tag ${tag}`}>
                  {tag} ×
                </button>
              ))}
            </div>
          )}

          <label htmlFor="show-manager-new-show-group">Group <span className="sm-new-show-optional">Optional</span></label>
          <select id="show-manager-new-show-group" value={groupId} onChange={event => setGroupId(event.target.value)} disabled={submitting}>
            <option value="">No group</option>
            {collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>

          {submitError && <p className="sm-canvas-form-error" role="alert">{submitError}</p>}
          <div className="sm-canvas-dialog-actions">
            <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" disabled={!canCreate}>{submitting ? 'Creating…' : 'Create Show'}</button>
          </div>
        </form>
      </div>
      {uploadOpen && (
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
  const reactPresets = useReactStore(state => state.reactPresets)
  const activeReactPresetId = useReactStore(state => state.activeReactPresetId)
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
  const manualTrackSectionsByTrackId = useReactStore(state => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(state => state.suppressedAutoSectionsByTrackId)
  const showManagerShows = useReactStore(state => state.showManagerShows)
  const showManagerEditingShowId = useReactStore(state => state.showManagerEditingShowId)
  const selectShowManagerShow = useReactStore(state => state.selectShowManagerShow)
  const resetShowManagerSession = useReactStore(state => state.resetShowManagerSession)
  const laserDmxShowManagerShows = useReactStore(state => state.laserDmxShowManagerShows)
  const laserDmxShowManagerEditingShowId = useReactStore(state => state.laserDmxShowManagerEditingShowId)
  const laserDmxShowManagerEditingSectionId = useReactStore(state => state.laserDmxShowManagerEditingSectionId)
  const laserDmxShowManagerPlaybackSectionId = useReactStore(state => state.laserDmxShowManagerPlaybackSectionId)
  const selectLaserDmxShowManagerShow = useReactStore(state => state.selectLaserDmxShowManagerShow)
  const selectLaserDmxShowManagerSection = useReactStore(state => state.selectLaserDmxShowManagerSection)
  const updateLaserDmxShowManagerSection = useReactStore(state => state.updateLaserDmxShowManagerSection)
  const updateLaserDmxShowManagerWorkspaceSettings = useReactStore(state => state.updateLaserDmxShowManagerWorkspaceSettings)
  const addLaserDmxShowManagerSection = useReactStore(state => state.addLaserDmxShowManagerSection)
  const removeLaserDmxShowManagerSection = useReactStore(state => state.removeLaserDmxShowManagerSection)
  const reorderLaserDmxShowManagerSection = useReactStore(state => state.reorderLaserDmxShowManagerSection)
  const addLaserDmxShowManagerFixture = useReactStore(state => state.addLaserDmxShowManagerFixture)
  const updateLaserDmxShowManagerFixture = useReactStore(state => state.updateLaserDmxShowManagerFixture)
  const removeLaserDmxShowManagerFixture = useReactStore(state => state.removeLaserDmxShowManagerFixture)
  const duplicateLaserDmxShowManagerFixture = useReactStore(state => state.duplicateLaserDmxShowManagerFixture)
  const mirrorLaserDmxShowManagerFixture = useReactStore(state => state.mirrorLaserDmxShowManagerFixture)
  const copyLaserDmxShowManagerFixturesFromSection = useReactStore(state => state.copyLaserDmxShowManagerFixturesFromSection)
  const updateLaserDmxShowManagerSectionBoundary = useReactStore(state => state.updateLaserDmxShowManagerSectionBoundary)
  const undoLaserDmxShowManagerEdit = useReactStore(state => state.undoLaserDmxShowManagerEdit)
  const redoLaserDmxShowManagerEdit = useReactStore(state => state.redoLaserDmxShowManagerEdit)
  const laserShowUndoDepth = useReactStore(state => state.showManagerUndoStack.length)
  const laserShowRedoDepth = useReactStore(state => state.showManagerRedoStack.length)
  const saveLaserDmxShowManagerShow = useReactStore(state => state.saveLaserDmxShowManagerShow)
  const canvasShowManagerShows = useReactStore(state => state.canvasShowManagerShows)
  const canvasShowManagerActiveShowId = useReactStore(state => state.canvasShowManagerActiveShowId)
  const canvasShowManagerEditingShowId = useReactStore(state => state.canvasShowManagerEditingShowId)
  const canvasShowManagerEditingSectionId = useReactStore(state => state.canvasShowManagerEditingSectionId)
  const canvasShowManagerEditingElementId = useReactStore(state => state.canvasShowManagerEditingElementId)
  const selectCanvasShowManagerShow = useReactStore(state => state.selectCanvasShowManagerShow)
  const selectCanvasShowManagerSection = useReactStore(state => state.selectCanvasShowManagerSection)
  const selectCanvasShowManagerMediaElement = useReactStore(state => state.selectCanvasShowManagerMediaElement)
  const renameCanvasShowManagerShow = useReactStore(state => state.renameCanvasShowManagerShow)
  const updateCanvasShowManagerSectionDuration = useReactStore(state => state.updateCanvasShowManagerSectionDuration)
  const addCanvasShowManagerMediaElement = useReactStore(state => state.addCanvasShowManagerMediaElement)
  const updateCanvasShowManagerMediaElement = useReactStore(state => state.updateCanvasShowManagerMediaElement)
  const removeCanvasShowManagerMediaElement = useReactStore(state => state.removeCanvasShowManagerMediaElement)
  const deleteCanvasShowManagerShow = useReactStore(state => state.deleteCanvasShowManagerShow)
  const undoCanvasShowManagerEdit = useReactStore(state => state.undoCanvasShowManagerEdit)
  const redoCanvasShowManagerEdit = useReactStore(state => state.redoCanvasShowManagerEdit)
  const canvasShowUndoDepth = useReactStore(state => state.canvasShowManagerUndoStack.length)
  const canvasShowRedoDepth = useReactStore(state => state.canvasShowManagerRedoStack.length)
  const beginCanvasShowManagerHistoryTransaction = useReactStore(state => state.beginCanvasShowManagerHistoryTransaction)
  const commitCanvasShowManagerHistoryTransaction = useReactStore(state => state.commitCanvasShowManagerHistoryTransaction)
  const saveCanvasShowManagerShow = useReactStore(state => state.saveCanvasShowManagerShow)
  const sharedMediaItems = useMediaStore(state => state.items)
  const [showManagerSessionReady, setShowManagerSessionReady] = useState(false)
  const [selectedEngineId, setSelectedEngineId] = useState<ReactEngineId>('pixGrid')
  const [selectedLightingComponentKind, setSelectedLightingComponentKind] = useState<LaserDmxShowDirectorFixtureKind | null>(null)
  const [selectedLaserFixtureId, setSelectedLaserFixtureId] = useState<string | null>(null)
  const [laserFixtureContextMenu, setLaserFixtureContextMenu] = useState<{ fixtureId: string; x: number; y: number } | null>(null)
  const [laserEndpointTargetingFixtureId, setLaserEndpointTargetingFixtureId] = useState<string | null>(null)
  const [copyLaserFixturesEnabled, setCopyLaserFixturesEnabled] = useState(false)
  const [copyLaserFixturesSourceSectionId, setCopyLaserFixturesSourceSectionId] = useState<string | null>(null)
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null)
  const [liveFps, setLiveFps] = useState(0)
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
  const [canvasRenameDraft, setCanvasRenameDraft] = useState('')
  const [canvasRenameError, setCanvasRenameError] = useState<string | null>(null)
  const [canvasLibraryMediaId, setCanvasLibraryMediaId] = useState<string | null>(null)
  const [canvasAuthoringError, setCanvasAuthoringError] = useState<string | null>(null)
  const [canvasPlayheadSec, setCanvasPlayheadSec] = useState(0)
  const compilerStatuses = usePixGridDeckCompilerStore(state => state.statuses)
  const transitionStatuses = usePixGridDeckCompilerStore(state => state.transitionStatuses)
  const activeShowManagerShow = useMemo(
    () => showManagerSessionReady
      ? showManagerShows.find(show => show.id === showManagerEditingShowId) ?? null
      : null,
    [showManagerEditingShowId, showManagerSessionReady, showManagerShows],
  )
  const hasOpenShow = activeShowManagerShow !== null
  const activeLaserDmxShow = useMemo(
    () => activeShowManagerShow && selectedEngineId === 'laserDmx'
      ? laserDmxShowManagerShows.find(show => show.id === activeShowManagerShow.id) ?? null
      : null,
    [activeShowManagerShow, laserDmxShowManagerShows, selectedEngineId],
  )
  const activeCanvasShow = useMemo(
    () => activeShowManagerShow && selectedEngineId === 'canvas'
      ? canvasShowManagerShows.find(show => show.id === activeShowManagerShow.id) ?? null
      : null,
    [activeShowManagerShow, canvasShowManagerShows, selectedEngineId],
  )
  const activeCanvasSection = useMemo(
    () => activeCanvasShow?.sections.find(section => section.id === canvasShowManagerEditingSectionId)
      ?? activeCanvasShow?.sections[0]
      ?? null,
    [activeCanvasShow, canvasShowManagerEditingSectionId],
  )
  const canvasSectionRanges = useMemo(
    () => activeCanvasShow ? getCanvasShowManagerSectionRanges(activeCanvasShow) : [],
    [activeCanvasShow],
  )
  const canvasTotalDuration = useMemo(
    () => activeCanvasShow ? getCanvasShowManagerTotalDuration(activeCanvasShow) : 0,
    [activeCanvasShow],
  )
  const showBrowserEntries = useMemo<ShowBrowserEntry[]>(() => showManagerShows.map(show => ({
    id: show.id,
    name: show.name,
    details: `${show.linkedAudioTrackId ? 'Audio linked' : 'Legacy · audio link missing'}${show.tags.length ? ` · ${show.tags.length} tag${show.tags.length === 1 ? '' : 's'}` : ''}`,
  })), [showManagerShows])
  const selectedCanvasElement = useMemo(
    () => activeCanvasShow?.mediaElements.find(element => element.id === canvasShowManagerEditingElementId) ?? null,
    [activeCanvasShow, canvasShowManagerEditingElementId],
  )
  const selectedCanvasElementMedia = useMemo(
    () => selectedCanvasElement ? sharedMediaItems.find(media => media.id === selectedCanvasElement.mediaId) ?? null : null,
    [selectedCanvasElement, sharedMediaItems],
  )
  const activeLaserDmxSection = useMemo(
    () => activeLaserDmxShow?.sections.find(section => section.id === laserDmxShowManagerEditingSectionId)
      ?? activeLaserDmxShow?.sections[0]
      ?? null,
    [activeLaserDmxShow, laserDmxShowManagerEditingSectionId],
  )
  const playbackLaserDmxSection = useMemo(
    () => activeLaserDmxShow?.sections.find(section => section.id === laserDmxShowManagerPlaybackSectionId) ?? null,
    [activeLaserDmxShow, laserDmxShowManagerPlaybackSectionId],
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
    () => Math.max(1, ...(activeLaserDmxShow?.sections.map(section => section.endSec) ?? [1])),
    [activeLaserDmxShow],
  )
  const laserTimelineViewport = useMemo<TimelineViewport>(
    () => ({ startSec: 0, endSec: laserTimelineDuration }),
    [laserTimelineDuration],
  )
  const laserTimelineViewportRef = useRef<TimelineViewport>(laserTimelineViewport)
  laserTimelineViewportRef.current = laserTimelineViewport

  useEffect(() => {
    resetShowManagerSession()
    setPreviewPresetId(null)
    setSelectedLaserFixtureId(null)
    setCanvasLibraryMediaId(null)
    setShowManagerSessionReady(true)
    return () => {
      resetShowManagerSession()
    }
  }, [resetShowManagerSession])

  useEffect(() => {
    setCanvasRenameDraft(activeCanvasShow?.name ?? '')
    setCanvasRenameError(null)
    setCanvasAuthoringError(null)
    setCanvasPlayheadSec(0)
  }, [activeCanvasShow?.id, activeCanvasShow?.name])

  useEffect(() => {
    if (selectedEngineId !== 'canvas' || !engine.isPlaying || canvasTotalDuration <= 0) return
    setCanvasPlayheadSec(engine.currentTime % canvasTotalDuration)
  }, [canvasTotalDuration, engine.currentTime, engine.isPlaying, selectedEngineId])

  useEffect(() => {
    if (selectedEngineId === 'laserDmx' && engine.isPlaying) return
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [engine.isPlaying, selectedEngineId])

  useEffect(() => () => {
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [])

  const handleLaserDmxPlaybackSectionChange = (sectionId: string | null) => {
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId === sectionId) return
    useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: sectionId })
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
  const activeCues = engine.currentTrackId
    ? (pixGridActionCuesByTrackId[engine.currentTrackId] ?? [])
    : []
  const durationSec = resolvePositiveDuration(engine.duration, 180)
  const activeManualTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    return trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
  }, [engine.currentTrackId, manualTrackSectionsByTrackId])
  const resolvedTrackSections = useMemo(() => resolveTrackSections({
    analyzedSections: engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : [],
    manualSections: activeManualTrackSections,
    suppressedIds: engine.currentTrackId
      ? (suppressedAutoSectionsByTrackId[engine.currentTrackId] ?? [])
      : [],
    durationSec,
  }), [
    activeManualTrackSections,
    durationSec,
    engine.currentAnalysis,
    engine.currentTrackId,
    suppressedAutoSectionsByTrackId,
  ])
  const effectiveTrackAnalysis = useMemo(() => {
    const analysis = engine.currentAnalysis
    const beatGrid = engine.currentEffectiveBeatGrid
    const bpm = engine.currentEffectiveBpm
    if (!analysis || !beatGrid || bpm == null || bpm <= 0) return analysis
    return {
      ...analysis,
      bpmUsedForGrid: bpm,
      beatGridOffsetSec: beatGrid[0]?.timeSec ?? analysis.beatGridOffsetSec,
      beatGrid,
      downbeats: beatGrid.filter(marker => marker.isDownbeat),
    }
  }, [engine.currentAnalysis, engine.currentEffectiveBeatGrid, engine.currentEffectiveBpm])
  const playheadPercent = Math.min(100, Math.max(0, (engine.currentTime / durationSec) * 100))
  const sceneLabels = displayedPixGridState.scenes.slice(0, SECTION_SEGMENTS.length).map(scene => scene.name)
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
  const previewBpm = engine.currentEffectiveBpm && engine.currentEffectiveBpm > 0 ? engine.currentEffectiveBpm : 120
  const builderPreviewTime = editingDeck
    ? (previewDeckIndex * editingDeck.configuration.defaultItemDurationBeats * 60) / previewBpm + 0.01
    : engine.currentTime

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
    if (!activeLaserDmxShow) return
    updateLaserDmxShowManagerWorkspaceSettings(activeLaserDmxShow.id, patch)
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

  const openSelectedShow = (showId: string) => {
    const show = showManagerShows.find(candidate => candidate.id === showId)
    if (!show) return
    const preferredEngine = show.engineIds.includes(selectedEngineId as ShowManagerEngineId)
      ? selectedEngineId as ShowManagerEngineId
      : (show.engineIds[0] ?? selectedEngineId as ShowManagerEngineId)
    setSelectedEngineId(preferredEngine)
    selectShowManagerShow(show.id)
    selectCanvasShowManagerShow(preferredEngine === 'canvas' && canvasShowManagerShows.some(candidate => candidate.id === show.id) ? show.id : null)
    selectLaserDmxShowManagerShow(preferredEngine === 'laserDmx' && laserDmxShowManagerShows.some(candidate => candidate.id === show.id) ? show.id : null)
    setPreviewPresetId(null)
    setShowBrowserOpen(false)
  }

  const createSelectedShow = () => {
    setNewShowOpen(true)
  }

  const saveAndActivateSelectedShow = () => {
    if (selectedEngineId === 'canvas') void commitCanvasShowSave(true)
    else if (selectedEngineId === 'laserDmx') void commitLaserShowSave(true)
  }

  const saveAndActivatePending = selectedEngineId === 'canvas'
    ? canvasSavePending === 'active'
    : selectedEngineId === 'laserDmx' && laserSavePending === 'active'
  const saveAndActivateDisabled = selectedEngineId === 'canvas'
    ? !activeCanvasShow || canvasSavePending !== null
    : selectedEngineId === 'laserDmx'
      ? !activeLaserDmxShow || laserSavePending !== null
      : true

  const commitCanvasMediaPlacement = (mediaId: string, layer: CanvasShowManagerLayer) => {
    if (!activeCanvasShow || !activeCanvasSection) {
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
      sectionId: activeCanvasSection.id,
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

  const commitLaserFixtureDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    const rawKind = event.dataTransfer.getData('application/x-drmvyz-laserdmx-fixture-kind')
      || event.dataTransfer.getData('text/plain')
    const kind = parseLaserDmxShowManagerFixtureKind(rawKind)
    if (!kind) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const cell = resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds)
    if (!cell) return
    const fixtureId = addLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, kind, cell)
    if (fixtureId) {
      setSelectedLaserFixtureId(fixtureId)
    }
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

  const commitLaserFixtureCopy = (sourceSectionId: string) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    if (!eligibleLaserFixtureCopySources.some(section => section.id === sourceSectionId)) return
    const copiedFixtureIds = copyLaserDmxShowManagerFixturesFromSection(
      activeLaserDmxShow.id,
      sourceSectionId,
      activeLaserDmxSection.id,
    )
    if (copiedFixtureIds.length === 0) return
    setSelectedLaserFixtureId(null)
    setCopyLaserFixturesSourceSectionId(null)
  }

  const selectLaserSectionForEditing = (sectionId: string) => {
    setSelectedLaserFixtureId(null)
    selectLaserDmxShowManagerSection(sectionId)
  }

  const commitLaserSectionBoundary = (
    sectionId: string,
    edge: 'start' | 'end',
    newTime: number,
    neighborId: string | null,
    neighborTime: number | null,
  ) => {
    if (!activeLaserDmxShow) return
    updateLaserDmxShowManagerSectionBoundary(
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
          {(selectedEngineId === 'laserDmx' || selectedEngineId === 'canvas') && workspaceMode === 'default' ? (
            <>
              <button
                type="button"
                onClick={selectedEngineId === 'canvas' ? undoCanvasShowManagerEdit : undoLaserShowEdit}
                disabled={(selectedEngineId === 'canvas' ? canvasShowUndoDepth : laserShowUndoDepth) === 0}
                title="Undo Show edit"
              >↶</button>
              <button
                type="button"
                onClick={selectedEngineId === 'canvas' ? redoCanvasShowManagerEdit : redoLaserShowEdit}
                disabled={(selectedEngineId === 'canvas' ? canvasShowRedoDepth : laserShowRedoDepth) === 0}
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
          onClick={() => void (selectedEngineId === 'canvas' ? commitCanvasShowSave(false) : commitLaserShowSave(false))}
          disabled={(selectedEngineId !== 'laserDmx' && selectedEngineId !== 'canvas')
            || (selectedEngineId === 'canvas' ? !activeCanvasShow || canvasSavePending !== null : !activeLaserDmxShow || laserSavePending !== null)}
        >{(selectedEngineId === 'canvas' ? canvasSavePending : laserSavePending) === 'save' ? 'Saving…' : 'Save'}</button>
        {(selectedEngineId === 'laserDmx' || selectedEngineId === 'canvas' || selectedEngineId === 'pixGrid') && (
          <>
            <ReactPersistenceStatus />
            {selectedEngineId !== 'pixGrid' && (selectedEngineId === 'canvas' ? canvasSaveStatus : laserSaveStatus) && (
              <span className="sm-header-save-status" role="status">
                {selectedEngineId === 'canvas' ? canvasSaveStatus : laserSaveStatus}
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
            <>
              <LibrarySection title="Lighting Components" count={LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.length}>
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
              </LibrarySection>

              <LibrarySection title="Workspace" count={2}>
                <LibrarySubsection title="Display Settings" count={4}>
                  <div className="sm-library-controls">
                    <ToggleRow
                      label="Show Grid"
                      value={activeLaserDmxShow?.settings?.showGrid ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showGrid => commitLaserWorkspaceSettings({ showGrid })}
                    />
                    <ToggleRow
                      label="Show Labels"
                      value={activeLaserDmxShow?.settings?.showLabels ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showLabels => commitLaserWorkspaceSettings({ showLabels })}
                    />
                    <ToggleRow
                      label="Show Beams"
                      value={activeLaserDmxShow?.settings?.showBeams ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showBeams => commitLaserWorkspaceSettings({ showBeams })}
                    />
                    <ToggleRow
                      label="Highlight Grid"
                      value={activeLaserDmxShow?.settings?.highlightGrid ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={highlightGrid => commitLaserWorkspaceSettings({ highlightGrid })}
                    />
                  </div>
                </LibrarySubsection>

                <LibrarySubsection title="Render Settings" count={3}>
                  <div className="sm-library-controls">
                    <SelectRow
                      label="Grid Size"
                      value="18x12"
                      disabled
                      onChange={() => undefined}
                      options={[{ value: '18x12', label: '18 × 12' }]}
                    />
                    <SelectRow
                      label="Lighting Renderer"
                      value={activeLaserDmxShow?.settings?.rendererMode ?? 'auto'}
                      disabled={!activeLaserDmxShow}
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
                  </div>
                </LibrarySubsection>
              </LibrarySection>
            </>
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
          <div className="sm-stage-frame">
            {selectedEngineId === 'laserDmx' && workspaceMode === 'default' ? (
              <>
              <LaserDmxShowManagerStage
                show={activeLaserDmxShow}
                section={activeLaserDmxSection}
                selectedFixtureId={selectedLaserFixtureId}
                showGrid={activeLaserDmxShow?.settings?.showGrid ?? true}
                showLabels={activeLaserDmxShow?.settings?.showLabels ?? true}
                showBeams={activeLaserDmxShow?.settings?.showBeams ?? true}
                highlightGrid={activeLaserDmxShow?.settings?.highlightGrid ?? true}
                playbackSectionLabel={engine.isPlaying ? playbackLaserDmxSection?.label ?? 'No active section' : null}
                runtimePreview={engine.isPlaying && laserDmxRuntimePreset && activeLaserDmxShow ? (
                  <ReactPlaceholderCanvas
                    analyser={engine.analyserMaster}
                    engine="laserDmx"
                    activePreset={laserDmxRuntimePreset}
                    intensity={reactIntensity}
                    motion={reactMotion}
                    glow={reactGlow}
                    bassReactivity={reactBassReactivity}
                    isPlaying={engine.isPlaying}
                    isPaused={false}
                    trackSections={resolvedTrackSections}
                    trackAnalysis={effectiveTrackAnalysis}
                    laserDmxSectionRuntimePrograms={laserDmxRuntimePrograms}
                    laserDmxEmptyRuntimeShowDirector={laserDmxEmptyRuntimeShowDirector}
                    onLaserDmxPlaybackSectionChange={handleLaserDmxPlaybackSectionChange}
                    getAudioTime={engine.getCurrentTime}
                    effectiveBpm={engine.currentEffectiveBpm ?? undefined}
                    activeAudioTrackId={engine.currentTrackId}
                    durationSec={durationSec}
                  />
                ) : null}
                onDropFixture={commitLaserFixtureDrop}
                onSelectFixture={setSelectedLaserFixtureId}
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
            ) : selectedEngineId === 'canvas' ? (
              <CanvasShowManagerStage
                show={activeCanvasShow}
                selectedSectionId={activeCanvasSection?.id ?? null}
                selectedElementId={selectedCanvasElement?.id ?? null}
                selectedLibraryMediaId={canvasLibraryMediaId}
                mediaItems={sharedMediaItems}
                sectionRanges={canvasSectionRanges}
                onSelectElement={selectCanvasShowManagerMediaElement}
                onPlaceMedia={commitCanvasMediaPlacement}
                onCreate={() => setNewShowOpen(true)}
                runtimePreview={activeCanvasShow ? (
                  <CanvasEngineSurface
                    isPlaying={engine.isPlaying}
                    isPaused={!engine.isPlaying}
                    analyser={engine.analyserMaster}
                    trackAnalysis={effectiveTrackAnalysis}
                    trackSections={resolvedTrackSections}
                    getAudioTime={() => canvasPlayheadSec}
                    activeAudioTrackId={engine.currentTrackId}
                    previewShow={activeCanvasShow}
                    previewShowTimeSec={canvasPlayheadSec}
                    previewSelectedElementId={selectedCanvasElement?.id ?? null}
                    showRuntimeStatus={false}
                    onLiveFps={setLiveFps}
                  />
                ) : null}
              />
            ) : (
              <PixGridSurface
                analyser={engine.analyserMaster}
                activePreset={displayedPreset}
                pixGridState={displayedPixGridState}
                pixGridDecks={pixGridDecks}
                pixGridActionCues={activeCues}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                isPlaying={engine.isPlaying}
                isPaused={!engine.isPlaying}
                trackSections={resolvedTrackSections}
                trackAnalysis={effectiveTrackAnalysis}
                trackIdentity={engine.currentTrackId}
                durationSec={durationSec}
                audioTimeSec={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? builderPreviewTime : engine.currentTime}
                getAudioTime={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? () => builderPreviewTime : engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm ?? undefined}
                onLiveFps={setLiveFps}
              />
            )}
            {selectedEngineId === 'canvas' && canvasAuthoringError && (
              <NoticeCard className="sm-stage-authoring-feedback" tone="error" role="alert">{canvasAuthoringError}</NoticeCard>
            )}
            <div className="sm-stage-status">
              {selectedEngineId === 'laserDmx' && workspaceMode === 'default' ? (
                <>
                  <span>LaserDMX {LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns} × {LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows}</span>
                  <span>{activeLaserDmxSection?.fixtures.length ?? 0} editing fixtures</span>
                  <span>{engine.isPlaying ? `Playback: ${playbackLaserDmxSection?.label ?? 'None'}` : 'Playback stopped'}</span>
                  <span>{selectedLaserFixture?.label ?? 'No selection'}</span>
                </>
              ) : selectedEngineId === 'canvas' ? (
                <>
                  <span>Canvas Show</span>
                  <span>{activeCanvasShow ? `${activeCanvasShow.sections.length} sections` : 'No Show open'}</span>
                  <span>{activeCanvasShow ? `${formatClock(canvasTotalDuration)} total` : 'Create or open a Show'}</span>
                  <span>{activeCanvasShow?.id === canvasShowManagerActiveShowId ? 'Active Show' : 'Editing'}</span>
                </>
              ) : (
                <>
                  <span>PixGrid {matrixLabel}</span>
                  <span>FPS {liveFps > 0 ? liveFps.toFixed(1) : '—'}</span>
                </>
              )}
            </div>
            <Dropdown
              id="show-manager-stage-scale"
              ariaLabel="Show Manager stage scale"
              value="fit"
              options={STAGE_SCALE_OPTIONS}
              size="dense"
              showDescriptions={false}
              disabled
              className="sm-fit-dropdown"
            />
          </div>

          {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && editingDeck ? (
            <PixGridDeckSequenceStrip
              deck={editingDeck}
              previewItemId={previewDeckItemId}
              onPreview={setPreviewDeckItemId}
              onPrevious={() => stepPreview(-1)}
              onNext={() => stepPreview(1)}
            />
          ) : selectedEngineId === 'laserDmx' ? (
            <LaserDmxShowManagerTimeline
              show={activeLaserDmxShow}
              selectedSectionId={activeLaserDmxSection?.id ?? null}
              durationSec={laserTimelineDuration}
              viewport={laserTimelineViewport}
              viewportRef={laserTimelineViewportRef}
              onSelect={selectLaserSectionForEditing}
              onRemove={sectionId => {
                if (!activeLaserDmxShow) return
                removeLaserDmxShowManagerSection(activeLaserDmxShow.id, sectionId)
              }}
              onCommitBoundary={commitLaserSectionBoundary}
            />
          ) : selectedEngineId === 'canvas' ? (
            <CanvasShowManagerTimeline
              show={activeCanvasShow}
              selectedSectionId={activeCanvasSection?.id ?? null}
              selectedElementId={selectedCanvasElement?.id ?? null}
              mediaItems={sharedMediaItems}
              sectionRanges={canvasSectionRanges}
              totalDurationSec={canvasTotalDuration}
              playheadSec={canvasPlayheadSec}
              onSelect={selectCanvasShowManagerSection}
              onSelectElement={selectCanvasShowManagerMediaElement}
              onPatchElement={commitCanvasElementPatch}
            />
          ) : (
            <ShowManagerTimeline
              currentTime={engine.currentTime}
              duration={durationSec}
              playheadPercent={playheadPercent}
              sections={resolvedTrackSections}
              sceneLabels={sceneLabels}
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
        <aside className="sm-inspector" aria-label={`Show Manager ${REACT_ENGINE_CATALOG[selectedEngineId].label} inspector`}>
          <div className="sm-panel-heading sm-panel-heading--inspector">
            <strong>INSPECTOR</strong>
            <span>{REACT_ENGINE_CATALOG[selectedEngineId].label} parameters</span>
          </div>
          {selectedEngineId === 'pixGrid' ? (
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
          ) : selectedEngineId === 'laserDmx' ? (
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
                    onDelete={deleteSelectedLaserFixture}
                  />
                ) : <>
                  <div className="sm-laser-section-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const index = activeLaserDmxShow.sections.findIndex(section => section.id === activeLaserDmxSection.id)
                        if (index <= 0) return
                        reorderLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, -1)
                      }}
                      disabled={activeLaserDmxShow.sections[0]?.id === activeLaserDmxSection.id}
                    >Move Earlier</button>
                    <button
                      type="button"
                      onClick={() => {
                        const index = activeLaserDmxShow.sections.findIndex(section => section.id === activeLaserDmxSection.id)
                        if (index < 0 || index >= activeLaserDmxShow.sections.length - 1) return
                        reorderLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, 1)
                      }}
                      disabled={activeLaserDmxShow.sections[activeLaserDmxShow.sections.length - 1]?.id === activeLaserDmxSection.id}
                    >Move Later</button>
                    <button
                      type="button"
                      onClick={() => {
                        const last = activeLaserDmxShow.sections[activeLaserDmxShow.sections.length - 1]
                        addLaserDmxShowManagerSection(activeLaserDmxShow.id, {
                          type: 'unknown',
                          label: 'Section',
                          startSec: last?.endSec ?? 0,
                          endSec: (last?.endSec ?? 0) + 1,
                        })
                      }}
                    >Add Section</button>
                  </div>
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
                  <EditSectionForm
                    key={activeLaserDmxSection.id}
                    section={activeLaserDmxSection}
                    durationSec={laserTimelineDuration}
                    effectiveBpm={null}
                    snapMode="free"
                    onCancel={() => undefined}
                    onSave={patch => {
                      updateLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, patch)
                    }}
                    onDelete={() => {
                      removeLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id)
                    }}
                  />
                  <NoticeCard tone="success" title="Section fixture ownership · READY">
                    {activeLaserDmxSection.fixtures.length} fixture{activeLaserDmxSection.fixtures.length === 1 ? '' : 's'} owned by this section. Select a fixture on the grid to edit its Part 1 controls.
                  </NoticeCard>
                </>
              ) : activeLaserDmxShow ? (
                <div className="sm-laser-empty-section">
                  <p>This Show intentionally has no sections.</p>
                  <button
                    type="button"
                    onClick={() => {
                      addLaserDmxShowManagerSection(activeLaserDmxShow.id, { label: 'Section', startSec: 0, endSec: 1 })
                    }}
                  >Add Section</button>
                </div>
              ) : (
                <div className="sm-panel-blank" />
              )}
            </div>
          ) : selectedEngineId === 'canvas' ? (
            <CanvasShowManagerInspector
              show={activeCanvasShow}
              section={activeCanvasSection}
              element={selectedCanvasElement}
              elementMedia={selectedCanvasElementMedia}
              sectionRanges={canvasSectionRanges}
              totalDurationSec={canvasTotalDuration}
              renameDraft={canvasRenameDraft}
              renameError={canvasRenameError}
              onRenameDraft={setCanvasRenameDraft}
              onRename={commitCanvasRename}
              onUpdateDuration={(sectionId, durationSec) => {
                if (!activeCanvasShow) return false
                const current = activeCanvasShow.sections.find(section => section.id === sectionId)
                const edit = updateCanvasShowManagerSectionDuration(activeCanvasShow.id, sectionId, durationSec)
                if (!edit && current?.durationSec !== durationSec) {
                  setCanvasAuthoringError('That section duration would create invalid or overlapping media cues. Adjust the affected clips first.')
                  return false
                } else {
                  setCanvasAuthoringError(null)
                  return true
                }
              }}
              onPatchElement={patch => selectedCanvasElement
                ? commitCanvasElementPatch(selectedCanvasElement.id, patch)
                : false}
              onInteractionStart={beginCanvasShowManagerHistoryTransaction}
              onInteractionEnd={commitCanvasShowManagerHistoryTransaction}
              onDeleteElement={deleteSelectedCanvasElement}
              onDelete={() => {
                if (!activeCanvasShow || !window.confirm(`Delete Canvas Show “${activeCanvasShow.name}”?`)) return
                deleteCanvasShowManagerShow(activeCanvasShow.id)
              }}
              onCreate={() => setNewShowOpen(true)}
            />
          ) : (
            <div className="sm-panel-blank" />
          )}
        </aside>
        )}
          </>
        )}
      </div>

      {/* Shared application Audio Dock. Loading or selecting a track here updates
          the same AudioEngineContext consumed by the Show Manager preview. */}
      <VyzualzAudioDock
        expandable
        unifiedTimeline
        waveformAppearance="deck"
      />
      {showBrowserOpen && (
        <ShowBrowserDialog
          engineLabel={REACT_ENGINE_CATALOG[selectedEngineId].label}
          shows={showBrowserEntries}
          currentShowId={showManagerEditingShowId}
          onClose={() => setShowBrowserOpen(false)}
          onOpen={openSelectedShow}
        />
      )}
      {newShowOpen && (
        <NewShowDialog
          engineId={selectedEngineId as ShowManagerEngineId}
          onClose={() => setNewShowOpen(false)}
        />
      )}
    </section>
  )
}

function CanvasShowManagerInspector({
  show,
  section,
  element,
  elementMedia,
  sectionRanges,
  totalDurationSec,
  renameDraft,
  renameError,
  onRenameDraft,
  onRename,
  onUpdateDuration,
  onPatchElement,
  onInteractionStart,
  onInteractionEnd,
  onDeleteElement,
  onDelete,
  onCreate,
}: {
  show: CanvasShowManagerShow | null
  section: CanvasShowManagerShow['sections'][number] | null
  element: CanvasShowManagerMediaElement | null
  elementMedia: UploadedMedia | null
  sectionRanges: readonly CanvasShowManagerSectionRange[]
  totalDurationSec: number
  renameDraft: string
  renameError: string | null
  onRenameDraft: (value: string) => void
  onRename: () => void
  onUpdateDuration: (sectionId: string, durationSec: number) => boolean
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
  const range = sectionRanges.find(candidate => candidate.sectionId === section?.id)
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
      {section && (
        <Collapsible label="Section" defaultOpen>
          <div className="sm-canvas-form">
            <strong>{section.label}</strong>
            <label htmlFor="canvas-section-duration">Duration (seconds)</label>
            <DreamVizTextInput
              id="canvas-section-duration"
              key={`${section.id}:${section.durationSec}`}
              type="number"
              min="0.001"
              step="0.1"
              defaultValue={section.durationSec}
              onBlur={event => {
                const duration = normalizeCanvasShowManagerDuration(event.target.value)
                event.target.value = String(onUpdateDuration(section.id, duration) ? duration : section.durationSec)
              }}
            />
            <small>{range ? `${formatClock(range.startSec)} – ${formatClock(range.endSec)}` : ''}</small>
          </div>
        </Collapsible>
      )}
      <button type="button" className="sm-canvas-delete" onClick={onDelete}>Delete Show</button>
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
      <div className="sm-laser-stage-heading sm-canvas-stage-heading">
        <span>{show.name}</span>
        <strong>{selectedSection ? `Editing: ${selectedSection.label}` : 'No section selected'}</strong>
      </div>
      <div className="sm-canvas-authoring-surface" data-testid="canvas-show-manager-authoring-surface">
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
                    event.preventDefault()
                    event.stopPropagation()
                    setHoveredLayer(layer)
                  }}
                  onDragLeave={() => setHoveredLayer(current => current === layer ? null : current)}
                  onDrop={event => {
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

function CanvasShowManagerTimeline({
  show,
  selectedSectionId,
  selectedElementId,
  mediaItems,
  sectionRanges,
  totalDurationSec,
  playheadSec,
  onSelect,
  onSelectElement,
  onPatchElement,
}: {
  show: CanvasShowManagerShow | null
  selectedSectionId: string | null
  selectedElementId: string | null
  mediaItems: readonly UploadedMedia[]
  sectionRanges: readonly CanvasShowManagerSectionRange[]
  totalDurationSec: number
  playheadSec: number
  onSelect: (sectionId: string | null) => void
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
      const deltaSec = ((pointerEvent.clientX - originX) / width) * totalDurationSec
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
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="Canvas timeline surfaces" />
        <span className="sm-timeline-meta">{show ? `${formatClock(totalDurationSec)} total` : 'No Canvas Show open'}</span>
      </header>
      {show ? (
        <>
          <div className="sm-timeline-grid sm-canvas-section-map">
            <div className="sm-timeline-ruler">
              {[0, ...sectionRanges.map(range => range.endSec)].map((timeSec, index) => (
                <span key={`${timeSec}:${index}`}>{formatClock(timeSec)}</span>
              ))}
            </div>
            <TimelineRow label="Section" className="sm-timeline-row--sections">
              <ShowManagerSectionStrip
                sections={canvasTimelineSections}
                durationSec={totalDurationSec}
                selectedSectionId={selectedSectionId}
                onSelect={onSelect}
              />
            </TimelineRow>
          </div>
          <div className="sm-canvas-timeline-body">
            <div className="sm-canvas-media-lanes">
              {([3, 2, 1, 0] as const).map(layer => (
                <div className="sm-canvas-media-lane" key={layer}>
                  <span className="sm-canvas-media-lane__label">L{layer + 1}</span>
                  <div className="sm-canvas-media-lane__track">
                    <span className="sm-canvas-playhead" style={{ left: `${totalDurationSec > 0 ? (playheadSec / totalDurationSec) * 100 : 0}%` }} aria-hidden="true" />
                    {show.mediaElements.filter(element => element.layer === layer).map(element => {
                      const media = mediaItems.find(candidate => candidate.id === element.mediaId) ?? null
                      const left = totalDurationSec > 0 ? (element.showStartSec / totalDurationSec) * 100 : 0
                      const width = totalDurationSec > 0 ? ((element.showEndSec - element.showStartSec) / totalDurationSec) * 100 : 0
                      const handleKey = (edge: 'start' | 'end', event: ReactKeyboardEvent<HTMLButtonElement>) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                        event.preventDefault()
                        nudgeCue(element, edge, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1))
                      }
                      return (
                        <div
                          key={element.id}
                          className={`sm-canvas-media-clip${element.id === selectedElementId ? ' is-selected' : ''}${media ? '' : ' is-missing'}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <button className="sm-canvas-clip-handle is-start" type="button" aria-label={`Adjust start cue for ${media?.name ?? 'missing media'}`} onPointerDown={event => beginPointerCueEdit(event, element, 'start')} onKeyDown={event => handleKey('start', event)} />
                          <button className="sm-canvas-media-clip__body" type="button" onClick={() => onSelectElement(element.id)} title={`${media?.name ?? 'Missing media'} · ${element.showStartSec.toFixed(2)}–${element.showEndSec.toFixed(2)}s`}>
                            {media?.title?.trim() || media?.name || 'Unavailable'}
                          </button>
                          <button className="sm-canvas-clip-handle is-end" type="button" aria-label={`Adjust end cue for ${media?.name ?? 'missing media'}`} onPointerDown={event => beginPointerCueEdit(event, element, 'end')} onKeyDown={event => handleKey('end', event)} />
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

function LaserDmxShowManagerFixtureInspector({
  fixture,
  onPatch,
  onDelete,
}: {
  fixture: LaserDmxShowDirectorFixture
  onPatch: (patch: LaserDmxShowDirectorFixturePatch) => void
  onDelete: () => void
}) {
  const triggerOption = resolveLaserDmxShowManagerTriggerOption(fixture.trigger)
  const beamPatternOptions = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'fan', label: 'Fan' },
    { value: 'sweep', label: 'Sweep' },
    { value: 'cross', label: 'Cross' },
    { value: 'mirror', label: 'Mirror' },
    { value: 'audioReactive', label: 'Audio Reactive' },
  ]

  return (
    <div className="sm-laser-fixture-inspector" data-testid="laser-dmx-fixture-inspector">
      <div className="sm-inspector-context sm-laser-fixture-context">
        <div><span>Fixture</span><strong>{fixture.label}</strong></div>
        <div><span>Type</span><strong>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]}</strong></div>
      </div>

      <Collapsible label="Position" defaultOpen>
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
        <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => onPatch({ rotation })} />
      </Collapsible>

      <Collapsible label="Color & Brightness" defaultOpen>
        <ColorRow label="Color" value={fixture.color} onChange={color => onPatch({ color })} />
        <SelectRow
          label="Color Mode"
          value="fixed"
          disabled
          options={[{ value: 'fixed', label: 'Static' }]}
          onChange={() => undefined}
        />
        <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => onPatch({ brightness })} />
      </Collapsible>

      <Collapsible label="Beam Configuration" defaultOpen>
        <SelectRow
          label="Beam Type / Pattern"
          value={fixture.beam.targetMode}
          options={beamPatternOptions}
          onChange={targetMode => onPatch({ beam: { targetMode: targetMode as LaserDmxShowDirectorFixture['beam']['targetMode'] } })}
        />
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
        <SliderRow
          label="Width"
          value={fixture.optics.zoom}
          min={0}
          max={1}
          step={0.01}
          onChange={zoom => onPatch({ optics: { zoom } })}
        />
        <SliderRow label="Spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} onChange={beamSpread => onPatch({ beam: { beamSpread } })} />
        <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => onPatch({ beam: { focus } })} />
      </Collapsible>

      <Collapsible label="Trigger Configuration" defaultOpen>
        <SelectRow
          label="Trigger"
          value={triggerOption}
          options={LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => ({ ...option }))}
          onChange={value => onPatch({ trigger: triggerPatchForLaserDmxShowManagerOption(value as LaserDmxShowManagerTriggerOption) })}
        />
      </Collapsible>

      <button type="button" className="sm-laser-delete-fixture" onClick={onDelete} aria-label={`Delete ${fixture.label}`}>
        Delete Fixture
      </button>
    </div>
  )
}

function LaserDmxShowManagerStage({
  show,
  section,
  selectedFixtureId,
  showGrid,
  showLabels,
  showBeams,
  highlightGrid,
  playbackSectionLabel,
  runtimePreview,
  onDropFixture,
  onSelectFixture,
  onFixtureContextMenu,
  endpointTargetingFixtureId,
  onCommitEndpointTarget,
}: {
  show: LaserDmxShowManagerShow | null
  section: LaserDmxShowManagerSection | null
  selectedFixtureId: string | null
  showGrid: boolean
  showLabels: boolean
  showBeams: boolean
  highlightGrid: boolean
  playbackSectionLabel: string | null
  runtimePreview: ReactNode
  onDropFixture: (event: DragEvent<HTMLDivElement>) => void
  onSelectFixture: (fixtureId: string | null) => void
  onFixtureContextMenu: (event: MouseEvent<HTMLButtonElement>, fixtureId: string) => void
  endpointTargetingFixtureId: string | null
  onCommitEndpointTarget: (event: MouseEvent<HTMLDivElement>) => void
}) {
  const fixtures = section?.fixtures ?? []
  const collisionOrdinals = new Map<string, number>()

  return (
    <div className="sm-laser-stage" aria-label="LaserDMX Part 1 authoring grid">
      <div className="sm-laser-stage-heading">
        <span>{show?.name ?? 'Untitled Show'}</span>
        <strong>{section ? `Editing: ${section.label}` : 'No section selected'}</strong>
        {playbackSectionLabel && <em>Playback: {playbackSectionLabel}</em>}
        {endpointTargetingFixtureId && <em>Click the grid to set the beam endpoint</em>}
      </div>
      <div
        className={`sm-laser-stage-grid-surface${showGrid ? ' is-grid-visible' : ''}${highlightGrid ? ' is-highlighted' : ''}${endpointTargetingFixtureId ? ' is-targeting-endpoint' : ''}`}
        data-testid="laser-dmx-authoring-grid"
        onDragOver={event => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={onDropFixture}
        onClick={event => endpointTargetingFixtureId ? onCommitEndpointTarget(event) : onSelectFixture(null)}
      >
        {runtimePreview && (
          <div className={`sm-laser-runtime-preview${showBeams ? '' : ' is-hidden'}`} aria-hidden="true">
            {runtimePreview}
          </div>
        )}
        {showBeams && !runtimePreview && fixtures.length > 0 && (
          <svg className="sm-laser-stage-beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {fixtures.flatMap(fixture => {
              if (!fixture.beam.beamEnabled || fixture.beam.targetX == null || fixture.beam.targetY == null) return []
              const x1 = ((fixture.x + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
              const y1 = ((fixture.y + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
              const x2 = ((fixture.beam.targetX + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
              const y2 = ((fixture.beam.targetY + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
              return [<line
                key={fixture.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                style={{
                  stroke: fixture.color,
                  strokeOpacity: Math.max(0.08, fixture.brightness * 0.45),
                  strokeWidth: 0.12 + fixture.optics.zoom * 0.38,
                }}
              />]
            })}
          </svg>
        )}
        {fixtures.map(fixture => {
          const collisionKey = `${fixture.x}:${fixture.y}`
          const collisionOrdinal = collisionOrdinals.get(collisionKey) ?? 0
          collisionOrdinals.set(collisionKey, collisionOrdinal + 1)
          const collisionOffset = collisionOrdinal % 4
          const left = ((fixture.x + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
          const top = ((fixture.y + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
          const isSelected = fixture.id === selectedFixtureId
          return (
            <button
              key={fixture.id}
              type="button"
              className={`sm-laser-fixture${isSelected ? ' is-selected' : ''}`}
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
              onClick={event => {
                event.stopPropagation()
                onSelectFixture(fixture.id)
              }}
              onContextMenu={event => onFixtureContextMenu(event, fixture.id)}
            >
              <span className="sm-laser-fixture-icon" aria-hidden="true"><FixtureIcon kind={fixture.kind} /></span>
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
  show,
  selectedSectionId,
  durationSec,
  viewport,
  viewportRef,
  onSelect,
  onRemove,
  onCommitBoundary,
}: {
  show: LaserDmxShowManagerShow | null
  selectedSectionId: string | null
  durationSec: number
  viewport: TimelineViewport
  viewportRef: MutableRefObject<TimelineViewport>
  onSelect: (sectionId: string) => void
  onRemove: (sectionId: string) => void
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
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="LaserDMX timeline surfaces" />
        <span className="sm-timeline-meta">No audio required · free boundaries</span>
      </header>
      <div className="sm-timeline-grid">
        <div className="sm-timeline-ruler">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index}>{index}</span>
          ))}
        </div>
        <TimelineRow label="Section" className="sm-timeline-row--sections">
          {show && show.sections.length > 0 ? (
            <SectionTimeline
              sections={show.sections}
              durationSec={durationSec}
              viewport={viewport}
              viewportRef={viewportRef}
              beatGrid={[]}
              effectiveBpm={null}
              snapMode="free"
              selectedId={selectedSectionId}
              onSelect={onSelect}
              onRemove={onRemove}
              onCommitBoundary={onCommitBoundary}
            />
          ) : (
            <div className="sm-laser-timeline-empty">No sections</div>
          )}
        </TimelineRow>
      </div>
    </section>
  )
}

function LibrarySubsection({
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
      className="sm-library-subsection"
      bodyClassName="sm-library-subsection-body"
      headerClassName="sm-library-section-toggle sm-library-subsection-toggle"
      defaultOpen={!defaultCollapsed}
      label={<strong>{title}</strong>}
      headerAccessory={<small>{count}</small>}
    >
      {children}
    </DualRailCollapsible>
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
  playheadPercent,
  sections,
  sceneLabels,
}: {
  currentTime: number
  duration: number
  playheadPercent: number
  sections: readonly ReactTrackSection[]
  sceneLabels: readonly string[]
}) {
  const timelineSections: readonly ShowManagerSectionSegment[] = sections.length > 0
    ? sections
    : SECTION_SEGMENTS.map((segment, index) => ({
        id: `pix-grid-fallback-section-${segment.type}`,
        label: segment.label,
        type: segment.type,
        startSec: (duration / SECTION_SEGMENTS.length) * index,
        endSec: (duration / SECTION_SEGMENTS.length) * (index + 1),
      }))
  return (
    <section className="sm-timeline sm-pixgrid-timeline" aria-label="Show Manager track map preview">
      <header className="sm-timeline-tabs">
        <UnderlineTabs tabs={TRACK_MAP_TABS} activeTab="trackMap" onChange={() => undefined} ariaLabel="PixGrid timeline surfaces" />
        <span className="sm-timeline-meta">Snap 1/4</span>
      </header>
      <div className="sm-timeline-grid">
        <div className="sm-timeline-ruler">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index}>{formatClock((duration / 6) * index)}</span>
          ))}
        </div>
        <TimelineRow label="Section" className="sm-timeline-row--sections">
          <ShowManagerSectionStrip sections={timelineSections} durationSec={duration} />
        </TimelineRow>
        <TimelineRow label="Scenes">
          <div className="sm-segment-row sm-segment-row--scenes">
            {SECTION_SEGMENTS.slice(0, 4).map((segment, index) => (
              <span key={segment.label}>{sceneLabels[index] ?? segment.label}</span>
            ))}
          </div>
        </TimelineRow>
        <TimelineRow label="Cues">
          <div className="sm-cue-row">
            {[8, 18, 31, 43, 55, 69, 82, 94].map(position => <i key={position} style={{ left: `${position}%` }} />)}
          </div>
        </TimelineRow>
        <TimelineRow label="Glow">
          <svg className="sm-automation-curve" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,14 12,13 25,11 38,5 50,10 63,12 76,6 88,9 100,13" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Intensity">
          <svg className="sm-automation-curve is-green" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,15 16,15 30,12 45,7 58,9 72,5 84,9 100,14" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Motion">
          <svg className="sm-automation-curve is-purple" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,13 14,12 28,12 43,8 57,13 70,10 84,6 100,11" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Audio">
          <div className="sm-waveform" aria-hidden="true">
            {Array.from({ length: 96 }, (_, index) => (
              <i key={index} style={{ height: `${22 + ((index * 17) % 68)}%` }} />
            ))}
          </div>
        </TimelineRow>
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
