import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import canonicalStyles from './controls/canonicalControls.css?inline'
import typographyStyles from '../../../styles/typography.css?inline'
import tabStyles from '../../../styles/tabRows.css?inline'
import workspaceStyles from './layoutLab/layoutLabWorkspace.css?inline'
import { PerformancePadStudies } from './layoutLab/PerformancePadStudies'
import { EngineDropdownStudies } from './layoutLab/EngineDropdownStudies'
import { AuthStudies } from './layoutLab/AuthStudies'
import { RecordListingStudies } from './layoutLab/RecordListingStudies'
import { BrandKitStudies } from './layoutLab/BrandKitStudies'
import { UiPreviewStudies } from './layoutLab/UiPreviewStudies'
import { MobileTab } from './layoutLab/MobileTab'
import { LAYOUT_LAB_AUTH_TAB_ID, LAYOUT_LAB_BRAND_KIT_PLACEHOLDER_IDS, isBrandKitTabName, LAYOUT_LAB_RECORD_LISTING_TAB_ID, LAYOUT_LAB_STORAGE_KEY, LAYOUT_LAB_UI_PREVIEW_TAB_ID, LAYOUT_LAB_MOBILE_TAB_ID, readLayoutLabTabs } from './layoutLab/layoutLabTabs'

/** Visual workspace. Preview actions remain local; Record Listing reuses production presentation. */
export function LayoutLabMockup() {
  const [workspace, setWorkspace] = useState(readLayoutLabTabs)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const editorRef = useRef<HTMLInputElement>(null)
  const editingRef = useRef<string | null>(null)
  const focusReturnRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({ version: 1, ...workspace }))
      setSaveFailed(false)
    } catch { setSaveFailed(true) }
  }, [workspace])

  useEffect(() => {
    editorRef.current?.focus()
    editorRef.current?.select()
    if (!editingId && focusReturnRef.current) {
      canvasRef.current?.querySelector<HTMLButtonElement>(`#${focusReturnRef.current}`)?.focus()
      focusReturnRef.current = null
    }
  }, [editingId])

  const rename = (id: string) => {
    setDraft(workspace.tabs.find(tab => tab.id === id)!.name)
    editingRef.current = id
    setEditingId(id)
  }
  const finishRename = (save: boolean) => {
    const id = editingRef.current
    if (!id) return
    editingRef.current = null
    focusReturnRef.current = id
    if (save && draft.trim()) setWorkspace(current => ({ ...current, tabs: current.tabs.map(tab => tab.id === id ? { ...tab, name: draft.trim() } : tab) }))
    setEditingId(null)
  }
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'F2') { event.preventDefault(); rename(workspace.tabs[index].id); return }
    const count = workspace.tabs.length
    const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
    if (next === null) return
    event.preventDefault()
    const id = workspace.tabs[next].id
    setWorkspace(current => ({ ...current, activeTabId: id }))
    canvasRef.current?.querySelector<HTMLButtonElement>(`#${id}`)?.focus()
  }

  return <main ref={canvasRef} className="ll-workspace" aria-label="Layout Lab canvas">
    <style>{canonicalStyles + typographyStyles + tabStyles + workspaceStyles}</style>
    <div className="dv-underline-tabs ll-tabs" role="tablist" aria-label="Layout Lab tabs">
      {workspace.tabs.map((tab, index) => <div className="ll-tab-slot" key={tab.id} data-layout-lab-tab-id={tab.id}>
        <button id={tab.id} type="button" role="tab" className={`dv-underline-tab${workspace.activeTabId === tab.id ? ' is-active' : ''}`} aria-selected={workspace.activeTabId === tab.id} aria-controls={`${tab.id}-panel`} tabIndex={workspace.activeTabId === tab.id ? 0 : -1} title={`${tab.name} · Click the selected tab again, double-click, or press F2 to rename`} style={editingId === tab.id ? { visibility: 'hidden' } : undefined} onClick={() => {
          if (workspace.activeTabId === tab.id) rename(tab.id)
          else setWorkspace(current => ({ ...current, activeTabId: tab.id }))
        }} onDoubleClick={() => rename(tab.id)} onKeyDown={event => navigate(event, index)}>{tab.name}</button>
        {editingId === tab.id && <input ref={editorRef} className="dv-underline-tab ll-tab-name-input" aria-label={`Rename ${tab.name}`} value={draft} maxLength={80} onChange={event => setDraft(event.target.value)} onBlur={() => finishRename(true)} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            finishRename(event.key === 'Enter')
          }
        }} />}
      </div>)}
    </div>
    <p className="ll-workspace-hint" role={saveFailed ? 'status' : undefined}>{saveFailed ? 'Tab names could not be saved in this browser. They will last only for this session.' : 'Click the selected tab again to rename. Enter saves · Escape cancels.'}</p>
    {workspace.tabs.map(tab => <section key={tab.id} id={`${tab.id}-panel`} className="ll-tab-panel" role="tabpanel" aria-labelledby={tab.id} data-layout-lab-tab-id={tab.id} hidden={workspace.activeTabId !== tab.id}>
      {tab.id === 'layout-lab-tab-01' && <PerformancePadStudies />}
      {tab.id === 'layout-lab-tab-03' && <EngineDropdownStudies />}
      {tab.id === LAYOUT_LAB_AUTH_TAB_ID && <AuthStudies />}
      {tab.id === LAYOUT_LAB_RECORD_LISTING_TAB_ID && <RecordListingStudies />}
      {tab.id === LAYOUT_LAB_UI_PREVIEW_TAB_ID && <UiPreviewStudies />}
      {tab.id === LAYOUT_LAB_MOBILE_TAB_ID && <MobileTab />}
      {(LAYOUT_LAB_BRAND_KIT_PLACEHOLDER_IDS.includes(tab.id) && isBrandKitTabName(tab.name)) && <BrandKitStudies />}
    </section>)}
  </main>
}
