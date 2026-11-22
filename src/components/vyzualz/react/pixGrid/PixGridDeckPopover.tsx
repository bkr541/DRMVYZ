import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import '../../../../styles/mediaUploadModal.css'
import '../../../../styles/pixGridDeckPopover.css'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconMorphCheckbox } from '../controls/IconMorphToggle'
import { ConfirmDialog } from '../controls/ConfirmDialog'
import { NoticeCard } from '../controls/NoticeCard'
import { IconChipButton } from '../controls/IconChipButton'
import {
  ARRIVAL_ANCHOR_OPTIONS,
  MOTION_PROFILE_OPTIONS,
  PLAYBACK_OPTIONS,
  PRE_DROP_OPTIONS,
  REACTION_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../showManager/PixGridDeckBuilder'
import {
  PIX_GRID_DECK_MAX_ITEMS,
  PIX_GRID_DECK_MIN_ITEMS,
  PIX_GRID_DECK_NAME_MAX_LENGTH,
  PIX_GRID_DECK_SECTION_TYPES,
  type PixGridDeckMusicalArrivalAnchor,
  type PixGridDeckPlaybackOrder,
  type PixGridDeckPreDropBehavior,
  type PixGridDeckReactionProfileId,
  type PixGridDeckTransitionMode,
} from './PixGridDeckDomain'
import {
  POPOVER_INHERIT,
  popoverTransitionPairs,
  type PopoverDeck,
  type PopoverReadiness,
  type PopoverSectionType,
  type PopoverSettingsPatch,
  type PopoverShip,
  type PopoverUpload,
} from './pixGridDeckPopoverModel'

type StepId = 'images' | 'playback' | 'transitions' | 'sections' | 'review'
const STEPS: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: 'images', label: 'Images' },
  { id: 'playback', label: 'Playback' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'sections', label: 'Sections' },
  { id: 'review', label: 'Review' },
]
const SECTION_LABELS: Record<PopoverSectionType, string> = {
  intro: 'Intro', verse: 'Verse', build: 'Build', preDrop: 'PreDrop', drop: 'Drop', breakdown: 'Breakdown', bridge: 'Bridge', outro: 'Outro',
}
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="ll-deck-field">
      <span className="ll-deck-field-label">{label}</span>
      {children}
      {hint && <small className="ll-deck-hint">{hint}</small>}
    </div>
  )
}

function BeatsInput({ value, placeholder, label, onChange }: { value: number | null; placeholder?: string; label: string; onChange: (value: number | null) => void }) {
  return (
    <span className="ll-deck-beats">
      <DreamVizTextInput
        type="number" min={0.25} max={1024} step={0.25} value={value ?? ''} placeholder={placeholder} aria-label={label}
        onChange={event => onChange(event.target.value === '' ? null : Math.min(1024, Math.max(0.25, Number(event.target.value))))}
      />
      <small>beats</small>
    </span>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="ll-deck-section">
      <header><h3>{title}</h3>{description && <p>{description}</p>}</header>
      <div className="ll-deck-section-body">{children}</div>
    </section>
  )
}

function ProgressRow({ label, progress }: { label: string; progress: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div className="ll-deck-progress" role="group" aria-label={`${label} ${percent} percent`}>
      <span>{label}</span>
      <div className="ll-deck-progress-track"><i style={{ width: `${percent}%` }} /></div>
      <strong>{percent}%</strong>
    </div>
  )
}

/** What the host supplies for the live preview: the rendered stage, and the selected image and transition position it is showing. */
export interface PixGridDeckPopoverPreview {
  itemId: string | null
  progress: number
  /** The live PixGrid render for the open Deck, or null while there is nothing to show. */
  stage: ReactNode
  onItem: (itemId: string) => void
  onProgress: (progress: number) => void
}

