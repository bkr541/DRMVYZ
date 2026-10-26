import { useEffect, useRef, useState } from 'react'
import { DualRailCollapsible } from '../DualRailCollapsible'
import {
  AccountPanelView, SettingsModalFrame, SystemSettingsView, type SettingsTab,
} from '../../settings/SettingsModal'
import { AppearanceSettingsView } from '../../../../features/appearance/AppearanceSettingsPanel'
import type { AppearanceTheme } from '../../../../features/appearance/appearanceTypes'
import { DjSoftwareSettingsView, type DjSoftware } from '../../settings/DjSoftwareSettingsPanel'
import { DeveloperPanel } from '../../settings/developer/DeveloperPanel'
import { ST_LOG_ENTRIES, ST_PROFILE, ST_REKORDBOX_STATUS } from './layoutLabSettingsFixture'

// ── Layout Lab · Settings pop-up ────────────────────────────────────────────
//
// The production Settings pop-up, drawn inline in a collapsible group instead of over the app. The pop-up's own surface
// (`SettingsModalFrame`: the SETTINGS header and close button, the section navigation with Sign Out, and the content pane)
// is the real component, and each tab is the real panel markup (`AccountPanelView`, `AppearanceSettingsView`,
// `SystemSettingsView`, `DjSoftwareSettingsView`, the Developer panel), fed placeholder state instead of the profile,
// appearance, visual and media stores, the native Rekordbox bridge and main.log. Close collapses the group, as closing
// the pop-up dismisses it; Sign Out does nothing, and the theme cards, quality and reset buttons change local state only
// (nothing is applied to the app, saved or signed out).

const QUALITY_LEVELS = ['Low', 'Medium', 'High'] as const

/** `idPrefix` keeps the pop-up's element ids unique when more than one design is mounted. */
export function LayoutLabSettingsWindow({ idPrefix = 'll-vsm' }: { idPrefix?: string } = {}) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<SettingsTab>('account')

  return (
    <div className="ll-lyric-timeline-host" data-workspace-layout="floating" data-app-workspace="lyrics">
      <section className="ll-settings-window" aria-label="Settings">
        <DualRailCollapsible label="Settings" open={open} onOpenChange={setOpen} headerClassName="lmv-live-preview-header">
          <SettingsModalFrame
            tab={tab}
            onTabChange={setTab}
            onClose={() => setOpen(false)}
            onSignOut={() => {}}
            dialog={false}
            idPrefix={idPrefix}
            className="ll-settings-modal"
          >
            {tab === 'account' && <AccountTab />}
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'brand' && <div className="bk-state">Brand Kit mockup pending.</div>}
            {tab === 'system' && <SystemTab />}
            {tab === 'dj-software' && <DjSoftwareTab />}
            {tab === 'developer' && <DeveloperPanel logPreview={{ entries: ST_LOG_ENTRIES, path: '~/Library/Logs/DRMVYZ/main.log', live: true }} />}
          </SettingsModalFrame>
        </DualRailCollapsible>
      </section>
    </div>
  )
}

function AccountTab() {
  const [displayName, setDisplayName] = useState(ST_PROFILE.displayName)
  const [artistName, setArtistName] = useState(ST_PROFILE.artistName)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const save = () => {
    setSaving(true)
    timers.current.push(setTimeout(() => {
      setSaving(false)
      setSaveMsg({ text: 'Profile saved', ok: true })
      timers.current.push(setTimeout(() => setSaveMsg(null), 3000))
    }, 500))
  }
  return (
    <AccountPanelView
      state="ready"
      email={ST_PROFILE.email}
      displayName={displayName}
      artistName={artistName}
      saving={saving}
      canSave
      saveMsg={saveMsg}
      onDisplayNameChange={setDisplayName}
      onArtistNameChange={setArtistName}
      onSave={save}
    />
  )
}

function AppearanceTab() {
  const [theme, setTheme] = useState<AppearanceTheme>('dark')
  return (
    <AppearanceSettingsView theme={theme} loading={false} syncing={false} error={null} currentUserId="lab-user" onSetTheme={setTheme} onRetrySync={() => {}} />
  )
}

function SystemTab() {
  const [quality, setQuality] = useState<(typeof QUALITY_LEVELS)[number]>('High')
  const [autoEnabled, setAutoEnabled] = useState(true)
  const [autoMin, setAutoMin] = useState<(typeof QUALITY_LEVELS)[number]>('Medium')
  const [autoMax, setAutoMax] = useState<(typeof QUALITY_LEVELS)[number]>('High')
  const [bpmSync, setBpmSync] = useState(true)
  const [diagnostics, setDiagnostics] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <SystemSettingsView
      quality={quality}
      onQualityChange={setQuality}
      autoQualityEnabled={autoEnabled}
      autoQualityMin={autoMin}
      autoQualityMax={autoMax}
      autoQualityReason="GPU frame time within budget"
      onAutoQualityEnabledChange={setAutoEnabled}
      onAutoQualityMinChange={setAutoMin}
      onAutoQualityMaxChange={setAutoMax}
      bpmSync={bpmSync}
      onToggleBpmSync={() => setBpmSync(value => !value)}
      bpm={129}
      storageAvailable
      authRequired={false}
      onResetEffects={() => {}}
      onResetModulation={() => {}}
      diagnosticsStatus={diagnostics}
      onCopyDiagnostics={() => {
        setDiagnostics('copied')
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setDiagnostics('idle'), 2000)
      }}
    />
  )
}

function DjSoftwareTab() {
  const [software, setSoftware] = useState<DjSoftware>('rekordbox')
  const [busy, setBusy] = useState<'loading' | 'selecting' | 'syncing' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const run = (state: 'selecting' | 'syncing') => {
    setBusy(state)
    timer.current = setTimeout(() => setBusy(null), 900)
  }
  return (
    <DjSoftwareSettingsView
      software={software}
      onSoftwareChange={value => setSoftware(value as DjSoftware)}
      status={ST_REKORDBOX_STATUS}
      busy={busy}
      error={null}
      nativeIndexAvailable
      onChooseDirectory={() => run('selecting')}
      onSync={() => run('syncing')}
    />
  )
}

