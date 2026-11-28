import { AppIcon } from '../../shared/icons/AppIcon'
import React, { useMemo } from 'react'
import { LaserDmxEnginePanel } from './LaserDmxEnginePanel'
import { CanvasEnginePanel } from './ReactCanvasEngineShell'
import { PixGridEnginePanel } from './pixGrid/PixGridEnginePanel'
import { HeadlinerEnginePanel } from './headliner/HeadlinerWorkspace'
import { XyScopeEnginePanel } from './xyScope/XyScopeWorkspace'
import { Cinema2TextLibraryPanel } from './Cinema2TextLibraryPanel'
import { isCinema2TextPreset } from '../cinema2/text/Cinema2TextConfiguration'
import { Cinema2MediaSourcePanel } from './Cinema2MediaSourcePanel'
import { Cinema2ModelSourcePanel, resolveCinema2SourcePanels } from './Cinema2ModelSourcePanel'
import type { Cinema2Runtime } from '../cinema2'
import { useShallow } from 'zustand/react/shallow'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../stores/reactStore'
import { CtrlSection, Collapsible } from './ReactControlRows'
import { CINEMATIC_WORLD_UI, type CinematicWorldUiDefinition } from './CinematicWorldsUi'
import type { CinematicWorldMode } from './CinematicWorldConfig'
import { resolvePresetCardNavigationIndex } from './ReactPresetCard'
import type { ReactPreset } from './ReactTypes'

const CINEMATIC_WORLD_CATEGORY_ORDER = ['Cosmic', 'Architectural', 'Organic', 'Mechanical', 'Storm', 'Legacy'] as const

function CinematicWorldIcon({ mode }: { mode: CinematicWorldMode }) {
  if (mode === 'eventHorizon') {
    return (
      <AppIcon kind="orbit" />
    )
  }
  if (mode === 'mirrorDimension') {
    return (
      <AppIcon kind="mirror" />
    )
  }
  if (mode === 'reactiveConstellation') {
    return (
      <AppIcon kind="constellation" />
    )
  }
  if (mode === 'infiniteCorridor') {
    return (
      <AppIcon kind="corridor" />
    )
  }
  if (mode === 'fractureRift') {
    return (
      <AppIcon kind="energy" />
    )
  }
  if (mode === 'ancientMachine') {
    return (
      <AppIcon kind="settings" />
    )
  }
  if (mode === 'stormGateway') {
    return (
      <AppIcon kind="storm" />
    )
  }
  if (mode === 'electricStorm') {
    return (
      <AppIcon kind="energy" />
    )
  }
  return (
    <AppIcon kind="shape" />
  )
}

function handleCinematicWorldKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
  const grid = event.currentTarget.closest<HTMLElement>('[data-cinematic-world-grid]')
  if (!grid) return
  const options = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-cinematic-world-option]'))
  const currentIndex = options.indexOf(event.currentTarget)
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, options.length, 2)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  options[nextIndex]?.focus()
  options[nextIndex]?.click()
}

