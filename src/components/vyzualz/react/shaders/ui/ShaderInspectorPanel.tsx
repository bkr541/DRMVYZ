import { useCallback } from 'react'
import { useShallow }            from 'zustand/react/shallow'
import { useShaderPanelStore }      from './shaderPanelStore'
import { useShaderLibraryStore }    from '../library/ShaderLibraryStore'
import { shaderRegistry }           from '../registry'
import { ShaderCompilePanel }       from '../editor/ShaderCompilePanel'
import { ShaderPassInspector }      from '../editor/ShaderPassInspector'
import type { PassInspectorData }   from '../editor/ShaderPassInspector'
import { ShaderCodeEditor }         from '../editor/ShaderCodeEditor'
import type { ShaderDefinition }    from '../registry/shaderRegistryTypes'
import { Collapsible }              from '../../ReactControlRows'

// ── ShaderInspectorPanel ──────────────────────────────────────────────────────

/**
 * Right-rail inspector shown when `activeReactEngineId === 'shaderPads'`.
 *
 * Connects ShaderCompilePanel, ShaderPassInspector, a performance summary,
 * and ShaderCodeEditor. Compile requests go through the store's ephemeral
 * preview-compile callback (set by ShaderEngineRenderer at mount time) —
 * the renderer is never stored in Zustand.
 */
export function ShaderInspectorPanel() {
  // Narrow shallow selector: only the fields this panel actually renders.
  // performanceMetrics and passInfo are throttled to ~10Hz in the renderer
  // so they don't drive 60fps rerenders even with this subscription.
  const {
    activeShaderId,
    compileStatus,
    compileError,
    performanceMetrics,
    effectiveQualityTier,
    passInfo,
    requestPreviewCompile,
    requestPreviewReset,
  } = useShaderPanelStore(useShallow(s => ({
    activeShaderId:       s.activeShaderId,
    compileStatus:        s.compileStatus,
    compileError:         s.compileError,
    performanceMetrics:   s.performanceMetrics,
    effectiveQualityTier: s.effectiveQualityTier,
    passInfo:             s.passInfo,
    requestPreviewCompile: s.requestPreviewCompile,
    requestPreviewReset:  s.requestPreviewReset,
  })))

  const libStore = useShaderLibraryStore()

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  // Determine if this is a user scene (editable); userScenes is a Record keyed by id
  const userSceneEntry = activeShaderId ? (libStore.userScenes[activeShaderId] ?? null) : null

  const handleCompile = useCallback((fragSrc: string, vertSrc?: string) => {
    requestPreviewCompile(fragSrc, vertSrc)
  }, [requestPreviewCompile])

  const handleResetPreview = useCallback(() => {
    requestPreviewReset()
  }, [requestPreviewReset])

  const handleSave = useCallback((updated: ShaderDefinition) => {
    if (userSceneEntry) {
      const result = libStore.updateUserScene(updated.id, updated)
      if (result?.ok === false) {
        if (import.meta.env.DEV) console.warn('[ShaderInspectorPanel] updateUserScene failed:', result.error)
      } else {
        // Force recompile after a successful update so the renderer picks up the change
        useShaderPanelStore.getState().requestRecompile(updated.id)
      }
    } else {
      libStore.addUserScene(updated)
    }
  }, [userSceneEntry, libStore])

  // Map live RenderPassInfo to PassInspectorData for the pass inspector
  const livePassData: PassInspectorData[] | undefined = passInfo
    ? passInfo.map(p => ({
        passId:       p.passId,
        compileState: 'ok' as const,
        textureW:     p.dimensions.w,
        textureH:     p.dimensions.h,
      }))
    : undefined

  if (!def) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">Select a Shader scene from the ENGINE tab to inspect it.</div>
      </div>
    )
  }

  return (
    <div className="rv-ctrl-group rv-shader-inspector">
      <Collapsible label="Renderer Diagnostics" defaultOpen>
        <div className="rv-show-director-performance-status rv-shader-diagnostics" data-shader-diagnostics>
          <div className="rv-show-director-performance-status__title rv-shader-diagnostics__title">
            <span>{def.name}</span>
            <span>{def.category}</span>
          </div>
          {def.description && (
            <p className="rv-show-director-performance-status__notice">{def.description}</p>
          )}

          <ShaderCompilePanel status={compileStatus} definition={def} />

          <ShaderPassInspector
            definition={def}
            metrics={performanceMetrics}
            passData={livePassData}
            qualityTier={effectiveQualityTier}
          />
        </div>
      </Collapsible>

      {/* User scenes are editable; bundled scenes keep their source read-only. */}
      {(userSceneEntry || def.fragSrc) && (
        <Collapsible label="Shader Code" defaultOpen={false}>
          <ShaderCodeEditor
            definition={def}
            isUserScene={!!userSceneEntry}
            onCompile={handleCompile}
            onSave={handleSave}
            onResetPreview={handleResetPreview}
            runtimeError={compileError}
            lastSuccessAt={compileStatus.state === 'ok' ? compileStatus.lastOkAt : null}
          />
        </Collapsible>
      )}
    </div>
  )
}
