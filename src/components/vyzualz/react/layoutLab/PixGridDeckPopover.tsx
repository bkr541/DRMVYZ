import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
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
  PIX_GRID_DECK_SECTION_TYPES,
  PLAYBACK_OPTIONS,
  PRE_DROP_OPTIONS,
  REACTION_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../showManager/PixGridDeckBuilder'
import { PIX_GRID_DECK_NAME_MAX_LENGTH } from '../pixGrid/PixGridDeckDomain'
import type { PixGridDeckMusicalArrivalAnchor, PixGridDeckPlaybackOrder, PixGridDeckPreDropBehavior, PixGridDeckReactionProfileId, PixGridDeckTransitionMode } from '../pixGrid/PixGridDeckDomain'
import {
  DECK_STUDY_MAX_ITEMS,
  DECK_STUDY_MIN_ITEMS,
  PREVIEW_COLUMNS,
  PREVIEW_ROWS,
  SAMPLE_IMAGE_NAMES,
  createStudyDeck,
  drawStudyFrame,
  enabledStudyItems,
  studyFrame,
  studyItem,
  studyReadiness,
  studyTransitionPairs,
  type DeckStudyDeck,
  type DeckStudyScenario,
  type DeckStudySectionType,
} from './pixGridDeckStudyModel'

type StepId = 'images' | 'playback' | 'transitions' | 'sections' | 'review'
const STEPS: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: 'images', label: 'Images' },
  { id: 'playback', label: 'Playback' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'sections', label: 'Sections' },
  { id: 'review', label: 'Review' },
]
const SECTION_LABELS: Record<DeckStudySectionType, string> = {
  intro: 'Intro', verse: 'Verse', build: 'Build', preDrop: 'PreDrop', drop: 'Drop', breakdown: 'Breakdown', bridge: 'Bridge', outro: 'Outro',
}
const NO_MOTION = 'default'
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp'

type Update = (patch: Partial<DeckStudyDeck>) => void

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`ll-deck-field${wide ? ' ll-deck-field--wide' : ''}`}>
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

// ── Screen 1: Images ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function PixelPreview({ from, to, progress }: { from: Uint8ClampedArray; to: Uint8ClampedArray; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (canvasRef.current) drawStudyFrame(canvasRef.current, from, to, progress) }, [from, to, progress])
  return <canvas ref={canvasRef} className="ll-deck-canvas" width={PREVIEW_COLUMNS * 8} height={PREVIEW_ROWS * 8} role="img" aria-label="Live PixGrid preview" />
}

function frameSeed(name: string): number {
  let hash = 7
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return hash
}