export interface PixGridDeckPopoverProps {
  /** Create opens empty; Edit opens an existing Deck. Only the title differs. */
  mode: 'create' | 'edit'
  deck: PopoverDeck
  nameError: string | null
  upload: PopoverUpload
  readiness: PopoverReadiness
  /** Create Preset succeeded: the popover shows its confirmation until it is closed. */
  created: boolean
  /** The Deck's Preset already exists, so its edits are live and the last step ends with Done instead of Create Preset. */
  presetCreated: boolean
  preview: PixGridDeckPopoverPreview
  /** Development builds only: the team's "Export for shipping" action. */
  ship: PopoverShip | null
  deletePending: boolean
  onName: (name: string) => void
  /** The name field lost focus or Enter was pressed: apply the name to an open Deck. */
  onNameCommit: () => void
  onFiles: (files: File[]) => void
  /** Study only: a link under the upload control that fills the Deck with sample images. */
  onAddSamples?: () => void
  onMove: (itemId: string, direction: -1 | 1) => void
  onDuplicate: (itemId: string) => void
  onReorder: (sourceItemId: string, targetItemId: string) => void
  onToggle: (itemId: string) => void
  onRemove: (itemId: string) => void
  onDuration: (itemId: string, beats: number | null) => void
  onSettings: (patch: PopoverSettingsPatch) => void
  onCreate: () => void
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  onClose: () => void
}

type Settings = Pick<PixGridDeckPopoverProps, 'deck' | 'onSettings'>

