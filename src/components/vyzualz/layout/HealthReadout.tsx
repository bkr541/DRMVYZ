import { useEffect, useId, useRef, useState } from 'react'
import { HEALTH_LABELS, HEALTH_SYSTEMS, useHealthStore, type HealthState, type HealthSystem, type SystemHealth } from '../../../stores/healthStore'
import { InfoPopover } from '../../shared/InfoPopover'
import './HeaderReadout.css'

const SYSTEM_LABEL: Readonly<Record<HealthSystem, string>> = { cast: 'Cast', audio: 'Audio', graphics: 'GFX' }
const SYSTEM_TEXT: Readonly<Record<HealthSystem, string>> = { cast: 'Output Cast', audio: 'Audio Engine', graphics: 'Graphics Engine' }
const STATE_TEXT: Readonly<Record<HealthState, string>> = {
  idle: 'Idle', ok: 'Operational', degraded: 'Degraded', healing: 'Recovering', failed: 'Failed',
}
const STATE_DETAIL: Readonly<Record<HealthState, string>> = {
  idle: 'System is not in use.', ok: 'No issue reported.', degraded: 'Operating at reduced quality.',
  healing: 'Automatic recovery is underway.', failed: 'Automatic recovery was unsuccessful. Attention is required.',
}

function healthDetail(system: HealthSystem, health: SystemHealth): string {
  return health.detail ?? (system === 'cast' && health.state === 'idle' ? 'No active casting session.' : STATE_DETAIL[health.state])
}

/** Distinct silhouettes carry the state even when its color cannot be distinguished. */
function HealthStatusIcon({ state }: { state: HealthState }) {
  return <svg className="vz-health-status-icon" data-health={state} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {state === 'degraded' ? <><path d="M8 1.8 14.5 13.5H1.5L8 1.8Z" /><path d="M8 5.8v3.3m0 2.2v.1" /></>
      : state === 'healing' ? <><path d="M13.8 6a6 6 0 0 0-10.6-2L1.8 5.5M1.8 2v3.5h3.5M2.2 10a6 6 0 0 0 10.6 2l1.4-1.5m0 3.5v-3.5h-3.5" /></>
      : <><circle cx="8" cy="8" r="6.3" />{state === 'idle' ? <path d="M5 8h6" /> : state === 'ok' ? <path d="m4.7 8 2.2 2.2 4.4-4.4" /> : <path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" />}</>}
  </svg>
}

/** Live, read-only diagnostics; opening the popover never changes the recovery state. */
export function HealthReadout() {
  const systems = useHealthStore(state => state.systems)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = `vz-health-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const summary = HEALTH_SYSTEMS.map(system => `${HEALTH_LABELS[system]}: ${STATE_TEXT[systems[system].state]}. ${healthDetail(system, systems[system])}`).join(' · ')

  useEffect(() => {
    if (!open) return
    const owner = trigger.current?.ownerDocument
    const win = owner?.defaultView
    if (!owner || !win) return
    const frame = win.requestAnimationFrame(() => owner.getElementById(id)?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => win.cancelAnimationFrame(frame)
  }, [id, open])

  return <>
    <button type="button" ref={trigger} className="vz-header-readout vz-health-trigger" data-health-readout
      aria-label={`System health. ${summary}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}>
      <span className="vz-header-readout-label">HEALTH</span>
      <span className="vz-header-readout-values vz-health-chips">
        {HEALTH_SYSTEMS.map(system => {
          const health = systems[system]
          return <span key={system} className="vz-health-chip" data-health={health.state} data-health-system={system}
            title={`${SYSTEM_TEXT[system]}: ${STATE_TEXT[health.state]}. ${healthDetail(system, health)}`}>
            <HealthStatusIcon state={health.state} />
            <span className="vz-health-system-label">{SYSTEM_LABEL[system]}</span>
          </span>
        })}
      </span>
    </button>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{summary}</span>
    <InfoPopover id={id} open={open} anchorRef={trigger} title="System Health" closeLabel="Close system health"
      placement="below" align="end" width={320} offset={8} className="vz-health-popover" showBackdrop={false}
      onOpenChange={setOpen}
      headerIcon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 8h3l2-5 3.3 10 2-5H15" /></svg>}
      footer={<><span>Automatic system recovery</span><span className="vz-health-recovery-enabled">Enabled</span></>}>
      <div className="vz-health-diagnostics">
        {HEALTH_SYSTEMS.map(system => {
          const health = systems[system]
          return <div key={system} className="vz-health-diagnostic" data-health={health.state} data-health-diagnostic={system}>
            <HealthStatusIcon state={health.state} />
            <div className="vz-health-diagnostic-copy">
              <div className="vz-health-diagnostic-heading"><strong>{SYSTEM_TEXT[system]}</strong><span className="vz-health-state-text">{STATE_TEXT[health.state]}</span></div>
              <p>{healthDetail(system, health)}</p>
              {health.since > 0 && <time dateTime={new Date(health.since).toISOString()}>Since {new Date(health.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>}
            </div>
          </div>
        })}
      </div>
    </InfoPopover>
  </>
}