function ImagesScreen({ deck, update, nameError, upload, setUpload, studyMode }: {
  deck: DeckStudyDeck
  update: Update
  nameError: string | null
  upload: { active: boolean; phase: string; error: string | null; warnings: string[] }
  setUpload: (value: { active: boolean; phase: string; error: string | null; warnings: string[] }) => void
  studyMode: DeckStudyScenario
}) {
  const inputId = useId()
  const dragged = useRef<string | null>(null)
  const items = deck.items
  const enabled = enabledStudyItems(deck)
  const remaining = DECK_STUDY_MAX_ITEMS - items.length
  const [previewId, setPreviewId] = useState<string | null>(enabled[0]?.id ?? null)
  const [progress, setProgress] = useState(0)
  const previewIndex = Math.max(0, enabled.findIndex(item => item.id === previewId))
  const current = enabled[previewIndex]
  const next = enabled.length > 1 ? enabled[(previewIndex + 1) % enabled.length] : current
  const frames = useMemo(() => ({
    from: studyFrame(current ? frameSeed(current.name) : 0),
    to: studyFrame(next ? frameSeed(next.name) : 0),
  }), [current, next])
  useEffect(() => { if (!enabled.some(item => item.id === previewId)) setPreviewId(enabled[0]?.id ?? null) }, [enabled, previewId])

  const addNames = (names: string[]) => {
    const accepted = names.slice(0, Math.max(0, remaining))
    const rejected = names.length - accepted.length
    if (accepted.length === 0) return
    setUpload({ active: true, phase: `${accepted[0]}: Uploading original…`, error: null, warnings: [] })
    window.setTimeout(() => {
      update({ items: [...items, ...accepted.map(name => studyItem(name))] })
      setUpload({
        active: false, phase: rejected > 0 ? 'Ready with warnings' : 'Ready', error: null,
        warnings: rejected > 0 ? [`${rejected} image${rejected === 1 ? ' was' : 's were'} not added: a Deck holds at most ${DECK_STUDY_MAX_ITEMS} images.`] : [],
      })
    }, 700)
  }
  const reorder = (sourceId: string, targetId: string) => {
    const list = [...items]
    const sourceIndex = list.findIndex(item => item.id === sourceId)
    if (sourceIndex < 0 || sourceId === targetId) return
    const [moved] = list.splice(sourceIndex, 1)
    list.splice(list.findIndex(item => item.id === targetId), 0, moved!)
    update({ items: list })
  }
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const list = [...items]
    ;[list[index], list[target]] = [list[target]!, list[index]!]
    update({ items: list })
  }
  const patchItem = (id: string, patch: Partial<DeckStudyDeck['items'][number]>) => update({ items: items.map(item => item.id === id ? { ...item, ...patch } : item) })
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files).map(file => file.name)
    if (files.length > 0) addNames(files)
  }

  return (
    <div className="ll-deck-split">
      <div className="ll-deck-col">
        <Field label="Deck name" hint={`${deck.name.length} of ${PIX_GRID_DECK_NAME_MAX_LENGTH} characters`}>
          <DreamVizTextInput
            value={deck.name} maxLength={PIX_GRID_DECK_NAME_MAX_LENGTH} aria-label={items.length > 0 ? 'Deck name' : 'New Deck name'}
            aria-invalid={Boolean(nameError)} onChange={event => update({ name: event.target.value })}
          />
          {nameError && <NoticeCard tone="error" role="alert" title="Deck name">{nameError}</NoticeCard>}
        </Field>

        <label
          htmlFor={inputId} className={`ll-deck-drop${upload.active ? ' is-busy' : ''}${remaining <= 0 ? ' is-full' : ''}`}
          onDragOver={event => event.preventDefault()} onDrop={onDrop}
        >
          <input
            id={inputId} type="file" accept={IMAGE_ACCEPT} multiple disabled={upload.active || remaining <= 0}
            onChange={event => { const names = Array.from(event.currentTarget.files ?? []).map(file => file.name); event.currentTarget.value = ''; if (names.length) addNames(names) }}
          />
          <span className="ll-deck-drop-icon" aria-hidden="true"><AppIcon kind="imageAdd" size={22} color="currentColor" /></span>
          <strong>{items.length > 0 ? 'Add images' : `Upload 2–${DECK_STUDY_MAX_ITEMS} images`}</strong>
          <span>{upload.active ? upload.phase : items.length > 0 ? `${remaining} slots remaining` : `Creates “${deck.name || 'Untitled Deck'}”`}</span>
          <small>PNG, JPEG, SVG or static WebP · drag files here or click to browse</small>
        </label>
        {studyMode === 'new' && items.length === 0 && (
          <button type="button" className="ll-deck-link" onClick={() => addNames([...SAMPLE_IMAGE_NAMES].slice(0, 5))}>Study only: add five sample images</button>
        )}
        {upload.error && <NoticeCard tone="error" role="alert" title="Deck upload failed">{upload.error}</NoticeCard>}
        {upload.warnings.map(warning => <NoticeCard key={warning} tone="warning" role="status" title="Deck upload warning">{warning}</NoticeCard>)}

        <div className="ll-deck-list-head"><strong>Images</strong><span>{items.length} of {DECK_STUDY_MAX_ITEMS} · {enabled.length} enabled</span></div>
        <div className="ll-deck-list" role="list" aria-label="Ordered Deck images">
          {items.map((item, index) => (
            <article
              key={item.id} role="listitem" draggable
              className={`ll-deck-image${previewId === item.id ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}`}
              onDragStart={() => { dragged.current = item.id }} onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); if (dragged.current) reorder(dragged.current, item.id); dragged.current = null }}
            >
              <button type="button" className="ll-deck-image-main" aria-pressed={previewId === item.id} onClick={() => item.enabled && setPreviewId(item.id)}>
                <span className="ll-deck-image-order">{String(index + 1).padStart(2, '0')}</span>
                <span className="ll-deck-image-copy"><strong>{item.name}</strong><small>{item.enabled ? 'Enabled' : 'Disabled'} · rev {item.revision}</small></span>
              </button>
              <label className="ll-deck-image-timing">
                <BeatsInput value={item.duration} placeholder={String(deck.defaultDuration)} label={`${item.name} duration in beats`} onChange={value => patchItem(item.id, { duration: value })} />
              </label>
              <div className="ll-deck-image-actions" aria-label={`${item.name} actions`}>
                <IconChipButton className="ll-deck-icon-button" aria-label="Move image earlier" title="Move earlier" disabled={index === 0} icon={<AppIcon kind="up" size={13} color="currentColor" />} onClick={() => move(index, -1)} />
                <IconChipButton className="ll-deck-icon-button" aria-label="Move image later" title="Move later" disabled={index === items.length - 1} icon={<AppIcon kind="down" size={13} color="currentColor" />} onClick={() => move(index, 1)} />
                <IconChipButton className="ll-deck-icon-button" aria-label="Duplicate image occurrence" title="Duplicate" disabled={remaining <= 0} icon={<AppIcon kind="copy" size={13} color="currentColor" />} onClick={() => update({ items: [...items.slice(0, index + 1), studyItem(item.name, { duration: item.duration }), ...items.slice(index + 1)] })} />
                <button type="button" className="ll-deck-toggle" aria-pressed={item.enabled} onClick={() => patchItem(item.id, { enabled: !item.enabled })}>{item.enabled ? 'On' : 'Off'}</button>
                <IconChipButton className="ll-deck-icon-button ll-deck-icon-button--danger" aria-label="Remove image" title="Remove" disabled={items.length <= DECK_STUDY_MIN_ITEMS} icon={<AppIcon kind="close" size={13} color="currentColor" />} onClick={() => update({ items: items.filter(candidate => candidate.id !== item.id) })} />
              </div>
            </article>
          ))}
          {items.length === 0 && <div className="ll-deck-empty">Name the Deck, then upload at least two images.</div>}
        </div>
      </div>

      <aside className="ll-deck-col ll-deck-preview" aria-label="Deck preview">
        <div className="ll-deck-list-head"><strong>Live preview</strong><span>{enabled.length > 0 ? `Image ${previewIndex + 1} → ${enabled.length > 1 ? (previewIndex + 1) % enabled.length + 1 : 1}` : 'No images yet'}</span></div>
        <div className={`ll-deck-stage${enabled.length === 0 ? ' is-empty' : ''}`}>
          {enabled.length > 0 ? <PixelPreview from={frames.from} to={frames.to} progress={progress} /> : <span>Upload at least two images to preview your Deck.</span>}
        </div>
        {enabled.length > 1 && (
          <>
            <div className="ll-deck-sequence">
              <div className="ll-deck-sequence-head">
                <div><strong>Deck sequence</strong><span>{enabled.length} enabled images · musical preview</span></div>
                <div className="ll-deck-preview-nav">
                  <IconChipButton className="ll-deck-icon-button" aria-label="Previous Deck image" icon={<AppIcon kind="left" size={13} color="currentColor" />} onClick={() => setPreviewId(enabled[(previewIndex + enabled.length - 1) % enabled.length]!.id)} />
                  <IconChipButton className="ll-deck-icon-button" aria-label="Next Deck image" icon={<AppIcon kind="chevronRight" size={13} color="currentColor" />} onClick={() => setPreviewId(enabled[(previewIndex + 1) % enabled.length]!.id)} />
                </div>
              </div>
              <div className="ll-deck-chips">
                {enabled.map((item, index) => (
                  <button key={item.id} type="button" className={previewId === item.id ? 'is-active' : ''} onClick={() => setPreviewId(item.id)}>
                    <span>{index + 1}</span><strong>{item.name}</strong><small>{item.duration ?? deck.defaultDuration} beats</small>
                  </button>
                ))}
              </div>
            </div>
            <label className="ll-deck-scrub">
              <span>Preview {previewIndex + 1} → {(previewIndex + 1) % enabled.length + 1}</span>
              <input type="range" min={0} max={1} step={0.01} value={progress} aria-label="Scrub generated PixGrid transition" onChange={event => setProgress(Number(event.target.value))} />
              <small>{Math.round(progress * 100)}% generated intermediate frame</small>
            </label>
          </>
        )}
      </aside>
    </div>
  )
}

