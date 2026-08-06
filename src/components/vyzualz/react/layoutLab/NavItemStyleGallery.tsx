import { useState, type ComponentType } from 'react'

// ── NavItemStyleGallery ─────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Five full replicas of the real
// left-nav shell (VyzualzSidebar) — same destinations, same grouping, same
// collapse/expand behavior, single-select active state — each skinned with
// a different, deliberately out-of-the-box item style. Because each replica
// mirrors the real shell's actual behavior (not just a static button), the
// one you pick here is a true preview of what promoting it to production
// will look and feel like. Fully local, disconnected — its own
// active-item + collapsed state per replica.

function ReactIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true">
      <ellipse cx="14" cy="14" rx="11" ry="4.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none" />
      <ellipse cx="14" cy="14" rx="11" ry="4.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none" transform="rotate(60 14 14)" />
      <ellipse cx="14" cy="14" rx="11" ry="4.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none" transform="rotate(120 14 14)" />
      <circle cx="14" cy="14" r="2.2" fill="currentColor" fillOpacity="0.85" />
    </svg>
  )
}

function VisualizerIcon() {
  return (
    <svg viewBox="0 0 1024 1024" width="24" height="24" aria-hidden="true">
      <path d="M960 1002.666667H64a42.666667 42.666667 0 0 1-42.666667-42.666667V64a42.666667 42.666667 0 0 1 42.666667-42.666667h896a42.666667 42.666667 0 0 1 42.666667 42.666667v896a42.666667 42.666667 0 0 1-42.666667 42.666667z" fill="#0d1820" />
      <path d="M64 64h896v682.666667H64z" fill="#091318" />
      <path d="M896 896H597.333333a21.333333 21.333333 0 1 1 0-42.666667h298.666667a21.333333 21.333333 0 1 1 0 42.666667z" fill="#1a2d3a" />
      <path d="M661.333333 896H128a21.333333 21.333333 0 1 1 0-42.666667h533.333333a21.333333 21.333333 0 1 1 0 42.666667z" fill="#4ac7db" />
      <path d="M640 960c-47.04 0-85.333333-38.293333-85.333333-85.333333s38.293333-85.333333 85.333333-85.333334 85.333333 38.293333 85.333333 85.333334-38.293333 85.333333-85.333333 85.333333z" fill="#4ac7db" />
      <path d="M426.666667 554.666667a21.269333 21.269333 0 0 1-21.333334-21.333334V277.333333a21.333333 21.333333 0 0 1 33.173334-17.749333l192 128a21.333333 21.333333 0 0 1 0 35.498667l-192 128A21.333333 21.333333 0 0 1 426.666667 554.666667z" fill="#67f7ff" />
    </svg>
  )
}

function ShowManagerIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4" width="21" height="20" rx="2.5" fill="#0d1820" />
      <rect x="3.5" y="4" width="21" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.48" />
      <path d="M10 4v20M18 4v20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      <path d="M3.5 15.5h21" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      <rect x="11.5" y="7" width="5" height="5" rx="1" fill="currentColor" fillOpacity="0.82" />
      <path d="M5.8 19h2.2M11.2 19h2.2M16.6 19h2.2M22 19h.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 21.5h16" stroke="currentColor" strokeWidth="1" strokeOpacity="0.45" />
    </svg>
  )
}

function LyricManagerIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="16" height="21" rx="2.5" fill="#0d1820" />
      <rect x="4" y="2" width="16" height="21" rx="2.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" />
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="22" r="4" fill="#0d1820" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" />
      <path d="M18.8 23.2c0 .66.54 1.2 1.2 1.2s1.2-.54 1.2-1.2-.54-1.2-1.2-1.2-1.2.54-1.2 1.2z" fill="currentColor" fillOpacity="0.8" />
      <line x1="21.2" y1="22" x2="21.2" y2="19.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="21.2" y1="19.6" x2="23" y2="20.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

function MediaManagerIcon() {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="21" height="17" rx="2.5" fill="#0d1820" />
      <rect x="3.5" y="5" width="21" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
      <path d="M7.5 18.2l4.1-4.2 3 2.9 2.1-2.1 3.8 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.8" cy="10.2" r="1.7" fill="currentColor" fillOpacity="0.8" />
      <path d="M9 3.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.45" />
      <path d="M9 23.8h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.45" />
    </svg>
  )
}

interface NavItemProps {
  label: string
  Icon: ComponentType
  active: boolean
  collapsed: boolean
  onSelect: () => void
}

