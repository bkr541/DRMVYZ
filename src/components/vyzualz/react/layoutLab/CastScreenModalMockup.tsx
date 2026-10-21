import { AppIcon } from '../../../shared/icons/AppIcon'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NoticeCard } from '../controls/NoticeCard'
import { UnderlineTabs } from '../controls/UnderlineTabs'

// ── CastScreenModalMockup ────────────────────────────────────────────────
//
// Layout Lab / Template engine, middle visualizer only. Three from-scratch
// concepts for the Cast Output popover (OutputCastControl.tsx) — wide,
// short panels instead of a tall narrow stack, each with its own reasoning
// for where a configuration notice belongs instead of one shared banner
// position. Real copy, real window/aspect/device data throughout. Icon +
// layout only — local sample data and local open/tab/popover state,
// nothing wired to a real target list, native bridge, or session.

type WindowModeId = 'windowed' | 'borderless' | 'fullscreen'
const WINDOW_OPTIONS: { id: WindowModeId; label: string; short: string; oneWord: string }[] = [
  { id: 'windowed', label: 'Window', short: 'Win', oneWord: 'Window' },
  { id: 'borderless', label: 'Borderless', short: 'Bdl', oneWord: 'Borderless' },
  { id: 'fullscreen', label: 'Full Screen', short: 'Full', oneWord: 'Full' },
]
const ASPECT_OPTIONS = ['16:9', '16:10', '4:3', '3:2', '1:1', '9:16'] as const
type AspectRatioId = (typeof ASPECT_OPTIONS)[number]

type CastScopeId = 'visualizer' | 'app'

type DeviceCategory = 'wireless' | 'local' | 'receiver'
interface MockDevice {
  id: string
  category: DeviceCategory
  name: string
  detail: string
  action: 'Open' | 'Setup' | 'Cast' | 'Pair & Cast'
  needsSetup?: boolean
}

const MOCK_DEVICES: MockDevice[] = [
  { id: 'airplay', category: 'wireless', name: 'Open macOS Displays', detail: 'Mirror or extend to an AirPlay display', action: 'Open' },
  { id: 'google-cast', category: 'wireless', name: 'Choose Google Cast Device', detail: 'Cast receiver app ID and HTTPS sender required', action: 'Setup', needsSetup: true },
  { id: 'built-in', category: 'local', name: 'Built-in Retina Display', detail: '1728 × 1117 · Primary', action: 'Cast' },
  { id: 'stage-led', category: 'receiver', name: 'Booth Mac · DRMVYZ — Stage LED', detail: '2560 × 1440 · Pair on first use', action: 'Pair & Cast' },
  { id: 'preview', category: 'receiver', name: 'Booth Mac · DRMVYZ — Preview', detail: '1920 × 1080 · Primary · Paired', action: 'Cast' },
]

const GOOGLE_CAST_NOTICE = (
  <>
    Requires <code>DRMVYZ_GOOGLE_CAST_APP_ID</code> and <code>DRMVYZ_GOOGLE_CAST_SENDER_URL</code>.
    The picker stays disabled until both are configured.
  </>
)

// Wider gap around each "·" separator in session detail lines than a plain
// space allows — browsers collapse consecutive regular spaces, so this
// joins with non-breaking spaces to actually render the extra padding.
function joinDetails(parts: string[]): string {
  return parts.join('  ·  ')
}

// A session detail row with its field name to the left of the value —
// e.g. "WINDOW  Full Screen" — instead of a bare, unlabeled value line.
function SessionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <small>
      <span className="llcm-cast-session-field-label">{label}</span>
      {children}
    </small>
  )
}

// ── Concept 1 only: the real popover's full device taxonomy ─────────────────
// OutputCastControl.tsx separates devices into three semantically distinct
// groups — OS-level wireless pickers (with explanatory copy, since AirPlay/
// Miracast/Google Cast each have real setup requirements), Local Displays,
// and DRMVYZ Receivers (network, needs pairing) — plus a live session banner
// and provider-issue notices. The other two concepts still show the
// simplified flat MOCK_DEVICES grid; this richer set exists so Concept 1 can
// stand in for what production actually needs before it's ported over.
type RailDeviceTabId = 'wireless' | 'local' | 'receivers'
const RAIL_DEVICE_TABS: { id: RailDeviceTabId; label: string }[] = [
  { id: 'wireless', label: 'Wireless Displays' },
  { id: 'local', label: 'Local Displays' },
  { id: 'receivers', label: 'App Receivers' },
]

