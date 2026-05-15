import React, { useRef } from 'react'
import type { ReferenceTrack } from '../../types/audio'

const SLOTS = [1, 2, 3, 4]

interface Props {
  referenceTracks: ReferenceTrack[]
  activeSlot: number
  isABMode: boolean
  autoLoudnessMatch: boolean
  refVolume: number
  onAddTrack: (file: File, slot: number) => void
  onRemoveTrack: (id: string) => void
  onSetSlot: (slot: number) => void
  onToggleAB: (on: boolean) => void
  onAutoLoudness: (on: boolean) => void
  onRefVolume: (v: number) => void
  primaryColor: string
  secondaryColor: string
}

export function ReferencePanel({
  referenceTracks, activeSlot, isABMode, autoLoudnessMatch, refVolume,
  onAddTrack, onRemoveTrack, onSetSlot, onToggleAB, onAutoLoudness, onRefVolume,
  primaryColor, secondaryColor,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingSlotRef = useRef(1)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onAddTrack(file, pendingSlotRef.current)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function openPicker(slot: number) {
    pendingSlotRef.current = slot
    fileInputRef.current?.click()
  }

  const activeTrack = referenceTracks.find(t => t.slot === activeSlot)

  return (
    <div className="reference-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div className="settings-section-title">REFERENCE SLOTS</div>
      <div className="ref-slots-grid">
        {SLOTS.map(slot => {
          const track = referenceTracks.find(t => t.slot === slot)
          const isActive = slot === activeSlot
          return (
            <div
              key={slot}
              className={`ref-slot ${isActive ? 'active' : ''} ${track ? 'has-track' : ''}`}
              style={{ '--accent': primaryColor } as React.CSSProperties}
            >
              <div className="ref-slot-header">
                <span className="ref-slot-num" style={{ color: isActive ? primaryColor : 'rgba(255,255,255,0.3)' }}>
                  REF {slot}
                </span>
                {track && (
                  <button className="btn-xs" onClick={() => onRemoveTrack(track.id)}>✕</button>
                )}
              </div>
              {track ? (
                <button
                  className="ref-slot-name"
                  onClick={() => onSetSlot(slot)}
                  style={{ color: isActive ? primaryColor : 'rgba(255,255,255,0.6)' }}
                >
                  {track.displayName}
                </button>
              ) : (
                <button className="ref-slot-empty" onClick={() => openPicker(slot)}>
                  + Load audio
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* A/B toggle */}
      <div className="ref-ab-section">
        <div className="settings-section-title">A/B COMPARISON</div>
        <div className="ref-ab-row">
          <button
            className={`ab-btn ${!isABMode ? 'active' : ''}`}
            onClick={() => onToggleAB(false)}
            style={{ '--accent': primaryColor } as React.CSSProperties}
          >
            A — Main
          </button>
          <button
            className={`ab-btn ${isABMode ? 'active' : ''}`}
            onClick={() => onToggleAB(true)}
            disabled={!activeTrack}
            style={{ '--accent': secondaryColor } as React.CSSProperties}
          >
            B — Reference
          </button>
        </div>
        <div className="settings-note">
          {isABMode
            ? `Monitoring reference: ${activeTrack?.displayName ?? '—'}`
            : 'Monitoring main track. Spectrum overlay shows both when ref is loaded.'}
        </div>
      </div>

      {/* Auto loudness match */}
      <div className="settings-section-title">LOUDNESS MATCHING</div>
      <label className="toggle-row" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={autoLoudnessMatch}
          onChange={e => onAutoLoudness(e.target.checked)} />
        <span className="toggle-track" style={{ '--accent': primaryColor } as React.CSSProperties}>
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-label">Auto-match loudness (approx)</span>
      </label>

      {!autoLoudnessMatch && (
        <div className="ref-vol-row">
          <span className="settings-label">Ref gain</span>
          <input
            type="range" min={0} max={2} step={0.01}
            value={refVolume}
            onChange={e => onRefVolume(parseFloat(e.target.value))}
            style={{ '--accent': primaryColor, '--pct': `${(refVolume / 2) * 100}%` } as React.CSSProperties}
          />
          <span className="settings-val">{refVolume > 0 ? `${(20 * Math.log10(refVolume)).toFixed(1)} dB` : '−∞'}</span>
        </div>
      )}

      <div className="settings-note">
        A/B mode switches the output signal. The spectrum analyzer shows an overlay
        of both main and reference spectra simultaneously when a reference is loaded.
      </div>
    </div>
  )
}
