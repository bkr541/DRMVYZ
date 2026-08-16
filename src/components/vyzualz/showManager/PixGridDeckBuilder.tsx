import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconMorphCheckbox } from '../react/controls/IconMorphToggle'
import { NoticeCard } from '../react/controls/NoticeCard'
import { useId, useRef, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { ReactPresetThumbnail } from '../react/ReactPresetThumbnail'
import type { ReactPreset } from '../react/ReactTypes'
import {
  PIX_GRID_DECK_MAX_ITEMS,
  PIX_GRID_DECK_MIN_ITEMS,
  PIX_GRID_DECK_NAME_MAX_LENGTH,
  PIX_GRID_DECK_REACTION_PROFILE_IDS,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
  type PixGridDeckPlaybackOrder,
  type PixGridDeckPreDropBehavior,
  type PixGridDeckReactionProfileId,
  type PixGridDeckTransitionMode,
  type PixGridDeckUpdatePatch,
} from '../react/pixGrid/PixGridDeckDomain'
import type { PixGridDeckPresetReadiness } from '../react/pixGrid/PixGridDeckPreset'

export interface PixGridDeckUploadUiState {
  active: boolean
  phase: string
  error: string | null
  warnings: readonly string[]
}

const PLAYBACK_OPTIONS: ReadonlyArray<{ value: PixGridDeckPlaybackOrder; label: string }> = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'pingPong', label: 'Ping Pong' },
  { value: 'shuffle', label: 'Deterministic Shuffle' },
  { value: 'sectionAssigned', label: 'Section Assigned' },
]

const REACTION_OPTIONS = PIX_GRID_DECK_REACTION_PROFILE_IDS.map(value => ({
  value,
  label: value === 'graphicLogo' ? 'Graphic / Logo'
    : value === 'photoArtwork' ? 'Photo / Artwork'
      : value === 'highEnergy' ? 'High Energy'
        : 'Balanced',
}))

const TRANSITION_OPTIONS: ReadonlyArray<{ value: PixGridDeckTransitionMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'pixelTransport', label: 'Pixel Transport' },
  { value: 'pixelDissolve', label: 'Pixel Dissolve' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'rowWipe', label: 'Row Wipe' },
  { value: 'columnWipe', label: 'Column Wipe' },
  { value: 'checkerWipe', label: 'Checker Wipe' },
  { value: 'radialReveal', label: 'Radial Reveal' },
  { value: 'hardCut', label: 'Hard Cut' },
]

const PRE_DROP_OPTIONS: ReadonlyArray<{ value: PixGridDeckPreDropBehavior; label: string }> = [
  { value: 'hold', label: 'Hold Current Image' },
  { value: 'dim', label: 'Dim' },
  { value: 'disperse', label: 'Disperse' },
  { value: 'previewNext', label: 'Preview Next' },
  { value: 'continue', label: 'Continue Sequence' },
]