// ── Screen 1: Images ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ImagesScreen(props: Pick<PixGridDeckPopoverProps, 'deck' | 'nameError' | 'upload' | 'preview' | 'onName' | 'onNameCommit' | 'onFiles' | 'onAddSamples' | 'onMove' | 'onDuplicate' | 'onReorder' | 'onToggle' | 'onRemove' | 'onDuration'>) {
  const { deck, nameError, upload, preview, onName, onNameCommit, onFiles, onAddSamples, onMove, onDuplicate, onReorder, onToggle, onRemove, onDuration } = props
  const inputId = useId()
  const dragged = useRef<string | null>(null)
  const items = deck.items
  const enabled = items.filter(item => item.enabled)
  const remaining = PIX_GRID_DECK_MAX_ITEMS - items.length
  const previewIndex = Math.max(0, enabled.findIndex(item => item.id === preview.itemId))
  const stepPreview = (direction: -1 | 1) => {
    const target = enabled[(previewIndex + direction + enabled.length) % enabled.length]
    if (target) preview.onItem(target.id)
  }
  const chooseFiles = (files: File[]) => { if (files.length > 0) onFiles(files) }
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (!upload.active && remaining > 0) chooseFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <div className="ll-deck-split">
      <div className="ll-deck-col">
        <Field label="Deck name" hint={`${deck.name.length} of ${PIX_GRID_DECK_NAME_MAX_LENGTH} characters`}>
          <DreamVizTextInput
            value={deck.name} maxLength={PIX_GRID_DECK_NAME_MAX_LENGTH} aria-label={items.length > 0 ? 'Deck name' : 'New Deck name'}
            aria-invalid={Boolean(nameError)} onChange={event => onName(event.target.value)} onBlur={onNameCommit}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onNameCommit() } }}
          />
          {nameError && <NoticeCard tone="error" role="alert" title="Deck name">{nameError}</NoticeCard>}
        </Field>

        <label
          htmlFor={inputId} className={`ll-deck-drop${upload.active ? ' is-busy' : ''}${remaining <= 0 ? ' is-full' : ''}`}
          onDragOver={event => event.preventDefault()} onDrop={onDrop}
        >
          <input
            id={inputId} type="file" accept={IMAGE_ACCEPT} multiple disabled={upload.active || remaining <= 0}
            onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; chooseFiles(files) }}
          />
          <span className="ll-deck-drop-icon" aria-hidden="true"><AppIcon kind="imageAdd" size={22} color="currentColor" /></span>
          <strong>{items.length > 0 ? 'Add images' : `Upload 2–${PIX_GRID_DECK_MAX_ITEMS} images`}</strong>
          <span>{upload.active ? upload.phase : items.length > 0 ? `${remaining} slots remaining` : `Creates “${deck.name || 'Untitled Deck'}”`}</span>
          <small>PNG, JPEG, SVG or static WebP · drag files here or click to browse</small>
        </label>
        {onAddSamples && items.length === 0 && (
          <button type="button" className="ll-deck-link" onClick={onAddSamples}>Study only: add five sample images</button>
        )}
        {upload.error && <NoticeCard tone="error" role="alert" title="Deck upload failed">{upload.error}</NoticeCard>}
        {upload.warnings.map(warning => <NoticeCard key={warning} tone="warning" role="status" title="Deck upload warning">{warning}</NoticeCard>)}

        <div className="ll-deck-list-head"><strong>Images</strong><span>{items.length} of {PIX_GRID_DECK_MAX_ITEMS} · {enabled.length} enabled</span></div>
        <div className="ll-deck-list" role="list" aria-label="Ordered Deck images">
          {items.map((item, index) => (
            <article
              key={item.id} role="listitem" draggable
              className={`ll-deck-image${preview.itemId === item.id ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}`}
              onDragStart={() => { dragged.current = item.id }} onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault()
                event.stopPropagation()
                const source = dragged.current
                dragged.current = null
                if (source && source !== item.id) onReorder(source, item.id)
              }}
            >
              <button type="button" className="ll-deck-image-main" aria-pressed={preview.itemId === item.id} onClick={() => item.enabled && preview.onItem(item.id)}>
                <span className="ll-deck-image-order">{String(index + 1).padStart(2, '0')}</span>
                <span className="ll-deck-image-copy"><strong>{item.name}</strong><small>{item.enabled ? 'Enabled' : 'Disabled'} · rev {item.revision}</small></span>
              </button>
              <label className="ll-deck-image-timing">
                <BeatsInput value={item.duration} placeholder={String(deck.defaultDuration)} label={`${item.name} duration in beats`} onChange={value => onDuration(item.id, value)} />
              </label>
              <div className="ll-deck-image-actions" aria-label={`${item.name} actions`}>
                <IconChipButton className="ll-deck-icon-button" aria-label="Move image earlier" title="Move earlier" disabled={index === 0} icon={<AppIcon kind="up" size={13} color="currentColor" />} onClick={() => onMove(item.id, -1)} />
                <IconChipButton className="ll-deck-icon-button" aria-label="Move image later" title="Move later" disabled={index === items.length - 1} icon={<AppIcon kind="down" size={13} color="currentColor" />} onClick={() => onMove(item.id, 1)} />
                <IconChipButton className="ll-deck-icon-button" aria-label="Duplicate image occurrence" title="Duplicate" disabled={remaining <= 0} icon={<AppIcon kind="copy" size={13} color="currentColor" />} onClick={() => onDuplicate(item.id)} />
                <button type="button" className="ll-deck-toggle" aria-pressed={item.enabled} onClick={() => onToggle(item.id)}>{item.enabled ? 'On' : 'Off'}</button>
                <IconChipButton className="ll-deck-icon-button ll-deck-icon-button--danger" aria-label="Remove image" title="Remove" disabled={items.length <= PIX_GRID_DECK_MIN_ITEMS} icon={<AppIcon kind="close" size={13} color="currentColor" />} onClick={() => onRemove(item.id)} />
              </div>
            </article>
          ))}
          {items.length === 0 && <div className="ll-deck-empty">Name the Deck, then upload at least two images.</div>}
        </div>
      </div>

      <aside className="ll-deck-col ll-deck-preview" aria-label="Deck preview">
        <div className="ll-deck-list-head"><strong>Live preview</strong><span>{enabled.length > 0 ? `Image ${previewIndex + 1} → ${enabled.length > 1 ? (previewIndex + 1) % enabled.length + 1 : 1}` : 'No images yet'}</span></div>
        <div className={`ll-deck-stage${enabled.length === 0 || !preview.stage ? ' is-empty' : ''}`}>
          {enabled.length > 0 && preview.stage ? preview.stage : <span>Upload at least two images to preview your Deck.</span>}
        </div>
        {enabled.length > 1 && (
          <>
            <div className="ll-deck-sequence">
              <div className="ll-deck-sequence-head">
                <div><strong>Deck sequence</strong><span>{enabled.length} enabled images · musical preview</span></div>
                <div className="ll-deck-preview-nav">
                  <IconChipButton className="ll-deck-icon-button" aria-label="Previous Deck image" icon={<AppIcon kind="left" size={13} color="currentColor" />} onClick={() => stepPreview(-1)} />
                  <IconChipButton className="ll-deck-icon-button" aria-label="Next Deck image" icon={<AppIcon kind="chevronRight" size={13} color="currentColor" />} onClick={() => stepPreview(1)} />
                </div>
              </div>
              <div className="ll-deck-chips">
                {enabled.map((item, index) => (
                  <button key={item.id} type="button" className={preview.itemId === item.id ? 'is-active' : ''} onClick={() => preview.onItem(item.id)}>
                    <span>{index + 1}</span><strong>{item.name}</strong><small>{item.duration ?? deck.defaultDuration} beats</small>
                  </button>
                ))}
              </div>
            </div>
            <label className="ll-deck-scrub">
              <span>Preview {previewIndex + 1} → {(previewIndex + 1) % enabled.length + 1}</span>
              <input type="range" min={0} max={1} step={0.01} value={preview.progress} aria-label="Scrub generated PixGrid transition" onChange={event => preview.onProgress(Number(event.target.value))} />
              <small>{Math.round(preview.progress * 100)}% generated intermediate frame</small>
            </label>
          </>
        )}
      </aside>
    </div>
  )
}

