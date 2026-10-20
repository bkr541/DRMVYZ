import type { CSSProperties } from 'react'
import { NotificationBellIcon } from '../../shared/NotificationDrawer'

/**
 * Layout Lab · Template canvas: ten restyles of the React header's status row (Saved, FPS, Frame Time, Quality, CPU,
 * Loading, Notifications). Every row is a real `.vz-header`, so its height, background and edge come from the same
 * rule as the production header; the concepts below only restyle what sits inside it. Within a row, every element is
 * built from the same chip DNA (shape, border, label/value type, tone and icon treatment) so the row reads as one set.
 */

type MetricId = 'saved' | 'fps' | 'frame-time' | 'quality' | 'cpu' | 'loading' | 'notifications'

/** The order the elements sit in the production header, left to right. */
export const HEADER_ROW_METRICS: readonly MetricId[] = ['saved', 'fps', 'frame-time', 'quality', 'cpu', 'loading', 'notifications']

export const HEADER_ROW_CONCEPTS = [
  { id: 'capsule-glass', label: 'Capsule Glass', note: 'Frosted pills with a lit top edge' },
  { id: 'segmented-rail', label: 'Segmented Rail', note: 'One joined bar, hairline dividers' },
  { id: 'neon-underline', label: 'Neon Underline', note: 'Borderless readouts on a glowing baseline' },
  { id: 'terminal-mono', label: 'Terminal Mono', note: 'Bracketed phosphor readouts' },
  { id: 'stacked-label', label: 'Stacked Label', note: 'Label over value, tone spine' },
  { id: 'pill-meter', label: 'Pill Meter', note: 'Each pill fills like a gauge' },
  { id: 'chamfer-tick', label: 'Chamfer Tick', note: 'Cut corners with corner ticks' },
  { id: 'soft-relief', label: 'Soft Relief', note: 'Raised chips, recessed values' },
  { id: 'gradient-outline', label: 'Gradient Outline', note: 'Violet to cyan hairlines' },
  { id: 'led-panel', label: 'LED Panel', note: 'Recessed panels with amber LEDs' },
] as const

export type HeaderRowConceptId = typeof HEADER_ROW_CONCEPTS[number]['id']

/**
 * Ten more studies where elements are stacked in columns. `groups` is the left-to-right layout: a one-element group
 * stands alone, a longer one becomes a column of two or three.
 */
export const STACKED_HEADER_ROW_CONCEPTS = [
  { id: 'twin-tiles', label: 'Twin Tiles', note: 'Flat tiles, two to a column', groups: [['saved'], ['fps', 'frame-time'], ['quality', 'cpu'], ['loading', 'notifications']] },
  { id: 'ledger-lines', label: 'Ledger Lines', note: 'Chrome-free lines on hairlines, three deep', groups: [['saved', 'quality'], ['fps', 'frame-time', 'cpu'], ['loading', 'notifications']] },
  { id: 'mini-gauges', label: 'Mini Gauges', note: 'Slim gauge bars stacked in threes', groups: [['saved'], ['fps', 'frame-time', 'cpu'], ['quality'], ['loading', 'notifications']] },
  { id: 'spine-tabs', label: 'Spine Tabs', note: 'Square tabs with a tone spine', groups: [['saved', 'quality'], ['fps', 'frame-time'], ['cpu'], ['loading', 'notifications']] },
  { id: 'terminal-stack', label: 'Terminal Stack', note: 'Prompt lines, no boxes', groups: [['saved', 'quality'], ['fps', 'frame-time'], ['cpu', 'loading'], ['notifications']] },
  { id: 'layered-cards', label: 'Layered Cards', note: 'Plain aligned columns, Saved under production Loading', groups: [['loading', 'saved'], ['fps', 'frame-time'], ['quality', 'cpu'], ['notifications']], productionIcons: true },
  { id: 'neon-edge-stack', label: 'Neon Edge Stack', note: 'Glowing left edge per line', groups: [['saved', 'quality'], ['fps', 'frame-time', 'cpu'], ['loading', 'notifications']] },
  { id: 'ticket-stubs', label: 'Ticket Stubs', note: 'Notched stubs with a perforation', groups: [['saved', 'loading'], ['fps', 'frame-time'], ['quality', 'cpu'], ['notifications']] },
  { id: 'gradient-stack', label: 'Gradient Stack', note: 'Violet to cyan hairlines, two deep', groups: [['saved'], ['fps', 'frame-time'], ['quality', 'cpu'], ['loading', 'notifications']] },
  { id: 'relief-stack', label: 'Relief Stack', note: 'Raised chips, recessed values', groups: [['saved', 'cpu'], ['fps', 'frame-time'], ['quality'], ['loading', 'notifications']] },
] as const satisfies readonly { id: string; label: string; note: string; groups: readonly (readonly MetricId[])[]; productionIcons?: boolean }[]

