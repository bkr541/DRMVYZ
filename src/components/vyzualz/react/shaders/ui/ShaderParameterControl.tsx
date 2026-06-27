import React from 'react'
import type { ShaderParamDef, ShaderParamValue } from '../registry/shaderRegistryTypes'
import { SliderRow, ToggleRow, SelectRow } from '../../ReactControlRows'
import { ShaderColorControl }    from './ShaderColorControl'
import { ShaderGradientControl } from './ShaderGradientControl'
import { ShaderVec2Control }     from './ShaderVec2Control'
import {
  toNumberValue, toBooleanValue, toStringValue,
  toRgbaValue, toVec2Value, toGradientValue,
  clampFloat, clampInteger,
} from './shaderParameterUiTypes'
import { getParamDefault } from '../registry/ShaderParameterSchema'

export interface ShaderParameterControlProps {
  param:          ShaderParamDef
  value:          ShaderParamValue
  effectiveValue: number | undefined
  onChange:       (id: string, value: ShaderParamValue) => void
  onTrigger:      (id: string) => void
}

export function ShaderParameterControl({
  param, value, effectiveValue, onChange, onTrigger,
}: ShaderParameterControlProps) {
  switch (param.type) {
    case 'float': {
      const v    = clampFloat(toNumberValue(value, param.default), param.min, param.max)
      const hasEff = effectiveValue !== undefined && Math.abs(effectiveValue - v) > 1e-4
      const label = param.unit ? `${param.label} (${param.unit})` : param.label
      return (
        <div className="rv-shader-param">
          <SliderRow
            label={label}
            value={v}
            onChange={n => onChange(param.id, clampFloat(n, param.min, param.max))}
            min={param.min}
            max={param.max}
            step={param.step ?? 0.01}
            color={hasEff ? '#61d6aa' : '#4ac7db'}
          />
          {hasEff && (
            <div className="rv-shader-eff-row">
              <span className="rv-shader-eff-label">modulated</span>
              <span className="rv-shader-eff-val">{(effectiveValue as number).toFixed(3)}</span>
            </div>
          )}
        </div>
      )
    }

    case 'integer': {
      const v = clampInteger(toNumberValue(value, param.default), param.min, param.max)
      const label = param.unit ? `${param.label} (${param.unit})` : param.label
      return (
        <SliderRow
          label={label}
          value={v}
          onChange={n => onChange(param.id, clampInteger(n, param.min, param.max))}
          min={param.min}
          max={param.max}
          step={param.step ?? 1}
        />
      )
    }

    case 'boolean':
      return (
        <ToggleRow
          label={param.label}
          value={toBooleanValue(value)}
          onChange={v => onChange(param.id, v)}
        />
      )

    case 'color':
      return (
        <ShaderColorControl
          label={param.label}
          value={toRgbaValue(value)}
          onChange={v => onChange(param.id, v)}
        />
      )

    case 'gradient':
      return (
        <ShaderGradientControl
          label={param.label}
          value={toGradientValue(value)}
          onChange={v => onChange(param.id, v)}
        />
      )

    case 'enum':
      return (
        <SelectRow
          label={param.label}
          value={toStringValue(value)}
          onChange={v => onChange(param.id, v)}
          options={param.values}
        />
      )

    case 'vec2':
      return (
        <ShaderVec2Control
          param={param}
          value={toVec2Value(value)}
          onChange={v => onChange(param.id, v)}
        />
      )

    case 'trigger':
      return (
        <div className="rv-ctrl-row rv-shader-trigger-row">
          <span className="rv-ctrl-label">{param.label}</span>
          <button
            type="button"
            className="rv-shader-trigger-btn"
            onClick={() => onTrigger(param.id)}
          >
            Fire
          </button>
        </div>
      )

    case 'texture':
      // Texture params are surfaced through ShaderTextureInputControl in the Texture Inputs section.
      return null

    default:
      return null
  }
}
