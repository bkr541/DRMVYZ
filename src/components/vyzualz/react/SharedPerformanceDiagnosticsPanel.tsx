import type { SharedPerformanceDiagnosticsEngine } from '../../../features/performanceCore'
import { Collapsible } from './ReactControlRows'
import { useSharedPerformanceDiagnostics } from './SharedPerformanceDiagnosticsStore'

function text(values: readonly string[], fallback = 'None'): string {
  return values.length ? values.join(', ') : fallback
}

export function SharedPerformanceDiagnosticsPanel({
  engine,
  label = 'Performance Diagnostics',
  variant = 'grid',
}: {
  engine: SharedPerformanceDiagnosticsEngine
  label?: string
  /** 'grid' is the original dt/dd status grid. 'audioIntelligence' mirrors the
   *  Audio Intelligence panel's key/value row styling (vz-mi-*), used when this
   *  panel sits alongside Audio Intelligence in the REACT tab's Analysis group. */
  variant?: 'grid' | 'audioIntelligence'
}) {
  const diagnostics = useSharedPerformanceDiagnostics(engine)
  const fields = diagnostics ? [
    { label: 'Engine', value: diagnostics.engine },
    { label: 'Show', value: diagnostics.performanceShow ?? 'None' },
    { label: 'Scene', value: diagnostics.scene ?? 'Fallback' },
    { label: 'Section', value: `${diagnostics.section} ${diagnostics.sectionOccurrence || ''}`.trim() },
    { label: 'Family', value: diagnostics.sectionFamily ?? 'None' },
    { label: 'Drop', value: String(diagnostics.dropOccurrence || 0) },
    { label: 'Phrase', value: String(diagnostics.phraseIndex + 1) },
    { label: 'Bar', value: String(diagnostics.barWithinSection + 1) },
    { label: '4 / 8 / 16', value: `${diagnostics.fourBarStage} / ${diagnostics.eightBarStage} / ${diagnostics.sixteenBarStage}` },
    { label: 'Motif', value: diagnostics.motifOrComposition ?? 'Base' },
    { label: 'Layers', value: text(diagnostics.activeLayers) },
    { label: 'Events', value: text(diagnostics.activeEventEnvelopes) },
    { label: 'Recent', value: text(diagnostics.recentActions) },
    { label: 'Routes', value: text(diagnostics.continuousRoutes) },
    { label: 'Upcoming', value: diagnostics.upcomingSemanticMoment ?? 'None' },
    { label: 'Locks', value: text(diagnostics.lockedParameters) },
    { label: 'Fallback', value: diagnostics.fallbackState ?? 'None' },
    { label: 'Capabilities', value: text(diagnostics.capabilityLimitations) },
    { label: 'Confidence', value: text(diagnostics.confidenceLimitations) },
    { label: 'Limits', value: text(diagnostics.resourceLimitDecisions) },
    ...diagnostics.engineDetails.map(detail => ({ label: detail.label, value: detail.value })),
  ] : []

  return (
    <Collapsible label={label} defaultOpen={false}>
      {!diagnostics ? (
        <div className="rv-ctrl-info rv-control-helper-copy">
          Runtime diagnostics appear while Auto Performance is active and the engine is rendering.
        </div>
      ) : variant === 'audioIntelligence' ? (
        <div className="vz-mi-panel" data-shared-performance-diagnostics={engine}>
          <div className="vz-mi-section">
            {fields.map(field => (
              <div key={field.label} className="vz-mi-kv-row">
                <span className="vz-mi-kv-label">{field.label}</span>
                <span className="vz-mi-kv-val">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rv-show-director-performance-status" data-shared-performance-diagnostics={engine}>
          <dl className="rv-show-director-performance-status__grid">
            {fields.map(field => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Collapsible>
  )
}