function CinematicWorldSourceGrid({
  groups,
  activeWorldMode,
  activePresetId,
  onSelect,
}: {
  groups: Array<{ world: CinematicWorldUiDefinition; presets: ReactPreset[] }>
  activeWorldMode: CinematicWorldMode | null
  activePresetId: string | null
  onSelect: (presetId: string) => void
}) {
  const hasActiveWorld = groups.some((group) => group.world.id === activeWorldMode)
  const orderedGroups = CINEMATIC_WORLD_CATEGORY_ORDER.flatMap(category =>
    groups.filter(group => group.world.category === category),
  )

  return (
    <div>
      <div
        className="rv-sound-source-grid rv-cinematic-world-source-grid"
        role="radiogroup"
        aria-label="Cinematic worlds"
        data-cinematic-world-grid
        data-grid-columns="2"
      >
        {orderedGroups.map((group, optionIndex) => {
          const isActive = group.world.id === activeWorldMode
          const activePresetInWorld = group.presets.find((preset) => preset.id === activePresetId)
          const targetPreset = activePresetInWorld ?? group.presets[0]
          return (
            <button
              id={`cinematic-world-group-${group.world.id}`}
              key={group.world.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive || (!hasActiveWorld && optionIndex === 0) ? 0 : -1}
              aria-label={`${group.world.label}, ${group.world.category} category, ${group.presets.length} presets`}
              className={`rv-sound-source-card rv-cinematic-world-source-card${isActive ? ' is-active' : ''}`}
              title={group.world.description}
              data-cinematic-world-option
              data-cinematic-world-category={group.world.category}
              onKeyDown={handleCinematicWorldKeyDown}
              onClick={() => {
                if (targetPreset && !isActive) onSelect(targetPreset.id)
              }}
            >
              <span className="rv-cinematic-world-source-category-badge">{group.world.category}</span>
              <span className="rv-sound-source-card-icon">
                <CinematicWorldIcon mode={group.world.id} />
              </span>
              <span className="rv-sound-source-card-label">{group.world.label}</span>
              <span className="rv-cinematic-world-source-count">
                {group.presets.length} preset
                {group.presets.length === 1 ? '' : 's'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Contextual engine workspace ──────────────────────────────────────────────────────────────

export function ReactEnginePanel({
  cinema2Runtime = null,
  onOpenMediaManager,
  onOpenPresetManager,
}: {
  cinema2Runtime?: Cinema2Runtime | null
  onOpenMediaManager?: () => void
  onOpenPresetManager?: () => void
} = {}) {
  const {
    activeReactEngineId,
    reactPresets,
    activeReactPresetId,
    cinematicConfigsByPresetId,
    selectReactPreset,
  } = useReactStore(
    useShallow((s) => ({
    activeReactEngineId:        s.activeReactEngineId,
    reactPresets:               s.reactPresets,
    activeReactPresetId:        s.activeReactPresetId,
    cinematicConfigsByPresetId: s.cinematicConfigsByPresetId,
    selectReactPreset:          s.selectReactPreset,
    })),
  )

  const cinematicWorldGroups = useMemo(
    () =>
      CINEMATIC_WORLD_UI.map((world) => ({
      world,
        presets: reactPresets.filter(
          (preset) =>
            preset.engine === 'cinematicPortal' && (preset.cinematicConfig?.worldMode ?? 'legacyPortal') === world.id,
        ),
      })).filter((group) => group.presets.length > 0),
    [reactPresets],
  )
  const activeCinematicPreset = useMemo(
    () =>
      reactPresets.find((preset) => preset.id === activeReactPresetId && preset.engine === 'cinematicPortal') ?? null,
    [activeReactPresetId, reactPresets],
  )
  const activeCinematicWorldMode = activeCinematicPreset
    ? (resolveCinematicConfigForPreset(activeCinematicPreset, cinematicConfigsByPresetId)?.worldMode ?? null)
    : null
  return (
    <div className="rv-ctrl-group">
      {activeReactEngineId === 'cinema2' && (
        isCinema2TextPreset(cinema2Runtime?.getCompiledPresetPlan().presetId)
          ? <Cinema2TextLibraryPanel runtime={cinema2Runtime} />
          : (() => {
            const plan = cinema2Runtime?.getCompiledPresetPlan()
            const { modelParameter, media } = resolveCinema2SourcePanels(plan?.manifest)
            return <>
              {cinema2Runtime && modelParameter && <Cinema2ModelSourcePanel key={`${plan?.presetId}:model`} runtime={cinema2Runtime} parameterId={modelParameter} />}
              {media && <Cinema2MediaSourcePanel key={`${plan?.presetId}:media`} runtime={cinema2Runtime} />}
            </>
          })()
      )}

      {/* Cinematic Worlds source selection lives in the left rail. */}
      {activeReactEngineId === 'cinematicPortal' && (
        <>
          <CtrlSection label="Worlds" />
          <CinematicWorldSourceGrid
            groups={cinematicWorldGroups}
            activeWorldMode={activeCinematicWorldMode}
            activePresetId={activeReactPresetId}
            onSelect={selectReactPreset}
          />
        </>
      )}

      {/* ── Engine Mode: GLSL Shader ──────────────────────────────────── */}
      {activeReactEngineId === 'shaderPads' && (
        <Collapsible label="Shader Scenes" defaultOpen>
          <div className="rv-ctrl-info rv-control-helper-copy">
            Shader uses Scenes rather than React presets. Choose and manage the active scene from the SCENES tab in the
            right rail.
          </div>
        </Collapsible>
      )}

      {/* ── Engine Mode: CANVAS ──────────────────────────────────────── */}
      {activeReactEngineId === 'canvas' && <CanvasEnginePanel />}

      {/* ── Engine Mode: PixGrid ──────────────────────────────────────── */}
      {activeReactEngineId === 'pixGrid' && <PixGridEnginePanel onCreateDeck={onOpenPresetManager} />}

      {/* ── Engine Mode: Headliner ────────────────────────────────────── */}
      {activeReactEngineId === 'headliner' && <HeadlinerEnginePanel />}

      {/* ── Engine Mode: Sound Drawing XY ─────────────────────────────── */}
      {activeReactEngineId === 'xyScope' && <XyScopeEnginePanel />}

      {/* ── Engine Mode: LaserDMX ─────────────────────────────────────── */}
      {activeReactEngineId === 'laserDmx' && <LaserDmxEnginePanel />}

    </div>
  )
}
