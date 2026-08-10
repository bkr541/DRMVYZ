import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { IconChipButton } from './controls/IconChipButton'

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
      <IconChipButton
        onClick={onResetCurrentEngineSettings}
        title="Reset only the active engine's live render settings. Authored track automation, layers, clips, presets, pads, fixtures, beams, and cues are preserved."
      >
        Reset Current Engine Settings
      </IconChipButton>
      <IconChipButton
        onClick={onResetReactViewPreferences}
        title="Reset React-view engine, preset, workspace, editor, and selection preferences without deleting authored content."
      >
        Reset React View Preferences
      </IconChipButton>

      {confirmProjectClear ? (
        <div className="rv-bm-confirm" role="alertdialog" aria-label="Confirm clearing authored React project content">
          <span>
            Permanently clear manual track sections, suppressed automatic sections, preset automation cues,
            Sound Drawing layers and clips, performance-pad edits, editable presets, and LaserDMX programs?
          </span>
          <IconChipButton
            className="rv-glyph-upload-btn--danger"
            onClick={handleConfirmProjectClear}
          >
            Confirm Clear Project Content
          </IconChipButton>
          <IconChipButton
            onClick={() => setConfirmProjectClear(false)}
          >
            Cancel
          </IconChipButton>
        </div>
      ) : (
        <IconChipButton
          className="rv-glyph-upload-btn--danger"
          onClick={() => setConfirmProjectClear(true)}
          title="Permanently clear authored React track automation and project content. A second explicit confirmation is required."
        >
          Clear Authored Automation &amp; Project Content…
        </IconChipButton>
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
