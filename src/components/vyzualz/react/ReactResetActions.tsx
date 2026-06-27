import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'

interface ReactResetActionsControlsProps {
  onResetCurrentEngineSettings: () => void
  onResetReactViewPreferences: () => void
  onClearReactProjectContent: () => void
}

export function ReactResetActionsControls({
  onResetCurrentEngineSettings,
  onResetReactViewPreferences,
  onClearReactProjectContent,
}: ReactResetActionsControlsProps) {
  const [confirmProjectClear, setConfirmProjectClear] = useState(false)

  const handleConfirmProjectClear = () => {
    onClearReactProjectContent()
    setConfirmProjectClear(false)
  }

  return (
    <div className="rv-reset-actions">
      <button
        type="button"
        className="rv-reset-btn"
        onClick={onResetCurrentEngineSettings}
        title="Reset only the active engine's live render settings. Authored track automation, layers, clips, presets, pads, fixtures, beams, and cues are preserved."
      >
        Reset Current Engine Settings
      </button>
      <button
        type="button"
        className="rv-reset-btn"
        onClick={onResetReactViewPreferences}
        title="Reset React-view engine, preset, workspace, editor, and selection preferences without deleting authored content."
      >
        Reset React View Preferences
      </button>

      {confirmProjectClear ? (
        <div className="rv-bm-confirm" role="alertdialog" aria-label="Confirm clearing authored React project content">
          <span>
            Permanently clear manual track sections, suppressed automatic sections, preset automation cues,
            Sound Drawing layers and clips, performance-pad edits, editable presets, and LaserDMX programs?
          </span>
          <button
            type="button"
            className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
            onClick={handleConfirmProjectClear}
          >
            Confirm Clear Project Content
          </button>
          <button
            type="button"
            className="rv-glyph-upload-btn"
            onClick={() => setConfirmProjectClear(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="rv-reset-btn rv-reset-btn--danger"
          onClick={() => setConfirmProjectClear(true)}
          title="Permanently clear authored React track automation and project content. A second explicit confirmation is required."
        >
          Clear Authored Automation &amp; Project Content…
        </button>
      )}
    </div>
  )
}

export function ReactResetActions() {
  const {
    activeReactEngineId,
    resetCurrentEngineSettings,
    resetReactViewPreferences,
    clearReactProjectContent,
  } = useReactStore(useShallow(s => ({
    activeReactEngineId: s.activeReactEngineId,
    resetCurrentEngineSettings: s.resetCurrentEngineSettings,
    resetReactViewPreferences: s.resetReactViewPreferences,
    clearReactProjectContent: s.clearReactProjectContent,
  })))
  const resetShaderParams = useShaderPanelStore(s => s.resetParams)

  const handleResetCurrentEngineSettings = () => {
    resetCurrentEngineSettings()
    if (activeReactEngineId === 'shaderPads') resetShaderParams()
  }

  return (
    <ReactResetActionsControls
      onResetCurrentEngineSettings={handleResetCurrentEngineSettings}
      onResetReactViewPreferences={resetReactViewPreferences}
      onClearReactProjectContent={clearReactProjectContent}
    />
  )
}
