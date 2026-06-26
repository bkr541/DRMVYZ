import React from 'react'
import type { ShaderDefinition, ShaderPassDef } from '../registry/shaderRegistryTypes'
import type { PerformanceMetrics } from '../performance/shaderPerformanceTypes'

// ── Pass compile state ────────────────────────────────────────────────────────

export type PassCompileState = 'ok' | 'error' | 'pending' | 'unknown'

export interface PassInspectorData {
  passId:       string
  compileState: PassCompileState
  gpuMs?:       number | null
  cpuMs?:       number | null
  textureW?:    number
  textureH?:    number
}

// ── ShaderPassInspector ───────────────────────────────────────────────────────

export interface ShaderPassInspectorProps {
  definition:  ShaderDefinition | null
  metrics?:    PerformanceMetrics | null
  passData?:   PassInspectorData[]
}

function passCompileLabel(state: PassCompileState): string {
  switch (state) {
    case 'ok':      return '✓ OK'
    case 'error':   return '✗ Error'
    case 'pending': return '… Pending'
    case 'unknown': return '— Unknown'
  }
}

export function ShaderPassInspector({ definition, metrics, passData = [] }: ShaderPassInspectorProps) {
  if (!definition) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">No shader scene loaded.</div>
      </div>
    )
  }

  const passes: ShaderPassDef[] = definition.passes?.length
    ? definition.passes
    : [{
        id:       'main',
        fragSrc:  definition.fragSrc ?? '',
        vertSrc:  definition.vertSrc === 'shared' ? undefined : definition.vertSrc,
        inputs:   (definition.textureInputs ?? []).map(t => t.name),
        output:   'screen',
      }]

  return (
    <div className="rv-shader-pass-inspector">
      {/* Scene summary */}
      <div className="rv-shader-pass-summary">
        <span className="rv-ctrl-label">Scene</span>
        <span className="rv-shader-pass-val">{definition.name}</span>
        <span className="rv-ctrl-label">Passes</span>
        <span className="rv-shader-pass-val">{passes.length}</span>
        {metrics && (
          <>
            <span className="rv-ctrl-label">Frame (ms)</span>
            <span className="rv-shader-pass-val">{metrics.totalMs.toFixed(1)}</span>
            {metrics.gpuMs !== null && (
              <>
                <span className="rv-ctrl-label">GPU (ms)</span>
                <span className="rv-shader-pass-val">{metrics.gpuMs.toFixed(2)}</span>
              </>
            )}
            <span className="rv-ctrl-label">Texture mem</span>
            <span className="rv-shader-pass-val">{metrics.textureMb.toFixed(2)} MiB</span>
            <span className="rv-ctrl-label">Resolution</span>
            <span className="rv-shader-pass-val">{metrics.internalW} × {metrics.internalH}</span>
          </>
        )}
      </div>

      {/* Per-pass table */}
      <div className="rv-shader-pass-list">
        <div className="rv-shader-pass-list-header">Passes</div>
        {passes.map((pass, idx) => {
          const data = passData.find(d => d.passId === pass.id)
          return (
            <div key={pass.id} className="rv-shader-pass-row">
              <div className="rv-shader-pass-row-order">{idx + 1}</div>
              <div className="rv-shader-pass-row-id" title={pass.id}>{pass.id}</div>

              {/* Inputs */}
              <div className="rv-shader-pass-row-section">
                <span className="rv-ctrl-label">In</span>
                <span className="rv-shader-pass-val">
                  {pass.inputs.length > 0 ? pass.inputs.join(', ') : '—'}
                </span>
              </div>

              {/* Output */}
              <div className="rv-shader-pass-row-section">
                <span className="rv-ctrl-label">Out</span>
                <span className="rv-shader-pass-val">
                  {pass.output === null ? 'screen' : pass.output}
                </span>
              </div>

              {/* Resolution scale */}
              {pass.resolutionScale !== undefined && pass.resolutionScale !== 1 && (
                <div className="rv-shader-pass-row-section">
                  <span className="rv-ctrl-label">Scale</span>
                  <span className="rv-shader-pass-val">×{pass.resolutionScale}</span>
                </div>
              )}

              {/* Blend mode */}
              {pass.blendMode && pass.blendMode !== 'none' && (
                <div className="rv-shader-pass-row-section">
                  <span className="rv-ctrl-label">Blend</span>
                  <span className="rv-shader-pass-val">{pass.blendMode}</span>
                </div>
              )}

              {/* Persistence flags */}
              {(pass.persistent || pass.pingPong) && (
                <div className="rv-shader-pass-row-section">
                  <span className="rv-ctrl-label">Mode</span>
                  <span className="rv-shader-pass-val">
                    {pass.pingPong ? 'ping-pong' : 'persistent'}
                  </span>
                </div>
              )}

              {/* Texture dimensions */}
              {data?.textureW && data?.textureH && (
                <div className="rv-shader-pass-row-section">
                  <span className="rv-ctrl-label">Dim</span>
                  <span className="rv-shader-pass-val">{data.textureW}×{data.textureH}</span>
                </div>
              )}

              {/* GPU timing */}
              {data?.gpuMs !== undefined && data.gpuMs !== null && (
                <div className="rv-shader-pass-row-section">
                  <span className="rv-ctrl-label">GPU</span>
                  <span className="rv-shader-pass-val">{data.gpuMs.toFixed(2)} ms</span>
                </div>
              )}

              {/* Compile state */}
              <div className={`rv-shader-pass-state rv-shader-pass-state--${data?.compileState ?? 'unknown'}`}>
                {passCompileLabel(data?.compileState ?? 'unknown')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
