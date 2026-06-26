import React from 'react'
import type { ShaderParamValue } from '../registry/shaderRegistryTypes'
import { Collapsible } from '../../ReactControlRows'
import { ShaderParameterControl } from './ShaderParameterControl'
import { getParamDefault } from '../registry/ShaderParameterSchema'
import type { ParamGroup } from './shaderParameterUiTypes'

export interface ShaderParameterGroupProps {
  group:           ParamGroup
  values:          Record<string, ShaderParamValue>
  modulatedValues: Record<string, number>
  onChange:        (id: string, value: ShaderParamValue) => void
  onTrigger:       (id: string) => void
}

export function ShaderParameterGroup({
  group, values, modulatedValues, onChange, onTrigger,
}: ShaderParameterGroupProps) {
  return (
    <Collapsible label={group.name} defaultOpen={!group.advanced}>
      {group.params.map(param => (
        <ShaderParameterControl
          key={param.id}
          param={param}
          value={values[param.id] ?? getParamDefault(param) ?? null}
          effectiveValue={modulatedValues[param.id]}
          onChange={onChange}
          onTrigger={onTrigger}
        />
      ))}
    </Collapsible>
  )
}
