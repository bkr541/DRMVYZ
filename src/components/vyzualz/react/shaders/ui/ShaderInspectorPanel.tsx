import React, { useCallback } from 'react'
import { useShaderPanelStore }      from './shaderPanelStore'
import { useShaderLibraryStore }    from '../library/ShaderLibraryStore'
import { shaderRegistry }           from '../registry'
import { ShaderCompilePanel }       from '../editor/ShaderCompilePanel'
import { ShaderPassInspector }      from '../editor/ShaderPassInspector'
import { ShaderCodeEditor }         from '../editor/ShaderCodeEditor'
import type { ShaderDefinition }    from '../registry/shaderRegistryTypes'

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
  const {
    activeShaderId,
    compileStatus,
    compileError,
    performanceMetrics,
    effectiveQualityTier,
    requestPreviewCompile,
  } = useShaderPanelStore()

  const libStore = useShaderLibraryStore()

  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null

  // Determine if this is a user scene (editable); userScenes is a Record keyed by id
  const userSceneEntry = activeShaderId ? (libStore.userScenes[activeShaderId] ?? null) : null

  const handleCompile = useCallback((fragSrc: string, vertSrc?: string) => {
    requestPreviewCompile(fragSrc, vertSrc)
  }, [requestPreviewCompile])

  const handleSave = useCallback((updated: ShaderDefinition) => {
    if (userSceneEntry) {
      libStore.updateUserScene(updated.id, updated)
    } else {
      libStore.addUserScene(updated)
    }
  }, [userSceneEntry, libStore])

  if (!def) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">Select a Shader scene from the ENGINE tab to inspect it.</div>
      </div>
    )
  }

  const metricFps = performanceMetrics?.totalMs ? (1000 / performanceMetrics.totalMs) : null
  const metricGpu = performanceMetrics?.gpuMs ?? null
  const metricCpu = performanceMetrics?.cpuPrepMs ?? null

  return (
    <div className="rv-ctrl-group rv-shader-pass-inspector">
      {/* Scene header */}
      <div className="rv-ctrl-section-label" style={{ marginBottom: 4 }}>
        {def.name}
        <span style={{ marginLeft: 6, opacity: 0.5, fontSize: '0.75em', textTransform: 'uppercase' }}>
          {def.category}
        </span>
      </div>
      {def.description && (
        <div className="rv-ctrl-info" style={{ marginBottom: 8 }}>{def.description}</div>
      )}

      {/* Compile status */}
      <ShaderCompilePanel status={compileStatus} definition={def} />

      {/* Pass inspector */}
      <ShaderPassInspector
        definition={def}
        metrics={performanceMetrics}
      />

      {/* Performance summary */}
      {(metricFps !== null || metricGpu !== null || metricCpu !== null) && (
        <div className="rv-shader-pass-row" style={{ marginTop: 6, fontSize: '0.8em', opacity: 0.7 }}>
          {metricFps !== null && <span>FPS {metricFps.toFixed(1)}</span>}
          {metricGpu !== null && <span style={{ marginLeft: 8 }}>GPU {metricGpu.toFixed(1)}ms</span>}
          {metricCpu !== null && <span style={{ marginLeft: 8 }}>CPU {metricCpu.toFixed(1)}ms</span>}
          {effectiveQualityTier && (
            <span style={{ marginLeft: 8, textTransform: 'uppercase' }}>Q:{effectiveQualityTier}</span>
          )}
        </div>
      )}

      {/* Code editor — only for user scenes or single-pass bundled scenes with fragSrc */}
      {(userSceneEntry || def.fragSrc) && (
        <ShaderCodeEditor
          definition={def}
          onCompile={handleCompile}
          onSave={handleSave}
          runtimeError={compileError}
          lastSuccessAt={compileStatus.state === 'ok' ? compileStatus.lastOkAt : null}
        />
      )}
    </div>
  )
}
