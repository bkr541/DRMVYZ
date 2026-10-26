import { useRef, useState, type ReactNode } from 'react'
import { InfoPopover } from '../../../shared/InfoPopover/InfoPopover'
import { ContextActionMenuSurface, type ContextActionMenuItem } from '../../context-menu/ContextActionMenu'
import { AudioTrackEditView } from '../../media/AudioTrackEditModal'
import { AudioTrackPreviewView } from '../../media/AudioTrackPreviewModal'
import { CollectionEditorView } from '../../media/CollectionEditorModal'
import { MediaDeleteConfirmDialog } from '../../media/MediaDeleteConfirmDialog'
import { SaveAsMediaDialog } from '../../media/SaveAsMediaDialog'
import { UnsavedMediaChangesView } from '../../media/UnsavedMediaChangesDialog'
import { NotificationDrawer, type NotificationCard } from '../../shared/NotificationDrawer'
import { CuePointContextMenuPanel } from '../../transport/CuePointContextMenu'
import { ConfirmLyricActivationDialog } from '../../../../features/lyrics/components/ConfirmLyricActivationDialog'
import { ConfirmLyricDeleteDialog } from '../../../../features/lyrics/components/ConfirmLyricDeleteDialog'
import { ConfirmTrackDeleteDialog } from '../../../../features/lyrics/components/ConfirmTrackDeleteDialog'
import { LyricConflictDialog } from '../../../../features/lyrics/components/LyricConflictDialog'
import { LyricRecoveryDialog } from '../../../../features/lyrics/components/LyricRecoveryDialog'
import { UnsavedLyricChangesDialog } from '../../../../features/lyrics/components/UnsavedLyricChangesDialog'
import type { LyricRecoveryRecord } from '../../../../lib/lyricDraftRecovery'
import type { VzCueMarker } from '../../../../types/cue'
import { ConfirmDialog } from '../controls/ConfirmDialog'
import { IconChipButton } from '../controls/IconChipButton'
import { UnderlineTabs } from '../controls/UnderlineTabs'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { LT_CUES } from './layoutLabLyricTimelineFixture'
import { LTR_DOCUMENTS } from './layoutLabLyricTracksFixture'
import { TM_BEAT_GRID } from './layoutLabTrackMapFixture'

// ── Layout Lab · Pop-ups and confirmation dialogs ───────────────────────────
//
// Every pop-up and confirmation dialog in the app, each drawn inline in a stage that stands in for the app window: the
// dimmed backdrop and the dialog card are production's own components and classes. The confirmations are the shared
// `ConfirmDialog` with the exact titles, messages, notices and buttons each caller gives it (Media Library and Manager,
// Lyric Manager, Show Manager, LaserDMX, Headliner), and the wrappers that own their copy (`MediaDeleteConfirmDialog`,
// `ConfirmTrackDeleteDialog`, `LyricConflictDialog`, `LyricRecoveryDialog`, …) are mounted as they are. The modals and menus
// that read stores are split into views the production components still render (`AudioTrackEditView`,
// `CollectionEditorView`, `AudioTrackPreviewView`, `UnsavedMediaChangesView`, `ContextActionMenuSurface`,
// `CuePointContextMenuPanel`) and fed placeholder state here. Buttons close nothing and save nothing; the Notifications
// drawer closes and reopens, and the fields and menus respond locally.
//
// Not mocked here: the Media Upload modal and Media Preview modal (large, stateful media flows), the New Show form dialog,
// the Cast Output popover (native display bridge), and the separate OS windows (Layout Lab, Track Timeline Visualizer).
// The Audio Source and Playlist popovers (`InfoPopover`) are live in the Audio dock, and a lyric cue's menu opens on
// right-click in the Track Timeline.

type PopupTab = 'confirm' | 'lyrics' | 'editors' | 'menus'
const TABS: { id: PopupTab; label: string }[] = [
  { id: 'confirm', label: 'CONFIRMATIONS' },
  { id: 'lyrics', label: 'LYRIC MANAGER' },
  { id: 'editors', label: 'EDITORS' },
  { id: 'menus', label: 'MENUS & PANELS' },
]

const noop = () => {}

function Sample({ title, where, stage, children }: { title: string; where: string; stage?: string; children: ReactNode }) {
  return (
    <figure className="ll-popup-sample">
      <figcaption><strong>{title}</strong><span>{where}</span></figcaption>
      <div className={`ll-popup-stage${stage ? ` ll-popup-stage--${stage}` : ''}`}>{children}</div>
    </figure>
  )
}

