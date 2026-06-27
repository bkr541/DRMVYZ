import React, { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useShaderPanelStore }    from './shaderPanelStore'
import { ShaderModulationPanel }  from './ShaderModulationPanel'
import { shaderRegistry }         from '../registry'
import { NEUTRAL_AUDIO_FRAME }    from '../audio/shaderAudioTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'

// Zustand 5 uses React's useSyncExternalStore under the hood. Selector fallbacks
// must keep the same reference between reads or React treats every snapshot as
// new and can enter an infinite render loop.
const EMPTY_ROUTES: readonly ShaderModulationRoute[] = Object.freeze([])

/**
 * Store-connected version of ShaderModulationPanel.
 * Reads all state from useShaderPanelStore and delegates to the
 * presentational ShaderModulationPanel.
 */
export function ConnectedShaderModulationPanel() {
  // Subscribe only to fields this panel renders. The previous whole-store
  // subscription rerendered this component for every shader-store write,
  // including 60 fps audio/evaluation updates and unrelated diagnostics.
  const {
    activeShaderId,
    audioFrame,
    evaluationFrame,
    addRoute,
    updateRoute,
    removeRoute,
  } = useShaderPanelStore(useShallow(s => ({
    activeShaderId: s.activeShaderId,
    audioFrame: s.audioFrame,
    evaluationFrame: s.evaluationFrame,
    addRoute: s.addRoute,
    updateRoute: s.updateRoute,
    removeRoute: s.removeRoute,
  })))

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  const routes = useShaderPanelStore(
    s => activeShaderId
      ? (s.routesByShaderId[activeShaderId] ?? EMPTY_ROUTES)
      : EMPTY_ROUTES,
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
