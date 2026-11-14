import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { notify } from '../../../stores/notificationStore'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { assignPerformancePreset, getAllPerformancePresets, isPadPreset, type PerformancePreset } from './performanceManagerPresets'

type Options = {
  selectPad: (id: string) => void
  showTab: (tab: 'presets' | 'edit') => void
}

export function usePerformancePadActions({ selectPad, showTab }: Options) {
  const pads = useReactStore(s => s.performancePads)
  const [menu, setMenu] = useState<{ padId: string; x: number; y: number } | null>(null)
  const [linkPadId, setLinkPadId] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const linkPad = pads.find(p => p.id === linkPadId)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const menuPad = pads.find(p => p.id === menu?.padId)

  useEffect(() => {
    if (!linkPadId) return
    // Capture before application navigation or other controls can change state.
    const guard = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (dialogRef.current?.contains(target)) return
      if (!cancelOpen && target?.closest('.pfm-root .vz-inspector--right [data-performance-preset] .rv-preset-card')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!cancelOpen) {
        returnFocusRef.current = document.activeElement as HTMLElement | null
        setCancelOpen(true)
      }
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !cancelOpen) guard(event) }
    document.addEventListener('pointerdown', guard, true)
    document.addEventListener('click', guard, true)
    document.addEventListener('contextmenu', guard, true)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', guard, true)
      document.removeEventListener('click', guard, true)
      document.removeEventListener('contextmenu', guard, true)
      document.removeEventListener('keydown', key, true)
    }
  }, [linkPadId, cancelOpen])

  useEffect(() => {
    if (!cancelOpen) return
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus() }
  }, [cancelOpen])

  const report = (title: string, message: string, success = true) => notify('performance-manager', { title, message, tone: success ? 'success' : 'error' })
  const assign = (padId: string, preset: Pick<PerformancePreset, 'id' | 'name' | 'engineId'>) => {
    const saved = assignPerformancePreset(padId, preset)
    report(saved ? 'Preset linked to pad' : 'Preset could not be linked', saved ? `${preset.name} is now assigned to the selected performance pad.` : 'The preset or pad is no longer available.', saved)
    return saved
  }
  const selectPreset = (preset: PerformancePreset) => {
    if (!linkPadId) return
    if (assign(linkPadId, preset)) setLinkPadId(null)
  }
  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const padId = (event.target as Element).closest<HTMLElement>('[data-performance-pad-id]')?.dataset.performancePadId
    if (!padId) return
    event.preventDefault()
    selectPad(padId)
    setMenu({ padId, x: event.clientX, y: event.clientY })
  }
  const clear = () => {
    if (!menuPad) return
    // Clearing an assignment keeps the pad's chosen color and keyboard identity.
    useReactStore.setState(state => ({ performancePads: state.performancePads.map(p => p.id === menuPad.id ? { ...p, presetId: null, destination: null, label: 'Empty', assignmentOverridesAction: true } : p), ...(state.activePadId === menuPad.id ? { activePadId: null, performancePadTransition: null } : {}) }))
    report('Pad link cleared', `Performance pad ${menuPad.keyBinding.toUpperCase()} is now empty.`)
  }
  const random = () => {
    if (!menuPad) return
    const choices = getAllPerformancePresets(useReactStore.getState().reactPresets).filter(p => !isPadPreset(menuPad, p))
    if (!choices.length) { report('No other presets available', 'Add another preset before choosing Random.', false); return }
    assign(menuPad.id, choices[Math.floor(Math.random() * choices.length)])
  }
  const popover = menu && menuPad ? <ContextActionMenu x={menu.x} y={menu.y} ariaLabel="Performance pad actions" onClose={() => setMenu(null)} items={[
    { id: 'edit', label: 'Edit', onSelect: () => showTab('edit') },
    { id: 'link', label: 'Link', onSelect: () => { setLinkPadId(menuPad.id); showTab('presets') } },
    { id: 'random', label: 'Random', onSelect: random },
    { id: 'clear', label: 'Clear', disabled: !menuPad.presetId && !menuPad.destination, onSelect: clear },
  ]} /> : null
  const cancelDialog = cancelOpen ? <div ref={dialogRef}><ConfirmDialog title="Cancel pad link?" message={`Stop choosing a preset for performance pad ${linkPad?.keyBinding.toUpperCase() ?? '—'}? Its current assignment will be kept.`} cancelLabel="Keep linking" confirmLabel="Cancel link" danger={false} confirmTone="primary" onCancel={() => setCancelOpen(false)} onConfirm={() => { setCancelOpen(false); setLinkPadId(null) }} /></div> : null
  return { onContextMenu, popover, cancelDialog, linkPad, selectPreset }
}