// ── Screen 2: Playback ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

function PlaybackScreen({ deck, onSettings }: Settings) {
  return (
    <div className="ll-deck-stack">
      <Section title="Playback" description="How the Deck steps through its images.">
        <div className="ll-deck-grid">
          <Field label="Order">
            <Dropdown id="ll-deck-order" ariaLabel="Deck playback order" value={deck.playback} options={PLAYBACK_OPTIONS} size="compact" onChange={value => onSettings({ playback: value as PixGridDeckPlaybackOrder })} />
          </Field>
          <Field label="Default image duration" hint="Images without their own duration use this. Set one per image on the Images screen.">
            <BeatsInput value={deck.defaultDuration} label="Default image duration in beats" onChange={value => onSettings({ defaultDuration: value ?? 4 })} />
          </Field>
        </div>
        <label className="ll-deck-check"><IconMorphCheckbox checked={deck.loop} onChange={event => onSettings({ loop: event.target.checked })} /><span>Loop sequence</span></label>
      </Section>
      <Section title="Audio Reaction" description="How strongly and in what style the pixels respond to the music.">
        <Field label="Reaction profile">
          <Dropdown id="ll-deck-reaction" ariaLabel="Deck reaction profile" value={deck.reaction} options={REACTION_OPTIONS} size="compact" onChange={value => onSettings({ reaction: value as PixGridDeckReactionProfileId })} />
        </Field>
      </Section>
    </div>
  )
}

