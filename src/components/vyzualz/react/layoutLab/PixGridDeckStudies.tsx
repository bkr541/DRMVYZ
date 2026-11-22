import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { HeaderControlGroup } from '../../layout/HeaderControlGroup'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import { HeaderActionIcon } from '../../layout/HeaderActionIcon'
import { SaveGlyph } from '../../layout/HeaderGlyphs'
import { REACT_ENGINE_CATALOG } from '../reactEngineCatalog'
import appearance from '../../../../styles/appearance.css?inline'
import modalStyles from '../../../../styles/mediaUploadModal.css?inline'
import popoverStyles from '../../../../styles/pixGridDeckPopover.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import headerStyles from '../../layout/HeaderControlGroup.css?inline'
import { PixGridDeckPopover } from '../pixGrid/PixGridDeckPopover'
import type { PopoverDeck, PopoverItem, PopoverSettingsPatch, PopoverUpload } from '../pixGrid/pixGridDeckPopoverModel'
import {
  DECK_STUDY_MAX_ITEMS,
  PREVIEW_COLUMNS,
  PREVIEW_ROWS,
  SAMPLE_IMAGE_NAMES,
  createStudyDeck,
  drawStudyFrame,
  studyFrame,
  studyItem,
  studyReadiness,
  type DeckStudyScenario,
} from './pixGridDeckStudyModel'
import styles from './pixGridDeckStudies.css?inline'

const SCENARIOS: ReadonlyArray<{ id: DeckStudyScenario; label: string; description: string }> = [
  { id: 'new', label: 'New Deck', description: 'Empty: name it, then upload images.' },
  { id: 'editing', label: 'Editing a Deck', description: 'Five images, one with its own duration and one switched off; compiles to Ready.' },
  { id: 'compiling', label: 'Compiling', description: 'Frames and transitions still being prepared: Create Preset stays disabled.' },
  { id: 'error', label: 'Compile error', description: 'An image failed to decode: the readiness card shows the error.' },
]

function frameSeed(name: string): number {
  let hash = 7
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return hash
}

function PixelPreview({ from, to, progress }: { from: Uint8ClampedArray; to: Uint8ClampedArray; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (canvasRef.current) drawStudyFrame(canvasRef.current, from, to, progress) }, [from, to, progress])
  return <canvas ref={canvasRef} className="ll-deck-canvas" width={PREVIEW_COLUMNS * 8} height={PREVIEW_ROWS * 8} role="img" aria-label="Live PixGrid preview" />
}

/** The popover driven by fixtures: every action edits local state, and compile progress moves on a timer so each state can be seen. */
function StudyPopover({ scenario, development, onClose }: { scenario: DeckStudyScenario; development: boolean; onClose: () => void }) {
  const [deck, setDeck] = useState(() => createStudyDeck(scenario))
  const [created, setCreated] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [upload, setUpload] = useState<PopoverUpload>({ active: false, phase: 'Ready', error: null, warnings: [] })
  const [elapsed, setElapsed] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const enabled = deck.items.filter(item => item.enabled)
  const compileKey = enabled.map(item => item.id).join('|')
  useEffect(() => {
    setElapsed(0)
    const started = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 120)
    return () => window.clearInterval(timer)
  }, [compileKey, scenario])

  const selectedId = enabled.some(item => item.id === previewId) ? previewId : enabled[0]?.id ?? null
  const previewIndex = Math.max(0, enabled.findIndex(item => item.id === selectedId))
  const current = enabled[previewIndex]
  const next = enabled.length > 1 ? enabled[(previewIndex + 1) % enabled.length] : current
  const frames = useMemo(() => ({
    from: studyFrame(current ? frameSeed(current.name) : 0),
    to: studyFrame(next ? frameSeed(next.name) : 0),
  }), [current, next])

  const setItems = (items: PopoverItem[]) => setDeck(value => ({ ...value, items }))
  const patchItem = (id: string, patch: Partial<PopoverItem>) => setItems(deck.items.map(item => item.id === id ? { ...item, ...patch } : item))
  const addNames = (names: string[]) => {
    const remaining = DECK_STUDY_MAX_ITEMS - deck.items.length
    const accepted = names.slice(0, Math.max(0, remaining))
    const rejected = names.length - accepted.length
    if (accepted.length === 0) return
    setUpload({ active: true, phase: `${accepted[0]}: Uploading original…`, error: null, warnings: [] })
    window.setTimeout(() => {
      setDeck(value => ({ ...value, items: [...value.items, ...accepted.map(name => studyItem(name))] }))
      setUpload({
        active: false, phase: rejected > 0 ? 'Ready with warnings' : 'Ready', error: null,
        warnings: rejected > 0 ? [`${rejected} image${rejected === 1 ? ' was' : 's were'} not added: a Deck holds at most ${DECK_STUDY_MAX_ITEMS} images.`] : [],
      })
    }, 700)
  }
  const reorder = (sourceId: string, targetId: string) => {
    const list = [...deck.items]
    const sourceIndex = list.findIndex(item => item.id === sourceId)
    if (sourceIndex < 0 || sourceId === targetId) return
    const [moved] = list.splice(sourceIndex, 1)
    list.splice(list.findIndex(item => item.id === targetId), 0, moved!)
    setItems(list)
  }
  const move = (id: string, direction: -1 | 1) => {
    const index = deck.items.findIndex(item => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= deck.items.length) return
    const list = [...deck.items]
    ;[list[index], list[target]] = [list[target]!, list[index]!]
    setItems(list)
  }
  const duplicate = (id: string) => {
    const index = deck.items.findIndex(item => item.id === id)
    const source = deck.items[index]
    if (!source) return
    setItems([...deck.items.slice(0, index + 1), studyItem(source.name, { duration: source.duration }), ...deck.items.slice(index + 1)])
  }
  const setName = (name: string) => {
    setDeck(value => ({ ...value, name }))
    setNameError(name.trim() ? null : 'Deck name is required.')
  }
  const settings = (patch: PopoverSettingsPatch) => setDeck((value: PopoverDeck) => ({ ...value, ...patch }))

  return (
    <PixGridDeckPopover
      mode={deck.items.length > 0 && scenario !== 'new' ? 'edit' : 'create'}
      deck={deck}
      nameError={nameError}
      upload={upload}
      readiness={studyReadiness(deck, scenario, elapsed)}
      created={created}
      presetCreated={false}
      preview={{
        itemId: selectedId,
        progress,
        stage: enabled.length > 0 ? <PixelPreview from={frames.from} to={frames.to} progress={progress} /> : null,
        onItem: setPreviewId,
        onProgress: setProgress,
      }}
      ship={development ? { busy: false, message: null, error: null, onExport: () => undefined } : null}
      deletePending={deletePending}
      onName={setName}
      onNameCommit={() => undefined}
      onFiles={files => addNames(files.map(file => file.name))}
      onAddSamples={() => addNames([...SAMPLE_IMAGE_NAMES].slice(0, 5))}
      onMove={move}
      onDuplicate={duplicate}
      onReorder={reorder}
      onToggle={id => patchItem(id, { enabled: !deck.items.find(item => item.id === id)?.enabled })}
      onRemove={id => setItems(deck.items.filter(item => item.id !== id))}
      onDuration={(id, beats) => patchItem(id, { duration: beats })}
      onSettings={settings}
      onCreate={() => setCreated(true)}
      onDeleteRequest={() => setDeletePending(true)}
      onDeleteCancel={() => setDeletePending(false)}
      onDeleteConfirm={() => { setDeletePending(false); onClose() }}
      onClose={onClose}
    />
  )
}

