import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, SliderRow, ToggleRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { ConfirmDialog } from './controls/ConfirmDialog'
import { LaserDmxReactionGroupInspector } from './LaserDmxReactionGroupInspector'
import { LASER_DMX_MATRIX_MAX_BEAMS } from './ReactTypes'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

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
      <div className="rv-laser-section-help drm-help-overlay-anchor">
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
        <HelpInfoTrigger
          helpId="react.laserDmx.beamMatrix.programAndCanvas.program.overview"
          currentValue={`${beamCount} beam${beamCount === 1 ? '' : 's'} · ${groupCount} group${groupCount === 1 ? '' : 's'}${selCount > 0 ? ` · ${selCount} selected` : ''}`}
          currentValueTone={beamCount > 0 ? 'accent' : 'default'}
          placement="right"
        />
      </div>

      {/* ── Stage-wide visualizer guides ────────────────────────────────── */}
      <div className="rv-show-director-design-panel rv-laser-global-controls">
        <div className="rv-laser-section-heading-help drm-help-overlay-anchor">
          <CtrlSection label="Beam Matrix Design" />
          <HelpInfoTrigger
            helpId="react.laserDmx.beamMatrix.programAndCanvas.design.overview"
            currentValue={editor.beamEditorVisible ? 'Beam editor visible' : 'Beam editor hidden'}
            currentValueTone={editor.beamEditorVisible ? 'accent' : 'default'}
            placement="right"
          />
        </div>
        <Collapsible label="Canvas" defaultOpen>
          <div className="rv-laser-control-help drm-help-overlay-anchor">
            <ToggleRow
              label="Show Beam Editor"
              value={editor.beamEditorVisible}
              onChange={beamEditorVisible => setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible })}
              title="Show editing handles and Beam Matrix guides without affecting live laser output."
            />
            <HelpInfoTrigger
              helpId="react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamEditor"
              currentValue={editor.beamEditorVisible ? 'On' : 'Off'}
              currentValueLabel="Status"
              currentValueTone={editor.beamEditorVisible ? 'accent' : 'default'}
              placement="right"
            />
          </div>
          <div className="rv-laser-control-help drm-help-overlay-anchor">
            <ToggleRow
              label="Snap to Grid"
              value={editor.snapEnabled}
              onChange={snapEnabled => setLaserDmxBeamMatrixEditorSettings({ snapEnabled })}
            />
            <HelpInfoTrigger
              helpId="react.laserDmx.beamMatrix.programAndCanvas.canvas.snapToGrid"
              currentValue={editor.snapEnabled ? 'On' : 'Off'}
              currentValueLabel="Status"
              currentValueTone={editor.snapEnabled ? 'accent' : 'default'}
              placement="right"
            />
          </div>
          <div className="rv-laser-control-help drm-help-overlay-anchor">
            <ToggleRow
              label="Show Grid"
              value={editor.guidesVisible}
              onChange={guidesVisible => setLaserDmxBeamMatrixEditorSettings({ guidesVisible })}
              disabled={!editor.beamEditorVisible}
            />
            <HelpInfoTrigger
              helpId="react.laserDmx.beamMatrix.programAndCanvas.canvas.showGrid"
              currentValue={editor.guidesVisible ? 'On' : 'Off'}
              currentValueLabel="Status"
              currentValueTone={editor.guidesVisible ? 'accent' : 'default'}
              placement="right"
            />
          </div>
          <div className="rv-laser-control-help drm-help-overlay-anchor">
            <ToggleRow
              label="Show Beam Paths"
              value={editor.beamPathsVisible}
              onChange={beamPathsVisible => setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible })}
              disabled={!editor.beamEditorVisible}
              title="Show origin-to-target path lines in the editor."
            />
            <HelpInfoTrigger
              helpId="react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamPaths"
              currentValue={editor.beamPathsVisible ? 'On' : 'Off'}
              currentValueLabel="Status"
              currentValueTone={editor.beamPathsVisible ? 'accent' : 'default'}
              placement="right"
            />
          </div>
          <div className="rv-laser-control-help drm-help-overlay-anchor">
            <SliderRow
              label="Overscan"
              value={editor.overscanAmount}
              onChange={overscanAmount => setLaserDmxBeamMatrixEditorSettings({ overscanAmount })}
              min={0}
              max={0.5}
              step={0.01}
              color="#d8b95a"
            />
            <HelpInfoTrigger
              helpId="react.laserDmx.beamMatrix.programAndCanvas.canvas.overscan"
              currentValue={editor.overscanAmount.toFixed(2)}
              placement="right"
            />
          </div>
        </Collapsible>
      </div>

      {/* ── Group inspector ─────────────────────────────────────────────── */}
      <div className="rv-laser-section-help drm-help-overlay-anchor">
        <Collapsible label="Reaction Groups" defaultOpen>
          <LaserDmxReactionGroupInspector />
        </Collapsible>
        <HelpInfoTrigger
          helpId="react.laserDmx.beamMatrix.programAndCanvas.reactionGroups.overview"
          currentValue={`${groupCount} group${groupCount === 1 ? '' : 's'}`}
          currentValueTone={groupCount > 0 ? 'accent' : 'default'}
          placement="right"
        />
      </div>

      {/* ── Cue list ────────────────────────────────────────────────────── */}
      <div className="rv-laser-section-help drm-help-overlay-anchor">
        <Collapsible label="Cue List" defaultOpen={false}>
          <div className="rv-ctrl-info rv-control-helper-copy">Cue list controls appear here when authored timeline cues are available.</div>
        </Collapsible>
        <HelpInfoTrigger
          helpId="react.laserDmx.beamMatrix.programAndCanvas.cueList.overview"
          currentValue="No authored cues available"
          placement="right"
        />
      </div>

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
