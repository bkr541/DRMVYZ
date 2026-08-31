import { useEffect, useRef, useState } from 'react'

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
const WINDOW_OPTIONS: { id: WindowModeId; label: string; short: string }[] = [
  { id: 'windowed', label: 'Window', short: 'Win' },
  { id: 'borderless', label: 'Borderless', short: 'Bdl' },
  { id: 'fullscreen', label: 'Full Screen', short: 'Full' },
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
// Ratio row always on screen. The device grid trades circular cards for
// wide two-column tiles (icon beside text, not stacked above it).

function IconRailBarModal() {
  const [scope, setScope] = useState<CastScopeId>('visualizer')
  const [windowMode, setWindowMode] = useState<WindowModeId>('fullscreen')
  const [aspect, setAspect] = useState<AspectRatioId>('16:9')
  const [noticeOpenId, setNoticeOpenId] = useState<string | null>(null)

  return (
    <div className="llcm-panel llcm-panel--rail">
      <header className="llcm-hdr">
        <span className="llcm-hdr-icon"><CastIcon /></span>
        <h2>Cast Output</h2>
        <HeaderActions />
      </header>

      <div className="llcm-rail-bar">
        <div className="llcm-rail-group">
          {(['visualizer', 'app'] as const).map(id => (
            <button key={id} type="button" className={scope === id ? 'is-selected' : ''} title={id === 'visualizer' ? 'Visualizer Only' : 'Whole App'} onClick={() => setScope(id)}>
              <ScopeIcon scope={id} />
            </button>
          ))}
        </div>
        <span className="llcm-rail-divider" aria-hidden="true" />
        <div className="llcm-rail-group">
          {WINDOW_OPTIONS.map(option => (
            <button key={option.id} type="button" className={windowMode === option.id ? 'is-selected' : ''} title={option.label} onClick={() => setWindowMode(option.id)}>
              <WindowModeIcon mode={option.id} />
            </button>
          ))}
        </div>
        <span className="llcm-rail-divider" aria-hidden="true" />
        <div className="llcm-rail-group llcm-rail-group--aspect">
          {ASPECT_OPTIONS.map(option => (
            <button key={option} type="button" className={aspect === option ? 'is-selected' : ''} title={option} onClick={() => setAspect(option)}>
              <AspectRatioIcon ratio={option} />
            </button>
          ))}
        </div>
      </div>

      <div className="llcm-card-grid llcm-card-grid--rail">
        {MOCK_DEVICES.map(device => (
          <div key={device.id} className="llcm-rail-tile">
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
            <span className="llcm-rail-tile-icon"><DeviceIcon category={device.category} /></span>
            <div className="llcm-rail-tile-copy">
              <strong>{device.name}</strong>
              <small>{device.detail}</small>
            </div>
            <button type="button" className={`llcm-tile-action${device.action === 'Setup' ? ' is-muted' : ''}`}>{device.action}</button>
          </div>
        ))}
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
    blurb: 'Same command-bar-over-grid skeleton as #3, but every option (Scope, Window, full Aspect Ratio row) stays visible at once in larger icon buttons instead of collapsing behind a dropdown. Devices sit in wide two-column tiles — icon beside text, not stacked above it.',
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