type RailWirelessProviderId = 'airplay' | 'miracast' | 'google-cast'
interface RailWirelessProvider {
  id: RailWirelessProviderId
  /** Title shown on the notice card when this provider needsSetup, and as
   * the tile's device-card name — same field both Local Displays and App
   * Receivers device cards use for their <strong> name. */
  name: string
  detail: string
  needsSetup?: boolean
}

const RAIL_WIRELESS_PROVIDERS: RailWirelessProvider[] = [
  { id: 'airplay', name: 'Open macOS Displays', detail: 'Mirror or extend to an AirPlay display.' },
  { id: 'miracast', name: 'Open Windows Displays', detail: 'Open Windows Displays and use Connect under Multiple displays.' },
  { id: 'google-cast', name: 'Choose Google Cast Device', detail: 'Choose a Cast device in the supported Web Sender companion.', needsSetup: true },
]

interface RailDevice {
  id: string
  category: 'local' | 'receiver'
  name: string
  detail: string
  action: 'Cast' | 'Pair & Cast' | 'Live'
}

const RAIL_LOCAL_DISPLAYS: RailDevice[] = [
  { id: 'built-in', category: 'local', name: 'Built-in Retina Display', detail: '1728 × 1117 · Primary', action: 'Cast' },
]

const RAIL_RECEIVERS: RailDevice[] = [
  { id: 'stage-led', category: 'receiver', name: 'Booth Mac · DRMVYZ — Stage LED', detail: '2560 × 1440 · Pair on first use', action: 'Pair & Cast' },
  { id: 'preview', category: 'receiver', name: 'Booth Mac · DRMVYZ — Preview', detail: '1920 × 1080 · Primary · Paired', action: 'Live' },
]

function CastIcon() { return <AppIcon kind="cast" /> }
function RefreshIcon() { return <AppIcon kind="sync" /> }
function CloseIcon() { return <AppIcon kind="close" /> }
// Same glyph as NoticeCard's canonical warning icon (canonicalControls.css'
// "Inline Flag" winner) — a circle-and-exclamation, not a triangle, so this
// badge reads as the same warning language the rest of the app uses.
function WarnIcon() { return <AppIcon kind="info" /> }
// Simplified, single-tone brand marks (fill, not outline, like real logos)
// so the wireless-provider options read as macOS/Windows/Google Cast at a
// glance the same way an icon rail button reads as its glyph — currentColor
// throughout so they pick up the same hover/selected tinting as every other
// icon in this rail.
function AppleLogoIcon() { return <AppIcon kind="apple" /> }
function WindowsLogoIcon() { return <AppIcon kind="windows" /> }
// A "C" with an open right side plus a crossbar reaching to center — the
// same simplified shorthand most monochrome renderings of the Google "G"
// use, since the full four-color mark doesn't work as a single-tone icon.
function GoogleLogoIcon() { return <AppIcon kind="google" /> }
function DeviceIcon({ category }: { category: DeviceCategory }) { return <AppIcon kind={category === 'local' ? 'monitor' : 'cast'} /> }
function AspectRatioIcon({ ratio }: { ratio: AspectRatioId }) {
  const kinds = { '16:9': 'ratio16x9', '16:10': 'ratio16x10', '4:3': 'ratio4x3', '3:2': 'ratio3x2', '1:1': 'ratio1x1', '9:16': 'ratio9x16' } as const
  return <AppIcon kind={kinds[ratio]} />
}
function ScopeIcon({ scope }: { scope: CastScopeId }) { return <AppIcon kind={scope === 'app' ? 'window' : 'borderless'} /> }
// Same glyph OutputCastControl.tsx uses above its real device list.
function AvailableDevicesIcon() { return <AppIcon kind="people" /> }
// Activity/pulse line — labels the Current Devices status log, distinct
// from Available Devices' circle-and-people glyph.
function CurrentDevicesIcon() { return <AppIcon kind="waveform" /> }
function CaretIcon() { return <AppIcon kind="chevronDown" /> }
function WindowModeIcon({ mode }: { mode: WindowModeId }) { return <AppIcon kind={mode === 'windowed' ? 'window' : mode === 'borderless' ? 'borderless' : 'expand'} /> }