// 1 — Neon glass pill: floating capsule, blurred glass fill, glow ring when active
function GlassPillItem({ label, Icon, active, collapsed, onSelect }: NavItemProps) {
  return (
    <button type="button" className={`llnv-glass${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active} title={label}>
      <span className="llnv-glass-icon"><Icon /></span>
      {!collapsed && <span className="llnv-glass-label">{label}</span>}
    </button>
  )
}

// 2 — Bracket tab: monospace label, brackets close in around it on active/hover
function BracketTabItem({ label, Icon, active, collapsed, onSelect }: NavItemProps) {
  return (
    <button type="button" className={`llnv-bracket${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active} title={label}>
      <span className="llnv-bracket-mark llnv-bracket-mark--open" aria-hidden="true">[</span>
      <span className="llnv-bracket-icon"><Icon /></span>
      {!collapsed && <span className="llnv-bracket-label">{label}</span>}
      <span className="llnv-bracket-mark llnv-bracket-mark--close" aria-hidden="true">]</span>
    </button>
  )
}

// 3 — Magnetic dock: icon lifts + glows on active, label reveals inline
function DockItem({ label, Icon, active, collapsed, onSelect }: NavItemProps) {
  return (
    <button type="button" className={`llnv-dock${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active} title={label}>
      <span className="llnv-dock-well"><Icon /></span>
      <span className="llnv-dock-reflection" aria-hidden="true" />
      {!collapsed && <span className="llnv-dock-label">{label}</span>}
    </button>
  )
}

// 4 — Vertical progress rail: fill bar climbs the left edge, letter-spaced caps label
function RailItem({ label, Icon, active, collapsed, onSelect }: NavItemProps) {
  return (
    <button type="button" className={`llnv-rail${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active} title={label}>
      <span className="llnv-rail-fill" aria-hidden="true" />
      <span className="llnv-rail-icon"><Icon /></span>
      {!collapsed && <span className="llnv-rail-label">{label}</span>}
    </button>
  )
}

// 5 — Holographic card stack: layered shadow depth, diagonal sheen sweep on active
function HoloItem({ label, Icon, active, collapsed, onSelect }: NavItemProps) {
  return (
    <button type="button" className={`llnv-holo${active ? ' is-active' : ''}`} onClick={onSelect} aria-pressed={active} title={label}>
      <span className="llnv-holo-sheen" aria-hidden="true" />
      <span className="llnv-holo-icon"><Icon /></span>
      {!collapsed && <span className="llnv-holo-label">{label}</span>}
    </button>
  )
}

type NavId = 'react' | 'visualizer' | 'showManager' | 'lyricManager' | 'mediaManager'

const TOP_ITEMS: { id: NavId, label: string, Icon: ComponentType }[] = [
  { id: 'react', label: 'React', Icon: ReactIcon },
  { id: 'visualizer', label: 'Visualizer', Icon: VisualizerIcon },
]

const MANAGER_ITEMS: { id: NavId, label: string, Icon: ComponentType }[] = [
  { id: 'showManager', label: 'Show Manager', Icon: ShowManagerIcon },
  { id: 'lyricManager', label: 'Lyric Manager', Icon: LyricManagerIcon },
  { id: 'mediaManager', label: 'Media Manager', Icon: MediaManagerIcon },
]

// Full VyzualzSidebar replica — logo click + footer toggle both collapse/expand,
// clicking any item sets it as the sole active destination — mirroring the real shell.
function MockSidebar({ ItemComponent }: { ItemComponent: ComponentType<NavItemProps> }) {
  const [activeId, setActiveId] = useState<NavId>('react')
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`llnv-shell${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="llnv-shell-logo"
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        <span className="llnv-shell-logo-icon">
          <img src="/drmvyz_logo_icon.png" alt="DRMVYZ" />
        </span>
        {!collapsed && <span className="llnv-shell-logo-text">DRMVYZ</span>}
      </button>

      <nav className="llnv-shell-nav">
        {TOP_ITEMS.map(item => (
          <ItemComponent
            key={item.id}
            label={item.label}
            Icon={item.Icon}
            active={activeId === item.id}
            collapsed={collapsed}
            onSelect={() => setActiveId(item.id)}
          />
        ))}

        {!collapsed && <div className="llnv-shell-section-label">Managers</div>}

        {MANAGER_ITEMS.map(item => (
          <ItemComponent
            key={item.id}
            label={item.label}
            Icon={item.Icon}
            active={activeId === item.id}
            collapsed={collapsed}
            onSelect={() => setActiveId(item.id)}
          />
        ))}
      </nav>

      <button type="button" className="llnv-shell-toggle" onClick={() => setCollapsed(v => !v)}>
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'glass', title: '01 · Neon Glass Pill', blurb: 'Floating blurred-glass capsule, glow ring when active.', ItemComponent: GlassPillItem },
  { id: 'bracket', title: '02 · Bracket Tab', blurb: 'Monospace label, terminal-style brackets close in on active.', ItemComponent: BracketTabItem },
  { id: 'dock', title: '03 · Magnetic Dock', blurb: 'Icon lifts and glows dock-style, label reveals inline.', ItemComponent: DockItem },
  { id: 'rail', title: '04 · Progress Rail', blurb: 'Vertical fill bar climbs the left edge, wide-tracked caps label.', ItemComponent: RailItem },
  { id: 'holo', title: '05 · Holographic Card', blurb: 'Layered stacked-card shadow depth, diagonal sheen sweep on active.', ItemComponent: HoloItem },
] satisfies { id: string, title: string, blurb: string, ItemComponent: ComponentType<NavItemProps> }[]

export function NavItemStyleGallery() {
  return (
    <div className="llnv-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample llnv-gallery-sample">
            <MockSidebar ItemComponent={entry.ItemComponent} />
          </div>
        </div>
      ))}
    </div>
  )
}