// ── Screen 3: Transitions ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function TransitionsScreen({ deck, onSettings }: Settings) {
  const pairs = popoverTransitionPairs(deck)
  const setPair = (key: string, patch: Partial<PopoverDeck['pairs'][string]>) => {
    const base: PopoverDeck['pairs'][string] = deck.pairs[key] ?? { mode: POPOVER_INHERIT, motion: POPOVER_INHERIT, length: null }
    const next = { ...deck.pairs, [key]: { ...base, ...patch } }
    const entry = next[key]!
    if (entry.mode === POPOVER_INHERIT && entry.motion === POPOVER_INHERIT && entry.length == null) delete next[key]
    onSettings({ pairs: next })
  }
  const resetMotion = () => onSettings({
    motion: 'balanced',
    pairs: Object.fromEntries(Object.entries(deck.pairs).map(([key, pair]) => [key, { ...pair, motion: POPOVER_INHERIT }])),
    sections: Object.fromEntries(Object.entries(deck.sections).map(([key, section]) => [key, { ...section, motion: POPOVER_INHERIT }])) as PopoverDeck['sections'],
  })
  return (
    <div className="ll-deck-stack">
      <Section title="Transition" description="How one image becomes the next. Pair and section settings take precedence over these defaults.">
        <div className="ll-deck-grid">
          <Field label="Motion profile" hint="Preset default · pair and scene overrides take precedence.">
            <Dropdown id="ll-deck-motion" ariaLabel="Deck motion profile" value={deck.motion} options={MOTION_PROFILE_OPTIONS} size="compact" onChange={value => onSettings({ motion: value })} />
            <button type="button" className="ll-deck-link" onClick={resetMotion}>Reset motion overrides</button>
          </Field>
          <Field label="Transition mode">
            <Dropdown id="ll-deck-mode" ariaLabel="Deck transition mode" value={deck.transitionMode} options={TRANSITION_OPTIONS} size="compact" onChange={value => onSettings({ transitionMode: value as PixGridDeckTransitionMode })} />
          </Field>
          <Field label="Transition length">
            <span className="ll-deck-beats">
              <DreamVizTextInput type="number" min={0} max={0.75} step={0.05} value={deck.transitionLength} aria-label="Transition length" onChange={event => onSettings({ transitionLength: Math.min(0.75, Math.max(0, Number(event.target.value))) })} />
              <small>of image</small>
            </span>
          </Field>
          <Field label="Timing anchor">
            <Dropdown id="ll-deck-anchor" ariaLabel="Deck transition timing anchor" value={deck.anchorMode} size="compact" onChange={value => onSettings({ anchorMode: value as 'onset' | 'arrival' })}
              options={[{ value: 'onset', label: 'Start on boundary' }, { value: 'arrival', label: 'Arrive on boundary' }]} />
          </Field>
          {deck.anchorMode === 'arrival' && (
            <Field label="Arrival event">
              <Dropdown id="ll-deck-arrival" ariaLabel="Deck transition arrival event" value={deck.arrivalAnchor} options={ARRIVAL_ANCHOR_OPTIONS} size="compact" onChange={value => onSettings({ arrivalAnchor: value as PixGridDeckMusicalArrivalAnchor })} />
            </Field>
          )}
        </div>
      </Section>
      <Section title="Pair overrides" description="Change one transition without touching the rest.">
        {pairs.length === 0 && <div className="ll-deck-empty">Enable at least two images to override a transition.</div>}
        {pairs.length > 0 && (
          <div className="ll-deck-table" role="table" aria-label="Pair overrides">
            <div className="ll-deck-row ll-deck-row--head" role="row"><span>Pair</span><span>Mode</span><span>Motion</span><span>Length</span></div>
            {pairs.map(pair => {
              const entry = deck.pairs[pair.key]
              return (
                <div key={pair.key} className="ll-deck-row" role="row">
                  <span className="ll-deck-pair" title={`${pair.source.name} to ${pair.target.name}`}>{pair.from} → {pair.to}</span>
                  <Dropdown id={`ll-deck-pair-${pair.key}`} ariaLabel={`Transition from image ${pair.from} to image ${pair.to}`} value={entry?.mode ?? POPOVER_INHERIT} size="dense"
                    options={[{ value: POPOVER_INHERIT, label: 'Use Default' }, ...TRANSITION_OPTIONS]} onChange={value => setPair(pair.key, { mode: value })} />
                  <Dropdown id={`ll-deck-pair-motion-${pair.key}`} ariaLabel={`Motion profile from image ${pair.from} to image ${pair.to}`} value={entry?.motion ?? POPOVER_INHERIT} size="dense"
                    options={[{ value: POPOVER_INHERIT, label: `Inherit ${MOTION_PROFILE_OPTIONS.find(option => option.value === deck.motion)?.label ?? deck.motion}` }, ...MOTION_PROFILE_OPTIONS]} onChange={value => setPair(pair.key, { motion: value })} />
                  {entry && entry.mode !== 'hardCut'
                    ? <BeatsInput value={entry.length} placeholder={String(deck.transitionLength)} label={`Transition length from image ${pair.from} to image ${pair.to}`} onChange={value => setPair(pair.key, { length: value })} />
                    : <span className="ll-deck-muted">{entry?.mode === 'hardCut' ? 'Instant' : 'Default'}</span>}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Screen 4: Sections ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

function SectionsScreen({ deck, onSettings }: Settings) {
  const enabled = deck.items.filter(item => item.enabled)
  const patch = (type: PopoverSectionType, value: Partial<PopoverDeck['sections'][PopoverSectionType]>) => onSettings({ sections: { ...deck.sections, [type]: { ...deck.sections[type], ...value } } })
  return (
    <div className="ll-deck-stack">
      <Section title="PreDrop" description="What the image does in the moment before a drop.">
        <Field label="PreDrop behavior">
          <Dropdown id="ll-deck-predrop" ariaLabel="Deck PreDrop behavior" value={deck.preDrop} options={PRE_DROP_OPTIONS} size="compact" onChange={value => onSettings({ preDrop: value as PixGridDeckPreDropBehavior })} />
        </Field>
      </Section>
      <Section title="Song sections" description="Give a section its own image duration, a specific image, or its own motion. Empty rows follow the sequence.">
        <div className="ll-deck-table ll-deck-table--sections" role="table" aria-label="Section settings">
          <div className="ll-deck-row ll-deck-row--head" role="row"><span>Section</span><span>Image duration</span><span>Assigned image</span><span>Scene motion</span></div>
          {PIX_GRID_DECK_SECTION_TYPES.map(type => (
            <div key={type} className="ll-deck-row" role="row">
              <span className="ll-deck-section-name">{SECTION_LABELS[type]}</span>
              <BeatsInput value={deck.sections[type].beats} placeholder={String(deck.defaultDuration)} label={`${type} image duration in beats`} onChange={value => patch(type, { beats: value })} />
              <Dropdown id={`ll-deck-section-${type}-image`} ariaLabel={`${type} assigned Deck image`} value={deck.sections[type].item} size="dense"
                options={[{ value: '', label: 'Use Sequence' }, ...enabled.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.name}` }))]} onChange={value => patch(type, { item: value })} />
              <Dropdown id={`ll-deck-section-${type}-motion`} ariaLabel={`${type} scene motion profile`} value={deck.sections[type].motion} size="dense"
                options={[{ value: POPOVER_INHERIT, label: 'Inherit Motion' }, ...MOTION_PROFILE_OPTIONS]} onChange={value => patch(type, { motion: value })} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Screen 5: Review ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ReviewScreen({ deck, readiness, ship, onDelete }: { deck: PopoverDeck; readiness: PopoverReadiness; ship: PopoverShip | null; onDelete: () => void }) {
  const enabled = deck.items.filter(item => item.enabled)
  const label = (options: ReadonlyArray<{ value: string; label: string }>, value: string) => options.find(option => option.value === value)?.label ?? value
  const rows: Array<[string, string]> = [
    ['Name', deck.name || 'Untitled Deck'],
    ['Images', `${enabled.length} enabled of ${deck.items.length}`],
    ['Order', `${label(PLAYBACK_OPTIONS, deck.playback)}${deck.loop ? ' · loops' : ''}`],
    ['Default duration', `${deck.defaultDuration} beats`],
    ['Audio reaction', label(REACTION_OPTIONS, deck.reaction)],
    ['Transition', `${label(TRANSITION_OPTIONS, deck.transitionMode)} · ${Math.round(deck.transitionLength * 100)}% of image`],
    ['Motion', label(MOTION_PROFILE_OPTIONS, deck.motion)],
    ['PreDrop', label(PRE_DROP_OPTIONS, deck.preDrop)],
    ['Overrides', `${Object.keys(deck.pairs).length} pair · ${Object.values(deck.sections).filter(section => section.beats != null || section.item || section.motion !== POPOVER_INHERIT).length} section`],
  ]
  const status = readiness.level === 'ready' ? 'READY' : readiness.level === 'error' ? 'ERROR' : readiness.level === 'invalid' ? 'NEEDS IMAGES' : 'WORKING'
  return (
    <div className="ll-deck-split ll-deck-split--review">
      <div className="ll-deck-col">
        <Section title="Summary" description="Everything the Preset will be created with. Go back to any screen to change it.">
          <dl className="ll-deck-kv">{rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        </Section>
      </div>
      <div className="ll-deck-col">
        <div className="ll-deck-section-body">
          <section className="ll-deck-readiness" aria-live="polite" data-level={readiness.level}>
            <header><strong>Compile Readiness</strong><span>{status}</span></header>
            <ProgressRow label="Images" progress={readiness.frameProgress} />
            <ProgressRow label="Transitions" progress={readiness.transitionProgress} />
            <p>{readiness.message}</p>
            {readiness.errors.map((error, index) => <NoticeCard key={`${error}-${index}`} tone="error" role="alert" title="Deck compiler error">{error}</NoticeCard>)}
          </section>
        </div>
        {ship && (
          <Section title="Shipping (development only)" description="Writes this Deck into the repository as a built-in preset: a manifest plus images resized to 512 px. Pick the repository root.">
            <IconChipButton disabled={readiness.level !== 'ready' || ship.busy} onClick={ship.onExport}>{ship.busy ? 'Exporting…' : 'Export for shipping…'}</IconChipButton>
            {ship.message && <NoticeCard tone="success" role="status" title="Exported">{ship.message}</NoticeCard>}
            {ship.error && <NoticeCard tone="error" role="alert" title="Export failed">{ship.error}</NoticeCard>}
          </Section>
        )}
        <Section title="Danger zone">
          <IconChipButton className="dv-icon-chip--danger" onClick={onDelete}>Delete Deck</IconChipButton>
        </Section>
      </div>
    </div>
  )
}

// ── Popover ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The PixGrid Deck builder as one popover: five screens (Images, Playback, Transitions, Sections, Review) on the application's dialog shell.
 * It owns only the current step; everything else comes from the host, so Preset Manager can drive it from the real Deck and the Layout Lab
 * can drive it from fixtures.
 */
export function PixGridDeckPopover(props: PixGridDeckPopoverProps) {
  const { mode, deck, nameError, upload, readiness, created, presetCreated, preview, ship, deletePending, onClose } = props
  const titleId = useId()
  const [step, setStep] = useState<StepId>('images')
  const bodyRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const enabledCount = deck.items.filter(item => item.enabled).length
  // An upload in flight is not cancelled by a stray click on the backdrop or an Escape; the close button still cancels it.
  const passiveClose = () => { if (!upload.active) onClose() }

  useEffect(() => { modalRef.current?.focus() }, [])
  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }) }, [step, created])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !deletePending && !upload.active) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [deletePending, onClose, upload.active])

  const index = STEPS.findIndex(candidate => candidate.id === step)
  const imagesDone = enabledCount >= PIX_GRID_DECK_MIN_ITEMS && deck.name.trim().length > 0 && !nameError
  const canAdvance = step !== 'images' || imagesDone
  const stepDone = (id: StepId) => id === 'images' ? imagesDone : STEPS.findIndex(candidate => candidate.id === id) < index

  return (
    <>
    <div className="mum-backdrop ll-deck-backdrop" onMouseDown={passiveClose}>
      <div ref={modalRef} tabIndex={-1} className="mum-modal ll-deck-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={event => event.stopPropagation()}>
        <header className="mum-header">
          <div className="mum-title">
            <span className="ll-deck-title-badge" aria-hidden="true"><AppIcon kind="pixGrid" size={17} color="currentColor" /></span>
            <span id={titleId}>{mode === 'edit' ? 'EDIT PIXGRID DECK' : 'CREATE PIXGRID DECK'}</span>
          </div>
          <div className="ll-deck-header-meta">
            {!created && <span className="ll-deck-step-count">Step {index + 1} of {STEPS.length}</span>}
            <button type="button" className="mum-close" aria-label="Close" onClick={onClose}><AppIcon kind="close" size={14} /></button>
          </div>
        </header>

        {created ? (
          <div className="mum-body ll-deck-body ll-deck-success" ref={bodyRef}>
            <span className="dv-confirm-icon dv-confirm-icon--neutral" aria-hidden="true"><AppIcon kind="check" size={22} color="currentColor" /></span>
            <h2>Preset created</h2>
            <p>“{deck.name}” is now in your Preset Library under Custom, with {enabledCount} images, generated transitions and your section settings.</p>
          </div>
        ) : (
          <>
            <nav className="ll-deck-steps" role="tablist" aria-label="Deck builder steps">
              {STEPS.map((candidate, position) => (
                <button key={candidate.id} type="button" role="tab" aria-selected={step === candidate.id} className={`ll-deck-step${step === candidate.id ? ' is-active' : ''}${stepDone(candidate.id) ? ' is-done' : ''}`} onClick={() => setStep(candidate.id)}>
                  <span className="ll-deck-step-badge" aria-hidden="true">{stepDone(candidate.id) && step !== candidate.id ? <AppIcon kind="check" size={11} color="currentColor" /> : position + 1}</span>
                  <span>{candidate.label}</span>
                </button>
              ))}
            </nav>
            <div className="mum-body ll-deck-body" ref={bodyRef} role="tabpanel" aria-label={STEPS[index]!.label}>
              {step === 'images' && <ImagesScreen {...props} />}
              {step === 'playback' && <PlaybackScreen deck={deck} onSettings={props.onSettings} />}
              {step === 'transitions' && <TransitionsScreen deck={deck} onSettings={props.onSettings} />}
              {step === 'sections' && <SectionsScreen deck={deck} onSettings={props.onSettings} />}
              {step === 'review' && <ReviewScreen deck={deck} readiness={readiness} ship={ship} onDelete={props.onDeleteRequest} />}
            </div>
          </>
        )}

        <footer className="mum-footer ll-deck-footer">
          {created ? (
            <IconChipButton tone="primary" onClick={onClose}>Done</IconChipButton>
          ) : (
            <>
              <IconChipButton disabled={index === 0} onClick={() => setStep(STEPS[index - 1]!.id)}>Back</IconChipButton>
              <span className="ll-deck-footer-hint">{step === 'images' && !canAdvance ? 'Name the Deck and enable at least two images to continue.' : readiness.level === 'preparing' && step === 'review' ? 'Preparing images and transitions…' : ''}</span>
              {step !== 'review'
                ? <IconChipButton tone="primary" disabled={!canAdvance} onClick={() => setStep(STEPS[index + 1]!.id)}>Next</IconChipButton>
                : presetCreated
                  ? <IconChipButton tone="primary" onClick={onClose}>Done</IconChipButton>
                  : <IconChipButton tone="primary" disabled={readiness.level !== 'ready' || upload.active} onClick={props.onCreate}>Create Preset</IconChipButton>}
            </>
          )}
        </footer>
      </div>
    </div>
    {/* A sibling of the backdrop, not a child: a press inside the confirmation must not dismiss the popover behind it. */}
    {deletePending && (
      <ConfirmDialog
        title="Delete Deck" message="Deleting this Deck will delete the Preset too. Are you sure?"
        onCancel={props.onDeleteCancel} onConfirm={props.onDeleteConfirm}
      />
    )}
    </>
  )
}
