import React, { useId } from 'react'
import type { RGBA } from '../registry/shaderRegistryTypes'
import { rgbaToHex, hexToRgba } from './shaderParameterUiTypes'

export interface ShaderColorControlProps {
  label:    string
  value:    RGBA
  onChange: (v: RGBA) => void
}

export function ShaderColorControl({ label, value, onChange }: ShaderColorControlProps) {
  const id    = useId()
  const hex   = rgbaToHex(value)
  const alpha = value[3]

  return (
    <div className="rv-ctrl-row rv-shader-color-row">
      <label className="rv-ctrl-label" htmlFor={id}>{label}</label>
      <div className="rv-shader-color-wrap">
        <input
          type="color"
          id={id}
          className="rv-shader-color-swatch"
          value={hex}
          onChange={e => onChange(hexToRgba(e.target.value, alpha))}
          title={`RGB: ${hex}  Alpha: ${Math.round(alpha * 100)}%`}
        />
        <input
          type="range"
          className="rv-ctrl-slider rv-shader-alpha-slider"
          min={0} max={1} step={0.01}
          value={alpha}
          onChange={e => {
            const a = parseFloat(e.target.value)
            onChange([value[0], value[1], value[2], a])
          }}
          title={`Alpha: ${Math.round(alpha * 100)}%`}
          aria-label={`${label} alpha`}
        />
      </div>
    </div>
  )
}
