import { useState } from 'react'
import { NoticeCard } from '../controls/NoticeCard'

// ── NotificationsModalMockup ─────────────────────────────────────────────
//
// Layout Lab / Template engine only. A mockup of the app-wide Messages /
// Notifications panel: a bell trigger with an unread badge, and the panel
// itself carrying an icon in its own header that's specific to whichever
// engine is currently viewable (so the same panel reads differently for
// Cinema vs. Sound Drawing vs. PixGrid, etc.). Icon + layout only for now —
// no real notification backend, local sample data and local open/tab state.

const SAMPLE_ENGINES = [
  { id: 'cinema', label: 'Cinema', icon: '◇' },
  { id: 'oscilloscope', label: 'Sound Drawing', icon: '〜' },
  { id: 'canvas', label: 'CANVAS', icon: '▣' },
  { id: 'laserDmx', label: 'LaserDMX', icon: '✦' },
  { id: 'pixGrid', label: 'PixGrid', icon: '▦' },
] as const

type SampleEngineId = (typeof SAMPLE_ENGINES)[number]['id']

const SAMPLE_ITEMS = [
  {
    id: 'brand-role',
    kind: 'warning' as const,
    title: 'CINEMA_BRAND_ROLE_UNAVAILABLE',
    body: "Cinema Brand Kit role 'primary' is unavailable; the authored color remains active.",
    meta: 'Cinema · Design · Palette · Just now',
  },
  {
    id: 'ready',
    kind: 'info' as const,
    title: 'Cinema ready',
    body: 'Audio and timeline connected.',
    meta: 'Cinema · Setup · 1 min ago',
  },
]

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 1.6 5.8H4.4C5 15 6 13.2 6 10Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

function NotificationsModal() {
  const [engineId, setEngineId] = useState<SampleEngineId>('cinema')
  const [tab, setTab] = useState<'all' | 'warnings' | 'system'>('all')
  const engine = SAMPLE_ENGINES.find(candidate => candidate.id === engineId)!
  const items = tab === 'warnings' ? SAMPLE_ITEMS.filter(item => item.kind === 'warning')
    : tab === 'system' ? []
    : SAMPLE_ITEMS

  return (
    <div className="llnm-demo">
      <div className="llnm-engine-picker" role="radiogroup" aria-label="Preview engine">
        {SAMPLE_ENGINES.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={engineId === candidate.id}
            className={engineId === candidate.id ? 'is-active' : ''}
            onClick={() => setEngineId(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div className="llnm-trigger-row">
        <button type="button" className="llnm-bell" aria-label="Notifications, 7 unread">
          <BellIcon />
          <span className="llnm-bell-badge">7</span>
        </button>
      </div>

      <div className="llnm-panel" role="dialog" aria-label="Notifications">
        <div className="llnm-panel-hdr">
          <span className="llnm-panel-engine-icon" aria-hidden="true">{engine.icon}</span>
          <strong className="llnm-panel-title">Notifications</strong>
          <button type="button" className="llnm-mark-read">Mark all read</button>
        </div>

        <div className="llnm-tabs" role="tablist" aria-label="Notification filters">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')}>
            All <span className="llnm-tab-count">7</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'warnings'} className={tab === 'warnings' ? 'is-active' : ''} onClick={() => setTab('warnings')}>
            Warnings <span className="llnm-tab-count llnm-tab-count--warn">1</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'system'} className={tab === 'system' ? 'is-active' : ''} onClick={() => setTab('system')}>
            System <span className="llnm-tab-count">6</span>
          </button>
        </div>

        <div className="llnm-list">
          {items.length === 0 && <div className="llnm-list-empty">No notifications in this filter.</div>}
          {items.map(item => (
            <NoticeCard
              key={item.id}
              tone={item.kind}
              className="llnm-item"
              title={<>{item.title}<span className="llnm-item-dot" aria-hidden="true" /></>}
            >
              <p>{item.body}</p>
              <span className="llnm-item-meta">{item.meta}</span>
            </NoticeCard>
          ))}
        </div>

        <button type="button" className="llnm-view-all">View all notifications</button>
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'notifications', title: '01 · Notifications Panel', blurb: "The bell trigger carries the unread count; the panel's own header carries an icon for whichever engine the notifications belong to — try the engine picker above the preview.", Modal: NotificationsModal },
]

export function NotificationsModalMockup() {
  return (
    <div className="llnm-gallery">
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
