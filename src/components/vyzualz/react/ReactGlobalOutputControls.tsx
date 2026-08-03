import { useRef, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { productionOutputController } from './output/ProductionOutput'
import { HelpInfoTrigger } from '../../shared/InfoPopover'


function OutputArmIcon() {
  return (
    <svg className="rv-global-output-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v8" />
      <path d="M7.05 5.2a8 8 0 1 0 9.9 0" />
    </svg>
  )
}

function RevealIcon() {
  return (
    <svg className="rv-global-output-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  )
}

function BlackoutIcon() {
  return (
    <svg className="rv-global-output-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.7 5.15A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.15 4.05" />
      <path d="M6.2 6.9C3.9 8.45 2.5 12 2.5 12s3.5 7 9.5 7a9.2 9.2 0 0 0 4.15-.96" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

function resolveStatusLabel(
  isLaserDmx: boolean,
  armed: boolean,
  blackout: boolean,
  unavailable: boolean,
): string {
  if (!isLaserDmx) return 'OUTPUT PREVIEW'
  if (unavailable) return 'OUTPUT OFFLINE'
  if (blackout) return 'OUTPUT DARK'
  if (armed) return 'OUTPUT ARMED'
  return 'OUTPUT SAFE'
}

export function ReactGlobalOutputControls() {
  const { activeReactEngineId, legacyRigBlackout, matrixBlackout, setBlackout } = useReactStore(
    useShallow(state => ({
      activeReactEngineId: state.activeReactEngineId,
      legacyRigBlackout: state.laserDmxSettings.blackout,
      matrixBlackout: state.laserDmxBeamMatrix.output.blackout,
      setBlackout: state.setLaserDmxBlackout,
    })),
  )
  const snapshot = useSyncExternalStore(
    productionOutputController.subscribe,
    productionOutputController.getSnapshot,
    productionOutputController.getSnapshot,
  )
  const restoreArmedRef = useRef(false)
  const isLaserDmx = activeReactEngineId === 'laserDmx'
  const selected = snapshot.registeredAdapters.find(
    adapter => adapter.id === snapshot.session.selectedAdapterId,
  )
  const unavailable = !selected || Boolean(
    selected.canTransmit && !selected.protocolMetadata.executableInCurrentRuntime,
  )
  const visualBlackout = legacyRigBlackout || matrixBlackout
  const blackout = visualBlackout || snapshot.emergencyBlackout
  const canControl = isLaserDmx && !unavailable
  const statusLabel = resolveStatusLabel(
    isLaserDmx,
    snapshot.status.armed,
    blackout,
    unavailable,
  )

  const toggleArmed = () => {
    if (!canControl) return
    if (snapshot.status.armed) {
      productionOutputController.disarm('User disarmed output from the global header')
      return
    }
    productionOutputController.arm()
  }

  const blackoutNow = () => {
    if (!isLaserDmx) return
    restoreArmedRef.current = snapshot.status.armed
    setBlackout(true)
    productionOutputController.emergencyBlackoutNow('Global header blackout')
  }

  const reveal = () => {
    if (!isLaserDmx) return
    setBlackout(false)
    productionOutputController.clearEmergencyBlackout()
    if (restoreArmedRef.current && !snapshot.status.armed && !unavailable) {
      productionOutputController.arm()
    }
    restoreArmedRef.current = false
  }

  return (
    <div className="rv-header-output-help drm-help-overlay-anchor">
      <div className="rv-global-output" aria-label="Global performance output">
        <button
          type="button"
          className={`rv-global-output-status${snapshot.status.armed && !blackout ? ' is-armed' : ''}${blackout ? ' is-dark' : ''}`}
          onClick={toggleArmed}
          disabled={!canControl}
          aria-pressed={snapshot.status.armed}
          aria-label={statusLabel}
          title={isLaserDmx
            ? `${statusLabel}: ${selected?.label ?? 'Production output'} · click to ${snapshot.status.armed ? 'disarm' : 'arm'}`
            : 'Production output controls become available when LaserDMX is active'}
        >
          <span className="rv-global-output-dot" aria-hidden="true" />
          <OutputArmIcon />
          <span className="rv-global-output-label">{statusLabel}</span>
        </button>
        <button
          type="button"
          className="rv-global-output-reveal"
          onClick={reveal}
          disabled={!isLaserDmx || (!blackout && !snapshot.emergencyBlackout)}
          aria-label="Reveal output"
          title="Reveal output"
        >
          <RevealIcon />
          <span className="rv-global-output-label">Reveal</span>
        </button>
        <button
          type="button"
          className="rv-global-output-blackout"
          onClick={blackoutNow}
          disabled={!isLaserDmx || (visualBlackout && snapshot.emergencyBlackout)}
          aria-label="Blackout output"
          title="Blackout output"
        >
          <BlackoutIcon />
          <span className="rv-global-output-label">Blackout</span>
        </button>
      </div>
      <HelpInfoTrigger
        helpId="react.shared.header.productionOutput"
        currentValue={statusLabel}
        currentValueLabel="Status"
        currentValueTone={isLaserDmx && (blackout || unavailable)
          ? 'warning'
          : isLaserDmx && snapshot.status.armed
            ? 'success'
            : 'default'}
        placement="below"
      />
    </div>
  )
}