/** Sample readings, shared by every concept so only the styling differs. `fill` feeds the gauge-style concepts. */
const READINGS: Record<Exclude<MetricId, 'loading' | 'notifications'>, { label: string; value: string; fill: number; title: string }> = {
  saved: { label: 'Saved', value: '7:38 AM', fill: 1, title: 'All changes saved' },
  fps: { label: 'FPS', value: '67', fill: 0.92, title: '67 frames per second' },
  'frame-time': { label: 'Frame Time', value: '15.0 ms', fill: 0.34, title: 'Average frame time 15.0 milliseconds' },
  quality: { label: 'Quality', value: 'High', fill: 1, title: 'Active quality tier: high' },
  cpu: { label: 'CPU', value: '1%', fill: 0.06, title: 'App CPU usage 1%' },
}

function ActivityRing() {
  return (
    <svg className="llhr-ring" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" opacity="0.28" />
      <path className="llhr-ring-arc" d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  )
}

/** One element of the row (any of the seven), identical markup in the flat and the stacked studies. */
function HeaderMetric({ id }: { id: MetricId }) {
  if (id === 'loading') {
    return (
      <span className="llhr-chip llhr-chip--icon" data-header-metric="loading" role="status" title="Loading">
        <span className="llhr-label">Loading</span>
        <ActivityRing />
      </span>
    )
  }
  if (id === 'notifications') {
    return (
      <button type="button" className="llhr-chip llhr-chip--icon" data-header-metric="notifications" aria-label="Notifications (mockup)" title="Notifications">
        <span className="llhr-label">Notifications</span>
        <NotificationBellIcon />
        <i className="llhr-bell-dot" aria-hidden="true" />
      </button>
    )
  }
  const reading = READINGS[id]
  return (
    <span className="llhr-chip" data-header-metric={id} title={reading.title} style={{ '--llhr-fill': reading.fill } as CSSProperties}>
      <i className="llhr-meter" aria-hidden="true" />
      {id === 'saved' && <i className="llhr-dot" aria-hidden="true" />}
      <span className="llhr-label">{reading.label}</span>
      <span className="llhr-value">{reading.value}</span>
    </span>
  )
}

function HeaderCluster({ concept }: { concept: string }) {
  return (
    <div className="llhr-right">
      <div className="llhr-cluster" data-header-cluster={concept}>
        {HEADER_ROW_METRICS.map(id => <HeaderMetric key={id} id={id} />)}
      </div>
      <span className="vz-header-avatar llhr-avatar" aria-hidden="true">KR</span>
    </div>
  )
}

/**
 * Stacked studies: some elements sit on top of each other in a column, so the row needs far less width. A column is
 * only a layout wrapper: it never carries a border, background, shadow or outline of its own (the elements keep their
 * own styling), and the same goes for the cluster that holds the columns.
 */
function StackedCluster({ concept, groups, productionIcons = false }: { concept: string; groups: readonly (readonly MetricId[])[]; productionIcons?: boolean }) {
  return (
    <div className="llhr-right">
      <div className="llhr-cluster llhr-cluster--stacked" data-header-cluster={concept}>
        {groups.map(group => group.length === 1
          ? productionIcons && group[0] === 'loading' ? <ProductionLoadingChip key="loading" />
            : productionIcons && group[0] === 'notifications' ? <ProductionNotificationsChip key="notifications" />
            : <HeaderMetric key={group[0]} id={group[0]!} />
          : (
            <div key={group.join('+')} className="llhr-stack" data-header-stack={group.join('+')} data-stack-count={group.length}>
              {group.map(id => (
                productionIcons && id === 'loading' ? <ProductionLoadingChip key={id} />
                  : productionIcons && id === 'notifications' ? <ProductionNotificationsChip key={id} />
                  : <HeaderMetric key={id} id={id} />
              ))}
            </div>
          ))}
      </div>
      <span className="vz-header-avatar llhr-avatar" aria-hidden="true">KR</span>
    </div>
  )
}