export function PixGridDeckBuilderLibrary({
  deck,
  draftName,
  upload,
  previewItemId,
  onFiles,
  onPreview,
  onMove,
  onReorder,
  onToggle,
  onRemove,
}: {
  deck: PixGridDeckDefinition | null
  draftName: string
  upload: PixGridDeckUploadUiState
  previewItemId: string | null
  onFiles: (files: File[]) => void
  onPreview: (itemId: string) => void
  onMove: (itemId: string, direction: -1 | 1) => void
  onReorder: (sourceItemId: string, targetItemId: string) => void
  onToggle: (itemId: string) => void
  onRemove: (itemId: string) => void
}) {
  const inputId = useId()
  const draggedItemId = useRef<string | null>(null)
  const items = deck?.items ?? []
  const remainingSlots = PIX_GRID_DECK_MAX_ITEMS - items.length

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length > 0) onFiles(files)
  }

  const dropBefore = (event: DragEvent<HTMLButtonElement>, targetItem: PixGridDeckItemDefinition) => {
    event.preventDefault()
    const sourceId = draggedItemId.current
    draggedItemId.current = null
    if (!sourceId || sourceId === targetItem.id) return
    if (!items.some(item => item.id === sourceId)) return
    onReorder(sourceId, targetItem.id)
  }

  return (
    <div className="sm-deck-library" aria-label="Deck image library">
      <div className="sm-panel-heading">
        <strong>DECK IMAGES</strong>
        <span>{deck ? `${items.length} of ${PIX_GRID_DECK_MAX_ITEMS}` : 'Create a new Deck'}</span>
      </div>
      <div className="sm-deck-upload-card">
        <label htmlFor={inputId} className={`sm-deck-upload-button${upload.active ? ' is-busy' : ''}`}>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            multiple
            disabled={upload.active || remainingSlots <= 0}
            onChange={chooseFiles}
          />
          <strong>{deck ? 'Add Images' : 'Upload 2–12 Images'}</strong>
          <span>{upload.active ? upload.phase : deck ? `${remainingSlots} slots remaining` : `Creates “${draftName || 'Untitled Deck'}”`}</span>
        </label>
        {upload.error && <NoticeCard tone="error" role="alert" title="Deck upload failed">{upload.error}</NoticeCard>}
        {upload.warnings.map(warning => <NoticeCard key={warning} tone="warning" role="status" title="Deck upload warning">{warning}</NoticeCard>)}
      </div>
      <div className="sm-deck-image-list" role="list" aria-label="Ordered Deck images">
        {items.map((item, index) => (
          <article
            key={item.id}
            className={`sm-deck-image-card${previewItemId === item.id ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}`}
            role="listitem"
          >
            <button
              type="button"
              className="sm-deck-image-main"
              draggable
              onDragStart={() => { draggedItemId.current = item.id }}
              onDragOver={event => event.preventDefault()}
              onDrop={event => dropBefore(event, item)}
              onClick={() => onPreview(item.id)}
              aria-pressed={previewItemId === item.id}
            >
              <span className="sm-deck-image-order">{String(index + 1).padStart(2, '0')}</span>
              <span className="sm-deck-image-copy">
                <strong>{item.source.fileName ?? `Image ${index + 1}`}</strong>
                <small>{item.enabled ? 'Enabled' : 'Disabled'} · rev {item.revision}</small>
              </span>
            </button>
            <div className="sm-deck-image-actions" aria-label={`${item.source.fileName ?? `Image ${index + 1}`} actions`}>
              <button type="button" onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label="Move image earlier">↑</button>
              <button type="button" onClick={() => onMove(item.id, 1)} disabled={index === items.length - 1} aria-label="Move image later">↓</button>
              <button type="button" onClick={() => onToggle(item.id)} aria-pressed={item.enabled}>{item.enabled ? 'On' : 'Off'}</button>
              <button type="button" onClick={() => onRemove(item.id)} disabled={items.length <= PIX_GRID_DECK_MIN_ITEMS} aria-label="Remove image">×</button>
            </div>
          </article>
        ))}
        {!deck && <div className="sm-deck-empty">Name the Deck, then upload at least two images.</div>}
      </div>
    </div>
  )
}