/**
 * Study for the PixGrid create-deck popover opened from the Preset Manager toolbar's PixGrid key. The popover is the same component Preset Manager
 * now opens (`PixGridDeckPopover`); here it is driven by local fixtures instead of the real Deck, so every state can be opened and nothing is
 * wired to the store, the Media Library or the compiler.
 */
export function PixGridDeckStudies() {
  const [open, setOpen] = useState<DeckStudyScenario | null>(null)
  const [scenario, setScenario] = useState<DeckStudyScenario>('editing')
  const [development, setDevelopment] = useState(true)
  const [session, setSession] = useState(0)
  const launch = (next: DeckStudyScenario) => { setScenario(next); setSession(value => value + 1); setOpen(next) }
  const tokens = { '--ll-deck-accent': '#67f7ff' } as CSSProperties
  return (
    <div className="ll-deck-studies" style={tokens} data-theme="dark" aria-label="PixGrid Deck popover studies">
      <style>{appearance.replaceAll(':root', ':scope') + modalStyles + dropdownStyles + headerStyles + popoverStyles + styles}</style>
      <section className="ll-deck-lab">
        <h2>PixGrid Deck popover</h2>
        <p>Preset Manager's Create PixGrid Deck key opens this popover. Here it runs on fixtures; open it in each state:</p>
        <div className="ll-deck-toolbar-mock" aria-label="Preset Manager toolbar">
          <span className="ll-deck-toolbar-label">Preset Manager toolbar</span>
          <HeaderControlGroup label="Preset Manager controls">
            <HeaderIconKey label="Create preset" icon={<HeaderActionIcon action="create" />} onClick={() => undefined} />
            <HeaderIconKey label="Create PixGrid Deck" icon={<AppIcon kind={REACT_ENGINE_CATALOG.pixGrid.icon} size={16} color="currentColor" aria-hidden="true" />} pressed={open !== null} onClick={() => launch('new')} />
            <HeaderIconKey label="Save preset" icon={<SaveGlyph />} onClick={() => undefined} />
            <HeaderIconKey label="Duplicate preset" icon={<HeaderActionIcon action="duplicate" />} onClick={() => undefined} />
            <HeaderIconKey label="Delete preset" icon={<HeaderActionIcon action="delete" />} danger onClick={() => undefined} />
          </HeaderControlGroup>
        </div>
        <div className="ll-deck-scenarios" role="group" aria-label="Popover states">
          {SCENARIOS.map(candidate => (
            <button key={candidate.id} type="button" className="ll-deck-scenario" data-scenario={candidate.id} aria-pressed={scenario === candidate.id && open !== null} onClick={() => launch(candidate.id)}>
              <strong>{candidate.label}</strong><span>{candidate.description}</span>
            </button>
          ))}
        </div>
        <label className="ll-deck-dev"><input type="checkbox" checked={development} onChange={event => setDevelopment(event.target.checked)} /> Show the development-only shipping action on the Review screen</label>
      </section>
      {open !== null && <StudyPopover key={session} scenario={open} development={development} onClose={() => setOpen(null)} />}
    </div>
  )
}
