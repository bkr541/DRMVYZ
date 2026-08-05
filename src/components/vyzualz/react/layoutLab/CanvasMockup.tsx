import { useMemo } from 'react'
import { RailTabs } from '../../layout/RailTabs'
import type { ReactEngineId } from '../ReactTypes'
import { MockEngineDropdown } from './MockEngineDropdown'
import type { LayoutLabEngineId } from './layoutLabEngineCatalog'
import { resolveLayoutLabComposition } from './layoutLabComposition'
import type { CanvasMockMediaRole, CanvasMockState } from './useCanvasMockState'

const ROLE_OPTIONS: Array<{ id: CanvasMockMediaRole; label: string }> = [
  { id: 'hero', label: 'Hero' },
  { id: 'alternateHero', label: 'Alternate Hero' },
  { id: 'background', label: 'Background' },
  { id: 'texture', label: 'Texture' },
  { id: 'foregroundAccent', label: 'Foreground Accent' },
  { id: 'mask', label: 'Mask' },
  { id: 'transition', label: 'Transition' },
  { id: 'dropAsset', label: 'Drop Asset' },
  { id: 'breakdownAsset', label: 'Breakdown Asset' },
  { id: 'buildAsset', label: 'Build Asset' },
  { id: 'introAsset', label: 'Intro Asset' },
  { id: 'outroAsset', label: 'Outro Asset' },
]