export function PixGridDeckBuilderInspector({
  deck,
  draftName,
  readiness,
  upload,
  nameError,
  onDraftName,
  onRename,
  onUpdate,
  onCreatePreset,
  onDelete,
}: {
  deck: PixGridDeckDefinition | null
  draftName: string
  readiness: PixGridDeckPresetReadiness | null
  upload: PixGridDeckUploadUiState
  nameError: string | null
  onDraftName: (name: string) => void
  onRename: () => void
  onUpdate: (patch: PixGridDeckUpdatePatch) => void
  onCreatePreset: () => void
  onDelete: () => void
}) {
  const configuration = deck?.configuration
  const updateConfiguration = (patch: PixGridDeckUpdatePatch['configuration']) => onUpdate({ configuration: patch })
  const sectionTypes = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro'] as const
  const enabledItems = deck?.items.filter(item => item.enabled) ?? []
  const transitionPairs = configuration
    ? enabledItems.flatMap((sourceItem, index) => {
        const targetItem = enabledItems[index + 1] ?? (configuration.loop ? enabledItems[0] : null)
        return targetItem && targetItem.id !== sourceItem.id ? [{ sourceItem, targetItem }] : []
      })
    : []
  const setPairOverride = (sourceItemId: string, targetItemId: string, value: string) => {
    if (!configuration) return
    const current = [...(configuration.transitionPolicy.pairOverrides ?? [])]
    const next = current.filter(override => !(
      override.sourceItemId === sourceItemId && override.targetItemId === targetItemId
    ))
    if (value !== 'default') {
      next.push({ sourceItemId, targetItemId, mode: value as PixGridDeckTransitionMode })
    }
    updateConfiguration({ transitionPolicy: { pairOverrides: next } })
  }
  const setPairDuration = (sourceItemId: string, targetItemId: string, durationFraction: number) => {
    if (!configuration) return
    const current = [...(configuration.transitionPolicy.pairOverrides ?? [])]
    const existing = current.find(override => (
      override.sourceItemId === sourceItemId && override.targetItemId === targetItemId
    ))
    const next = current.filter(override => !(
      override.sourceItemId === sourceItemId && override.targetItemId === targetItemId
    ))
    next.push({
      sourceItemId,
      targetItemId,
      mode: existing?.mode ?? configuration.transitionPolicy.mode ?? 'auto',
      durationFraction,
    })
    updateConfiguration({ transitionPolicy: { pairOverrides: next } })
  }
  const setSectionAssignment = (sectionType: typeof sectionTypes[number], itemId: string) => {
    if (!configuration) return
    const next = { ...configuration.sectionItemAssignments }
    if (!itemId) delete next[sectionType]
    else next[sectionType] = [itemId]
    updateConfiguration({ sectionItemAssignments: next })
  }

  return (
    <div className="sm-deck-inspector" aria-label="Deck Builder inspector">
      <div className="sm-panel-heading sm-panel-heading--inspector">
        <strong>DECK BUILDER</strong>
        <span>{deck ? 'Project Deck configuration' : 'New Deck'}</span>
      </div>
      <div className="sm-inspector-scroll">
        <section className="sm-deck-inspector-section">
          <h3>Name</h3>
          <DreamVizTextInput
            className="sm-deck-text-input"
            value={draftName}
            maxLength={PIX_GRID_DECK_NAME_MAX_LENGTH}
            onChange={event => onDraftName(event.target.value)}
            onBlur={onRename}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onRename()
                event.currentTarget.blur()
              }
            }}
            aria-label={deck ? 'Deck name' : 'New Deck name'}
            aria-invalid={Boolean(nameError)}
          />
          {nameError && <NoticeCard tone="error" role="alert" title="Deck name">{nameError}</NoticeCard>}
        </section>

        {deck && configuration && (
          <>
            <section className="sm-deck-inspector-section">
              <h3>Playback</h3>
              <Field label="Order">
                <Dropdown
                  id="deck-playback-order"
                  ariaLabel="Deck playback order"
                  value={configuration.playbackOrder}
                  options={PLAYBACK_OPTIONS}
                  onChange={value => updateConfiguration({ playbackOrder: value as PixGridDeckPlaybackOrder })}
                  size="compact"
                />
              </Field>
              <Field label="Default image duration">
                <NumberInput
                  value={configuration.defaultItemDurationBeats}
                  min={0.25}
                  max={1024}
                  step={0.25}
                  suffix="beats"
                  onChange={value => updateConfiguration({ defaultItemDurationBeats: value })}
                />
              </Field>
              <label className="sm-deck-checkbox">
                <IconMorphCheckbox checked={configuration.loop} onChange={event => updateConfiguration({ loop: event.target.checked })} />
                <span>Loop sequence</span>
              </label>
            </section>

            <section className="sm-deck-inspector-section">
              <h3>Audio Reaction</h3>
              <Dropdown
                id="deck-reaction-profile"
                ariaLabel="Deck reaction profile"
                value={configuration.reactionProfileId}
                options={REACTION_OPTIONS}
                onChange={value => updateConfiguration({ reactionProfileId: value as PixGridDeckReactionProfileId })}
                size="compact"
              />
            </section>

            <section className="sm-deck-inspector-section">
              <h3>Transition</h3>
              <Dropdown
                id="deck-transition-mode"
                ariaLabel="Deck transition mode"
                value={configuration.transitionPolicy.mode ?? 'auto'}
                options={TRANSITION_OPTIONS}
                onChange={value => updateConfiguration({
                  transitionPolicy: { mode: value as PixGridDeckTransitionMode },
                })}
                size="compact"
              />
              <Field label="Transition length">
                <NumberInput
                  value={configuration.transitionPolicy.durationFraction ?? 0.25}
                  min={0}
                  max={0.75}
                  step={0.05}
                  suffix="of image"
                  onChange={value => updateConfiguration({ transitionPolicy: { durationFraction: value } })}
                />
              </Field>
              {transitionPairs.length > 0 && (
                <div className="sm-deck-pair-overrides">
                  <strong>Pair overrides</strong>
                  {transitionPairs.map(({ sourceItem, targetItem }) => {
                    const override = configuration.transitionPolicy.pairOverrides?.find(candidate => (
                      candidate.sourceItemId === sourceItem.id && candidate.targetItemId === targetItem.id
                    ))
                    return (
                      <div key={`${sourceItem.id}:${targetItem.id}`} className="sm-deck-pair-row">
                        <span title={`${sourceItem.source.fileName ?? sourceItem.id} to ${targetItem.source.fileName ?? targetItem.id}`}>
                          {sourceItem.order + 1} → {targetItem.order + 1}
                        </span>
                        <Dropdown
                          id={`deck-pair-${sourceItem.id}-${targetItem.id}`}
                          ariaLabel={`Transition from image ${sourceItem.order + 1} to image ${targetItem.order + 1}`}
                          value={override?.mode ?? 'default'}
                          options={[{ value: 'default', label: 'Use Default' }, ...TRANSITION_OPTIONS]}
                          onChange={value => setPairOverride(sourceItem.id, targetItem.id, value)}
                          size="dense"
                        />
                        {override && override.mode !== 'hardCut' && (
                          <NumberInput
                            value={override.durationFraction ?? configuration.transitionPolicy.durationFraction ?? 0.25}
                            min={0}
                            max={0.75}
                            step={0.05}
                            suffix="fraction"
                            onChange={value => setPairDuration(sourceItem.id, targetItem.id, value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="sm-deck-inspector-section">
              <h3>Sections</h3>
              <Field label="PreDrop behavior">
                <Dropdown
                  id="deck-pre-drop-behavior"
                  ariaLabel="Deck PreDrop behavior"
                  value={configuration.preDropBehavior}
                  options={PRE_DROP_OPTIONS}
                  onChange={value => updateConfiguration({ preDropBehavior: value as PixGridDeckPreDropBehavior })}
                  size="compact"
                />
              </Field>
              <div className="sm-deck-section-grid">
                {sectionTypes.map(sectionType => (
                  <div key={sectionType} className="sm-deck-section-row">
                    <label>
                      <span>{sectionType === 'preDrop' ? 'PreDrop' : sectionType[0].toUpperCase() + sectionType.slice(1)}</span>
                      <input
                        type="number"
                        min={0.25}
                        max={1024}
                        step={0.25}
                        value={configuration.sectionTimingBeats[sectionType] ?? ''}
                        placeholder={String(configuration.defaultItemDurationBeats)}
                        onChange={event => {
                          const raw = event.target.value
                          const next = { ...configuration.sectionTimingBeats }
                          if (!raw) delete next[sectionType]
                          else next[sectionType] = Number(raw)
                          updateConfiguration({ sectionTimingBeats: next })
                        }}
                        aria-label={`${sectionType} image duration in beats`}
                      />
                    </label>
                    <Dropdown
                      id={`deck-section-${sectionType}-assignment`}
                      ariaLabel={`${sectionType} assigned Deck image`}
                      value={configuration.sectionItemAssignments[sectionType]?.[0] ?? ''}
                      options={[
                        { value: '', label: 'Use Sequence' },
                        ...enabledItems.map((item, index) => ({
                          value: item.id,
                          label: `${index + 1}. ${item.source.fileName ?? `Image ${index + 1}`}`,
                        })),
                      ]}
                      onChange={value => setSectionAssignment(sectionType, value)}
                      size="dense"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="sm-deck-readiness" aria-live="polite">
              <header><strong>Compile Readiness</strong><span>{readiness?.ready ? 'READY' : readiness?.errorCount ? 'ERROR' : 'WORKING'}</span></header>
              <ProgressRow label="Images" progress={readiness?.frameProgress ?? 0} />
              <ProgressRow label="Transitions" progress={readiness?.transitionProgress ?? 0} />
              <p>{readiness?.message ?? 'Compiler status is not available yet.'}</p>
              {readiness?.errors?.map((error, index) => (
                <NoticeCard key={`${error}-${index}`} tone="error" role="alert" title="Deck compiler error">{error}</NoticeCard>
              ))}
              <button
                type="button"
                className="sm-deck-create-preset"
                disabled={!readiness?.ready || upload.active || deck.presetCreated}
                onClick={onCreatePreset}
              >
                {deck.presetCreated ? 'Preset Created' : 'Create Preset'}
              </button>
            </section>

            <button type="button" className="sm-deck-delete" onClick={onDelete}>Delete Deck</button>
          </>
        )}
      </div>
    </div>
  )
}

export function PixGridDeckSequenceStrip({
  deck,
  previewItemId,
  onPreview,
  onPrevious,
  onNext,
}: {
  deck: PixGridDeckDefinition
  previewItemId: string | null
  onPreview: (itemId: string) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const enabledItems = deck.items.filter(item => item.enabled)
  return (
    <section className="sm-deck-sequence" aria-label="Deck sequence preview">
      <header>
        <div><strong>DECK SEQUENCE</strong><span>{enabledItems.length} enabled images · musical preview</span></div>
        <div className="sm-deck-preview-nav">
          <button type="button" onClick={onPrevious} disabled={enabledItems.length < 2} aria-label="Previous Deck image">‹</button>
          <button type="button" onClick={onNext} disabled={enabledItems.length < 2} aria-label="Next Deck image">›</button>
        </div>
      </header>
      <div className="sm-deck-sequence-items">
        {enabledItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={previewItemId === item.id ? 'is-active' : ''}
            onClick={() => onPreview(item.id)}
          >
            <span>{index + 1}</span>
            <strong>{item.source.fileName ?? `Image ${index + 1}`}</strong>
            <small>{item.timingOverrideBeats ?? deck.configuration.defaultItemDurationBeats} beats</small>
          </button>
        ))}
      </div>
    </section>
  )
}

export function PixGridDeckPresetSummary({
  deck,
  preset,
  readiness,
  onEdit,
}: {
  deck: PixGridDeckDefinition
  preset: ReactPreset
  readiness: PixGridDeckPresetReadiness
  onEdit: () => void
}) {
  return (
    <section className="sm-deck-preset-summary" aria-label={`${deck.name} Deck summary`}>
      <ReactPresetThumbnail preset={preset} generationKey={preset.pixGridDeck?.thumbnailFingerprint} />
      <div className="sm-deck-preset-summary-copy">
        <strong>{deck.name}</strong>
        <span>{readiness.enabledItemCount} enabled images</span>
        <span>{readiness.ready ? 'Ready' : readiness.errorCount ? 'Compile error' : `${Math.round(Math.min(readiness.frameProgress, readiness.transitionProgress) * 100)}% compiling`}</span>
      </div>
      <button type="button" onClick={onEdit}>Edit Deck</button>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="sm-deck-field"><span>{label}</span>{children}</label>
}

function NumberInput({
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <span className="sm-deck-number-input">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
      />
      <small>{suffix}</small>
    </span>
  )
}

function ProgressRow({ label, progress }: { label: string; progress: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div className="sm-deck-progress-row">
      <span>{label}</span>
      <div><i style={{ width: `${percent}%` }} /></div>
      <strong>{percent}%</strong>
    </div>
  )
}
