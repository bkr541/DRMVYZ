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

function CastIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5v3a13 13 0 0 1 13 13h3A16 16 0 0 0 3 5Z" />
      <path d="M3 11v3a7 7 0 0 1 7 7h3a10 10 0 0 0-10-10Z" />
      <circle cx="5" cy="19" r="1.6" />
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M17 4v4h-4M7 20v-4h4" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
// Same glyph as NoticeCard's canonical warning icon (canonicalControls.css'
// "Inline Flag" winner) — a circle-and-exclamation, not a triangle, so this
// badge reads as the same warning language the rest of the app uses.
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
// Simplified, single-tone brand marks (fill, not outline, like real logos)
// so the wireless-provider options read as macOS/Windows/Google Cast at a
// glance the same way an icon rail button reads as its glyph — currentColor
// throughout so they pick up the same hover/selected tinting as every other
// icon in this rail.
function AppleLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        stroke="none"
        d="M16.7 12.6c0-2.5 2-3.9 2.1-4-1.1-1.7-2.9-1.9-3.5-2-1.5-.2-2.9.9-3.7.9-.8 0-2-.8-3.2-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.5 7.5 1.3 9.9.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.7-.9 1-1.9 1.3-2.9-1.7-.7-2.7-2.4-2.7-3.7Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M14.2 5.2c.6-.8 1.1-1.9 1-3-.9.1-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.4Z"
      />
    </svg>
  )
}
function WindowsLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect fill="currentColor" stroke="none" x="3" y="3" width="8" height="8" />
      <rect fill="currentColor" stroke="none" x="13" y="3" width="8" height="8" />
      <rect fill="currentColor" stroke="none" x="3" y="13" width="8" height="8" />
      <rect fill="currentColor" stroke="none" x="13" y="13" width="8" height="8" />
    </svg>
  )
}
// A "C" with an open right side plus a crossbar reaching to center — the
// same simplified shorthand most monochrome renderings of the Google "G"
// use, since the full four-color mark doesn't work as a single-tone icon.
function GoogleLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M18.1 6.9A8 8 0 1 0 18.1 17.1" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M19 12h-7" />
    </svg>
  )
}
function DeviceIcon({ category }: { category: DeviceCategory }) {
  if (category === 'local') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M9 20h6M12 16v4" />
      </svg>
    )
  }
  if (category === 'receiver') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="1.5" />
        <path d="M7 3l3 3M17 3l-3 3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6a12 12 0 0 1 16 0" />
      <path d="M7 9.5a8 8 0 0 1 10 0" />
      <path d="M10 13a4 4 0 0 1 4 0" />
      <circle cx="12" cy="17" r="1.4" />
    </svg>
  )
}
function AspectRatioIcon({ ratio }: { ratio: AspectRatioId }) {
  const [w, h] = ratio.split(':').map(Number)
  const box = 15
  const scale = box / Math.max(w, h)
  const rectW = Math.max(4, w * scale)
  const rectH = Math.max(4, h * scale)
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <rect x={(18 - rectW) / 2} y={(18 - rectH) / 2} width={rectW} height={rectH} rx="1.5" />
    </svg>
  )
}
function ScopeIcon({ scope }: { scope: CastScopeId }) {
  if (scope === 'app') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="1.5" />
        <path d="M8 4v16M17 4v16" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
    </svg>
  )
}
// Same glyph OutputCastControl.tsx uses above its real device list.
function AvailableDevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="7" r="2.5" />
      <circle cx="17" cy="8" r="2" />
      <path d="M3.5 18v-2.2A3.8 3.8 0 0 1 7.3 12h1.4a3.8 3.8 0 0 1 3.8 3.8V18M14 18v-1.6a3 3 0 0 1 3-3h.8a2.7 2.7 0 0 1 2.7 2.7V18" />
    </svg>
  )
}
// Activity/pulse line — labels the Current Devices status log, distinct
// from Available Devices' circle-and-people glyph.
function CurrentDevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12h4l2-7 4 14 3-10 2 3h5" />
    </svg>
  )
}
function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function WindowModeIcon({ mode }: { mode: WindowModeId }) {
  if (mode === 'windowed') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="8" width="13" height="10" rx="1.2" />
        <rect x="8" y="4" width="13" height="10" rx="1.2" opacity="0.4" />
      </svg>
    )
  }
  if (mode === 'borderless') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="1.2" strokeDasharray="3 2.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

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
