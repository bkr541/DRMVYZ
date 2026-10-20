import { ReactPresetCard } from '../ReactPresetCard'

const CONCEPTS = [
  { id: 'separate-chips', label: 'Separate Chips' },
  { id: 'unified-stack', label: 'Unified Stack' },
  { id: 'signal-rail', label: 'Signal Rail' },
  { id: 'glass-deck', label: 'Glass Deck' },
  { id: 'edge-readout', label: 'Edge Readout' },
] as const

const MONITOR_CONCEPTS = [
  { id: 'macro-overview', label: 'Macro Overview', tone: '#4c28cb', source: 'Infrastructure Monitoring Dashboard' },
  { id: 'delta-kpi', label: 'Delta KPI', tone: '#6e4cff', source: 'Cloud Monitoring Dashboard' },
  { id: 'resource-bars', label: 'Resource Bars', tone: '#89ae5d', source: 'Server & Hosting Management Dashboard' },
  { id: 'threshold-stack', label: 'Threshold Stack', tone: '#0fb24c', source: 'Data Center Monitoring Dashboard Redesign' },
  { id: 'topology-planes', label: 'Topology Planes', tone: '#199bf8', source: '3D Cloud Monitoring Dashboard' },
] as const

function MetricRow({ label, value, metric }: { label: string; value: string; metric: 'fps' | 'frame-time' }) {
  return (
    <div className="llft-metric" data-metric={metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MonitoringBackdrop({ id }: { id: typeof MONITOR_CONCEPTS[number]['id'] }) {
  return (
    <span className={`llft-monitor-visual llft-monitor-visual--${id}`}>
      <span className="llft-monitor-decoration" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span className="llft-monitor-group">
        <MetricRow label="FPS" value="60" metric="fps" />
        <MetricRow label="Frame Time" value="16.7 ms" metric="frame-time" />
      </span>
    </span>
  )
}

/** Template canvas studies for a two-row React-header performance group. */
export function TemplateFpsFrameTimeMockups() {
  return (
    <section className="llft-stage" aria-label="FPS and frame time header mockups">
      <header>
        <span>FPS + Frame Time</span>
        <small>Five stacked-group studies</small>
      </header>
      <div className="llft-row">
        {CONCEPTS.map((concept, index) => (
          <article key={concept.id} className={`llft-concept llft-concept--${concept.id}`} data-fps-concept={concept.id}>
            <span className="llft-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="llft-group" aria-label={`${concept.label} performance group`}>
              <MetricRow label="FPS" value="60" metric="fps" />
              <MetricRow label="Frame Time" value="16.7 ms" metric="frame-time" />
            </div>
            <small>{concept.label}</small>
          </article>
        ))}
      </div>
      <div className="llft-monitor-row" aria-label="Preset-inspired server monitoring mockups">
        {MONITOR_CONCEPTS.map(concept => (
          <ReactPresetCard
            key={concept.id}
            id={`monitor-${concept.id}`}
            title={concept.label}
            description={`Inspired by ${concept.source}`}
            backdrop={<MonitoringBackdrop id={concept.id} />}
            chips={[{ label: 'Monitoring' }]}
            palette={[{ color: concept.tone }]}
            activateLabel={`${concept.label} monitoring mockup`}
            onActivate={() => {}}
            className="llft-monitor-card"
            shellClassName="llft-monitor-shell"
            dataAttributes={{
              'data-monitor-concept': concept.id,
              'data-monitor-reference': concept.source,
            }}
          />
        ))}
      </div>
    </section>
  )
}
