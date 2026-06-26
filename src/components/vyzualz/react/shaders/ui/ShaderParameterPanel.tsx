import React from 'react'
import { useShaderPanelStore } from './shaderPanelStore'
import { shaderRegistry } from '../registry'
import { ShaderParameterGroup } from './ShaderParameterGroup'
import { ShaderTextureInputControl } from './ShaderTextureInputControl'
import { CtrlSection } from '../../ReactControlRows'
import { groupParams } from './shaderParameterUiTypes'
import type { ShaderParamValue } from '../registry/shaderRegistryTypes'

// ── ShaderParameterPanel ──────────────────────────────────────────────────────
//
// FX-tab panel for the GLSL Shader engine.
// Renders only the controls declared by the active ShaderDefinition — no
// generic controls that are not consumed by the active shader.

export function ShaderParameterPanel() {
  const {
    activeShaderId,
    paramValues,
    modulatedValues,
    compileError,
    setParamValue,
    triggerParam,
    resetParams,
    textureSelectionsByShaderId,
    textureValidationByShaderId,
    setTextureSelection,
    clearTextureSelection,
  } = useShaderPanelStore()

  const textureSelections = activeShaderId
    ? (textureSelectionsByShaderId[activeShaderId] ?? {})
    : {}
  const textureValidation = activeShaderId
    ? (textureValidationByShaderId[activeShaderId] ?? [])
    : []

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  function handleTrigger(id: string) {
    triggerParam(id)
  }

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
          onTrigger={handleTrigger}
        />
      ))}

      {def.textureInputs && def.textureInputs.length > 0 && (
        <>
          <CtrlSection label="Texture Inputs" />
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
        </>
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