export function LayoutLabPopupsWindow() {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<PopupTab>('confirm')

  return (
    <div className="ll-lyric-timeline-host" data-workspace-layout="floating" data-app-workspace="lyrics">
      <section className="ll-settings-window ll-popups-window" aria-label="Pop-ups and dialogs">
        <DualRailCollapsible label="Pop-ups & Dialogs" open={open} onOpenChange={setOpen} headerClassName="lmv-live-preview-header">
          <UnderlineTabs tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Pop-up groups" className="ll-popup-tabs" />
          <div className="ll-popup-list" role="tabpanel" aria-label={TABS.find(item => item.id === tab)?.label}>
            {tab === 'confirm' && <ConfirmationSamples />}
            {tab === 'lyrics' && <LyricManagerSamples />}
            {tab === 'editors' && <EditorSamples />}
            {tab === 'menus' && <MenuSamples />}
          </div>
        </DualRailCollapsible>
      </section>
    </div>
  )
}

function ConfirmationSamples() {
  return (
    <>
      <Sample title="Delete Media Item" where="Media Library · Media Manager inspector">
        <MediaDeleteConfirmDialog count={1} onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Media Items" where="Media Library · multiple selected">
        <MediaDeleteConfirmDialog count={3} onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Media Item (working)" where="Media Library · while the delete runs">
        <MediaDeleteConfirmDialog count={1} busy onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Track" where="Audio track cards (Media Library tracks)">
        <ConfirmDialog
          title="Delete Track"
          message="Delete “Neon Cathedral”? This also deletes its saved lyric versions and transcription jobs."
          notice="Deleted audio tracks will not be available to use within specific areas within React Shows, Lyrics, etc. The same deleted audio track will still be available to be used when loaded in the Audio Dock."
          onCancel={noop}
          onConfirm={noop}
        />
      </Sample>
      <Sample title="Delete Collection" where="Media Library">
        <ConfirmDialog title="Delete Collection" message="Delete collection “Festival Intros”? Media files will remain in the library." onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Pool" where="Media Library · Canvas pools">
        <ConfirmDialog title="Delete Pool" message="Delete pool “Drop Loops”? Media files will remain in the library." onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Show" where="Show Manager">
        <ConfirmDialog
          title="Delete Show"
          message="Delete Show “Neon Cathedral Live”? This removes only the Show and its authored data. Linked media and audio remain in the library."
          onCancel={noop}
          onConfirm={noop}
        />
      </Sample>
      <Sample title="Delete Show (deleting)" where="Show Manager · while the delete runs">
        <ConfirmDialog
          title="Delete Show"
          message="Delete Show “Neon Cathedral Live”? This removes only the Show and its authored data. Linked media and audio remain in the library."
          busy
          onCancel={noop}
          onConfirm={noop}
        />
      </Sample>
      <Sample title="Change Section Engine?" where="Show Manager · section already has an engine">
        <ConfirmDialog
          title="Change Section Engine?"
          message="“Drop 1” is already used by Cinema 2.0. Using Canvas here will clear the existing elements and settings from this section."
          confirmLabel="Clear Section & Use Canvas"
          onCancel={noop}
          onConfirm={noop}
        />
      </Sample>
      <Sample title="Delete Deck" where="Show Manager">
        <ConfirmDialog title="Delete Deck" message="Deleting this Deck will delete the Preset too. Are you sure?" onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Beam" where="LaserDMX beam inspector">
        <ConfirmDialog title="Delete Beam" message={'Delete beam "Beam 3"?'} onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Beams" where="LaserDMX beam matrix · multi-beam editor">
        <ConfirmDialog title="Delete Beams" message="Delete 4 selected beams?" onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Delete Group" where="LaserDMX reaction group inspector">
        <ConfirmDialog title="Delete Group" message={'Delete group "Stage Left"?'} onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Camera Access Needed" where="Headliner · camera permission blocked">
        <ConfirmDialog
          title="Camera Access Needed"
          message="Camera access is blocked for DRMVYZ. Allow it in your system settings, then try again."
          iconTone="neutral"
          danger={false}
          confirmTone="primary"
          cancelLabel="Not now"
          confirmLabel="Open Camera Settings"
          secondary={{ label: 'Try again', onClick: noop }}
          onCancel={noop}
          onConfirm={noop}
        />
      </Sample>
      <Sample title="Unsaved changes" where="Media Manager · leaving with edits">
        <UnsavedMediaChangesView busy={false} error={null} onCancel={noop} onDiscard={noop} onSave={noop} />
      </Sample>
      <Sample title="Unsaved changes (save failed)" where="Media Manager · the save did not persist">
        <UnsavedMediaChangesView busy={false} error="The edited image could not be uploaded. Check your connection and try again." onCancel={noop} onDiscard={noop} onSave={noop} />
      </Sample>
      <Sample title="Save As" where="Media Manager · edited media">
        <SaveAsMediaDialog initialName="Neon Cathedral artwork (edited)" busy={false} error={null} onCancel={noop} onSubmit={noop} />
      </Sample>
      <Sample title="Save As (failed)" where="Media Manager · the new item was not created">
        <SaveAsMediaDialog initialName="Neon Cathedral artwork (edited)" busy={false} error="Storage quota exceeded." onCancel={noop} onSubmit={noop} />
      </Sample>
    </>
  )
}

