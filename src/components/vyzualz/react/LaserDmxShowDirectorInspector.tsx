import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_DEPTH_LAYER_LABELS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  type LaserDmxShowDirectorAudioBand,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorBeatDivision,
  type LaserDmxShowDirectorBeamTargetMode,
  type LaserDmxShowDirectorColorMode,
  type LaserDmxShowDirectorDepthLayer,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorGoboPattern,
  type LaserDmxShowDirectorLedDirection,
  type LaserDmxShowDirectorMovingHeadPanTiltStyle,
  type LaserDmxShowDirectorOpticalPrimitiveType,
  type LaserDmxShowDirectorSectionType,
  type LaserDmxShowDirectorScannerConfig,
  type LaserDmxShowDirectorScannerDirection,
  type LaserDmxShowDirectorScannerInterpolation,
  type LaserDmxShowDirectorScannerOpticalMode,
  type LaserDmxShowDirectorScannerPatternType,
  type LaserDmxShowDirectorScannerRepeatMode,
  type LaserDmxShowDirectorTriggerMode,
  type LaserDmxShowDirectorVideoWallSource,
} from './ReactTypes'
import { CtrlSection, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'
import { LaserDmxShowDirectorFixtureIcon } from './LaserDmxShowDirectorFixtureIcon'
import {
  LASER_DMX_SCANNER_PATTERN_OPTIONS,
  applyLaserDmxScannerRuntimeOverrides,
  createLaserDmxScannerDiagnosticsSummary,
  createLaserDmxScannerPattern,
  insertLaserDmxScannerPoint,
  previewLaserDmxLegacyScannerMigration,
  removeLaserDmxScannerPoint,
  reorderLaserDmxScannerPoint,
  reverseLaserDmxScannerPath,
  scannerPointsToBeamTargets,
  updateLaserDmxScannerPoint,
  updateLaserDmxScannerPatternGeometry,
  validateLaserDmxScannerConfig,
  type LaserDmxScannerMigrationPreview,
} from './laserDmxScannerAuthoring'
import {
  RECOMMENDED_TRIGGER_RECIPE_BY_KIND,
  TRIGGER_RECIPE_HINTS,
  TRIGGER_RECIPE_OPTIONS,
  recipeForTriggerConfig,
  triggerPatchForRecipe,
  triggerRecipeLabel,
  type LaserDmxShowDirectorTriggerRecipe,
} from './laserDmxShowDirectorTriggerRecipes'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'

interface LaserDmxShowDirectorInspectorProps {
  fixture: LaserDmxShowDirectorFixture | null
}

function ScannerMigrationPreviewDiagram({
  preview,
  columns,
  rows,
}: {
  preview: LaserDmxScannerMigrationPreview
  columns: number
  rows: number
}) {
  const points = preview.scanner.path.points
  const maxX = Math.max(1, columns - 1)
  const maxY = Math.max(1, rows - 1)
  const segments = points.flatMap((point, index) => {
    const nextIndex = index + 1 < points.length
      ? index + 1
      : preview.scanner.path.closed && points.length > 1 ? 0 : -1
    if (nextIndex < 0) return []
    const next = points[nextIndex]!
    const blanked = point.blanked || next.blanked
    return [(
      <line
        key={`${point.id}-${next.id}`}
        className={`rv-show-director-scanner-migration-preview__segment${blanked ? ' rv-show-director-scanner-migration-preview__segment--blanked' : ''}`}
        x1={point.x}
        y1={point.y}
        x2={next.x}
        y2={next.y}
      />
    )]
  })
  return (
    <svg
      className="rv-show-director-scanner-migration-preview"
      viewBox={`-0.5 -0.5 ${maxX + 1} ${maxY + 1}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Migration preview with ${preview.visibleSegmentCount} visible and ${preview.blankedSegmentCount} blanked segments`}
    >
      {segments}
      {points.map((point, index) => (
        <g key={point.id}>
          <circle className={point.blanked ? 'rv-show-director-scanner-migration-preview__point rv-show-director-scanner-migration-preview__point--blanked' : 'rv-show-director-scanner-migration-preview__point'} cx={point.x} cy={point.y} r={0.18} />
          <text className="rv-show-director-scanner-migration-preview__order" x={point.x + 0.22} y={point.y - 0.18}>{index + 1}</text>
        </g>
      ))}
    </svg>
  )
}

const COLOR_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorColorMode; label: string }> = [
  { value: 'fixed', label: 'Fixed color' },
  { value: 'palette', label: 'React palette' },
  { value: 'music', label: 'Music reactive' },
  { value: 'fixtureDefault', label: 'Fixture default' },
]

const OPTICAL_PRIMITIVE_OPTIONS: Array<{ value: LaserDmxShowDirectorOpticalPrimitiveType; label: string }> = [
  { value: 'auto', label: 'Auto / authored endpoints' },
  { value: 'fan', label: 'Fan' },
  { value: 'layeredFan', label: 'Layered fan' },
  { value: 'parallelBank', label: 'Parallel bank' },
  { value: 'crossBank', label: 'Cross bank' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'canopy', label: 'Upper-air canopy' },
  { value: 'audienceRake', label: 'Front-air rake' },
  { value: 'diamondPlane', label: 'Diamond plane' },
  { value: 'mirroredCorridor', label: 'Mirrored corridor' },
  { value: 'rotatingLattice', label: 'Rotating lattice' },
  { value: 'apertureBurst', label: 'Aperture burst' },
  { value: 'scannerWave', label: 'Scanner wave' },
  { value: 'washCone', label: 'Wash cone' },
  { value: 'blinderBank', label: 'Blinder bank' },
  { value: 'strobeField', label: 'Strobe field' },
  { value: 'co2Burst', label: 'CO₂ burst' },
]

const SCANNER_DIRECTION_OPTIONS: Array<{ value: LaserDmxShowDirectorScannerDirection; label: string }> = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'alternating', label: 'Alternating' },
]

const SCANNER_REPEAT_OPTIONS: Array<{ value: LaserDmxShowDirectorScannerRepeatMode; label: string }> = [
  { value: 'loop', label: 'Loop' },
  { value: 'pingPong', label: 'Ping-pong' },
  { value: 'once', label: 'Once' },
]

const SCANNER_INTERPOLATION_OPTIONS: Array<{ value: LaserDmxShowDirectorScannerInterpolation; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'arc', label: 'Arc' },
  { value: 'bezier', label: 'Bezier' },
]

const SCANNER_OPTICAL_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorScannerOpticalMode; label: string }> = [
  { value: 'normal', label: 'Normal scanner' },
  { value: 'prism', label: 'Prism' },
  { value: 'lineDiffraction', label: 'Line diffraction' },
  { value: 'gridDiffraction', label: 'Grid diffraction' },
  { value: 'burstDiffraction', label: 'Burst diffraction' },
]

const BEAM_TARGET_OPTIONS: Array<{ value: LaserDmxShowDirectorBeamTargetMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fan', label: 'Fan' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'cross', label: 'Cross' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'audioReactive', label: 'Audio reactive' },
]

const DEPTH_LAYER_OPTIONS = (Object.entries(LASER_DMX_SHOW_DIRECTOR_DEPTH_LAYER_LABELS) as Array<[LaserDmxShowDirectorDepthLayer, string]>)
  .map(([value, label]) => ({ value, label }))

const TRIGGER_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerMode; label: string }> = [
  { value: 'alwaysOn', label: 'Always on' },
  { value: 'beat', label: 'Beat' },
  { value: 'bar', label: 'Bar' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'section', label: 'Section' },
  { value: 'cuePoint', label: 'Cue point' },
  { value: 'bassHit', label: 'Bass hit' },
  { value: 'snareTransient', label: 'Snare / transient' },
  { value: 'energy', label: 'Energy' },
  { value: 'audioBand', label: 'Audio band' },
]

const BEAT_DIVISION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0.25', label: '1/4 beat' },
  { value: '0.5', label: '1/2 beat' },
  { value: '1', label: '1 beat' },
  { value: '2', label: '2 beats' },
  { value: '4', label: '4 beats' },
  { value: '8', label: '8 beats' },
]

