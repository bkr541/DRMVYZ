import React from 'react'
import type { Vec2ParamDef, Vec2 } from '../registry/shaderRegistryTypes'
import { SliderRow } from '../../ReactControlRows'

export interface ShaderVec2ControlProps {
  param:    Vec2ParamDef
  value:    Vec2
  onChange: (v: Vec2) => void
}

export function ShaderVec2Control({ param, value, onChange }: ShaderVec2ControlProps) {
  const stepX = param.step?.[0] ?? 0.01
  const stepY = param.step?.[1] ?? 0.01
  const label = param.label

  return (
    <div className="rv-shader-vec2">
      <SliderRow
        label={`${label} X`}
        value={value[0]}
        onChange={x => onChange([x, value[1]])}
        min={param.min[0]}
        max={param.max[0]}
        step={stepX}
        color="#4ac7db"
      />
      <SliderRow
        label={`${label} Y`}
        value={value[1]}
        onChange={y => onChange([value[0], y])}
        min={param.min[1]}
        max={param.max[1]}
        step={stepY}
        color="#61d6aa"
      />
    </div>
  )
}