function MediaCard({
  item,
  selected,
  inPool,
  onSelect,
  onAddToPool,
  onRemove,
}: {
  item: CanvasMockState['mediaItems'][number]
  selected: boolean
  inPool: boolean
  onSelect: () => void
  onAddToPool: () => void
  onRemove: () => void
}) {
  return (
    <article className={`rv-layout-lab-canvas-media-card${selected ? ' is-active' : ''}`}>
      <button type="button" className="rv-layout-lab-canvas-media-main" onClick={onSelect} aria-pressed={selected}>
        <span className={`rv-layout-lab-canvas-media-thumb is-${item.type}`} aria-hidden="true">
          {item.type === 'video' ? '▶' : item.type === 'svg' ? '◇' : '▧'}
        </span>
        <span>
          <strong>{item.name}</strong>
          <small>{item.type.toUpperCase()} · {item.dimensions}</small>
          <small>{item.sizeLabel} · {item.collection}</small>
        </span>
      </button>
      <div className="rv-layout-lab-canvas-media-actions">
        <button type="button" onClick={onAddToPool} disabled={inPool}>{inPool ? 'In Pool' : 'Add to Pool'}</button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.name} from Layout Lab`}>Remove</button>
      </div>
    </article>
  )
}

export function CanvasMockup({
  engineId,
  onSelectEngine,
  state,
}: {
  engineId: ReactEngineId
  onSelectEngine: (id: LayoutLabEngineId) => void
  state: CanvasMockState
}) {
  const composition = resolveLayoutLabComposition(engineId)
  const poolItems = useMemo(
    () => state.orchestration.mediaPoolIds.map(id => state.mediaItems.find(item => item.id === id)).filter(Boolean) as CanvasMockState['mediaItems'],
    [state.mediaItems, state.orchestration.mediaPoolIds],
  )
  const activeRoles = state.activePoolMedia
    ? state.orchestration.mediaRolesById[state.activePoolMedia.id] ?? state.activePoolMedia.automaticRoles
    : []

  return (
    <div className="rv-left-workspace-shell" data-description-density="compact" data-layout-lab-canvas="source">
      <section className="rv-context-workspace">
        <header className="rv-context-workspace-header">
          <MockEngineDropdown engineId={engineId} onSelect={onSelectEngine} />
        </header>
        <RailTabs
          tabs={composition.leftTabs.map(tab => ({ id: tab.id, label: tab.label }))}
          activeTab="workspace"
          onChange={() => {}}
          ariaLabel="Canvas left workspace tabs"
        />
        <div className="rv-context-workspace-body rv-inspector-scroll">
          <div className="rv-ctrl-section-label">CANVAS</div>
          <div className="rv-canvas-engine-panel rv-layout-lab-canvas-source">
            <section className="rv-layout-lab-canvas-library" aria-label="CANVAS Media Library">
              <header>
                <div>
                  <strong>Media Library</strong>
                  <small>Saved media compatible with CANVAS</small>
                </div>
                <span>{state.libraryItems.length}</span>
              </header>

              <div className="rv-layout-lab-canvas-capability">
                <strong>Video, image, and SVG ready</strong>
                <span>Upload and Media Manager actions are visually represented but stay local in Layout Lab.</span>
              </div>

              <div className="rv-layout-lab-canvas-library-actions">
                <button type="button" onClick={() => state.setMediaNotice('Upload is unavailable in Layout Lab. Use the deterministic samples below.')}>Upload Media</button>
                <button type="button" onClick={() => state.setMediaNotice('Media Manager preview is local-only in Layout Lab.')}>Open Media Manager</button>
                {state.libraryEmpty
                  ? <button type="button" onClick={state.restoreSampleLibrary}>Restore Samples</button>
                  : <button type="button" onClick={state.showEmptyLibrary}>Show Empty State</button>}
              </div>

              {state.mediaNotice && <div className="rv-canvas-engine-note" role="status">{state.mediaNotice}</div>}

              {state.libraryItems.length === 0 ? (
                <div className="rv-layout-lab-canvas-empty">
                  <strong>No saved CANVAS media</strong>
                  <span>Add video, image, or SVG media in the production Media Library. Layout Lab never reads user files.</span>
                </div>
              ) : (
                <div className="rv-layout-lab-canvas-media-list">
                  {state.libraryItems.map(item => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      selected={item.id === state.activeMediaId}
                      inPool={state.orchestration.mediaPoolIds.includes(item.id)}
                      onSelect={() => state.selectMedia(item.id)}
                      onAddToPool={() => state.addToPool(item.id)}
                      onRemove={() => state.removeMedia(item.id)}
                    />
                  ))}
                </div>
              )}

              {state.manualMediaOverrideActive && (
                <div className="rv-layout-lab-canvas-lock-status">
                  <span>Media lock: This CANVAS source stays selected.</span>
                  <button type="button" onClick={state.clearMediaOverride} aria-label="Clear CANVAS media lock">Clear</button>
                </div>
              )}
            </section>

            <div className="rv-canvas-panel-status"><span>Saved media</span><strong>{state.libraryItems.length}</strong></div>
            <div className="rv-canvas-panel-status"><span>CANVAS-ready</span><strong>{state.libraryItems.length}</strong></div>
            <div className="rv-canvas-panel-status"><span>Preset</span><strong>{state.activePreset.name}</strong></div>

            <section className="rv-layout-lab-canvas-pool" aria-label="Performance Pool">
              <header><strong>Performance Pool</strong><span>{poolItems.length}</span></header>
              {poolItems.length === 0 ? (
                <div className="rv-layout-lab-canvas-empty">
                  <strong>No pooled media</strong>
                  <span>Select media to build a deterministic multi-source pool.</span>
                </div>
              ) : (
                <div className="rv-layout-lab-canvas-pool-list">
                  {poolItems.map(item => (
                    <div key={item.id} className={state.activePoolMedia?.id === item.id ? 'is-active' : ''}>
                      <button type="button" onClick={() => state.selectPoolMedia(item.id)}>{item.name}</button>
                      <button type="button" onClick={() => state.removeFromPool(item.id)} aria-label={`Remove ${item.name} from Performance Pool`}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {state.activePoolMedia && (
              <section className="rv-layout-lab-canvas-roles" aria-label={`Roles · ${state.activePoolMedia.name}`}>
                <header>
                  <strong>Roles · {state.activePoolMedia.name}</strong>
                  <span>{state.orchestration.mediaRolesById[state.activePoolMedia.id] ? 'Authored roles' : 'Auto roles'}</span>
                </header>
                <div className="rv-layout-lab-canvas-role-grid">
                  {ROLE_OPTIONS.map(role => (
                    <button
                      key={role.id}
                      type="button"
                      className={activeRoles.includes(role.id) ? 'is-active' : ''}
                      aria-pressed={activeRoles.includes(role.id)}
                      onClick={() => state.toggleMediaRole(state.activePoolMedia!.id, role.id)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {state.legacyItems.length > 0 && (
              <section className="rv-layout-lab-canvas-legacy" aria-label="Legacy session media">
                <header><strong>Session Media</strong><span>{state.legacyItems.length}</span></header>
                {state.legacyItems.map(item => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    selected={item.id === state.activeMediaId}
                    inPool={state.orchestration.mediaPoolIds.includes(item.id)}
                    onSelect={() => state.selectMedia(item.id)}
                    onAddToPool={() => state.addToPool(item.id)}
                    onRemove={() => state.removeMedia(item.id)}
                  />
                ))}
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