const DOCUMENT = LTR_DOCUMENTS['lab-track-1']![0]!
const RECOVERY: LyricRecoveryRecord = {
  key: 'lab-recovery',
  schemaVersion: 1,
  userId: 'lab-user',
  trackId: 'lab-track-1',
  documentId: DOCUMENT.id,
  logicalDocumentId: DOCUMENT.id,
  baseServerRevision: DOCUMENT.revision,
  cues: LT_CUES.slice(0, 20).map((cue, index) => (index === 3 ? { ...cue, text: 'Hold on to the sound again' } : cue)),
  title: 'Neon Cathedral — Final (recovered)',
  artist: DOCUMENT.artist,
  defaultStyle: {},
  defaultAnimation: {},
  defaultEffects: {},
  globalOffsetMs: 120,
  sourceType: DOCUMENT.sourceType,
  sourceFormat: DOCUMENT.sourceFormat,
  rawSourceText: null,
  metadata: null,
  activateOnSave: false,
  editVersion: 14,
  lastEditAt: Date.now() - 42 * 60_000,
}

function LyricManagerSamples() {
  const [reviewing, setReviewing] = useState(true)
  return (
    <>
      <Sample title="Delete Track" where="Lyric Manager · Tracks tab">
        <ConfirmTrackDeleteDialog trackTitle="Neon Cathedral" onConfirm={noop} onCancel={noop} />
      </Sample>
      <Sample title="Delete Lyric Version" where="Lyric Manager · a version's delete action">
        <ConfirmLyricDeleteDialog title="Neon Cathedral — Draft" onConfirm={noop} onCancel={noop} />
      </Sample>
      <Sample title="Replace active lyric version?" where="Lyric Manager · Make Active">
        <ConfirmLyricActivationDialog targetTitle="Neon Cathedral — Draft" currentTitle="Neon Cathedral — Final" busy={false} onCancel={noop} onConfirm={noop} />
      </Sample>
      <Sample title="Unsaved lyric changes" where="Lyric Manager · leaving with edits">
        <UnsavedLyricChangesDialog open onSave={noop} onDiscard={noop} onCancel={noop} />
      </Sample>
      <Sample title="This lyric version was changed elsewhere" where="Lyric Manager · save refused (cannot be dismissed)">
        <LyricConflictDialog open documentTitle="Neon Cathedral — Final" serverRevision={7} yourRevision={5} onReloadLatest={noop} onSaveAsNewVersion={noop} />
      </Sample>
      <Sample title="Recovered lyric draft available" where="Lyric Manager · local edits found (Review open)">
        <LyricRecoveryDialog recovery={RECOVERY} document={DOCUMENT} canonicalCues={LT_CUES} reviewing={reviewing} onRestore={noop} onReview={() => setReviewing(value => !value)} onDiscard={noop} />
      </Sample>
      <Sample title="Recovered lyric draft conflicts with the server" where="Lyric Manager · the server moved on">
        <LyricRecoveryDialog
          recovery={{ ...RECOVERY, baseServerRevision: DOCUMENT.revision - 1 }}
          document={DOCUMENT}
          canonicalCues={LT_CUES}
          reviewing={false}
          onRestore={noop}
          onReview={noop}
          onDiscard={noop}
        />
      </Sample>
    </>
  )
}

function EditorSamples() {
  const track = { title: 'Neon Cathedral', artist: 'DVYDRM', genre: 'Melodic Techno', bpm: 129, musicalKey: 'Am' }
  return (
    <>
      <Sample title="Edit Audio Metadata" where="Media Library · audio track card">
        <AudioTrackEditView track={track} saving={false} error={null} onClose={noop} onSave={noop} />
      </Sample>
      <Sample title="Edit Audio Metadata (invalid)" where="Media Library · validation message">
        <AudioTrackEditView track={{ ...track, title: '' }} saving={false} error="Title is required." onClose={noop} onSave={noop} />
      </Sample>
      <Sample title="New Collection" where="Media Library · collections">
        <CollectionEditorView saving={false} error={null} onClose={noop} onSave={noop} />
      </Sample>
      <Sample title="Edit Collection" where="Media Library · collections">
        <CollectionEditorView collection={{ name: 'Festival Intros', description: 'Opening loops for the main stage sets.' }} saving={false} error={null} onClose={noop} onSave={noop} />
      </Sample>
      <Sample title="Audio preview" where="Media Library · preview a saved track">
        <AudioTrackPreviewView title="Neon Cathedral" url={null} loading={false} error="A preview URL could not be created. Refresh the library or check storage access." onClose={noop} onAudioError={noop} />
      </Sample>
      <Sample title="Audio preview (loading)" where="Media Library · while the signed URL is created">
        <AudioTrackPreviewView title="Neon Cathedral" url={null} loading error={null} onClose={noop} onAudioError={noop} />
      </Sample>
    </>
  )
}

