import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, SliderRow, ToggleRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { ConfirmDialog } from './controls/ConfirmDialog'
import { LaserDmxReactionGroupInspector } from './LaserDmxReactionGroupInspector'
import { LASER_DMX_MATRIX_MAX_BEAMS } from './ReactTypes'

export function LaserDmxBeamMatrixPanel() {
  const {
    laserDmxBeamMatrix,
    addLaserDmxMatrixBeam,
    removeSelectedLaserDmxMatrixBeams,
    duplicateLaserDmxMatrixBeam,
    clearLaserDmxMatrixSelection,
    setSelectedLaserDmxMatrixBeams,
    resetLaserDmxBeamMatrix,
    setLaserDmxBeamMatrixEditorSettings,
  } = useReactStore(useShallow(s => ({
    laserDmxBeamMatrix:                s.laserDmxBeamMatrix,
    addLaserDmxMatrixBeam:             s.addLaserDmxMatrixBeam,
    removeSelectedLaserDmxMatrixBeams: s.removeSelectedLaserDmxMatrixBeams,
    duplicateLaserDmxMatrixBeam:       s.duplicateLaserDmxMatrixBeam,
    clearLaserDmxMatrixSelection:      s.clearLaserDmxMatrixSelection,
    setSelectedLaserDmxMatrixBeams:    s.setSelectedLaserDmxMatrixBeams,
    resetLaserDmxBeamMatrix:           s.resetLaserDmxBeamMatrix,
    setLaserDmxBeamMatrixEditorSettings: s.setLaserDmxBeamMatrixEditorSettings,
  })))

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)

  const { beams, groups, selectedBeamIds, editor } = laserDmxBeamMatrix
  const beamCount  = beams.length
  const groupCount = groups.length
  const selCount   = selectedBeamIds.length
  const atLimit    = beamCount >= LASER_DMX_MATRIX_MAX_BEAMS
  const primaryId  = selectedBeamIds[0] ?? null

  function handleReset() {
    if (confirmReset) {
      resetLaserDmxBeamMatrix()
      setConfirmReset(false)
    } else {
      setConfirmReset(true)
    }
  }

  return (
    <>
      {/* ── Program overview ────────────────────────────────────────────── */}
      <Collapsible label="Program" defaultOpen>
        <div className="rv-bm-stats">
          <span>Beams: <strong>{beamCount} / {LASER_DMX_MATRIX_MAX_BEAMS}</strong></span>
          <span>Groups: <strong>{groupCount}</strong></span>
          {selCount > 0 && <span className="rv-bm-sel-badge">{selCount} selected</span>}
        </div>

        <div className="rv-bm-toolbar">
          <IconChipButton
            disabled={atLimit}
            title={atLimit ? `Beam limit (${LASER_DMX_MATRIX_MAX_BEAMS}) reached` : 'Add a new beam (choose origin and target in the editor)'}
            aria-label="Add beam"
            onClick={() => addLaserDmxMatrixBeam()}
          >
            + Add Beam
          </IconChipButton>
          {primaryId && (
            <IconChipButton
              disabled={atLimit}
              title="Duplicate primary selected beam"
              aria-label="Duplicate selected beam"
              onClick={() => duplicateLaserDmxMatrixBeam(primaryId)}
            >
              ⧉ Dup
            </IconChipButton>
          )}
          {selCount > 0 && (
            <>
              <IconChipButton
                className="rv-glyph-upload-btn--danger"
                aria-label={`Delete ${selCount} selected beam${selCount !== 1 ? 's' : ''}`}
                onClick={() => setConfirmDeleteSelected(true)}
              >
                × Del
              </IconChipButton>
              <IconChipButton
                aria-label="Clear beam selection"
                onClick={clearLaserDmxMatrixSelection}
              >
                Desel
              </IconChipButton>
            </>
          )}
          <IconChipButton
            aria-label="Select all beams"
            onClick={() => setSelectedLaserDmxMatrixBeams(beams.map(b => b.id))}
          >
            All
          </IconChipButton>
        </div>

        {/* ── Reset with confirmation ──────────────────────────────────── */}
        {confirmReset ? (
          <div className="rv-bm-confirm">
            <span>Reset entire Beam Matrix program?</span>
            <IconChipButton className="rv-glyph-upload-btn--danger" onClick={handleReset}>Confirm Reset</IconChipButton>
            <IconChipButton onClick={() => setConfirmReset(false)}>Cancel</IconChipButton>
          </div>
        ) : (
          <IconChipButton
            className="rv-bm-reset-btn"
            onClick={handleReset}
            aria-label="Reset Beam Matrix"
          >
            Reset Matrix
          </IconChipButton>
        )}
      </Collapsible>

      {/* ── Stage-wide visualizer guides ────────────────────────────────── */}
      <div className="rv-show-director-design-panel rv-laser-global-controls">
        <CtrlSection label="Beam Matrix Design" />
        <Collapsible label="Canvas" defaultOpen>
          <ToggleRow
            label="Show Beam Editor"
            value={editor.beamEditorVisible}
            onChange={beamEditorVisible => setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible })}
            title="Show editing handles and Beam Matrix guides without affecting live laser output."
          />
          <ToggleRow
            label="Snap to Grid"
            value={editor.snapEnabled}
            onChange={snapEnabled => setLaserDmxBeamMatrixEditorSettings({ snapEnabled })}
          />
          <ToggleRow
            label="Show Grid"
            value={editor.guidesVisible}
            onChange={guidesVisible => setLaserDmxBeamMatrixEditorSettings({ guidesVisible })}
            disabled={!editor.beamEditorVisible}
          />
          <ToggleRow
            label="Show Beam Paths"
            value={editor.beamPathsVisible}
            onChange={beamPathsVisible => setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible })}
            disabled={!editor.beamEditorVisible}
            title="Show origin-to-target path lines in the editor."
          />
          <SliderRow
            label="Overscan"
            value={editor.overscanAmount}
            onChange={overscanAmount => setLaserDmxBeamMatrixEditorSettings({ overscanAmount })}
            min={0}
            max={0.5}
            step={0.01}
            color="#d8b95a"
          />
        </Collapsible>
      </div>

      {/* ── Group inspector ─────────────────────────────────────────────── */}
      <Collapsible label="Reaction Groups" defaultOpen>
        <LaserDmxReactionGroupInspector />
      </Collapsible>

      {/* ── Cue list ────────────────────────────────────────────────────── */}
      <Collapsible label="Cue List" defaultOpen={false}>
        <div className="rv-ctrl-info rv-control-helper-copy">Cue list controls appear here when authored timeline cues are available.</div>
      </Collapsible>

      {confirmDeleteSelected && (
        <ConfirmDialog
          title="Delete Beams"
          message={`Delete ${selCount} beam${selCount !== 1 ? 's' : ''}?`}
          onCancel={() => setConfirmDeleteSelected(false)}
          onConfirm={() => { removeSelectedLaserDmxMatrixBeams(); setConfirmDeleteSelected(false) }}
        />
      )}
    </>
  )
}