const AUDIO_BAND_OPTIONS: Array<{ value: LaserDmxShowDirectorAudioBand; label: string }> = [
  { value: 'sub', label: 'Sub' },
  { value: 'bass', label: 'Bass' },
  { value: 'lowMid', label: 'Low-mid' },
  { value: 'mid', label: 'Mid' },
  { value: 'highMid', label: 'High-mid' },
  { value: 'high', label: 'High' },
]

const TRIGGER_HINTS: Record<LaserDmxShowDirectorTriggerMode, string> = {
  alwaysOn: 'Runs continuously. Good for haze, gentle washes, and layout previews when no track is loaded.',
  beat: 'Pulses on the selected beat division using BPM, beat index, and beat phase.',
  bar: 'Fires on downbeats. Use Bar interval for every 2, 4, or 8 bars.',
  phrase: 'Fires on phrase boundaries from the Music Intelligence phrase clock.',
  section: 'Stays active only while the current track section matches the selected gate.',
  cuePoint: 'Uses manual/imported cue markers first, then matching drop/section markers from analysis.',
  bassHit: 'Pulses when kick or bass transient strength crosses the hit threshold.',
  snareTransient: 'Pulses on snare-like or mid/high transient hits.',
  energy: 'Fades in when the track energy curve rises above the threshold.',
  audioBand: 'Pulses when the selected audio band crosses the threshold from below.',
}

const SECTION_OPTIONS: Array<{ value: LaserDmxShowDirectorSectionType; label: string }> = [
  { value: 'intro', label: 'Intro' },
  { value: 'verse', label: 'Verse' },
  { value: 'build', label: 'Build' },
  { value: 'drop', label: 'Drop' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'outro', label: 'Outro' },
]

const LED_DIRECTION_OPTIONS: Array<{ value: LaserDmxShowDirectorLedDirection; label: string }> = [
  { value: 'leftToRight', label: 'Left to right' },
  { value: 'rightToLeft', label: 'Right to left' },
  { value: 'centerOut', label: 'Center out' },
  { value: 'edgesIn', label: 'Edges in' },
  { value: 'chase', label: 'Chase' },
]

const MOVING_HEAD_STYLE_OPTIONS: Array<{ value: LaserDmxShowDirectorMovingHeadPanTiltStyle; label: string }> = [
  { value: 'locked', label: 'Locked aim' },
  { value: 'smoothSweep', label: 'Smooth sweep' },
  { value: 'snap', label: 'Snap turns' },
  { value: 'figureEight', label: 'Figure eight' },
  { value: 'audioReactive', label: 'Audio reactive' },
]

const GOBO_PATTERN_OPTIONS: Array<{ value: LaserDmxShowDirectorGoboPattern; label: string }> = [
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

const PRISM_FACET_OPTIONS = [
  { value: '1', label: 'Open / single image' },
  { value: '3', label: '3-facet prism' },
  { value: '5', label: '5-facet prism' },
]

const VIDEO_WALL_SOURCE_OPTIONS: Array<{ value: LaserDmxShowDirectorVideoWallSource; label: string }> = [
  { value: 'placeholder', label: 'Procedural fallback' },
  { value: 'reactVisual', label: 'React visual' },
  { value: 'media', label: 'Media' },
  { value: 'camera', label: 'Camera' },
]

const BEAM_FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser',
  'movingHead',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'parWash',
])

type LaserDmxShowDirectorInspectorMode = 'simple' | 'advanced'

const SHOW_DIRECTOR_INSPECTOR_MODE_STORAGE_KEY = 'drmvyz.showDirector.inspectorMode'

function readShowDirectorInspectorModePreference(): LaserDmxShowDirectorInspectorMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const stored = window.localStorage.getItem(SHOW_DIRECTOR_INSPECTOR_MODE_STORAGE_KEY)
    return stored === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

function persistShowDirectorInspectorModePreference(mode: LaserDmxShowDirectorInspectorMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SHOW_DIRECTOR_INSPECTOR_MODE_STORAGE_KEY, mode)
  } catch {
    // Local storage is optional; losing this preference must never touch fixture data.
  }
}

function sharedRecipeForFixtures(fixtures: LaserDmxShowDirectorFixture[]): LaserDmxShowDirectorTriggerRecipe | 'mixed' | null {
  if (fixtures.length === 0) return null
  const firstRecipe = recipeForTriggerConfig(fixtures[0].trigger)
  return fixtures.every(fixture => recipeForTriggerConfig(fixture.trigger) === firstRecipe) ? firstRecipe : 'mixed'
}

function isBeamFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return BEAM_FIXTURE_KINDS.has(fixture.kind)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function defaultEndpointForFixture(fixture: LaserDmxShowDirectorFixture, maxX: number, maxY: number, snapEnabled: boolean): { x: number; y: number } {
  const distance = Math.max(2, Math.min(maxX + 1, maxY + 1) * 0.32)
  const radians = (finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)) * Math.PI / 180
  const rawX = clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, maxX)
  const rawY = clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, maxY)
  return {
    x: snapEnabled ? Math.round(rawX) : Math.round(rawX * 1000) / 1000,
    y: snapEnabled ? Math.round(rawY) : Math.round(rawY * 1000) / 1000,
  }
}

function snapEndpointPoint(point: { x: number; y: number }, maxX: number, maxY: number, snapEnabled: boolean): { x: number; y: number } {
  const x = snapEnabled ? Math.round(point.x) : Math.round(point.x * 1000) / 1000
  const y = snapEnabled ? Math.round(point.y) : Math.round(point.y * 1000) / 1000
  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY),
  }
}

function beamTargetsForFixture(
  fixture: LaserDmxShowDirectorFixture,
  maxX: number,
  maxY: number,
  snapEnabled: boolean,
): LaserDmxShowDirectorBeamTarget[] {
  const fallback = defaultEndpointForFixture(fixture, maxX, maxY, snapEnabled)
  const primary = snapEndpointPoint({
    x: finite(fixture.beam?.targetX, fallback.x),
    y: finite(fixture.beam?.targetY, fallback.y),
  }, maxX, maxY, snapEnabled)
  const rawTargets = Array.isArray(fixture.beam?.targets) ? fixture.beam.targets : []
  const targets = rawTargets
    .filter((target): target is LaserDmxShowDirectorBeamTarget => target != null && typeof target === 'object')
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index) => ({
      ...target,
      id: typeof target.id === 'string' && target.id.trim().length > 0 ? target.id : `${fixture.id}-target-${index + 1}`,
      ...snapEndpointPoint({ x: finite(target.x, primary.x), y: finite(target.y, primary.y) }, maxX, maxY, snapEnabled),
    }))

  if (targets.length === 0) return [{ id: `${fixture.id}-target-1`, ...primary }]
  return [{ ...targets[0], ...primary }, ...targets.slice(1)]
}

function colorInputValue(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#4ac7db'
}

function compactGroupLabel(label: string): string {
  return label.trim().slice(0, 48)
}

function beatDivisionValue(value: LaserDmxShowDirectorBeatDivision): string {
  return String(value)
}

function parseBeatDivision(value: string): LaserDmxShowDirectorBeatDivision {
  const numeric = Number(value)
  if (numeric === 0.25 || numeric === 0.5 || numeric === 2 || numeric === 4 || numeric === 8) return numeric
  return 1
}

function firstSection(fixture: LaserDmxShowDirectorFixture): LaserDmxShowDirectorSectionType {
  return fixture.trigger.sectionTypes[0] ?? 'drop'
}

function triggerRequirementNotes(fixture: LaserDmxShowDirectorFixture): string[] {
  const notes: string[] = []
  switch (fixture.trigger.mode) {
    case 'beat':
    case 'bar':
    case 'phrase':
      notes.push('Requires BPM/beat analysis during playback. The editor still works without a loaded track.')
      break
    case 'section':
      notes.push('Requires analyzed or manually edited track sections. Use Always On or Beat for a safe fallback when no sections exist.')
      break
    case 'cuePoint':
      notes.push('Requires cue markers or matching analyzed drop/section markers. Enter a cue ID to target a specific marker.')
      if (fixture.trigger.cuePointIds.length === 0) notes.push('No cue point ID is set yet; this trigger will listen for generic drop/cue markers only.')
      break
    case 'bassHit':
    case 'snareTransient':
    case 'audioBand':
      notes.push('Requires live audio band/transient data. In silent preview this trigger may stay idle.')
      break
    case 'energy':
      notes.push('Requires the Music Intelligence energy curve. If no curve is available, the fixture will not force itself on.')
      break
    case 'alwaysOn':
    default:
      break
  }
  return notes
}

