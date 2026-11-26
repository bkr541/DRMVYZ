import { HEALTH_LABELS, HEALTH_SYSTEMS, useHealthStore, type HealthState, type HealthSystem } from '../../../stores/healthStore'
import { HeaderReadout } from './HeaderReadout'

const CHIP_TEXT: Readonly<Record<HealthSystem, string>> = { cast: 'CAST', audio: 'AUDIO', graphics: 'GFX' }
const STATE_TEXT: Readonly<Record<HealthState, string>> = {
  idle: 'not in use',
  ok: 'working',
  degraded: 'working at reduced quality',
  healing: 'failed; repairing itself',
  failed: 'needs attention',
}

/** The header's HEALTH readout: one chip per system (cast, audio, graphics) with a light that goes amber while degraded or repairing and red when it needs attention. */
export function HealthReadout() {
  const systems = useHealthStore(state => state.systems)
  const summary = HEALTH_SYSTEMS.map(system => `${HEALTH_LABELS[system]}: ${STATE_TEXT[systems[system].state]}${systems[system].detail ? ` (${systems[system].detail})` : ''}`).join(' · ')
  return <HeaderReadout label="HEALTH" title={summary}>
    <div className="vz-health-chips" role="status" aria-live="polite" aria-label={summary} data-health-readout>
      {HEALTH_SYSTEMS.map(system => (
        <span key={system} className="vz-health-chip" data-health={systems[system].state} data-health-system={system}>
          <i className="vz-header-readout-led" aria-hidden="true" />
          <strong className="vz-header-readout-primary">{CHIP_TEXT[system]}</strong>
        </span>
      ))}
    </div>
  </HeaderReadout>
}
