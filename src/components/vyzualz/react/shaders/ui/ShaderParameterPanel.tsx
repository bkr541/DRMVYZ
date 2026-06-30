import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useShaderPanelStore } from './shaderPanelStore'
import { shaderRegistry } from '../registry'
import { ShaderParameterGroup } from './ShaderParameterGroup'
import { ShaderTextureInputControl } from './ShaderTextureInputControl'
import { Collapsible } from '../../ReactControlRows'
import { groupParams } from './shaderParameterUiTypes'

// ── ShaderParameterPanel ──────────────────────────────────────────────────────
//
// FX-tab panel for the GLSL Shader engine.
// Uses narrow selectors so it does not rerender on every audio frame or
// performance-metric update.

const EMPTY_SELECTIONS = {} as Record<string, never>
const EMPTY_VALIDATION: never[] = []

export function ShaderParameterPanel() {
  // Stable fields — scene ID and definition-driving state
  const activeShaderId = useShaderPanelStore(s => s.activeShaderId)
  const paramValues    = useShaderPanelStore(s => s.paramValues)
  const modulatedValues = useShaderPanelStore(s => s.modulatedValues)
  const compileError   = useShaderPanelStore(s => s.compileError)

  // Actions (stable references from the store — never change after creation)
  const { setParamValue, triggerParam, resetParams,
          setTextureSelection, clearTextureSelection } =
    useShaderPanelStore(useShallow(s => ({
      setParamValue:       s.setParamValue,
      triggerParam:        s.triggerParam,
      resetParams:         s.resetParams,
      setTextureSelection: s.setTextureSelection,
      clearTextureSelection: s.clearTextureSelection,
    })))

  // Per-scene texture state — only rerenders when this scene's entry changes
  const textureSelections = useShaderPanelStore(
    s => activeShaderId ? (s.textureSelectionsByShaderId[activeShaderId] ?? EMPTY_SELECTIONS) : EMPTY_SELECTIONS,
  )
  const textureValidation = useShaderPanelStore(
    s => activeShaderId ? (s.textureValidationByShaderId[activeShaderId] ?? EMPTY_VALIDATION) : EMPTY_VALIDATION,
  )

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  if (!def) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">
          Select a Shader scene from the ENGINE tab to configure its parameters.
        </div>
      </div>
    )
  }

  if (compileError) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-osc-status-warn">
          Shader compile error: {compileError}
        </div>
      </div>
    )
  }

  const nonTextureParms = def.params.filter(p => p.type !== 'texture')

  if (nonTextureParms.length === 0 && (!def.textureInputs || def.textureInputs.length === 0)) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">{def.name} has no adjustable parameters.</div>
      </div>
    )
  }

  const groups = groupParams(nonTextureParms)

  return (
    <div className="rv-ctrl-group">
      {groups.map(group => (
        <ShaderParameterGroup
          key={group.name}
          group={group}
          values={paramValues}
          modulatedValues={modulatedValues}
          onChange={(id, v) => setParamValue(id, v)}
          onTrigger={id => triggerParam(id)}
        />
      ))}

      {def.textureInputs && def.textureInputs.length > 0 && (
        <Collapsible label="Texture Inputs" defaultOpen>
          <ShaderTextureInputControl
            definition={def}
            selections={textureSelections}
            validation={textureValidation}
            onSelectionChange={(inputName, sel) => {
              if (!activeShaderId) return
              if (sel === null) {
                clearTextureSelection(activeShaderId, inputName)
              } else {
                setTextureSelection(activeShaderId, inputName, sel)
              }
            }}
          />
        </Collapsible>
      )}

      <div className="rv-ctrl-footer">
        <button
          type="button"
          className="rv-reset-btn"
          onClick={resetParams}
          title="Reset all parameters to their defaults"
        >
          Reset Params
        </button>
      </div>
    </div>
  )
}
