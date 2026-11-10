import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { type Cinema2InspectorControlModel } from '../cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2ParameterState } from '../cinema2/parameters/Cinema2ParameterState'
import {
  CINEMA2_TEXT_FIELDS, applySavedText, createTextDraft, isCinema2TextPreset, textContentError, textLines, textParameters,
  type Cinema2SavedText, type Cinema2TextPresetId,
} from '../cinema2/text/Cinema2TextConfiguration'
import { captureCinema2WorkspacePresetState } from '../cinema2/runtime/Cinema2WorkspaceSession'
import { requestTextSceneNavigation, useTextSceneNavigation } from '../../../features/cinema2Text/textSceneNavigation'
import { UnsavedTextSceneChangesDialog } from '../../../features/cinema2Text/UnsavedTextSceneChangesDialog'
import { useCinema2TextLibraryStore } from '../../../features/cinema2Text/cinema2TextStore'
import { useReactStore } from '../../../stores/reactStore'
import { AppIcon } from '../../shared/icons/AppIcon'
import { HeaderActionIcon } from '../layout/HeaderActionIcon'
import { HeaderIconKey } from '../layout/HeaderIconKey'
import '../layout/HeaderControlGroup.css'
import { ContextActionMenu, ContextMenuItemsList } from '../context-menu/ContextActionMenu'
import { Collapsible, TextInputRow } from './ReactControlRows'
import { Cinema2PaletteControls, Cinema2SchemaControl } from './Cinema2InspectorPanel'
import { IconChipButton } from './controls/IconChipButton'
import { LibraryViewToggle } from './controls/LibraryViewToggle'
import { LibrarySearchRow } from './controls/LibrarySearchRow'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import './Cinema2TextLibraryPanel.css'