export function LaserDmxShowDirectorInspector({ fixture }: LaserDmxShowDirectorInspectorProps) {
  const {
    fixtures,
    groups,
    selectedFixtureIds,
    settings,
    updateFixture,
    deleteFixture,
    duplicateFixture,
    deleteSelectedFixtures,
    duplicateSelectedFixtures,
    groupSelectedFixtures,
    ungroupSelectedFixtures,
    renameGroup,
    duplicateGroup,
  } = useReactStore(useShallow(s => ({
    fixtures:                  s.laserDmxShowDirector.fixtures,
    groups:                    s.laserDmxShowDirector.groups,
    selectedFixtureIds:        s.laserDmxShowDirector.selectedFixtureIds,
    settings:                  s.laserDmxShowDirector.settings,
    updateFixture:             s.updateLaserDmxShowDirectorFixture,
    deleteFixture:             s.deleteLaserDmxShowDirectorFixture,
    duplicateFixture:          s.duplicateLaserDmxShowDirectorFixture,
    deleteSelectedFixtures:    s.deleteSelectedLaserDmxShowDirectorFixtures,
    duplicateSelectedFixtures: s.duplicateSelectedLaserDmxShowDirectorFixtures,
    groupSelectedFixtures:     s.groupSelectedLaserDmxShowDirectorFixtures,
    ungroupSelectedFixtures:   s.ungroupSelectedLaserDmxShowDirectorFixtures,
    renameGroup:               s.renameLaserDmxShowDirectorGroup,
    duplicateGroup:            s.duplicateLaserDmxShowDirectorGroup,
  })))
  const [draftLabel, setDraftLabel] = useState('')
  const [draftGroupLabel, setDraftGroupLabel] = useState('')
  const [inspectorMode, setInspectorMode] = useState<LaserDmxShowDirectorInspectorMode>(() => readShowDirectorInspectorModePreference())
  const [scannerMigrationPreview, setScannerMigrationPreview] = useState<LaserDmxScannerMigrationPreview | null>(null)

  useEffect(() => {
    setDraftLabel(fixture?.label ?? '')
    setScannerMigrationPreview(null)
  }, [fixture?.id, fixture?.label])

  useEffect(() => {
    persistShowDirectorInspectorModePreference(inspectorMode)
  }, [inspectorMode])

  const showAdvanced = inspectorMode === 'advanced'
  const renderInspectorModeToggle = () => (
    <div className="rv-show-director-mode-toggle" role="group" aria-label="Show Director inspector mode">
      <button
        type="button"
        className={`rv-show-director-mode-toggle__button${!showAdvanced ? ' rv-show-director-mode-toggle__button--active' : ''}`}
        onClick={() => setInspectorMode('simple')}
        aria-pressed={!showAdvanced}
      >
        Simple
      </button>
      <button
        type="button"
        className={`rv-show-director-mode-toggle__button${showAdvanced ? ' rv-show-director-mode-toggle__button--active' : ''}`}
        onClick={() => setInspectorMode('advanced')}
        aria-pressed={showAdvanced}
      >
        Advanced
      </button>
    </div>
  )

  const gridBounds = useMemo(() => ({
    maxX: Math.max(0, settings.gridSize.columns - 1),
    maxY: Math.max(0, settings.gridSize.rows - 1),
  }), [settings.gridSize.columns, settings.gridSize.rows])

  const selectedFixtures = useMemo(() => {
    const selectedSet = new Set(selectedFixtureIds)
    return fixtures.filter(item => selectedSet.has(item.id))
  }, [fixtures, selectedFixtureIds])
  const selectedCount = selectedFixtures.length
  const selectedTriggerRecipe = useMemo(() => sharedRecipeForFixtures(selectedFixtures), [selectedFixtures])
  const bulkTriggerRecipeOptions = useMemo(() => (selectedTriggerRecipe === 'mixed'
    ? [{ value: 'mixed', label: 'Mixed recipes', disabled: true }, ...TRIGGER_RECIPE_OPTIONS]
    : TRIGGER_RECIPE_OPTIONS), [selectedTriggerRecipe])
  const bulkTriggerRecipeValue = selectedTriggerRecipe === 'mixed' || selectedTriggerRecipe == null ? 'mixed' : selectedTriggerRecipe
  const groupsById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups])
  const selectedGroupIds = useMemo(() => Array.from(new Set(selectedFixtures.flatMap(item => item.groupId ? [item.groupId] : []))), [selectedFixtures])
  const sharedGroupId = selectedCount > 1 && selectedGroupIds.length === 1 && selectedFixtures.every(item => item.groupId === selectedGroupIds[0])
    ? selectedGroupIds[0]
    : null
  const sharedGroup = sharedGroupId ? groupsById.get(sharedGroupId) ?? null : null
  const fixtureGroup = fixture?.groupId ? groupsById.get(fixture.groupId) ?? null : null

  useEffect(() => {
    setDraftGroupLabel(sharedGroup?.label ?? '')
  }, [sharedGroup?.id, sharedGroup?.label])

  const updateSelectedFixtures = (patch: Parameters<typeof updateFixture>[1]) => {
    selectedFixtures.forEach(item => updateFixture(item.id, patch))
  }

  const applyTriggerRecipeToSelectedFixtures = (recipe: LaserDmxShowDirectorTriggerRecipe) => {
    selectedFixtures.forEach(item => updateFixture(item.id, { trigger: triggerPatchForRecipe(recipe) }))
  }

  const applyRecommendedTriggerRecipesToSelectedFixtures = () => {
    selectedFixtures.forEach(item => updateFixture(item.id, { trigger: triggerPatchForRecipe(RECOMMENDED_TRIGGER_RECIPE_BY_KIND[item.kind]) }))
  }

  const commitBulkGroupDraft = () => {
    if (!sharedGroupId || !sharedGroup) return
    const nextLabel = compactGroupLabel(draftGroupLabel) || sharedGroup.label
    setDraftGroupLabel(nextLabel)
    if (nextLabel !== sharedGroup.label) renameGroup(sharedGroupId, nextLabel)
  }

  if (selectedCount > 1) {
    return (
      <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director bulk fixture inspector">
        <div className="rv-show-director-panel__header rv-show-director-inspector__header">
          <div>
            <span className="rv-show-director-kicker">Inspector</span>
            <h4>Multi-select</h4>
            <p>{selectedCount} lighting components selected for bulk actions.</p>
          </div>
        </div>

        <div className="rv-show-director-inspector__body">
          {renderInspectorModeToggle()}
          <CtrlSection label="Selected Fixtures" />
          <div className="rv-show-director-readout-grid">
            <div><span>Selected</span><strong>{selectedCount}</strong></div>
            <div><span>Primary</span><strong>{fixture?.label ?? selectedFixtures[0]?.label ?? 'None'}</strong></div>
          </div>

          <CtrlSection label="Bulk Trigger Recipe" />
          <SelectRow
            label="Trigger Recipe"
            value={bulkTriggerRecipeValue}
            options={bulkTriggerRecipeOptions}
            onChange={recipe => applyTriggerRecipeToSelectedFixtures(recipe as LaserDmxShowDirectorTriggerRecipe)}
          />
          <p className="rv-show-director-trigger-hint">
            Apply one DJ-facing timing recipe to all selected fixtures. Use the recommended button to let each fixture type pick its best starter recipe.
          </p>
          {sharedGroup ? (
            <>
              <div className="rv-show-director-readout-grid">
                <div><span>Group</span><strong>{sharedGroup.label}</strong></div>
                <div><span>Members</span><strong>{fixtures.filter(item => item.groupId === sharedGroup.id).length}</strong></div>
              </div>
              <TextInputRow label="Group name" value={draftGroupLabel} maxLength={48} onChange={setDraftGroupLabel} onBlur={commitBulkGroupDraft} />
            </>
          ) : (
            <p className="rv-show-director-trigger-hint">
              Group selected fixtures from the canvas context menu or use the button below. Mixed groups stay separate until you regroup them.
            </p>
          )}

          <div className="rv-show-director-inspector__actions">
            <button type="button" className="rv-glyph-upload-btn" onClick={() => updateSelectedFixtures({ enabled: true })}>Enable Selected</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => updateSelectedFixtures({ enabled: false })}>Disable Selected</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={applyRecommendedTriggerRecipesToSelectedFixtures}>Recommended Recipes</button>
            {!sharedGroup && <button type="button" className="rv-glyph-upload-btn" onClick={() => groupSelectedFixtures()}>Group Selected</button>}
            {sharedGroup && <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateGroup(sharedGroup.id)}>Duplicate Group</button>}
            {selectedGroupIds.length > 0 && <button type="button" className="rv-glyph-upload-btn" onClick={ungroupSelectedFixtures}>Ungroup</button>}
            <button type="button" className="rv-glyph-upload-btn" onClick={duplicateSelectedFixtures}>Duplicate Selected</button>
            <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={deleteSelectedFixtures}>Delete Selected</button>
          </div>
        </div>
      </aside>
    )
  }

  if (!fixture) {
    return (
      <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
        <div className="rv-show-director-panel__header">
          <span className="rv-show-director-kicker">Inspector</span>
          <h4>No Fixture Selected</h4>
          <p>Select a fixture to edit beam, color, and timing, plus transform, fades, and fixture-specific parameters.</p>
        </div>
        <div className="rv-show-director-empty">
          <strong>Select a fixture to edit beam, color, and timing</strong>
          <span>Drag a light component onto the Show Director canvas, then click it to open its production controls.</span>
        </div>
      </aside>
    )
  }

  const typeLabel = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
  const supportsBeam = isBeamFixture(fixture)
  const triggerNotes = triggerRequirementNotes(fixture)
  const beamTargets = beamTargetsForFixture(fixture, gridBounds.maxX, gridBounds.maxY, settings.snapEnabled)
  const primaryBeamTarget = beamTargets[0] ?? defaultEndpointForFixture(fixture, gridBounds.maxX, gridBounds.maxY, settings.snapEnabled)
  const defaultTargetX = primaryBeamTarget.x
  const defaultTargetY = primaryBeamTarget.y
  const endpointSummary = supportsBeam
    ? `${beamTargets.length} ${beamTargets.length === 1 ? 'ray' : 'rays'} aimed · primary ${defaultTargetX}, ${defaultTargetY}`
    : `No beam endpoint needed for ${typeLabel}`
  const triggerRecipe = recipeForTriggerConfig(fixture.trigger)
  const recommendedTriggerRecipe = RECOMMENDED_TRIGGER_RECIPE_BY_KIND[fixture.kind]
  const recommendedTriggerRecipeLabel = triggerRecipeLabel(recommendedTriggerRecipe)
  const fixtureIndex = fixtures.findIndex(item => item.id === fixture.id)
  const defaultFixtureLabel = `${typeLabel} ${Math.max(1, fixtureIndex + 1)}`
  const update = (patch: Parameters<typeof updateFixture>[1]) => updateFixture(fixture.id, patch)
  const scanner = fixture.kind === 'laser'
    ? applyLaserDmxScannerRuntimeOverrides(
      fixture.scanner ?? createLaserDmxScannerPattern(fixture, 'holdBeam', settings.gridSize),
      undefined,
    )
    : null
  const commitScanner = (nextScanner: LaserDmxShowDirectorScannerConfig) => {
    const targets = scannerPointsToBeamTargets(nextScanner)
    const primary = targets[0]
    update({
      scanner: nextScanner,
      beam: {
        targets,
        ...(primary ? { targetX: primary.x, targetY: primary.y, targetZ: primary.z } : {}),
      },
    })
  }
  const changeScannerPattern = (patternType: LaserDmxShowDirectorScannerPatternType) => {
    const next = createLaserDmxScannerPattern(fixture, patternType, settings.gridSize)
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
    if (!scanner) return
    commitScanner({ ...scanner, ...patch })
  }
  const patchScannerPath = (patch: Partial<LaserDmxShowDirectorScannerConfig['path']>) => {
    if (!scanner) return
    commitScanner({ ...scanner, path: { ...scanner.path, ...patch } })
  }
  const patchScannerOptics = (patch: Partial<LaserDmxShowDirectorScannerConfig['optics']>) => {
    if (!scanner) return
    commitScanner({ ...scanner, optics: { ...scanner.optics, ...patch } })
  }
  const patchScannerAdvanced = (patch: Partial<LaserDmxShowDirectorScannerConfig['advanced']>) => {
    if (!scanner) return
    commitScanner({ ...scanner, advanced: { ...scanner.advanced, ...patch } })
  }
  const updatePrimaryBeamTarget = (point: Partial<Pick<LaserDmxShowDirectorBeamTarget, 'x' | 'y'>>) => {
    const nextPrimary = snapEndpointPoint({
      x: point.x ?? primaryBeamTarget.x,
      y: point.y ?? primaryBeamTarget.y,
    }, gridBounds.maxX, gridBounds.maxY, settings.snapEnabled)
    const nextTargets = [
      { ...primaryBeamTarget, ...nextPrimary },
      ...beamTargets.slice(1),
    ].slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    update({
      beam: {
        targetX: nextPrimary.x,
        targetY: nextPrimary.y,
        targets: nextTargets,
      },
    })
  }
  const commitLabelDraft = () => {
    const trimmed = draftLabel.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : defaultFixtureLabel
    setDraftLabel(nextLabel)
    if (nextLabel !== fixture.label) update({ label: nextLabel })
  }
  const handleLabelDraftChange = (label: string) => {
    setDraftLabel(label)
    if (label.trim().length > 0 && label !== fixture.label) update({ label })
  }
  const updateTriggerMode = (mode: LaserDmxShowDirectorTriggerMode) => {
    update({
      trigger: {
        mode,
        ...(mode === 'bassHit' ? { audioBand: 'bass' as const, audioThreshold: fixture.trigger.audioThreshold || 0.65 } : {}),
        ...(mode === 'snareTransient' ? { audioBand: 'highMid' as const, audioThreshold: fixture.trigger.audioThreshold || 0.58 } : {}),
        ...(mode === 'audioBand' ? { audioBand: fixture.trigger.audioBand ?? 'bass', audioThreshold: fixture.trigger.audioThreshold || 0.5 } : {}),
      },
    })
  }

  const scannerIssues = scanner ? validateLaserDmxScannerConfig(fixture, scanner, settings.gridSize) : []
  const scannerDiagnostics = scanner ? createLaserDmxScannerDiagnosticsSummary(fixture, scanner, settings.gridSize) : null
  const scannerWarningsVisible = settings.presentationMode === 'edit' || settings.presentationMode === 'hybrid'

  return (
    <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
      <div className="rv-show-director-panel__header rv-show-director-inspector__header">
        <div>
          <span className="rv-show-director-kicker">Inspector</span>
          <h4>{fixture.label}</h4>
          <p>{typeLabel} · {fixture.enabled ? 'Enabled' : 'Disabled'} · {fixtureGroup?.label ?? fixture.groupId ?? 'No group'}</p>
        </div>
        <span
          className="rv-show-director-inspector__fixture-icon"
          style={{ '--fixture-color': fixture.color } as CSSProperties}
          aria-hidden="true"
        >
          <LaserDmxShowDirectorFixtureIcon kind={fixture.kind} color={fixture.color} />
        </span>
      </div>

      <div className="rv-show-director-inspector__body">
        {renderInspectorModeToggle()}
        {!showAdvanced ? (
          <>
            <CtrlSection label="DJ Controls" />
            <ToggleRow label="On / off" value={fixture.enabled} onChange={enabled => update({ enabled })} />
            <TextInputRow label="Name" value={draftLabel} maxLength={48} onChange={handleLabelDraftChange} onBlur={commitLabelDraft} />
            <label className="rv-show-director-color-field">
              <span className="rv-ctrl-label">Color</span>
              <input type="color" value={colorInputValue(fixture.color)} onChange={event => update({ color: event.target.value, colorMode: 'fixed' })} />
              <span>{colorInputValue(fixture.color).toUpperCase()}</span>
            </label>
            <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => update({ brightness: clamp(brightness, 0, 1) })} />

            <CtrlSection label="Aim" />
            <div className="rv-show-director-readout-grid">
              <div><span>Endpoint</span><strong>{endpointSummary}</strong></div>
              <div><span>Beam</span><strong>{supportsBeam ? (fixture.beam.beamEnabled ? 'On' : 'Off') : 'Not needed'}</strong></div>
            </div>
            <p className="rv-show-director-trigger-hint">
              Right-click the fixture on the grid and choose Set Endpoint to aim it visually. Switch to Advanced for exact X/Y numbers.
            </p>

            {fixture.kind === 'laser' && scanner && (
              <>
                <CtrlSection label="Scanner" />
                <SelectRow label="Pattern" value={scanner.patternType} options={LASER_DMX_SCANNER_PATTERN_OPTIONS} onChange={value => changeScannerPattern(value as LaserDmxShowDirectorScannerPatternType)} />
                <div className="rv-show-director-field-grid">
                  <NumberInputRow label="Scan rate" value={scanner.scanRatePps} min={10} max={100000} step={100} unit="pps" onChange={scanRatePps => patchScanner({ scanRatePps })} />
                  <NumberInputRow label="Duration" value={scanner.durationBeats} min={0.0625} max={128} step={0.25} unit="beats" onChange={durationBeats => patchScanner({ durationBeats })} />
                </div>
                <SelectRow label="Direction" value={scanner.direction} options={SCANNER_DIRECTION_OPTIONS} onChange={direction => patchScanner({ direction: direction as LaserDmxShowDirectorScannerDirection })} />
                {!fixture.scanner && scannerWarningsVisible && (
                  <button type="button" className="rv-glyph-upload-btn" onClick={() => setScannerMigrationPreview(previewLaserDmxLegacyScannerMigration(fixture, settings.gridSize))}>Preview Legacy Conversion</button>
                )}
                {scannerMigrationPreview && !fixture.scanner && scannerWarningsVisible && (
                  <div className="rv-show-director-trigger-notes" role="status">
                    <span>{scannerMigrationPreview.classification} · {Math.round(scannerMigrationPreview.confidence * 100)}% confidence</span>
                    <ScannerMigrationPreviewDiagram preview={scannerMigrationPreview} columns={settings.gridSize.columns} rows={settings.gridSize.rows} />
                    <span>{scannerMigrationPreview.visibleSegmentCount} visible · {scannerMigrationPreview.blankedSegmentCount} blanked segments</span>
                    {scannerMigrationPreview.ambiguous && <span>Review required: conversion is ambiguous.</span>}
                    {scannerMigrationPreview.warnings.map(warning => <span key={warning}>{warning}</span>)}
                    <button type="button" className="rv-glyph-upload-btn" onClick={() => {
                      commitScanner({ ...scannerMigrationPreview.scanner, migration: { ...scannerMigrationPreview.scanner.migration, status: 'migrated' } })
                      setScannerMigrationPreview(null)
                    }}>Apply Conversion</button>
                  </div>
                )}
              </>
            )}

            <CtrlSection label="Trigger Recipe" />
            <SelectRow
              label="Recipe"
              value={triggerRecipe}
              options={TRIGGER_RECIPE_OPTIONS}
              onChange={recipe => update({ trigger: triggerPatchForRecipe(recipe as LaserDmxShowDirectorTriggerRecipe) })}
            />
            <p className="rv-show-director-trigger-hint">{TRIGGER_RECIPE_HINTS[triggerRecipe]}</p>
            {triggerRecipe !== recommendedTriggerRecipe && (
              <button
                type="button"
                className="rv-glyph-upload-btn rv-show-director-recommended-recipe-btn"
                onClick={() => update({ trigger: triggerPatchForRecipe(recommendedTriggerRecipe) })}
              >
                Use recommended: {recommendedTriggerRecipeLabel}
              </button>
            )}

            {fixtureGroup && (
              <>
                <CtrlSection label="Group" />
                <div className="rv-show-director-readout-grid">
                  <div><span>Group</span><strong>{fixtureGroup.label}</strong></div>
                  <div><span>Status</span><strong>Grouped</strong></div>
                </div>
              </>
            )}

            <div className="rv-show-director-inspector__actions">
              <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateFixture(fixture.id)}>Duplicate</button>
              <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => deleteFixture(fixture.id)}>Delete</button>
            </div>
          </>
        ) : (
          <>
        <CtrlSection label="Fixture" />
        <div className="rv-show-director-readout-grid">
          <div><span>Type</span><strong>{typeLabel}</strong></div>
          <div><span>ID</span><strong>{fixture.id.slice(0, 8)}</strong></div>
        </div>

        <CtrlSection label="Transform" />
        <SelectRow
          label="Depth layer"
          value={fixture.depthLayer ?? 'auto'}
          options={DEPTH_LAYER_OPTIONS}
          onChange={depthLayer => update({ depthLayer: depthLayer as LaserDmxShowDirectorDepthLayer })}
        />
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="Position X" value={fixture.x} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.01} onChange={x => update({ x: clamp(x, 0, gridBounds.maxX) })} />
          <NumberInputRow label="Position Y" value={fixture.y} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.01} onChange={y => update({ y: clamp(y, 0, gridBounds.maxY) })} />
          <NumberInputRow label="Depth / Z" value={fixture.z} min={-1} max={1} step={0.01} onChange={z => update({ z: clamp(z, -1, 1) })} />
          <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => update({ rotation: clamp(rotation, -360, 360) })} />
        </div>
        <p className="rv-show-director-trigger-hint">
          Auto assigns an invisible air layer from the fixture role and beam pattern. The 2D editor stays front-facing; Z is an optional advanced override.
        </p>

        <CtrlSection label="Light" />
        <ToggleRow label="Enabled / active" value={fixture.enabled} onChange={enabled => update({ enabled })} />
        <TextInputRow label="Label / name" value={draftLabel} maxLength={48} onChange={handleLabelDraftChange} onBlur={commitLabelDraft} />
        <TextInputRow label="Group" value={fixtureGroup?.label ?? fixture.groupId ?? ''} maxLength={48} placeholder="Ungrouped" onChange={group => update({ groupId: group.trim() ? group.trim() : null })} />
        <SelectRow label="Color mode" value={fixture.colorMode} options={COLOR_MODE_OPTIONS} onChange={colorMode => update({ colorMode: colorMode as LaserDmxShowDirectorColorMode })} />
        <label className="rv-show-director-color-field">
          <span className="rv-ctrl-label">Color</span>
          <input type="color" value={colorInputValue(fixture.color)} onChange={event => update({ color: event.target.value })} />
          <span>{colorInputValue(fixture.color).toUpperCase()}</span>
        </label>
        <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => update({ brightness: clamp(brightness, 0, 1) })} />

        {supportsBeam && (
          <>
            <CtrlSection label="Beam" />
            <ToggleRow label="Beam enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => update({ beam: { beamEnabled } })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Beam angle" value={fixture.beam.beamAngle} min={-360} max={360} step={1} unit="°" onChange={beamAngle => update({ beam: { beamAngle: clamp(beamAngle, -360, 360) } })} />
              <NumberInputRow label="Beam spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} unit="°" onChange={beamSpread => update({ beam: { beamSpread: clamp(beamSpread, 0, 180) } })} />
            </div>
            <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => update({ beam: { focus: clamp(focus, 0, 1) } })} />
            <SelectRow label="Target mode" value={fixture.beam.targetMode} options={BEAM_TARGET_OPTIONS} onChange={targetMode => update({ beam: { targetMode: targetMode as LaserDmxShowDirectorBeamTargetMode } })} />
            <SelectRow
              label="Target depth"
              value={fixture.beam.targetDepthLayer ?? 'auto'}
              options={DEPTH_LAYER_OPTIONS}
              onChange={targetDepthLayer => update({ beam: { targetDepthLayer: targetDepthLayer as LaserDmxShowDirectorDepthLayer } })}
            />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Target X" value={defaultTargetX} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.01} onChange={targetX => updatePrimaryBeamTarget({ x: clamp(targetX, 0, gridBounds.maxX) })} />
              <NumberInputRow label="Target Y" value={defaultTargetY} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.01} onChange={targetY => updatePrimaryBeamTarget({ y: clamp(targetY, 0, gridBounds.maxY) })} />
            </div>
            {beamTargets.length > 1 && (
              <p className="rv-show-director-trigger-hint">
                {beamTargets.length} beam endpoints are active. Target X/Y edits the primary ray; drag the endpoint dots on the canvas to shape the rest.
              </p>
            )}
          </>
        )}

        {fixture.kind === 'laser' && scanner && (
          <>
            <CtrlSection label="Scanner Pattern" />
            <SelectRow
              label="Pattern type"
              value={scanner.patternType}
              options={LASER_DMX_SCANNER_PATTERN_OPTIONS}
              onChange={value => changeScannerPattern(value as LaserDmxShowDirectorScannerPatternType)}
              description="Normal scanner patterns are one ordered beam path. Permanent copies require explicit optics or multiple apertures."
            />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Scan rate" value={scanner.scanRatePps} min={10} max={100000} step={100} unit="pps" onChange={scanRatePps => patchScanner({ scanRatePps })} />
              <NumberInputRow label="Duration" value={scanner.durationBeats} min={0.0625} max={128} step={0.25} unit="beats" onChange={durationBeats => patchScanner({ durationBeats })} />
            </div>
            <SelectRow label="Direction" value={scanner.direction} options={SCANNER_DIRECTION_OPTIONS} onChange={direction => patchScanner({ direction: direction as LaserDmxShowDirectorScannerDirection })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Phase" value={scanner.phase} min={0} max={1} step={0.01} onChange={phase => patchScanner({ phase: clamp(phase, 0, 1) })} />
              <NumberInputRow label="Pattern size" value={scanner.size} min={0} max={1} step={0.01} onChange={size => scanner && commitScanner(updateLaserDmxScannerPatternGeometry(scanner, fixture, settings.gridSize, { size: clamp(size, 0, 1) }))} />
              <NumberInputRow label="Fan width" value={scanner.fanWidth} min={0} max={180} step={1} unit="°" onChange={fanWidth => scanner && commitScanner(updateLaserDmxScannerPatternGeometry(scanner, fixture, settings.gridSize, { fanWidth }))} />
              <NumberInputRow label="Radius" value={scanner.radius} min={0} max={1} step={0.01} onChange={radius => scanner && commitScanner(updateLaserDmxScannerPatternGeometry(scanner, fixture, settings.gridSize, { radius: clamp(radius, 0, 1) }))} />
            </div>
            <SelectRow label="Depth layer" value={scanner.depthLayer} options={DEPTH_LAYER_OPTIONS} onChange={depthLayer => patchScanner({ depthLayer: depthLayer as LaserDmxShowDirectorDepthLayer })} />
            <ToggleRow label="Scanner shutter closed" value={scanner.shutterClosed} onChange={shutterClosed => patchScanner({ shutterClosed })} />

            {showAdvanced && (
              <>
                <CtrlSection label="Scanner Path" />
                <div className="rv-show-director-field-grid">
                  <SelectRow label="Playback" value={scanner.path.repeatMode} options={SCANNER_REPEAT_OPTIONS} onChange={repeatMode => patchScannerPath({ repeatMode: repeatMode as LaserDmxShowDirectorScannerRepeatMode })} />
                  <SelectRow label="Interpolation" value={scanner.path.interpolation} options={SCANNER_INTERPOLATION_OPTIONS} onChange={interpolation => patchScannerPath({ interpolation: interpolation as LaserDmxShowDirectorScannerInterpolation })} />
                </div>
                <ToggleRow label="Closed path" value={scanner.path.closed} onChange={closed => patchScannerPath({ closed })} />
                <ToggleRow label="Blank retrace" value={scanner.path.retraceBlanking} onChange={retraceBlanking => patchScannerPath({ retraceBlanking })} />
                <div className="rv-show-director-field-grid">
                  <NumberInputRow label="Point dwell" value={scanner.path.pointDwellMicros} min={0} max={1000000} step={1} unit="µs" onChange={pointDwellMicros => patchScannerPath({ pointDwellMicros })} />
                  <NumberInputRow label="Corner dwell" value={scanner.path.cornerDwellMicros} min={0} max={1000000} step={1} unit="µs" onChange={cornerDwellMicros => patchScannerPath({ cornerDwellMicros })} />
                  <NumberInputRow label="Blanking delay" value={scanner.path.blankingDelayMicros} min={0} max={100000} step={1} unit="µs" onChange={blankingDelayMicros => patchScannerPath({ blankingDelayMicros })} />
                </div>
                <div className="rv-show-director-inspector__actions">
                  <button type="button" className="rv-glyph-upload-btn" onClick={() => commitScanner(reverseLaserDmxScannerPath(scanner))}>Reverse Path</button>
                  <button type="button" className="rv-glyph-upload-btn" onClick={() => commitScanner(insertLaserDmxScannerPoint(scanner, fixture.id))}>Add Point</button>
                  <button type="button" className="rv-glyph-upload-btn" onClick={() => patchScanner({ pathResetToken: scanner.pathResetToken + 1 })}>Reset Path</button>
                </div>
                <div className="rv-show-director-scanner-points" aria-label="Ordered scanner path points">
                  {scanner.path.points.map((point, index) => (
                    <div className="rv-show-director-scanner-point" key={point.id}>
                      <strong>#{index + 1}</strong>
                      <input aria-label={`Point ${index + 1} X`} type="number" value={point.x} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.01} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { x: clamp(finite(event.target.value, point.x), 0, gridBounds.maxX) }))} />
                      <input aria-label={`Point ${index + 1} Y`} type="number" value={point.y} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.01} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { y: clamp(finite(event.target.value, point.y), 0, gridBounds.maxY) }))} />
                      <label><input type="checkbox" checked={point.blanked} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { blanked: event.target.checked }))} /> Blank</label>
                      <button type="button" onClick={() => commitScanner(reorderLaserDmxScannerPoint(scanner, point.id, -1))} disabled={index === 0} aria-label={`Move point ${index + 1} earlier`}>↑</button>
                      <button type="button" onClick={() => commitScanner(reorderLaserDmxScannerPoint(scanner, point.id, 1))} disabled={index === scanner.path.points.length - 1} aria-label={`Move point ${index + 1} later`}>↓</button>
                      <button type="button" onClick={() => commitScanner(removeLaserDmxScannerPoint(scanner, point.id))} disabled={scanner.path.points.length <= 1} aria-label={`Remove point ${index + 1}`}>×</button>
                      <div className="rv-show-director-scanner-point__overrides">
                        <label>Dwell <input aria-label={`Point ${index + 1} dwell`} type="number" value={point.dwellMicros} min={0} max={1000000} step={1} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { dwellMicros: clamp(finite(event.target.value, point.dwellMicros), 0, 1000000) }))} /></label>
                        <label>Corner <input aria-label={`Point ${index + 1} corner dwell`} type="number" value={point.cornerDwellMicros ?? scanner.path.cornerDwellMicros} min={0} max={1000000} step={1} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { cornerDwellMicros: clamp(finite(event.target.value, scanner.path.cornerDwellMicros), 0, 1000000) }))} /></label>
                        <label>Depth <DropdownSelect aria-label={`Point ${index + 1} depth layer`} value={point.depthLayer ?? scanner.depthLayer} onChange={event => commitScanner(updateLaserDmxScannerPoint(scanner, point.id, { depthLayer: event.target.value as LaserDmxShowDirectorDepthLayer }))}>{DEPTH_LAYER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
                      </div>
                    </div>
                  ))}
                </div>

                <CtrlSection label="Scanner Optics" />
                <SelectRow label="Optical mode" value={scanner.optics.mode} options={SCANNER_OPTICAL_MODE_OPTIONS} onChange={mode => patchScannerOptics({ mode: mode as LaserDmxShowDirectorScannerOpticalMode })} />
                <div className="rv-show-director-field-grid">
                  <NumberInputRow label="Optical copies" value={scanner.optics.copyCount} min={1} max={25} step={1} onChange={copyCount => patchScannerOptics({ copyCount: Math.round(copyCount) })} />
                  <NumberInputRow label="Optical spread" value={scanner.optics.spreadDeg} min={0} max={90} step={1} unit="°" onChange={spreadDeg => patchScannerOptics({ spreadDeg })} />
                  <NumberInputRow label="Apertures" value={scanner.optics.apertureCount} min={1} max={8} step={1} onChange={apertureCount => patchScannerOptics({ apertureCount: Math.round(apertureCount) })} />
                </div>

                <CtrlSection label="Scanner Advanced" />
                <div className="rv-show-director-field-grid">
                  <NumberInputRow label="Max velocity" value={scanner.advanced.maximumVelocity} min={1} max={100000} step={100} onChange={maximumVelocity => patchScannerAdvanced({ maximumVelocity })} />
                  <NumberInputRow label="Max acceleration" value={scanner.advanced.maximumAcceleration} min={1} max={10000000} step={1000} onChange={maximumAcceleration => patchScannerAdvanced({ maximumAcceleration })} />
                  <NumberInputRow label="Exposure" value={scanner.advanced.shutterExposureSeconds * 1000} min={4.1667} max={83.333} step={0.1} unit="ms" onChange={milliseconds => patchScannerAdvanced({ shutterExposureSeconds: milliseconds / 1000 })} />
                </div>
                <TextInputRow label="Calibration profile" value={scanner.advanced.calibrationProfileId} maxLength={96} onChange={calibrationProfileId => patchScannerAdvanced({ calibrationProfileId })} />
              </>
            )}

            {scannerWarningsVisible && scannerDiagnostics && (
              <>
                <CtrlSection label="Scanner Diagnostics" />
                <div className="rv-show-director-readout-grid">
                  <div><span>Pattern</span><strong>{scannerDiagnostics.activePattern}</strong></div>
                  <div><span>Points</span><strong>{scannerDiagnostics.pointCount}</strong></div>
                  <div><span>Visible</span><strong>{scannerDiagnostics.visibleSegmentCount}</strong></div>
                  <div><span>Blanked</span><strong>{scannerDiagnostics.blankedSegmentCount}</strong></div>
                  <div><span>Dwell</span><strong>{scannerDiagnostics.dwellTotalMicros} µs</strong></div>
                  <div><span>Optical copies</span><strong>{scannerDiagnostics.opticalCopyCount}</strong></div>
                  <div><span>Apertures</span><strong>{scannerDiagnostics.apertureCount}</strong></div>
                  <div><span>Compatibility</span><strong>{scannerDiagnostics.compatibilityMode}</strong></div>
                </div>
                {scannerIssues.length > 0 && <div className="rv-show-director-trigger-notes" role="status">{scannerIssues.map(issue => <span key={`${issue.code}:${issue.pointId ?? ''}`}>{issue.severity.toUpperCase()}: {issue.message}</span>)}</div>}
              </>
            )}

            {!fixture.scanner && scannerWarningsVisible && (
              <>
                <CtrlSection label="Legacy Migration" />
                <p className="rv-show-director-trigger-hint">This fixture still uses target endpoints. Previewing does not modify the project; applying is one history transaction and retains a target backup.</p>
                <div className="rv-show-director-inspector__actions">
                  <button type="button" className="rv-glyph-upload-btn" onClick={() => setScannerMigrationPreview(previewLaserDmxLegacyScannerMigration(fixture, settings.gridSize))}>Preview Conversion</button>
                  {scannerMigrationPreview && <button type="button" className="rv-glyph-upload-btn" onClick={() => {
                    const migrated = { ...scannerMigrationPreview.scanner, migration: { ...scannerMigrationPreview.scanner.migration, status: 'migrated' as const } }
                    commitScanner(migrated)
                    setScannerMigrationPreview(null)
                  }}>Apply Conversion</button>}
                </div>
                {scannerMigrationPreview && (
                  <div className="rv-show-director-trigger-notes" role="status">
                    <span>{scannerMigrationPreview.classification} · {Math.round(scannerMigrationPreview.confidence * 100)}% confidence</span>
                    <ScannerMigrationPreviewDiagram preview={scannerMigrationPreview} columns={settings.gridSize.columns} rows={settings.gridSize.rows} />
                    <span>{scannerMigrationPreview.visibleSegmentCount} visible · {scannerMigrationPreview.blankedSegmentCount} blanked segments</span>
                    {scannerMigrationPreview.ambiguous && <span>Review required: conversion is ambiguous.</span>}
                    {scannerMigrationPreview.warnings.map(warning => <span key={warning}>{warning}</span>)}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <CtrlSection label="Optics / Structure" />
        <SelectRow
          label="Primitive"
          value={fixture.optics.primitiveType}
          options={OPTICAL_PRIMITIVE_OPTIONS}
          onChange={primitiveType => update({ optics: { primitiveType: primitiveType as LaserDmxShowDirectorOpticalPrimitiveType } })}
          description="Auto preserves authored endpoints. A named primitive rebuilds them as one coherent professional lighting structure."
        />
        {(supportsBeam || fixture.kind === 'strobe' || fixture.kind === 'blinder' || fixture.kind === 'co2Jet') && (
          <div className="rv-show-director-field-grid">
            <NumberInputRow label="Ray count" value={fixture.optics.rayCount} min={1} max={12} step={1} onChange={rayCount => update({ optics: { rayCount: clamp(Math.round(rayCount), 1, 12) } })} />
            <NumberInputRow label="Fan width" value={fixture.optics.fanWidth} min={0} max={180} step={1} unit="°" onChange={fanWidth => update({ optics: { fanWidth: clamp(fanWidth, 0, 180) } })} />
          </div>
        )}
        <SliderRow label="Optical softness" value={fixture.optics.opticalSoftness} min={0} max={1} step={0.01} onChange={opticalSoftness => update({ optics: { opticalSoftness: clamp(opticalSoftness, 0, 1) } })} />
        <SliderRow label="Source intensity" value={fixture.optics.sourceIntensity} min={0} max={1} step={0.01} onChange={sourceIntensity => update({ optics: { sourceIntensity: clamp(sourceIntensity, 0, 1) } })} />
        <SliderRow label="Atmosphere response" value={fixture.optics.atmosphereResponse} min={0} max={1} step={0.01} onChange={atmosphereResponse => update({ optics: { atmosphereResponse: clamp(atmosphereResponse, 0, 1) } })} />
        {(fixture.kind === 'movingHead' || fixture.kind === 'parWash') && (
          <>
            <SliderRow label="Zoom" value={fixture.optics.zoom} min={0} max={1} step={0.01} onChange={zoom => update({ optics: { zoom: clamp(zoom, 0, 1) } })} />
            <SliderRow label="Iris" value={fixture.optics.iris} min={0} max={1} step={0.01} onChange={iris => update({ optics: { iris: clamp(iris, 0, 1) } })} />
            <SliderRow label="Frost" value={fixture.optics.frost} min={0} max={1} step={0.01} onChange={frost => update({ optics: { frost: clamp(frost, 0, 1) } })} />
          </>
        )}
        {fixture.kind === 'movingHead' && (
          <>
            <SelectRow
              label="Gobo pattern"
              value={fixture.optics.goboPattern}
              options={GOBO_PATTERN_OPTIONS}
              onChange={goboPattern => update({ optics: { goboPattern: goboPattern as LaserDmxShowDirectorGoboPattern } })}
              description="Projects a repository-owned analytic mask through the moving-head cone."
            />
            <SliderRow label="Gobo amount" value={fixture.optics.goboAmount} min={0} max={1} step={0.01} onChange={goboAmount => update({ optics: { goboAmount: clamp(goboAmount, 0, 1) } })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Gobo rotation" value={fixture.optics.goboRotation} min={-360} max={360} step={1} unit="°" onChange={goboRotation => update({ optics: { goboRotation: clamp(goboRotation, -360, 360) } })} />
              <SelectRow label="Prism" value={String(fixture.optics.prismFacets)} options={PRISM_FACET_OPTIONS} onChange={value => update({ optics: { prismFacets: value === '5' ? 5 : value === '3' ? 3 : 1 } })} />
            </div>
            {fixture.optics.prismFacets > 1 && (
              <NumberInputRow label="Prism rotation" value={fixture.optics.prismRotation} min={-360} max={360} step={1} unit="°" onChange={prismRotation => update({ optics: { prismRotation: clamp(prismRotation, -360, 360) } })} />
            )}
          </>
        )}

        <CtrlSection label="Trigger / Timing" />
        <SelectRow label="Trigger mode" value={fixture.trigger.mode} options={TRIGGER_MODE_OPTIONS} onChange={mode => updateTriggerMode(mode as LaserDmxShowDirectorTriggerMode)} />
        <p className="rv-show-director-trigger-hint">{TRIGGER_HINTS[fixture.trigger.mode]}</p>
        {triggerNotes.length > 0 && (
          <div className="rv-show-director-trigger-notes" role="note" aria-label="Show Director timing requirements">
            {triggerNotes.map(note => <span key={note}>{note}</span>)}
          </div>
        )}
        {(fixture.trigger.mode === 'beat' || fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase') && (
          <SelectRow label="Beat division" value={beatDivisionValue(fixture.trigger.beatDivision)} options={BEAT_DIVISION_OPTIONS} onChange={beatDivision => update({ trigger: { beatDivision: parseBeatDivision(beatDivision) } })} />
        )}
        {(fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase') && (
          <div className="rv-show-director-field-grid">
            {fixture.trigger.mode === 'bar' && <NumberInputRow label="Bar interval" value={fixture.trigger.barInterval} min={1} max={64} step={1} onChange={barInterval => update({ trigger: { barInterval: clamp(Math.round(barInterval), 1, 64) } })} />}
            {fixture.trigger.mode === 'phrase' && <NumberInputRow label="Phrase bars" value={fixture.trigger.phraseLengthBars} min={1} max={128} step={1} onChange={phraseLengthBars => update({ trigger: { phraseLengthBars: clamp(Math.round(phraseLengthBars), 1, 128) } })} />}
          </div>
        )}
        {fixture.trigger.mode === 'section' && (
          <SelectRow label="Section" value={firstSection(fixture)} options={SECTION_OPTIONS} onChange={sectionType => update({ trigger: { sectionTypes: [sectionType as LaserDmxShowDirectorSectionType] } })} />
        )}
        {fixture.trigger.mode === 'cuePoint' && (
          <TextInputRow label="Cue point ID" value={fixture.trigger.cuePointIds[0] ?? ''} maxLength={32} placeholder="A, B, Drop 1..." onChange={cuePointId => update({ trigger: { cuePointIds: cuePointId.trim() ? [cuePointId.trim()] : [] } })} />
        )}
        {fixture.trigger.mode === 'audioBand' && (
          <SelectRow label="Audio band" value={fixture.trigger.audioBand} options={AUDIO_BAND_OPTIONS} onChange={audioBand => update({ trigger: { audioBand: audioBand as LaserDmxShowDirectorAudioBand } })} />
        )}
        {(fixture.trigger.mode === 'bassHit' || fixture.trigger.mode === 'snareTransient' || fixture.trigger.mode === 'audioBand') && (
          <SliderRow label={fixture.trigger.mode === 'audioBand' ? 'Band threshold' : 'Hit threshold'} value={fixture.trigger.audioThreshold} min={0} max={1} step={0.01} onChange={audioThreshold => update({ trigger: { audioThreshold: clamp(audioThreshold, 0, 1) } })} />
        )}
        {fixture.trigger.mode === 'energy' && (
          <SliderRow label="Energy threshold" value={fixture.trigger.energyThreshold} min={0} max={1} step={0.01} onChange={energyThreshold => update({ trigger: { energyThreshold: clamp(energyThreshold, 0, 1) } })} />
        )}
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="Fade in" value={fixture.trigger.fadeInMs} min={0} max={10000} step={25} unit="ms" onChange={fadeInMs => update({ trigger: { fadeInMs: clamp(Math.round(fadeInMs), 0, 10000) } })} />
          <NumberInputRow label="Fade out" value={fixture.trigger.fadeOutMs} min={0} max={10000} step={25} unit="ms" onChange={fadeOutMs => update({ trigger: { fadeOutMs: clamp(Math.round(fadeOutMs), 0, 10000) } })} />
        </div>

        {fixture.kind === 'strobe' && (
          <>
            <CtrlSection label="Strobe" />
            <NumberInputRow label="Strobe rate" value={fixture.component.strobeRate} min={0} max={30} step={0.5} unit="Hz" onChange={strobeRate => update({ component: { strobeRate: clamp(strobeRate, 0, 30) } })} />
          </>
        )}

        {(fixture.kind === 'ledBar' || fixture.kind === 'ledTube') && (
          <>
            <CtrlSection label={fixture.kind === 'ledBar' ? 'LED Bar' : 'LED Tube'} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Cell count" value={fixture.component.ledCellCount} min={1} max={64} step={1} onChange={ledCellCount => update({ component: { ledCellCount: clamp(Math.round(ledCellCount), 1, 64) } })} />
              <SelectRow label="Direction" value={fixture.component.ledDirection} options={LED_DIRECTION_OPTIONS} onChange={ledDirection => update({ component: { ledDirection: ledDirection as LaserDmxShowDirectorLedDirection } })} />
            </div>
          </>
        )}

        {fixture.kind === 'movingHead' && (
          <>
            <CtrlSection label="Moving Head" />
            <SelectRow label="Pan / tilt style" value={fixture.component.movingHeadPanTiltStyle} options={MOVING_HEAD_STYLE_OPTIONS} onChange={movingHeadPanTiltStyle => update({ component: { movingHeadPanTiltStyle: movingHeadPanTiltStyle as LaserDmxShowDirectorMovingHeadPanTiltStyle } })} />
          </>
        )}

        {fixture.kind === 'haze' && (
          <>
            <CtrlSection label="Haze" />
            <SliderRow label="Haze intensity" value={fixture.component.hazeIntensity} min={0} max={1} step={0.01} onChange={hazeIntensity => update({ component: { hazeIntensity: clamp(hazeIntensity, 0, 1) } })} />
          </>
        )}

        {fixture.kind === 'co2Jet' && (
          <>
            <CtrlSection label="CO₂ Jet" />
            <NumberInputRow label="Burst duration" value={fixture.component.co2BurstDurationMs} min={50} max={10000} step={50} unit="ms" onChange={co2BurstDurationMs => update({ component: { co2BurstDurationMs: clamp(Math.round(co2BurstDurationMs), 50, 10000) } })} />
          </>
        )}

        {fixture.kind === 'videoWall' && (
          <>
            <CtrlSection label="Video Wall" />
            <SliderRow label="Wall brightness" value={fixture.component.videoWallBrightness} min={0} max={1} step={0.01} onChange={videoWallBrightness => update({ component: { videoWallBrightness: clamp(videoWallBrightness, 0, 1) } })} />
            <SelectRow
              label="Source"
              value={fixture.component.videoWallSource}
              options={VIDEO_WALL_SOURCE_OPTIONS}
              onChange={videoWallSource => update({ component: { videoWallSource: videoWallSource as LaserDmxShowDirectorVideoWallSource } })}
              description="WebGL preserves the authored surface aspect and uses a bounded procedural emissive fallback whenever the selected live source is unavailable."
            />
          </>
        )}

        <div className="rv-show-director-inspector__actions">
          <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateFixture(fixture.id)}>Duplicate</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => deleteFixture(fixture.id)}>Delete</button>
        </div>
          </>
        )}
      </div>
    </aside>
  )
}
