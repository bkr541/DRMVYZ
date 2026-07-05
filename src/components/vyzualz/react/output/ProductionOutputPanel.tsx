import { useSyncExternalStore } from 'react'
import { Collapsible, SelectRow, SliderRow } from '../ReactControlRows'
import { productionOutputController } from './ProductionOutput'

function statusTone(state: string): string {
  if (state === 'armed') return '#61d6aa'
  if (state === 'blackout' || state === 'error') return '#ff6b7a'
  if (state === 'unavailable') return '#f6c85f'
  return '#4ac7db'
}

export function ProductionOutputPanel() {
  const snapshot = useSyncExternalStore(
    productionOutputController.subscribe,
    productionOutputController.getSnapshot,
    productionOutputController.getSnapshot,
  )


  const selected = snapshot.registeredAdapters.find(adapter => adapter.id === snapshot.session.selectedAdapterId)
  const physicalUnavailable = Boolean(selected?.canTransmit && !selected.protocolMetadata.executableInCurrentRuntime)

  return (
    <Collapsible label="Production Output" defaultOpen>
      <div className="rv-ctrl-info" role="status" aria-live="polite">
        <strong style={{ color: statusTone(snapshot.status.state) }}>
          {snapshot.status.state.toUpperCase()}
        </strong>
        {' · '}{selected?.label ?? snapshot.status.adapterId}
        {' · '}{snapshot.lastFixtureCount} fixtures / {snapshot.lastUniverseCount} universes
      </div>

      <SelectRow
        label="Adapter"
        value={snapshot.session.selectedAdapterId}
        onChange={value => productionOutputController.selectAdapter(value)}
        options={snapshot.registeredAdapters.map(adapter => ({
          value: adapter.id,
          label: adapter.protocolMetadata.executableInCurrentRuntime
            ? adapter.label
            : `${adapter.label} (trusted host required)`,
        }))}
        description="Virtual Output is canonical. Art-Net and sACN are protocol-ready but cannot transmit from this renderer-only build."
      />

      <button
        type="button"
        className={`rv-glyph-upload-btn${snapshot.rehearsalMode ? ' rv-glyph-upload-btn--active' : ''}`}
        aria-pressed={snapshot.rehearsalMode}
        onClick={() => productionOutputController.setRehearsalMode(!snapshot.rehearsalMode)}
        style={{ marginBottom: 8 }}
      >
        Rehearsal Preview: {snapshot.rehearsalMode ? 'ON' : 'OFF'}
      </button>
      <div className="rv-ctrl-info">
        Rehearsal Preview routes cues, looks, and pad actions to Virtual Output only. Enabling it immediately disarms physical output.
      </div>

      <SliderRow
        label="Hardware Master"
        value={snapshot.session.safety.hardwareMasterIntensity}
        onChange={value => productionOutputController.setHardwareMasterIntensity(value)}
        description="Independent from virtual preview intensity. It is applied only while preparing adapter channel frames."
      />
      <SliderRow
        label="Strobe Limit"
        value={snapshot.session.safety.maxStrobeHz}
        onChange={value => productionOutputController.setMaxStrobeHz(value)}
        min={0}
        max={30}
        step={1}
        description="Adapter-side normalized flash limit. This does not claim medical or regulatory safety."
      />

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          onClick={() => productionOutputController.arm()}
          disabled={physicalUnavailable || snapshot.status.armed || Boolean(snapshot.rehearsalMode && selected?.canTransmit)}
        >
          {selected?.virtual ? 'Arm Virtual Test' : 'Arm Session'}
        </button>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          onClick={() => productionOutputController.disarm('User disarmed output')}
          disabled={!snapshot.status.armed && snapshot.status.state !== 'blackout'}
        >
          Disarm
        </button>
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          onClick={() => productionOutputController.emergencyBlackoutNow('User emergency blackout')}
        >
          Emergency Blackout
        </button>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          onClick={() => productionOutputController.clearEmergencyBlackout()}
          disabled={!snapshot.emergencyBlackout}
        >
          Clear Latch
        </button>
      </div>

      {physicalUnavailable && (
        <div className="rv-ctrl-info">
          No network packets can be sent: this repository is a browser/Vite renderer with no Electron main process, preload bridge, or trusted IPC boundary.
        </div>
      )}

      {snapshot.diagnostics.slice(0, 4).map((diagnostic, index) => (
        <div key={`${diagnostic.code}:${diagnostic.fixtureId ?? ''}:${index}`} className="rv-ctrl-info">
          {diagnostic.severity.toUpperCase()}: {diagnostic.message}
        </div>
      ))}

      <div className="rv-ctrl-info">
        Address, overlap, profile, exclusion-zone, stale-frame, heartbeat, cooldown, and fail-dark checks are diagnostic safeguards only. DRMVYZ does not certify physical laser or venue safety.
      </div>
    </Collapsible>
  )
}