function HeaderActions() {
  return (
    <div className="llcm-hdr-actions">
      <button type="button" className="llcm-icon-btn" aria-label="Refresh output devices"><RefreshIcon /></button>
      <button type="button" className="llcm-icon-btn llcm-icon-btn--close" aria-label="Close cast panel"><CloseIcon /></button>
    </div>
  )
}

// ── Concept 1: Icon Rail Bar ──────────────────────────────────────────────
// Same command-bar-over-grid skeleton as Command Bar + Grid, but every
// option stays visible at once instead of collapsing behind a dropdown —
// larger square icon buttons for Scope and Window, and the full Aspect
// Ratio row always on screen. Below it, the device area models everything
// the real OutputCastControl.tsx popover actually needs (see the "Concept 1
// only" data block above): an Available Devices heading with refresh, a
// live session banner, then a tab row (Wireless Displays / Local Displays /
// App Receivers) switching between three device-card grids that all share
// Concept 02's dense four-column square-tile style — Wireless Displays'
// macOS/Windows/Google Cast tiles included, each opening either its OS
// picker or, for Google Cast, a setup notice.

function IconRailBarModal() {
  const [scope, setScope] = useState<CastScopeId>('visualizer')
  const [windowMode, setWindowMode] = useState<WindowModeId>('fullscreen')
  const [aspect, setAspect] = useState<AspectRatioId>('16:9')
  const [deviceTab, setDeviceTab] = useState<RailDeviceTabId>('wireless')
  const [wirelessSelected, setWirelessSelected] = useState<RailWirelessProviderId | null>(null)
  const selectedWirelessProvider = wirelessSelected
    ? RAIL_WIRELESS_PROVIDERS.find(provider => provider.id === wirelessSelected) ?? null
    : null
  const [errorExpanded, setErrorExpanded] = useState(false)

  return (
    <div className="llcm-panel llcm-panel--rail">
      <header className="llcm-hdr">
        <span className="llcm-hdr-icon"><CastIcon /></span>
        <h2>Cast Output</h2>
        <HeaderActions />
      </header>

      {/* Degrouped — no enclosing background/border box and no parent
          "Output Settings" label; Mode/Window/Aspect Ratio sit directly in
          one plain row. */}
      <div className="llcm-rail-bar">
        <div className="llcm-rail-section">
          <span className="llcm-rail-section-hdr">Mode</span>
          <div className="llcm-rail-group">
            {(['visualizer', 'app'] as const).map(id => (
              <button key={id} type="button" className={scope === id ? 'is-selected' : ''} title={id === 'visualizer' ? 'Visualizer Only' : 'Whole App'} onClick={() => setScope(id)}>
                <ScopeIcon scope={id} />
                <span className="llcm-rail-option-label">{id === 'visualizer' ? 'Visualizer' : 'App'}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="llcm-rail-divider" aria-hidden="true" />
        <div className="llcm-rail-section">
          <span className="llcm-rail-section-hdr">Window</span>
          <div className="llcm-rail-group">
            {WINDOW_OPTIONS.map(option => (
              <button key={option.id} type="button" className={windowMode === option.id ? 'is-selected' : ''} title={option.label} onClick={() => setWindowMode(option.id)}>
                <WindowModeIcon mode={option.id} />
                <span className="llcm-rail-option-label">{option.oneWord}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="llcm-rail-divider" aria-hidden="true" />
        <div className="llcm-rail-section">
          <span className="llcm-rail-section-hdr">Aspect Ratio</span>
          <div className="llcm-rail-group llcm-rail-group--aspect">
            {ASPECT_OPTIONS.map(option => (
              <button key={option} type="button" className={aspect === option ? 'is-selected' : ''} title={option} onClick={() => setAspect(option)}>
                <AspectRatioIcon ratio={option} />
                <span className="llcm-rail-option-label">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="llcm-rail-section">
        {/* Current status first — these are devices already in use or being
            negotiated, not "available" ones, so they read oddly sitting
            under an Available Devices label. Real production's session
            banner has four states; connected was the only one shown before
            this change — the other three below demonstrate the rest with
            distinct, state-appropriate tones. */}
        <span className="llcm-rail-section-hdr llcm-devices-heading-title">
          <CurrentDevicesIcon />
          <span>Current Devices</span>
        </span>

        <div className="llcm-cast-session">
          <span className="llcm-cast-session-bar" aria-hidden="true" />
          <div className="llcm-cast-session-info">
            <div className="llcm-cast-session-name-row">
              <strong>Booth Mac · DRMVYZ — Preview</strong>
              <span className="llcm-cast-session-status"><span className="llcm-cast-session-status-dot" aria-hidden="true" />Now casting</span>
            </div>
            <SessionField label="Window">Full Screen</SessionField>
            <SessionField label="Aspect Ratio">{joinDetails(['16:9', '1920×1080'])}</SessionField>
            <SessionField label="Stats">{joinDetails(['60 fps', '9.4 Mbps', '18 ms'])}</SessionField>
          </div>
          <button type="button" className="llcm-cast-stop">Stop Output</button>
        </div>

        <div className="llcm-cast-session llcm-cast-session--connecting">
          <span className="llcm-cast-session-bar" aria-hidden="true" />
          <div className="llcm-cast-session-info">
            <div className="llcm-cast-session-name-row">
              <strong>Booth Mac · DRMVYZ — Stage LED</strong>
              <span className="llcm-cast-session-status"><span className="llcm-cast-session-status-dot" aria-hidden="true" />Connecting output</span>
            </div>
            <SessionField label="Window">Full Screen</SessionField>
            <SessionField label="Aspect Ratio">16:9</SessionField>
          </div>
          <button type="button" className="llcm-cast-stop">Stop Output</button>
        </div>

        <div className="llcm-cast-session llcm-cast-session--failed">
          <span className="llcm-cast-session-bar" aria-hidden="true" />
          <div className="llcm-cast-session-info">
            <div className="llcm-cast-session-name-row">
              <strong>Built-in Retina Display</strong>
              <span className="llcm-cast-session-status"><span className="llcm-cast-session-status-dot" aria-hidden="true" />Output failed</span>
            </div>
            <SessionField label="Window">Full Screen</SessionField>
            <SessionField label="Aspect Ratio">16:9</SessionField>
            {errorExpanded && (
              <NoticeCard tone="error" role="alert" title="Output failed" className="llcm-wireless-notice-drop">
                The output receiver connection was lost and did not recover.
              </NoticeCard>
            )}
          </div>
          <button
            type="button"
            className="llcm-cast-session-error-toggle"
            aria-expanded={errorExpanded}
            onClick={() => setErrorExpanded(value => !value)}
          >
            {errorExpanded ? 'Hide Error' : 'Show Error'}
          </button>
          <button type="button" className="llcm-cast-stop">Stop Output</button>
        </div>

        <div className="llcm-cast-session llcm-cast-session--disconnecting">
          <span className="llcm-cast-session-bar" aria-hidden="true" />
          <div className="llcm-cast-session-info">
            <div className="llcm-cast-session-name-row">
              <strong>Booth Mac · DRMVYZ — Preview</strong>
              <span className="llcm-cast-session-status"><span className="llcm-cast-session-status-dot" aria-hidden="true" />Stopping output</span>
            </div>
            <SessionField label="Window">Full Screen</SessionField>
            <SessionField label="Aspect Ratio">{joinDetails(['16:9', '1920×1080'])}</SessionField>
            <SessionField label="Stats">60 fps</SessionField>
          </div>
          <button type="button" className="llcm-cast-stop">Stop Output</button>
        </div>
      </div>

      {/* A separate rail-section (not appended to the status block above) so
          it gets the panel's normal 12px inter-block gap instead of the
          6px rhythm status banners use among themselves — Available Devices
          sits directly above the tab row it labels, not above the status
          banners, since those aren't "available", they're already in use. */}
      <div className="llcm-rail-section">
        <div className="llcm-devices-heading">
          <span className="llcm-rail-section-hdr llcm-devices-heading-title">
            <AvailableDevicesIcon />
            <span>Available Devices</span>
          </span>
          <button type="button" className="llcm-icon-btn" aria-label="Refresh output devices"><RefreshIcon /></button>
        </div>

        <UnderlineTabs
          tabs={RAIL_DEVICE_TABS}
          activeTab={deviceTab}
          onChange={setDeviceTab}
          ariaLabel="Device category"
        />

        {deviceTab === 'wireless' && (
          <div className="llcm-device-subsection">
            <div className="llcm-card-grid llcm-card-grid--4col">
              {RAIL_WIRELESS_PROVIDERS.map(provider => (
                <div key={provider.id} className="llcm-device-card llcm-device-card--sm">
                  <span className="llcm-device-card-icon llcm-device-card-icon--sm">
                    {provider.id === 'airplay' && <AppleLogoIcon />}
                    {provider.id === 'miracast' && <WindowsLogoIcon />}
                    {provider.id === 'google-cast' && <GoogleLogoIcon />}
                  </span>
                  <div className="llcm-device-card-body">
                    <strong>{provider.name}</strong>
                    <small>{provider.detail}</small>
                  </div>
                  <button
                    type="button"
                    className={`llcm-device-card-action${provider.needsSetup ? ' is-muted' : ''}`}
                    onClick={() => setWirelessSelected(current => current === provider.id ? null : provider.id)}
                  >
                    {provider.needsSetup ? 'Setup' : 'Open'}
                  </button>
                </div>
              ))}
            </div>
            {selectedWirelessProvider?.needsSetup && (
              <NoticeCard
                key={selectedWirelessProvider.id}
                tone="warning"
                role="status"
                title={selectedWirelessProvider.name}
                className="llcm-wireless-notice-drop"
              >
                {GOOGLE_CAST_NOTICE}
              </NoticeCard>
            )}
          </div>
        )}

        {deviceTab === 'local' && (
          <div className="llcm-device-subsection">
            <div className="llcm-card-grid llcm-card-grid--4col">
              {RAIL_LOCAL_DISPLAYS.map(device => (
                <div key={device.id} className="llcm-device-card llcm-device-card--sm">
                  <span className="llcm-device-card-icon llcm-device-card-icon--sm"><DeviceIcon category={device.category} /></span>
                  <div className="llcm-device-card-body">
                    <strong>{device.name}</strong>
                    <small>{device.detail}</small>
                  </div>
                  <button type="button" className="llcm-device-card-action">{device.action}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {deviceTab === 'receivers' && (
          <div className="llcm-device-subsection">
            <div className="llcm-card-grid llcm-card-grid--4col">
              {RAIL_RECEIVERS.map(device => (
                <div key={device.id} className="llcm-device-card llcm-device-card--sm">
                  <span className="llcm-device-card-icon llcm-device-card-icon--sm"><DeviceIcon category={device.category} /></span>
                  <div className="llcm-device-card-body">
                    <strong>{device.name}</strong>
                    <small>{device.detail}</small>
                  </div>
                  <button type="button" className={`llcm-device-card-action${device.action === 'Live' ? ' is-live' : ''}`}>{device.action}</button>
                </div>
              ))}
            </div>
            <p className="llcm-device-note">Open DRMVYZ on another computer to make it discoverable. Each Receiver V2 display is selectable independently; first use asks the receiving computer to approve pairing.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Concept 2: Pill Toggle Bar ────────────────────────────────────────────
// Same command-bar-over-grid skeleton again, restyled a third way — Scope
// is one sliding two-sided pill instead of separate buttons, Window is a
// labeled pill row (icon + text together), and Aspect Ratio collapses into
// a dropdown whose popover lays every option out in a single horizontal
// strip instead of a 3×2 grid. Devices sit in a denser four-column grid of
// small square tiles.

function PillToggleBarModal() {
  const [scope, setScope] = useState<CastScopeId>('visualizer')
  const [windowMode, setWindowMode] = useState<WindowModeId>('fullscreen')
  const [aspect, setAspect] = useState<AspectRatioId>('16:9')
  const [aspectOpen, setAspectOpen] = useState(false)
  const [noticeOpenId, setNoticeOpenId] = useState<string | null>(null)
  const aspectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aspectOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (aspectRef.current && !aspectRef.current.contains(event.target as Node)) setAspectOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [aspectOpen])

  return (
    <div className="llcm-panel llcm-panel--pill">
      <header className="llcm-hdr">
        <span className="llcm-hdr-icon"><CastIcon /></span>
        <h2>Cast Output</h2>
        <HeaderActions />
      </header>

      <div className="llcm-pill-bar">
        <div className="llcm-scope-pill" role="radiogroup" aria-label="What to cast">
          {(['visualizer', 'app'] as const).map(id => (
            <button key={id} type="button" role="radio" aria-checked={scope === id} className={scope === id ? 'is-selected' : ''} onClick={() => setScope(id)}>
              <ScopeIcon scope={id} />
              <span>{id === 'visualizer' ? 'Visualizer' : 'Whole App'}</span>
            </button>
          ))}
        </div>
        <div className="llcm-window-pills">
          {WINDOW_OPTIONS.map(option => (
            <button key={option.id} type="button" className={windowMode === option.id ? 'is-selected' : ''} onClick={() => setWindowMode(option.id)}>
              <WindowModeIcon mode={option.id} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className="llcm-command-aspect" ref={aspectRef}>
          <button type="button" className="llcm-aspect-pill-trigger" aria-expanded={aspectOpen} onClick={() => setAspectOpen(value => !value)}>
            <AspectRatioIcon ratio={aspect} />
            <span>{aspect}</span>
            <CaretIcon />
          </button>
          {aspectOpen && (
            <div className="llcm-aspect-strip-popover">
              {ASPECT_OPTIONS.map(option => (
                <button key={option} type="button" className={aspect === option ? 'is-selected' : ''} onClick={() => { setAspect(option); setAspectOpen(false) }}>
                  <AspectRatioIcon ratio={option} />
                  <span>{option}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="llcm-card-grid llcm-card-grid--4col">
        {MOCK_DEVICES.map(device => (
          <div key={device.id} className="llcm-device-card llcm-device-card--sm">
            {device.needsSetup && (
              <button
                type="button"
                className="llcm-card-badge"
                aria-label="Setup required"
                aria-expanded={noticeOpenId === device.id}
                onClick={() => setNoticeOpenId(value => value === device.id ? null : device.id)}
              >
                <WarnIcon />
              </button>
            )}
            {noticeOpenId === device.id && <div className="llcm-card-popover">{GOOGLE_CAST_NOTICE}</div>}
            <span className="llcm-device-card-icon llcm-device-card-icon--sm"><DeviceIcon category={device.category} /></span>
            <div className="llcm-device-card-body">
              <strong>{device.name}</strong>
              <small>{device.detail}</small>
            </div>
            <button type="button" className={`llcm-device-card-action${device.action === 'Setup' ? ' is-muted' : ''}`}>{device.action}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Concept 3: Command Bar + Grid ─────────────────────────────────────────
// Every setting collapses into one slim command-bar row (Spotlight-style),
// freeing the rest of the panel for a wide three-column device grid. The
// notice is a small badge on the one affected card, expanding into detail
// only when the operator asks — nothing shown by default takes up height.

function CommandBarModal() {
  const [scope, setScope] = useState<CastScopeId>('visualizer')
  const [windowMode, setWindowMode] = useState<WindowModeId>('fullscreen')
  const [aspect, setAspect] = useState<AspectRatioId>('16:9')
  const [aspectOpen, setAspectOpen] = useState(false)
  const [noticeOpenId, setNoticeOpenId] = useState<string | null>(null)

  return (
    <div className="llcm-panel llcm-panel--command">
      <header className="llcm-hdr">
        <span className="llcm-hdr-icon"><CastIcon /></span>
        <h2>Cast Output</h2>
        <HeaderActions />
      </header>

      <div className="llcm-command-bar">
        <div className="llcm-command-group">
          {(['visualizer', 'app'] as const).map(id => (
            <button key={id} type="button" className={scope === id ? 'is-selected' : ''} title={id === 'visualizer' ? 'Visualizer Only' : 'Whole App'} onClick={() => setScope(id)}>
              <ScopeIcon scope={id} />
            </button>
          ))}
        </div>
        <span className="llcm-command-divider" aria-hidden="true" />
        <div className="llcm-command-group">
          {WINDOW_OPTIONS.map(option => (
            <button key={option.id} type="button" className={windowMode === option.id ? 'is-selected' : ''} title={option.label} onClick={() => setWindowMode(option.id)}>
              {option.short}
            </button>
          ))}
        </div>
        <span className="llcm-command-divider" aria-hidden="true" />
        <div className="llcm-command-aspect">
          <button type="button" className="llcm-command-aspect-trigger" aria-expanded={aspectOpen} onClick={() => setAspectOpen(value => !value)}>
            <AspectRatioIcon ratio={aspect} />
            <span>{aspect}</span>
            <CaretIcon />
          </button>
          {aspectOpen && (
            <div className="llcm-command-aspect-popover">
              {ASPECT_OPTIONS.map(option => (
                <button key={option} type="button" className={aspect === option ? 'is-selected' : ''} onClick={() => { setAspect(option); setAspectOpen(false) }}>
                  <AspectRatioIcon ratio={option} />
                  <span>{option}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="llcm-card-grid llcm-card-grid--3col">
        {MOCK_DEVICES.map(device => (
          <div key={device.id} className="llcm-device-card">
            {device.needsSetup && (
              <button
                type="button"
                className="llcm-card-badge"
                aria-label="Setup required"
                aria-expanded={noticeOpenId === device.id}
                onClick={() => setNoticeOpenId(value => value === device.id ? null : device.id)}
              >
                <WarnIcon />
              </button>
            )}
            {noticeOpenId === device.id && (
              <div className="llcm-card-popover">{GOOGLE_CAST_NOTICE}</div>
            )}
            <span className="llcm-device-card-icon"><DeviceIcon category={device.category} /></span>
            <strong>{device.name}</strong>
            <small>{device.detail}</small>
            <button type="button" className={`llcm-device-card-action${device.action === 'Setup' ? ' is-muted' : ''}`}>{device.action}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  {
    id: 'icon-rail',
    title: '01 · Icon Rail Bar',
    blurb: 'Same command-bar-over-grid skeleton as #3, but every option (Scope, Window, full Aspect Ratio row) stays visible at once in larger icon buttons instead of collapsing behind a dropdown. Below it, the device area models everything the real OutputCastControl.tsx popover needs — session banner, then a Wireless Displays / Local Displays / App Receivers tab row, all three using the same dense four-column square-tile grid as #2.',
    Modal: IconRailBarModal,
  },
  {
    id: 'pill-toggle',
    title: '02 · Pill Toggle Bar',
    blurb: 'Same skeleton again, restyled a third way — Scope is one sliding two-sided pill, Window is a labeled icon+text pill row, and Aspect Ratio collapses into a dropdown with a single horizontal strip of options. Devices sit in a denser four-column grid of small square tiles.',
    Modal: PillToggleBarModal,
  },
  {
    id: 'command-bar',
    title: '03 · Command Bar + Grid',
    blurb: 'Every setting collapses into one Spotlight-style bar, freeing the rest of the panel for a wide three-column device grid. The notice is a small badge on the one affected card — nothing else takes up height for it.',
    Modal: CommandBarModal,
  },
]

export function CastScreenModalMockup() {
  return (
    <div className="llcm-gallery lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Modal />
          </div>
        </div>
      ))}
    </div>
  )
}
