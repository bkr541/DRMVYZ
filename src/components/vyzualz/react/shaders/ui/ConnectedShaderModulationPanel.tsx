import React, { useCallback } from 'react'
import { useShaderPanelStore }    from './shaderPanelStore'
import { ShaderModulationPanel }  from './ShaderModulationPanel'
import { shaderRegistry }         from '../registry'
import { NEUTRAL_AUDIO_FRAME }    from '../audio/shaderAudioTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'

/**
 * Store-connected version of ShaderModulationPanel.
 * Reads all state from useShaderPanelStore and delegates to the
 * presentational ShaderModulationPanel.
 */
export function ConnectedShaderModulationPanel() {
  const {
    activeShaderId,
    audioFrame,
    evaluationFrame,
    addRoute,
    updateRoute,
    removeRoute,
  } = useShaderPanelStore()

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  const routes = useShaderPanelStore(
    s => s.routesByShaderId[activeShaderId ?? ''] ?? [],
  )

  const handleAdd = useCallback((route: ShaderModulationRoute) => {
    if (activeShaderId) addRoute(activeShaderId, route)
  }, [activeShaderId, addRoute])

  const handleUpdate = useCallback((id: string, patch: Partial<ShaderModulationRoute>) => {
    if (activeShaderId) updateRoute(activeShaderId, id, patch)
  }, [activeShaderId, updateRoute])

  const handleRemove = useCallback((id: string) => {
    if (activeShaderId) removeRoute(activeShaderId, id)
  }, [activeShaderId, removeRoute])

  if (!def) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">Select a Shader scene to configure modulation routes.</div>
      </div>
    )
  }

  return (
    <ShaderModulationPanel
      definition={def}
      routes={routes}
      audioFrame={audioFrame ?? NEUTRAL_AUDIO_FRAME}
      evaluationFrame={evaluationFrame}
      onAddRoute={handleAdd}
      onUpdateRoute={handleUpdate}
      onRemoveRoute={handleRemove}
    />
  )
}