const CUE: VzCueMarker = { id: 'lab-cue', label: 'Drop 1', time: 24.5, type: 'drop', color: '#e2364f' }

const TRACK_MENU: ContextActionMenuItem[] = [
  { id: 'active', label: 'Open Active Lyrics' },
  { id: 'make-active', label: 'Make Open Version Active' },
  { id: 'delete', label: 'Delete Track', danger: true, dividerBefore: true },
]
const LIBRARY_MENU: ContextActionMenuItem[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'edit', label: 'Edit Metadata…' },
  { id: 'collection', label: 'Add to Collection', submenu: <ContextActionMenuSurface ariaLabel="Add to collection" items={[{ id: 'a', label: 'Festival Intros' }, { id: 'b', label: 'Drop Loops' }, { id: 'c', label: 'New Collection…', dividerBefore: true }]} className="ll-popup-menu" /> },
  { id: 'unavailable', label: 'Show in Folder', disabled: true },
  { id: 'delete', label: 'Delete', danger: true, dividerBefore: true },
]

const NOTIFICATIONS: NotificationCard[] = [
  { id: 'n1', tone: 'info', title: 'Analysis queued', body: 'Neon Cathedral will be analyzed when the track finishes loading.' },
  { id: 'n2', tone: 'success', title: 'Track analysis complete', body: '129 BPM, 8A. Beat grid and sections are ready.', onDismiss: noop },
  { id: 'n3', tone: 'warning', title: 'Beat grid is using a temporary tempo', body: 'Run analysis to replace it with detected beats.' },
  { id: 'n4', tone: 'error', title: 'Analysis failed', body: 'The file could not be decoded. Check that it is a supported audio format.', role: 'alert' },
]

function MenuSamples() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const anchor = useRef<HTMLButtonElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  return (
    <>
      <Sample title="Track actions menu" where="Tracks list · the ⋯ button on a track card" stage="menu">
        <ContextActionMenuSurface ariaLabel="More actions for Neon Cathedral" header={{ title: 'Neon Cathedral', subtitle: 'DVYDRM' }} items={TRACK_MENU} className="ll-popup-menu" />
      </Sample>
      <Sample title="Library context menu (with submenu)" where="Media Library · right-click; hover Add to Collection" stage="menu">
        <ContextActionMenuSurface ariaLabel="Media actions" header={{ title: 'neon-cathedral-cover.png', subtitle: 'Image · 3000 × 3000' }} items={LIBRARY_MENU} className="ll-popup-menu" />
      </Sample>
      <Sample title="Cue point menu (existing cue)" where="Audio dock waveform · right-click a cue point" stage="menu">
        <CuePointContextMenuPanel
          style={{ position: 'static' }}
          authoredTimeSec={24.5}
          cueMarker={CUE}
          cueEditable
          beatGrid={TM_BEAT_GRID}
          onClose={noop}
          onSeek={noop}
          onCreateCuePoint={noop}
          onUpdateCuePoint={noop}
          onDeleteCuePoint={noop}
        />
      </Sample>
      <Sample title="Cue point menu (empty spot)" where="Audio dock waveform · right-click the waveform" stage="menu">
        <CuePointContextMenuPanel
          style={{ position: 'static' }}
          authoredTimeSec={37.2}
          cueMarker={null}
          cueEditable={false}
          beatGrid={TM_BEAT_GRID}
          onClose={noop}
          onSeek={noop}
          onCreateCuePoint={noop}
        />
      </Sample>
      <Sample title="Notifications drawer" where="Page headers · the bell (and the Track Timeline)" stage="drawer">
        {drawerOpen
          ? <NotificationDrawer cards={NOTIFICATIONS} scope="container" onClose={() => setDrawerOpen(false)} />
          : <div className="ll-popup-reopen"><IconChipButton onClick={() => setDrawerOpen(true)}>Open Notifications</IconChipButton></div>}
      </Sample>
      <Sample title="Info popover" where="Audio dock · Audio Source and Playlist (click the trigger)" stage="info">
        <IconChipButton ref={anchor} onClick={() => setInfoOpen(value => !value)} aria-expanded={infoOpen}>Show info popover</IconChipButton>
        <InfoPopover
          open={infoOpen}
          anchorRef={anchor}
          title="Audio Source"
          description="Where DRMVYZ listens for audio."
          sections={[{ label: 'Input', content: 'Built-in Microphone', tone: 'accent' }, { label: 'Status', content: 'Signal detected', tone: 'success' }]}
          onOpenChange={setInfoOpen}
        />
      </Sample>
    </>
  )
}
