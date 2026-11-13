import { useEffect, useState, type DragEvent } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { notify } from '../../../stores/notificationStore'
import { DEFAULT_PERFORMANCE_PADS, type ReactPerformancePad } from '../react/ReactTypes'
import type { ReactLiveEngineId } from '../react/reactEngineCatalog'
import { migrateLegacyPerformancePadsToCinema2 } from '../cinema2/migration/Cinema2LegacyStateMigration'
import { HeaderIconKey } from '../layout/HeaderIconKey'
import { HeaderActionIcon } from '../layout/HeaderActionIcon'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'

export const PERFORMANCE_PRESET_MIME = 'application/x-drmvyz-performance-preset'
type Preset = { id: string; name: string }
type Pending = { kind: 'link'; padId: string; preset: Preset; engine: ReactLiveEngineId } | { kind: 'clearAll' | 'delete' | 'reset'; padId?: string }
const PAGE = 'performance-manager'
const empty = (pad: ReactPerformancePad): ReactPerformancePad => ({ ...pad, presetId: null, destination: null, assignmentOverridesAction: true, label: 'Empty' })

export function usePerformanceManagerPads(engine: ReactLiveEngineId, presets: readonly Preset[], selectedPreset: string | null) {
  const pads = useReactStore(s => s.performancePads)
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => {
    if (!pending) return
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => document.querySelector<HTMLButtonElement>('.dv-confirm-dialog button')?.focus(), 0)
    return () => { window.clearTimeout(timer); if (previous?.isConnected) previous.focus() }
  }, [pending])
  const selected = pads.find(p => p.id === selectedPadId)
  const post = (title: string, message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info') => notify(PAGE, { title, message, tone })
  const beginLink = (padId: string, preset: Preset) => {
    if (!useReactStore.getState().performancePads.some(pad => pad.id === padId)) return
    setSelectedPadId(padId)
    setPending({ kind: 'link', padId, preset, engine })
    const pad = useReactStore.getState().performancePads.find(p => p.id === padId)!
    post('Pad link awaiting confirmation', `Review linking ${preset.name} to performance pad ${pad.keyBinding.toUpperCase()}.`)
  }
  const cancel = () => {
    if (pending?.kind === 'link') post('Pad link canceled', `${pending.preset.name} was not linked. Existing assignments were kept.`)
    setPending(null)
  }
  const confirm = () => {
    if (!pending) return
    const state = useReactStore.getState()
    if (pending.kind === 'link') {
      const pad = state.performancePads.find(p => p.id === pending.padId)
      // Revalidate the catalog and target at confirmation, not just at drop time.
      const preset = presets.find(p => p.id === pending.preset.id)
      if (!pad || !preset || engine !== pending.engine) {
        post('Preset could not be linked', 'The preset or pad is no longer available. Drag the preset again.', 'error')
      } else {
        const reactPreset = state.reactPresets.find(p => p.id === preset.id && p.engine === engine)
        state.updatePerformancePad(pad.id, { label: preset.name, assignmentOverridesAction: true,
          ...(reactPreset ? { presetId: preset.id, destination: null } : { presetId: null, destination: { schemaVersion: 1, engineId: engine, presetId: preset.id } }) })
        const saved = useReactStore.getState().performancePads.find(p => p.id === pad.id)
        if (saved?.presetId || saved?.destination) post('Preset linked to pad', `${preset.name} is now linked to performance pad ${pad.keyBinding.toUpperCase()} throughout the application.`, 'success')
        else post('Preset could not be linked', 'This preset is no longer available. Choose another preset.', 'error')
      }
    } else if (pending.kind === 'clearAll') {
      useReactStore.setState({ performancePads: state.performancePads.map(empty), activePadId: null, performancePadTransition: null })
      post('All pad links cleared', 'All performance pad assignments were cleared throughout the application.', 'success')
    } else if (pending.kind === 'delete') {
      const pad = state.performancePads.find(p => p.id === pending.padId)
      if (pad) {
        useReactStore.setState({ performancePads: state.performancePads.filter(p => p.id !== pad.id), ...(state.activePadId === pad.id ? { activePadId: null, performancePadTransition: null } : {}) })
        setSelectedPadId(null)
        post('Performance pad deleted', `Pad ${pad.keyBinding.toUpperCase()} was removed. Add restores the next missing slot; Reset restores the default set.`, 'success')
      }
    } else {
      useReactStore.setState({ performancePads: migrateLegacyPerformancePadsToCinema2(DEFAULT_PERFORMANCE_PADS.map(p => ({ ...p }))), activePadId: null, performancePadTransition: null })
      setSelectedPadId(null)
      post('Performance pads reset', 'The default performance pad layout and assignments were restored.', 'success')
    }
    setPending(null)
  }
  const add = () => {
    const preset = presets.find(p => p.id === selectedPreset)
    if (preset) {
      const target = selected ?? pads.find(p => !p.presetId && !p.destination)
      if (target) { beginLink(target.id, preset); return }
    }
    const missing = DEFAULT_PERFORMANCE_PADS.find(defaultPad => !pads.some(p => p.id === defaultPad.id))
    if (missing) {
      const added = empty({ ...missing })
      const order = new Map(DEFAULT_PERFORMANCE_PADS.map((p, index) => [p.id, index]))
      useReactStore.setState({ performancePads: [...pads, added].sort((a,b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)) })
      setSelectedPadId(added.id)
      post('Performance pad added', `Empty pad ${added.keyBinding.toUpperCase()} is ready for a preset.`, 'success')
    } else post('Choose a preset and pad', 'Select a preset and a pad, then press Add, or drag a preset directly onto a pad.')
  }
  const toolbar = <>
    <HeaderIconKey label="Add pad link" title="Link selected preset, or restore the next missing pad" icon={<HeaderActionIcon action="create" />} onClick={add} />
    <HeaderIconKey label="Clear pad" icon={<HeaderActionIcon action="clear" />} disabled={!selected} onClick={() => {
      if (!selected) return
      useReactStore.getState().updatePerformancePad(selected.id, empty(selected))
      post('Pad link cleared', `Performance pad ${selected.keyBinding.toUpperCase()} is now empty.`, 'success')
    }} />
    <HeaderIconKey label="Clear all pads" icon={<HeaderActionIcon action="clearAll" />} onClick={() => setPending({ kind: 'clearAll' })} />
    <HeaderIconKey label="Delete pad" icon={<HeaderActionIcon action="delete" />} danger disabled={!selected} onClick={() => selected && setPending({ kind: 'delete', padId: selected.id })} />
    <HeaderIconKey label="Reset pads" icon={<HeaderActionIcon action="reset" />} onClick={() => setPending({ kind: 'reset' })} />
  </>
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!pending && event.dataTransfer.types.includes(PERFORMANCE_PRESET_MIME) && (event.target as Element).closest('[data-performance-pad-id]')) {
      event.preventDefault(); event.dataTransfer.dropEffect = 'link'
    }
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (pending || !event.dataTransfer.types.includes(PERFORMANCE_PRESET_MIME)) return
    event.preventDefault()
    const padId = (event.target as Element).closest<HTMLElement>('[data-performance-pad-id]')?.dataset.performancePadId
    try {
      const value: unknown = JSON.parse(event.dataTransfer.getData(PERFORMANCE_PRESET_MIME))
      if (!value || typeof value !== 'object') throw new Error('Invalid preset')
      const payload = value as { engineId?: unknown; presetId?: unknown }
      const preset = payload.engineId === engine && typeof payload.presetId === 'string' ? presets.find(p => p.id === payload.presetId) : undefined
      if (!padId || !preset) throw new Error('Preset no longer available')
      beginLink(padId, preset)
    } catch { post('Preset could not be dropped', 'Choose a preset from this window and drop it onto a performance pad.', 'error') }
  }
  const target = pending?.kind === 'link' ? pads.find(p => p.id === pending.padId) : null
  const dialog = pending ? <ConfirmDialog
    title={pending.kind === 'link' ? 'Link preset to performance pad?' : pending.kind === 'reset' ? 'Reset performance pads?' : pending.kind === 'delete' ? 'Delete performance pad?' : 'Clear all performance pad links?'}
    message={pending.kind === 'link' ? `Are you sure you want to have ${pending.preset.name} linked to performance pad ${target?.keyBinding.toUpperCase() ?? '—'}?` : pending.kind === 'reset' ? 'Restore the default pads and preset assignments throughout the application?' : pending.kind === 'delete' ? 'Remove the selected pad throughout the application?' : 'Remove all preset links while keeping the pad slots?'}
    notice={pending.kind === 'link' ? 'Linking replaces the current assignment for this pad throughout the application. The preset will load when the pad is performed.' : undefined}
    noticeTitle="Shared performance pad" noticeTone="info"
    confirmLabel={pending.kind === 'link' ? 'Link' : pending.kind === 'reset' ? 'Reset' : pending.kind === 'delete' ? 'Delete' : 'Clear all'}
    danger={pending.kind !== 'link'} confirmTone={pending.kind === 'link' ? 'primary' : 'default'}
    onCancel={cancel} onConfirm={confirm}
  /> : null
  return { toolbar, dialog, onDragOver, onDrop, editor: { selectedPadId, onSelect: setSelectedPadId } }
}
