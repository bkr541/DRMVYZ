import { BubbleRevealSlider } from '../../controls/BubbleRevealSlider'
import React from 'react'
import type { GradientStop, RGBA } from '../registry/shaderRegistryTypes'
import { sortStops, clamp01, rgbaToHex, hexToRgba } from './shaderParameterUiTypes'

export interface ShaderGradientControlProps {
  label:    string
  value:    GradientStop[]
  onChange: (stops: GradientStop[]) => void
}

export function ShaderGradientControl({ label, value, onChange }: ShaderGradientControlProps) {
  const sorted = sortStops(value)

  function updateStop(i: number, patch: Partial<GradientStop>) {
    const next = sorted.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    onChange(sortStops(next))
  }

  function addStop() {
    const pos = sorted.length >= 2
      ? (sorted[sorted.length - 2].position + sorted[sorted.length - 1].position) / 2
      : 0.5
    onChange(sortStops([...sorted, { position: clamp01(pos), color: [1, 1, 1, 1] as RGBA }]))
  }

  function removeStop(i: number) {
    if (sorted.length <= 2) return
    onChange(sorted.filter((_, idx) => idx !== i))
  }

  return (
    <div className="rv-shader-gradient">
      <div className="rv-ctrl-label">{label}</div>
      <div className="rv-shader-gradient-stops">
        {sorted.map((stop, i) => (
          <div key={i} className="rv-shader-gradient-stop">
            <BubbleRevealSlider
              type="range"
              className="rv-shader-stop-pos"
              min={0} max={1} step={0.01}
              value={stop.position}
              onChange={e => updateStop(i, { position: parseFloat(e.target.value) })}
              title={`Position: ${Math.round(stop.position * 100)}%`}
              aria-label={`${label} stop ${i + 1} position`}
            />
            <input
              type="color"
              className="rv-shader-stop-color"
              value={rgbaToHex(stop.color)}
              onChange={e => updateStop(i, { color: hexToRgba(e.target.value, stop.color[3]) })}
              aria-label={`${label} stop ${i + 1} color`}
            />
            <BubbleRevealSlider
              type="range"
              className="rv-shader-stop-alpha"
              min={0} max={1} step={0.01}
              value={stop.color[3]}
              onChange={e => {
                const a = parseFloat(e.target.value)
                const rgba: RGBA = [stop.color[0], stop.color[1], stop.color[2], a]
                updateStop(i, { color: rgba })
              }}
              title={`Alpha: ${Math.round(stop.color[3] * 100)}%`}
              aria-label={`${label} stop ${i + 1} alpha`}
            />
            <button
              type="button"
              className="rv-shader-stop-remove"
              onClick={() => removeStop(i)}
              disabled={sorted.length <= 2}
              title="Remove stop"
              aria-label={`Remove ${label} stop ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="rv-shader-stop-add"
        onClick={addStop}
      >
        + Stop
      </button>
    </div>
  )
}