// ── Screen 2: Playback ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

function PlaybackScreen({ deck, update }: { deck: DeckStudyDeck; update: Update }) {
  return (
    <div className="ll-deck-stack">
      <Section title="Playback" description="How the Deck steps through its images.">
        <div className="ll-deck-grid">
          <Field label="Order">
            <Dropdown id="ll-deck-order" ariaLabel="Deck playback order" value={deck.playback} options={PLAYBACK_OPTIONS} size="compact" onChange={value => update({ playback: value as PixGridDeckPlaybackOrder })} />
          </Field>
          <Field label="Default image duration" hint="Images without their own duration use this. Set one per image on the Images screen.">
            <BeatsInput value={deck.defaultDuration} label="Default image duration in beats" onChange={value => update({ defaultDuration: value ?? 4 })} />
          </Field>
        </div>
        <label className="ll-deck-check"><IconMorphCheckbox checked={deck.loop} onChange={event => update({ loop: event.target.checked })} /><span>Loop sequence</span></label>
      </Section>
      <Section title="Audio Reaction" description="How strongly and in what style the pixels respond to the music.">
        <Field label="Reaction profile">
          <Dropdown id="ll-deck-reaction" ariaLabel="Deck reaction profile" value={deck.reaction} options={REACTION_OPTIONS} size="compact" onChange={value => update({ reaction: value as PixGridDeckReactionProfileId })} />
        </Field>
      </Section>
    </div>
  )
}

