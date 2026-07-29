import type { SharedPerformanceDiagnosticsEngine } from '../../../features/performanceCore'
import { Collapsible } from './ReactControlRows'
import { useSharedPerformanceDiagnostics } from './SharedPerformanceDiagnosticsStore'

function text(values: readonly string[], fallback = 'None'): string {
  return values.length ? values.join(', ') : fallback
}

export function SharedPerformanceDiagnosticsPanel({
  engine,
  label = 'Performance Diagnostics',
}: {
  engine: SharedPerformanceDiagnosticsEngine
  label?: string
}) {
  const diagnostics = useSharedPerformanceDiagnostics(engine)
  return (
    <Collapsible label={label} defaultOpen={false}>
      {!diagnostics ? (
        <div className="rv-ctrl-info rv-control-helper-copy">
          Runtime diagnostics appear while Auto Performance is active and the engine is rendering.
        </div>
      ) : (
        <div className="rv-show-director-performance-status" data-shared-performance-diagnostics={engine}>
          <dl className="rv-show-director-performance-status__grid">
            <div>
              <dt>Engine</dt>
              <dd>{diagnostics.engine}</dd>
            </div>
            <div>
              <dt>Show</dt>
              <dd>{diagnostics.performanceShow ?? 'None'}</dd>
            </div>
            <div>
              <dt>Scene</dt>
              <dd>{diagnostics.scene ?? 'Fallback'}</dd>
            </div>
            <div>
              <dt>Section</dt>
              <dd>
                {diagnostics.section} {diagnostics.sectionOccurrence || ''}
              </dd>
            </div>
            <div>
              <dt>Family</dt>
              <dd>{diagnostics.sectionFamily ?? 'None'}</dd>
            </div>
            <div>
              <dt>Drop</dt>
              <dd>{diagnostics.dropOccurrence || 0}</dd>
            </div>
            <div>
              <dt>Phrase</dt>
              <dd>{diagnostics.phraseIndex + 1}</dd>
            </div>
            <div>
              <dt>Bar</dt>
              <dd>{diagnostics.barWithinSection + 1}</dd>
            </div>
            <div>
              <dt>4 / 8 / 16</dt>
              <dd>
                {diagnostics.fourBarStage} / {diagnostics.eightBarStage} / {diagnostics.sixteenBarStage}
              </dd>
            </div>
            <div>
              <dt>Motif</dt>
              <dd>{diagnostics.motifOrComposition ?? 'Base'}</dd>
            </div>
            <div>
              <dt>Layers</dt>
              <dd>{text(diagnostics.activeLayers)}</dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{text(diagnostics.activeEventEnvelopes)}</dd>
            </div>
            <div>
              <dt>Recent</dt>
              <dd>{text(diagnostics.recentActions)}</dd>
            </div>
            <div>
              <dt>Routes</dt>
              <dd>{text(diagnostics.continuousRoutes)}</dd>
            </div>
            <div>
              <dt>Upcoming</dt>
              <dd>{diagnostics.upcomingSemanticMoment ?? 'None'}</dd>
            </div>
            <div>
              <dt>Locks</dt>
              <dd>{text(diagnostics.lockedParameters)}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{diagnostics.fallbackState ?? 'None'}</dd>
            </div>
            <div>
              <dt>Capabilities</dt>
              <dd>{text(diagnostics.capabilityLimitations)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{text(diagnostics.confidenceLimitations)}</dd>
            </div>
            <div>
              <dt>Limits</dt>
              <dd>{text(diagnostics.resourceLimitDecisions)}</dd>
            </div>
            {diagnostics.engineDetails.map((detail) => (
              <div key={`${detail.label}:${detail.value}`}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Collapsible>
  )
}