export function Cinema2TextLibraryPanel({ runtime, mode = 'source' }: { runtime: Cinema2Runtime | null; mode?: 'source' | 'pool' }) {
  const presetId = runtime?.getCompiledPresetPlan().presetId
  if (!runtime || !isCinema2TextPreset(presetId)) return <div className="rv-ctrl-info">Select a text preset to open its text scene library.</div>
  return <TextLibrary key={`${presetId}:${mode}`} runtime={runtime} presetId={presetId} mode={mode} />
}
function TextLibrary({ runtime, presetId, mode }: { runtime: Cinema2Runtime; presetId: Cinema2TextPresetId; mode: 'source' | 'pool' }) {
  const library = useCinema2TextLibraryStore()
  useSyncExternalStore(runtime.getParameterState().subscribe, runtime.getParameterState().getPersistentRevision)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [listingOpen, setListingOpen] = useState(true)
  const [draft, setDraft] = useState<Cinema2ParameterState | null>(null)
  const [name, setName] = useState('')
  const initialDraftParameters = useRef('')
  const screenRef = useRef<HTMLDivElement>(null)
  const previousScreen = useRef<{ draft: Cinema2ParameterState | null; height: number } | null>(null)
  const screenAnimations = useRef<Animation[]>([])
  const session = useRef<{ isDirty: () => boolean; save: () => boolean; discard: () => void }>({ isDirty: () => false, save: () => false, discard: () => {} })
  const [, setDraftRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [poolName, setPoolName] = useState('')
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ record: Cinema2SavedText; x: number; y: number } | null>(null)
  const pools = library.data.pools.filter(pool => pool.presetId === presetId)
  const selectedPool = pools.find(pool => pool.id === selectedPoolId) ?? pools[0]
  const records = library.data.records.filter(record => record.presetId === presetId)
    .filter(record => mode === 'source' || library.data.memberships.some(item => item.poolId === selectedPool?.id && item.recordId === record.id))
    .filter(record => [record.name, ...textLines(presetId, record.parameters, true)].join('\n').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
  const run = (action: () => void) => { try { action(); setError(null) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Text action could not be completed.') } }
  const closeEditor = () => { setDraft(null); setListingOpen(true); setError(null) }
  const begin = (capture: boolean) => requestTextSceneNavigation(() => {
    const next = createTextDraft(presetId, capture ? runtime.getParameterState() : undefined)
    initialDraftParameters.current = JSON.stringify(textParameters(presetId, next))
    setDraft(next)
    setName(''); setError(null); setListingOpen(false); setMenu(null)
  })
  const saveDraft = () => {
    try {
      if (!draft) return false
      library.save(presetId, name, textParameters(presetId, draft))
      closeEditor(); setQuery('')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The text scene could not be saved.')
      return false
    }
  }
  session.current = {
    isDirty: () => draft !== null && (name !== '' || JSON.stringify(textParameters(presetId, draft)) !== initialDraftParameters.current),
    save: saveDraft,
    discard: closeEditor,
  }
  useLayoutEffect(() => {
    if (!draft) return
    return useTextSceneNavigation.getState().register({
      owner: Symbol('text-scene-editor'),
      isDirty: () => session.current.isDirty(),
      save: () => session.current.save(),
      discard: () => session.current.discard(),
    })
  }, [draft])
  useEffect(() => {
    if (!draft) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!session.current.isDirty()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [draft])

  // Animate the group height as well as its contents in both navigation directions.
  useLayoutEffect(() => {
    const screen = screenRef.current
    if (!screen) return
    const previous = previousScreen.current
    const height = screen.scrollHeight
    previousScreen.current = { draft, height }
    if (!previous || previous.draft === draft) return
    screenAnimations.current.forEach(animation => animation.cancel())
    if (!screen.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timing = { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    screenAnimations.current = [
      screen.animate([{ height: `${previous.height}px` }, { height: `${height}px` }], timing),
      screen.firstElementChild!.animate([
        { opacity: 0, transform: `translateY(${draft ? 6 : -6}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], timing),
    ]
  })
  useEffect(() => () => screenAnimations.current.forEach(animation => animation.cancel()), [])

  const activate = (record: Cinema2SavedText) => run(() => {
    applySavedText(runtime, record)
    useReactStore.getState().storeCinema2WorkspacePresetState(captureCinema2WorkspacePresetState(runtime))
  })
  const openMenu = (event: MouseEvent, record: Cinema2SavedText) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ record, x: event.clientX || rect.left, y: event.clientY || rect.bottom })
  }
  const draftValues = draft ? textParameters(presetId, draft) : null
  const contentError = draftValues ? textContentError(presetId, draftValues) : null
  // Reuse canonical definitions and controls; signs remain editable while disabled in the draft.
  const controls: Cinema2InspectorControlModel[] = draft ? CINEMA2_TEXT_FIELDS[presetId].flatMap(id => {
    const definition = draft.getDefinition(id as Parameters<Cinema2ParameterState['getDefinition']>[0])!
    if (id === 'say-it-line-2-text' && draftValues?.['say-it-line-mode'] !== 'two') return []
    return [{ definition, value: draft.getValue(definition.id), enabled: true, disabledReason: null }]
  }) : []
  const change = (control: Cinema2InspectorControlModel, value: Parameters<Cinema2ParameterState['setPersistentValue']>[1]) => {
    const result = draft!.setPersistentValue(control.definition.id, value)
    if (!result.ok) setError(result.diagnostics[0]?.message ?? 'Invalid setting.')
    else { setError(null); setDraftRevision(revision => revision + 1) }
  }
  return <div className="rv-cinema2-text-library" aria-label={`${runtime.getCompiledPresetPlan().manifest.metadata.name} ${mode === 'source' ? 'text scenes' : 'text scene pools'}`}>
    {mode === 'pool' && <Collapsible bodyClassName="dv-library-body" label="Text Scene Pools" icon={<AppIcon kind="folder" size={15} />}>
      <form className="rv-cinema2-text-pool-create" onSubmit={event => { event.preventDefault(); run(() => { const pool = library.createPool(presetId, poolName); setSelectedPoolId(pool.id); setPoolName('') }) }}>
        <DreamVizTextInput value={poolName} maxLength={100} aria-label="New pool name" placeholder="New pool name…" onChange={event => setPoolName(event.target.value)} />
        <IconChipButton type="submit" disabled={!library.userId || !poolName.trim()}>Create Pool</IconChipButton>
      </form>
      <div className="rv-cinema2-text-pools" aria-label="Text scene pools">
        {pools.map(pool => <IconChipButton key={pool.id} aria-pressed={selectedPool?.id === pool.id} onClick={() => setSelectedPoolId(pool.id)}>{pool.name} ({library.data.memberships.filter(item => item.poolId === pool.id).length})</IconChipButton>)}
      </div>
      {!pools.length && <div className="rv-ctrl-info">Create a pool, then add text scenes from Source.</div>}
    </Collapsible>}
    {!library.userId && <div className="rv-ctrl-info">Sign in to access your text scenes.</div>}
    <div ref={screenRef} className="rv-cinema2-text-screen">
    {!draft && <Collapsible bodyClassName="dv-library-body" label={mode === 'source' ? 'Text Scenes' : selectedPool?.name ?? 'Pool Scenes'} icon={<AppIcon kind="list" size={15} />} open={listingOpen} onOpenChange={setListingOpen}>

      <LibrarySearchRow value={query} onChange={setQuery} placeholder="Search text scenes…" label="Search text scenes" clearable>
        <div className="vz-md-view-toggles"><LibraryViewToggle view={view} onChange={setView} /></div>
        {mode === 'source' && <div className="vz-header-group rv-cinema2-text-actions" role="toolbar" aria-label="Text scene actions">
          <HeaderIconKey label="Capture Current" icon={<HeaderActionIcon action="capture" />} onClick={() => begin(true)} disabled={!library.userId} />
          <HeaderIconKey label="Add Text Scene" icon={<HeaderActionIcon action="create" />} onClick={() => begin(false)} disabled={!library.userId} />
        </div>}
      </LibrarySearchRow>
      {records.length > 0 && <div className={`rv-cinema2-text-records is-${view}`} role="list" aria-label="Text scenes">
        {records.map(record => {
          const active = Object.entries(record.parameters).every(([id, value]) => JSON.stringify(runtime.getParameterState().getValue(id as Parameters<Cinema2ParameterState['getValue']>[0])) === JSON.stringify(value))
          return <div key={record.id} role="listitem" className="rv-preset-card-shell rv-preset-spotlight-shell"><button className={`rv-cinema2-text-card rv-preset-card rv-preset-spotlight-card ${view === 'grid' ? 'rv-preset-spotlight-card--poster' : 'rv-preset-spotlight-card--no-thumb'}${active ? ' is-active rv-preset-card--active rv-preset-spotlight-card--active' : ''}`} onClick={event => openMenu(event, record)} onContextMenu={event => openMenu(event, record)} aria-label={`${record.name} actions`} aria-haspopup="menu">
            <span className="rv-cinema2-text-caption rv-preset-spotlight-caption">
              <span className="rv-preset-spotlight-name">{record.name}</span>
              <span className="rv-cinema2-text-preview dv-library-record-copy">{textLines(presetId, record.parameters).filter(Boolean).join('\n')}</span>
            </span>
            <span className="rv-cinema2-text-swatches">{Object.entries(record.parameters).filter(([, value]) => Array.isArray(value) && value.length === 4).map(([id, value]) => <span key={id} title={runtime.getParameterState().getDefinition(id as Parameters<Cinema2ParameterState['getDefinition']>[0])?.label} style={{ backgroundColor: `rgb(${(value as number[]).slice(0, 3).map(channel => Math.round(channel * 255)).join(' ')})` } as CSSProperties} />)}</span>
            <span className="rv-cinema2-text-card-status dv-library-record-copy">{[active ? 'Active' : '', library.pending.records.some(item => item.id === record.id) ? 'Waiting to sync' : ''].filter(Boolean).join(' · ')}</span>
          </button></div>
        })}
      </div>}
      {!records.length && <div className="rv-ctrl-info">{query ? 'No matching text scenes.' : mode === 'source' ? 'Add a text scene or capture your current configuration to get started.' : 'Add text scenes to this pool from Source.'}</div>}
    </Collapsible>}
    {draft && <Collapsible bodyClassName="dv-library-body" label="New Text Scene" icon={<AppIcon kind="plus" size={15} />}>
      <div className="rv-cinema2-text-editor-navigation">
        <div className="vz-header-group rv-cinema2-text-actions"><HeaderIconKey label="Back to Text Scenes" icon={<HeaderActionIcon action="back" />} onClick={() => requestTextSceneNavigation(closeEditor)} /></div>
      </div>
      <form className="rv-cinema2-text-editor" noValidate onSubmit={event => { event.preventDefault(); saveDraft() }}>
        <TextInputRow label="Name" value={name} maxLength={100} onChange={setName} />
        {controls.filter(control => control.definition.type !== 'color').map(control => <Cinema2SchemaControl key={control.definition.id} idPrefix="cinema2-text-draft" control={control} onChange={value => change(control, value)} onTrigger={() => {}} />)}
        <Cinema2PaletteControls idPrefix="cinema2-text-draft" controls={controls.filter(control => control.definition.type === 'color')} onChange={change} />
        {contentError && <div className="rv-ctrl-info" role="status">{contentError}</div>}
        <div className="rv-cinema2-text-toolbar">
          <IconChipButton type="submit" disabled={!name.trim() || Boolean(contentError) || !library.userId}>Save</IconChipButton>
        </div>
      </form>
    </Collapsible>}
    </div>
    {error && <div className="rv-ctrl-info" role="alert">{error}</div>}
    {library.error && <div className="rv-ctrl-info" role="status">{library.error} <IconChipButton onClick={() => { void library.sync() }} disabled={library.syncing}>Retry Sync</IconChipButton></div>}
    {library.syncing && <div className="rv-ctrl-info" role="status">Syncing text scenes…</div>}
    <UnsavedTextSceneChangesDialog error={error} />
    {menu && <ContextActionMenu x={menu.x} y={menu.y} ariaLabel={`Text scene actions for ${menu.record.name}`} onClose={() => setMenu(null)} items={[
      { id: 'make-active', label: 'Make Active', onSelect: () => activate(menu.record) },
      { id: 'add-to-pool', label: 'Add to Pool', submenu: pools.length ? <ContextMenuItemsList onSelect={() => setMenu(null)} items={pools.map(pool => ({ id: pool.id, label: pool.name, disabled: library.data.memberships.some(item => item.poolId === pool.id && item.recordId === menu.record.id), onSelect: () => run(() => library.addToPool(pool.id, menu.record.id)) }))} /> : <div className="rv-ctrl-info">Create a pool in the Pool tab first.</div> },
    ]} />}
  </div>
}
