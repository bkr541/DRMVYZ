import React from 'react'
import type { QualityTier, ShaderDefinition, ShaderPassDef } from '../registry/shaderRegistryTypes'
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
  qualityTier?: QualityTier | null
}

function passCompileLabel(state: PassCompileState): string {
  switch (state) {
    case 'ok':      return '✓ OK'
    case 'error':   return '✕ Error'
    case 'pending': return '… Pending'
    case 'unknown': return '— Unknown'
  }
}

function displayInputs(pass: ShaderPassDef): string {
  return pass.inputs.length > 0
    ? pass.inputs.map(input => typeof input === 'string' ? input : `${input.source} → ${input.uniformName}`).join(', ')
    : 'None'
}

export function ShaderPassInspector({
  definition,
  metrics,
  passData = [],
  qualityTier,
}: ShaderPassInspectorProps) {
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
  const metricFps = metrics?.totalMs ? 1000 / metrics.totalMs : null

  return (
    <div className="rv-shader-pass-inspector">
      <dl className="rv-show-director-performance-status__grid rv-shader-diagnostics-grid">
        <div><dt>Scene</dt><dd title={definition.name}>{definition.name}</dd></div>
        <div><dt>Passes</dt><dd>{passes.length}</dd></div>
        {metrics && (
          <>
            <div><dt>Frame</dt><dd>{metrics.totalMs.toFixed(1)} ms</dd></div>
            <div><dt>FPS</dt><dd>{metricFps?.toFixed(1) ?? 'Unavailable'}</dd></div>
            <div><dt>GPU</dt><dd>{metrics.gpuMs == null ? 'Unavailable' : `${metrics.gpuMs.toFixed(2)} ms`}</dd></div>
            <div><dt>CPU</dt><dd>{metrics.cpuPrepMs.toFixed(2)} ms</dd></div>
            <div><dt>Texture Memory</dt><dd>{metrics.textureMb.toFixed(2)} MiB</dd></div>
            <div><dt>Resolution</dt><dd>{metrics.internalW} × {metrics.internalH}</dd></div>
          </>
        )}
        <div><dt>Quality</dt><dd>{qualityTier ?? definition.quality?.recommendedTier ?? 'medium'}</dd></div>
        <div><dt>Float Target</dt><dd>{definition.quality?.requiresFloatTarget ? 'Required' : 'Optional'}</dd></div>
      </dl>

      <div className="rv-shader-pass-list">
        <div className="rv-shader-pass-list-header">
          <span>Render Passes</span>
          <span>{passes.length}</span>
        </div>
        {passes.map((pass, idx) => {
          const data = passData.find(d => d.passId === pass.id)
          const compileState = data?.compileState ?? 'unknown'
          return (
            <div key={pass.id} className="rv-shader-pass-card">
              <div className="rv-shader-pass-card-header">
                <span className="rv-shader-pass-row-order">{idx + 1}</span>
                <strong className="rv-shader-pass-row-id" title={pass.id}>{pass.id}</strong>
                <span className={`rv-shader-pass-state rv-shader-pass-state--${compileState}`}>
                  {passCompileLabel(compileState)}
                </span>
              </div>
              <dl className="rv-show-director-performance-status__grid rv-shader-pass-card-grid">
                <div><dt>Input</dt><dd title={displayInputs(pass)}>{displayInputs(pass)}</dd></div>
                <div><dt>Output</dt><dd>{pass.output === null ? 'screen' : pass.output}</dd></div>
                <div><dt>Scale</dt><dd>×{pass.resolutionScale ?? 1}</dd></div>
                <div><dt>Blend</dt><dd>{pass.blendMode ?? 'none'}</dd></div>
                <div><dt>Mode</dt><dd>{pass.pingPong ? 'ping-pong' : pass.persistent ? 'persistent' : 'standard'}</dd></div>
                <div><dt>Dimensions</dt><dd>{data?.textureW && data?.textureH ? `${data.textureW} × ${data.textureH}` : 'Runtime pending'}</dd></div>
                {data?.gpuMs != null && <div><dt>GPU</dt><dd>{data.gpuMs.toFixed(2)} ms</dd></div>}
                {data?.cpuMs != null && <div><dt>CPU</dt><dd>{data.cpuMs.toFixed(2)} ms</dd></div>}
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}
