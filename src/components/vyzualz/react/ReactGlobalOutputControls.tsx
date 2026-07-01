import { useRef, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { productionOutputController } from './output/ProductionOutput'

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
  const { activeReactEngineId, spatialBlackout, matrixBlackout, setBlackout } = useReactStore(
    useShallow(state => ({
      activeReactEngineId: state.activeReactEngineId,
      spatialBlackout: state.laserDmxSettings.blackout,
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
  const visualBlackout = spatialBlackout || matrixBlackout
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
    <div className="rv-global-output" aria-label="Global performance output">
      <button
        type="button"
        className={`rv-global-output-status${snapshot.status.armed && !blackout ? ' is-armed' : ''}${blackout ? ' is-dark' : ''}`}
        onClick={toggleArmed}
        disabled={!canControl}
        aria-pressed={snapshot.status.armed}
        title={isLaserDmx
          ? `${selected?.label ?? 'Production output'}: click to ${snapshot.status.armed ? 'disarm' : 'arm'}`
          : 'Production output controls become available when LaserDMX is active'}
      >
        <span className="rv-global-output-dot" aria-hidden="true" />
        <span>{statusLabel}</span>
      </button>
      <button
        type="button"
        className="rv-global-output-reveal"
        onClick={reveal}
        disabled={!isLaserDmx || (!blackout && !snapshot.emergencyBlackout)}
      >
        Reveal
      </button>
      <button
        type="button"
        className="rv-global-output-blackout"
        onClick={blackoutNow}
        disabled={!isLaserDmx || (visualBlackout && snapshot.emergencyBlackout)}
      >
        Blackout
      </button>
    </div>
  )
}