/** Loading and Notifications exactly as the production header draws them (labeled chips), shared with the reference row. */
function ProductionLoadingChip() {
  return (
    <span className="vz-header-chip vz-header-chip--labeled vz-header-activity" data-header-metric="loading" data-busy="false" style={{ width: 'auto', padding: '0 8px' }}>
      <span className="vz-header-state-label">Loading</span>
      <ActivityRing />
    </span>
  )
}

function ProductionNotificationsChip() {
  return (
    <span className="vz-header-chip vz-header-chip--labeled vz-header-notifications" data-header-metric="notifications" style={{ width: 'auto', padding: '0 8px', color: '#67f7ff' }}>
      <span className="vz-header-state-label">Notifications</span>
      <NotificationBellIcon />
    </span>
  )
}

/** The header row as it ships today, for height and spacing comparison. */
function ProductionReferenceRow() {
  return (
    <article className="llhr-concept" data-header-reference="production">
      <small><b>Ref</b> Production header row</small>
      <div className="vz-header llhr-row llhr-row--reference">
        <span className="llhr-tag">REACT</span>
        <div className="llhr-right">
        <div className="llhr-cluster llhr-cluster--reference">
          <span className="vz-header-chip vz-header-chip--save-state" data-save-tone="saved">
            <span className="vz-header-state-label">Saved</span>
            <span className="vz-header-state-value">7:38 AM</span>
          </span>
          {([['FPS', '67', 'fps'], ['FRAME TIME', '15.0 ms', 'frame-time'], ['QUALITY', 'high', 'quality'], ['CPU', '1%', 'cpu']] as const).map(([label, value, metric]) => (
            <span key={metric} className="vz-header-chip vz-header-cpu vz-header-performance-metric" data-performance-metric={metric} data-cpu-level="low">
              <span className="vz-header-cpu-label">{label}</span>
              <span className="vz-header-cpu-value">{value}</span>
            </span>
          ))}
          <ProductionLoadingChip />
          <ProductionNotificationsChip />
        </div>
        <span className="vz-header-avatar llhr-avatar" aria-hidden="true">KR</span>
        </div>
      </div>
    </article>
  )
}

export function TemplateHeaderRowMockups() {
  return (
    <section className="llhr-stage" aria-label="React header row mockups">
      <header>
        <span>React Header Row</span>
        <small>Twenty restyles · every row is a real 60 px header</small>
      </header>
      <ProductionReferenceRow />
      {HEADER_ROW_CONCEPTS.map((concept, index) => (
        <article key={concept.id} className={`llhr-concept llhr-concept--${concept.id}`} data-header-concept={concept.id}>
          <small><b>{String(index + 1).padStart(2, '0')}</b> {concept.label} <em>{concept.note}</em></small>
          <div className={`vz-header llhr-row llhr-row--${concept.id}`}>
            <span className="llhr-tag">REACT</span>
            <HeaderCluster concept={concept.id} />
          </div>
        </article>
      ))}
      <header className="llhr-section">
        <span>Stacked Groups</span>
        <small>Ten more · elements stacked in columns, no border or background on the groups</small>
      </header>
      {STACKED_HEADER_ROW_CONCEPTS.map((concept, index) => (
        <article key={concept.id} className={`llhr-concept llhr-concept--${concept.id}`} data-header-stacked-concept={concept.id}>
          <small><b>{String(index + 11).padStart(2, '0')}</b> {concept.label} <em>{concept.note}</em></small>
          <div className={`vz-header llhr-row llhr-row--${concept.id}`}>
            <span className="llhr-tag">REACT</span>
            <StackedCluster concept={concept.id} groups={concept.groups} productionIcons={'productionIcons' in concept && concept.productionIcons === true} />
          </div>
        </article>
      ))}
    </section>
  )
}