// ── Screen 3: Transitions ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function TransitionsScreen({ deck, update }: { deck: DeckStudyDeck; update: Update }) {
  const pairs = studyTransitionPairs(deck)
  const setPair = (key: string, patch: Partial<DeckStudyDeck['pairs'][string]>) => {
    const base: DeckStudyDeck['pairs'][string] = deck.pairs[key] ?? { mode: 'default', motion: NO_MOTION, length: null }
    const next = { ...deck.pairs, [key]: { ...base, ...patch } }
    const entry = next[key]!
    if (entry.mode === 'default' && entry.motion === 'default' && entry.length == null) delete next[key]
    update({ pairs: next })
  }
  return (
    <div className="ll-deck-stack">
      <Section title="Transition" description="How one image becomes the next. Pair and section settings take precedence over these defaults.">
        <div className="ll-deck-grid">
          <Field label="Motion profile" hint="Preset default · pair and scene overrides take precedence.">
            <Dropdown id="ll-deck-motion" ariaLabel="Deck motion profile" value={deck.motion} options={MOTION_PROFILE_OPTIONS} size="compact" onChange={value => update({ motion: value })} />
            <button type="button" className="ll-deck-link" onClick={() => update({ motion: 'balanced', pairs: Object.fromEntries(Object.entries(deck.pairs).map(([key, pair]) => [key, { ...pair, motion: NO_MOTION }])), sections: Object.fromEntries(Object.entries(deck.sections).map(([key, section]) => [key, { ...section, motion: NO_MOTION }])) as DeckStudyDeck['sections'] })}>Reset motion overrides</button>
          </Field>
          <Field label="Transition mode">
            <Dropdown id="ll-deck-mode" ariaLabel="Deck transition mode" value={deck.transitionMode} options={TRANSITION_OPTIONS} size="compact" onChange={value => update({ transitionMode: value as PixGridDeckTransitionMode })} />
          </Field>
          <Field label="Transition length">
            <span className="ll-deck-beats">
              <DreamVizTextInput type="number" min={0} max={0.75} step={0.05} value={deck.transitionLength} aria-label="Transition length" onChange={event => update({ transitionLength: Math.min(0.75, Math.max(0, Number(event.target.value))) })} />
              <small>of image</small>
            </span>
          </Field>
          <Field label="Timing anchor">
            <Dropdown id="ll-deck-anchor" ariaLabel="Deck transition timing anchor" value={deck.anchorMode} size="compact" onChange={value => update({ anchorMode: value as 'onset' | 'arrival' })}
              options={[{ value: 'onset', label: 'Start on boundary' }, { value: 'arrival', label: 'Arrive on boundary' }]} />
          </Field>
          {deck.anchorMode === 'arrival' && (
            <Field label="Arrival event">
              <Dropdown id="ll-deck-arrival" ariaLabel="Deck transition arrival event" value={deck.arrivalAnchor} options={ARRIVAL_ANCHOR_OPTIONS} size="compact" onChange={value => update({ arrivalAnchor: value as PixGridDeckMusicalArrivalAnchor })} />
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
                  <Dropdown id={`ll-deck-pair-${pair.key}`} ariaLabel={`Transition from image ${pair.from} to image ${pair.to}`} value={entry?.mode ?? 'default'} size="dense"
                    options={[{ value: 'default', label: 'Use Default' }, ...TRANSITION_OPTIONS]} onChange={value => setPair(pair.key, { mode: value })} />
                  <Dropdown id={`ll-deck-pair-motion-${pair.key}`} ariaLabel={`Motion profile from image ${pair.from} to image ${pair.to}`} value={entry?.motion ?? NO_MOTION} size="dense"
                    options={[{ value: NO_MOTION, label: `Inherit ${MOTION_PROFILE_OPTIONS.find(option => option.value === deck.motion)?.label ?? deck.motion}` }, ...MOTION_PROFILE_OPTIONS]} onChange={value => setPair(pair.key, { motion: value })} />
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

function SectionsScreen({ deck, update }: { deck: DeckStudyDeck; update: Update }) {
  const enabled = enabledStudyItems(deck)
  const patch = (type: DeckStudySectionType, value: Partial<DeckStudyDeck['sections'][DeckStudySectionType]>) => update({ sections: { ...deck.sections, [type]: { ...deck.sections[type], ...value } } })
  return (
    <div className="ll-deck-stack">
      <Section title="PreDrop" description="What the image does in the moment before a drop.">
        <Field label="PreDrop behavior">
          <Dropdown id="ll-deck-predrop" ariaLabel="Deck PreDrop behavior" value={deck.preDrop} options={PRE_DROP_OPTIONS} size="compact" onChange={value => update({ preDrop: value as PixGridDeckPreDropBehavior })} />
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
                options={[{ value: NO_MOTION, label: 'Inherit Motion' }, ...MOTION_PROFILE_OPTIONS]} onChange={value => patch(type, { motion: value })} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Screen 5: Review ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ReviewScreen({ deck, readiness, development, onDelete }: {
  deck: DeckStudyDeck
  readiness: ReturnType<typeof studyReadiness>
  development: boolean
  onDelete: () => void
}) {
  const enabled = enabledStudyItems(deck)
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
    ['Overrides', `${Object.keys(deck.pairs).length} pair · ${Object.values(deck.sections).filter(section => section.beats != null || section.item || section.motion !== NO_MOTION).length} section`],
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
            {readiness.errors.map(error => <NoticeCard key={error} tone="error" role="alert" title="Deck compiler error">{error}</NoticeCard>)}
          </section>
        </div>
        {development && (
          <Section title="Shipping (development only)" description="Writes this Deck into the repository as a built-in preset: a manifest plus images resized to 512 px. Pick the repository root.">
            <IconChipButton disabled={readiness.level !== 'ready'}>Export for shipping…</IconChipButton>
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

export function PixGridDeckPopover({ scenario, development, onClose }: { scenario: DeckStudyScenario; development: boolean; onClose: () => void }) {
  const titleId = useId()
  const [deck, setDeck] = useState(() => createStudyDeck(scenario))
  const [step, setStep] = useState<StepId>('images')
  const [created, setCreated] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [upload, setUpload] = useState({ active: false, phase: 'Ready', error: null as string | null, warnings: [] as string[] })
  const [elapsed, setElapsed] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const update: Update = patch => { setDeck(current => ({ ...current, ...patch })); if (patch.name !== undefined) setNameError(patch.name.trim() ? null : 'Deck name is required.') }
  const enabledCount = enabledStudyItems(deck).length
  const compileKey = enabledStudyItems(deck).map(item => item.id).join('|')
  useEffect(() => {
    setElapsed(0)
    const started = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 120)
    return () => window.clearInterval(timer)
  }, [compileKey, scenario])
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [step, created])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !confirmDelete) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmDelete, onClose])

  const readiness = studyReadiness(deck, scenario, elapsed)
  const index = STEPS.findIndex(candidate => candidate.id === step)
  const canAdvance = step !== 'images' || (enabledCount >= DECK_STUDY_MIN_ITEMS && deck.name.trim().length > 0)
  const stepDone = (id: StepId) => id === 'images' ? enabledCount >= DECK_STUDY_MIN_ITEMS && deck.name.trim().length > 0 : STEPS.findIndex(candidate => candidate.id === id) < index

  return (
    <>
    <div className="mum-backdrop ll-deck-backdrop" onMouseDown={onClose}>
      <div className="mum-modal ll-deck-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={event => event.stopPropagation()}>
        <header className="mum-header">
          <div className="mum-title">
            <span className="ll-deck-title-badge" aria-hidden="true"><AppIcon kind="pixGrid" size={17} color="currentColor" /></span>
            <span id={titleId}>{deck.items.length > 0 && scenario !== 'new' ? 'EDIT PIXGRID DECK' : 'CREATE PIXGRID DECK'}</span>
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
              {step === 'images' && <ImagesScreen deck={deck} update={update} nameError={nameError} upload={upload} setUpload={setUpload} studyMode={scenario} />}
              {step === 'playback' && <PlaybackScreen deck={deck} update={update} />}
              {step === 'transitions' && <TransitionsScreen deck={deck} update={update} />}
              {step === 'sections' && <SectionsScreen deck={deck} update={update} />}
              {step === 'review' && <ReviewScreen deck={deck} readiness={readiness} development={development} onDelete={() => setConfirmDelete(true)} />}
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
                : <IconChipButton tone="primary" disabled={readiness.level !== 'ready'} onClick={() => setCreated(true)}>Create Preset</IconChipButton>}
            </>
          )}
        </footer>
      </div>
    </div>
    {/* A sibling of the backdrop, not a child: a press inside the confirmation must not dismiss the popover behind it. */}
    {confirmDelete && (
      <ConfirmDialog
        title="Delete Deck" message="Deleting this Deck will delete the Preset too. Are you sure?"
        onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); onClose() }}
      />
    )}
    </>
  )
}
