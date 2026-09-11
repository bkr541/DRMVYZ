import { Fragment, useMemo, useRef, useState } from 'react'
import {
  createCinema2InspectorModel,
  type Cinema2InspectorControlModel,
  type Cinema2InspectorSurface,
} from '../cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2JsonValue } from '../cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'

export interface Cinema2InspectorPanelProps {
  runtime: Cinema2Runtime | null
  surface: Cinema2InspectorSurface
}

export function Cinema2InspectorPanel({ runtime, surface }: Cinema2InspectorPanelProps) {
  const [, setRevision] = useState(0)
  const actionSequence = useRef(0)
  const plan = runtime?.getCompiledPresetPlan() ?? null
  const snapshot = runtime?.getParameterState().getSnapshot() ?? null
  const sections = useMemo(() => (
    plan && snapshot ? createCinema2InspectorModel(plan, snapshot, surface) : []
  ), [plan, snapshot, surface])
  const hasResettablePersistentValue = sections.some(section => section.groups.some(group => group.controls.some(control => (
    control.definition.persistence !== 'runtime-only'
    && control.definition.reset !== 'none'
    && control.definition.type !== 'trigger'
  ))))

  const refresh = () => setRevision(current => current + 1)

  if (!runtime || !plan || !snapshot) {
    return <EmptyCinema2Inspector copy="Cinema 2.0 controls are unavailable until the runtime is active." />
  }

  const parameterState = runtime.getParameterState()
  const commit = (control: Readonly<Cinema2InspectorControlModel>, candidate: unknown) => {
    const result = parameterState.setPersistentValue(control.definition.id, candidate)
    if (result.ok) refresh()
    else if (import.meta.env.DEV) console.warn('[Cinema2InspectorPanel] parameter update rejected:', result.diagnostics)
  }
  const dispatch = (control: Readonly<Cinema2InspectorControlModel>) => {
    const target = plan.targets.targets.find(candidate => (
      candidate.parameterId === control.definition.id && candidate.channel === 'action'
    ))
    if (!target) {
      if (import.meta.env.DEV) console.warn(`[Cinema2InspectorPanel] no action target for ${control.definition.id}`)
      return
    }
    actionSequence.current += 1
    const result = runtime.getTargetResolver().dispatch(target.id, [{
      contributorId: 'cinema2.inspector',
      operation: 'action',
      eventId: `cinema2-inspector:${control.definition.id}:${actionSequence.current}`,
    }])
    if (!result.ok && import.meta.env.DEV) console.warn('[Cinema2InspectorPanel] action dispatch rejected:', result.diagnostics)
  }

  if (sections.length === 0) {
    return <EmptyCinema2Inspector copy="No Cinema 2.0 parameters are declared for this workspace." />
  }

  return (
    <div className="rv-workspace-panel" data-cinema2-inspector={surface}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'design' && hasResettablePersistentValue && (
            <div className="rv-ctrl-group" data-cinema2-inspector-actions="true">
              <IconChipButton
                onClick={() => {
                  parameterState.resetAll()
                  refresh()
                }}
              >
                Reset Parameters
              </IconChipButton>
            </div>
          )}
          {sections.map(section => (
            <div className="rv-ctrl-group" key={section.label} data-cinema2-section={section.label}>
              <CtrlSection label={section.label} />
              {section.groups.map((group, groupIndex) => (
                <Fragment key={group.label ?? `ungrouped-${groupIndex}`}>
                  {group.label ? (
                    <Collapsible label={group.label}>
                      {group.controls.map(control => (
                        <Cinema2SchemaControl
                          key={control.definition.id}
                          control={control}
                          onChange={candidate => commit(control, candidate)}
                          onTrigger={() => dispatch(control)}
                        />
                      ))}
                    </Collapsible>
                  ) : group.controls.map(control => (
                    <Cinema2SchemaControl
                      key={control.definition.id}
                      control={control}
                      onChange={candidate => commit(control, candidate)}
                      onTrigger={() => dispatch(control)}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Cinema2SchemaControl({
  control,
  onChange,
  onTrigger,
}: {
  control: Readonly<Cinema2InspectorControlModel>
  onChange: (value: Cinema2JsonValue) => void
  onTrigger: () => void
}) {
  const { definition, value, enabled, disabledReason } = control
  const description = [definition.description, disabledReason].filter(Boolean).join(' ')
  const disabled = !enabled
  const controlId = `cinema2-parameter-${definition.id}`

  switch (definition.type) {
    case 'float':
    case 'integer': {
      const numeric = typeof value === 'number' ? value : 0
      if (typeof definition.min === 'number' && typeof definition.max === 'number' && definition.max > definition.min) {
        return (
          <div data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
            <SliderRow
              id={controlId}
              label={definition.label}
              value={numeric}
              min={definition.min}
              max={definition.max}
              step={definition.step ?? (definition.type === 'integer' ? 1 : 0.01)}
              disabled={disabled}
              description={description || undefined}
              onChange={next => onChange(definition.type === 'integer' ? Math.round(next) : next)}
            />
          </div>
        )
      }
      return (
        <ControlWithDescription control={control}>
          <NumberInputRow
            id={controlId}
            label={definition.label}
            value={numeric}
            min={definition.min}
            max={definition.max}
            step={definition.step ?? (definition.type === 'integer' ? 1 : 0.01)}
            unit={definition.unit}
            disabled={disabled}
            onChange={next => onChange(definition.type === 'integer' ? Math.round(next) : next)}
          />
        </ControlWithDescription>
      )
    }
    case 'boolean':
      return (
        <div data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <ToggleRow
            id={controlId}
            label={definition.label}
            value={value === true}
            disabled={disabled}
            description={description || undefined}
            onChange={onChange}
          />
        </div>
      )
    case 'enum':
      return (
        <div data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <SelectRow
            id={controlId}
            label={definition.label}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            description={description || undefined}
            options={(definition.options ?? []).map(option => ({ value: option.value, label: option.label }))}
            onChange={onChange}
          />
        </div>
      )
    case 'color': {
      const rgba = isNumericArray(value, 4) ? value : [1, 1, 1, 1]
      return (
        <div data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <ColorRow
            id={controlId}
            label={definition.label}
            value={rgbaToHex(rgba)}
            disabled={disabled}
            description={description || undefined}
            onChange={hex => onChange(hexToRgba(hex, rgba[3]))}
          />
        </div>
      )
    }
    case 'trigger':
      return (
        <div className="rv-ctrl-row" data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <IconChipButton id={controlId} disabled={disabled} onClick={onTrigger}>{definition.label}</IconChipButton>
          {description && <span className="rv-ctrl-description">{description}</span>}
        </div>
      )
    case 'string':
    case 'media':
      return (
        <ScalarTextControl
          id={controlId}
          control={control}
          value={value == null ? '' : String(value)}
          onChange={onChange}
        />
      )
    case 'text':
      return (
        <div className="rv-ctrl-row" data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <label className="rv-ctrl-label" htmlFor={controlId}>{definition.label}</label>
          <textarea
            id={controlId}
            className="rv-ctrl-text-input rv-cinema2-textarea"
            rows={3}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={event => onChange(event.target.value)}
            aria-describedby={description ? `${controlId}-description` : undefined}
          />
          {description && <span id={`${controlId}-description`} className="rv-ctrl-description">{description}</span>}
        </div>
      )
    case 'vec2':
    case 'vec3': {
      const length = definition.type === 'vec2' ? 2 : 3
      const vector = isNumericArray(value, length) ? value : Array.from({ length }, () => 0)
      const axes = ['X', 'Y', 'Z']
      return (
        <div className="rv-cinema2-vector-control" data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
          <span className="rv-ctrl-label">{definition.label}</span>
          {vector.map((component, index) => (
            <NumberInputRow
              key={axes[index]}
              id={`${controlId}-${axes[index].toLowerCase()}`}
              label={axes[index]}
              value={component}
              min={definition.min}
              max={definition.max}
              step={definition.step ?? 0.01}
              unit={definition.unit}
              disabled={disabled}
              onChange={next => {
                const updated = [...vector]
                updated[index] = next
                onChange(updated)
              }}
            />
          ))}
          {description && <span className="rv-ctrl-description">{description}</span>}
        </div>
      )
    }
    case 'status':
      return (
        <ScalarTextControl
          id={controlId}
          control={control}
          value={value == null ? '' : String(value)}
          onChange={() => {}}
        />
      )
    case 'meter': {
      const numeric = typeof value === 'number' ? value : 0
      if (typeof definition.min === 'number' && typeof definition.max === 'number' && definition.max > definition.min) {
        return (
          <div data-cinema2-control-id={definition.id} data-cinema2-control-type={definition.type}>
            <SliderRow
              id={controlId}
              label={definition.label}
              value={numeric}
              min={definition.min}
              max={definition.max}
              step={definition.step ?? 0.01}
              disabled
              description={description || undefined}
              onChange={() => {}}
            />
          </div>
        )
      }
      return (
        <ControlWithDescription control={control}>
          <NumberInputRow id={controlId} label={definition.label} value={numeric} disabled onChange={() => {}} />
        </ControlWithDescription>
      )
    }
  }
}

function ScalarTextControl({
  id,
  control,
  value,
  onChange,
}: {
  id: string
  control: Readonly<Cinema2InspectorControlModel>
  value: string
  onChange: (value: string) => void
}) {
  const description = [control.definition.description, control.disabledReason].filter(Boolean).join(' ')
  return (
    <div className="rv-ctrl-row" data-cinema2-control-id={control.definition.id} data-cinema2-control-type={control.definition.type}>
      <label className="rv-ctrl-label" htmlFor={id}>{control.definition.label}</label>
      <input
        id={id}
        className="rv-ctrl-text-input"
        type="text"
        value={value}
        disabled={!control.enabled}
        onChange={event => onChange(event.target.value)}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      {description && <span id={`${id}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

function ControlWithDescription({
  control,
  children,
}: {
  control: Readonly<Cinema2InspectorControlModel>
  children: React.ReactNode
}) {
  const description = [control.definition.description, control.disabledReason].filter(Boolean).join(' ')
  return (
    <div data-cinema2-control-id={control.definition.id} data-cinema2-control-type={control.definition.type}>
      {children}
      {description && <span className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

function EmptyCinema2Inspector({ copy }: { copy: string }) {
  return (
    <div className="rv-workspace-panel" data-cinema2-inspector="empty">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group"><div className="rv-ctrl-info">{copy}</div></div>
        </div>
      </div>
    </div>
  )
}

function isNumericArray(value: Cinema2JsonValue | undefined, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(component => typeof component === 'number' && Number.isFinite(component))
}

function rgbaToHex(rgba: readonly number[]): string {
  return `#${rgba.slice(0, 3).map(component => Math.round(clamp01(component) * 255).toString(16).padStart(2, '0')).join('')}`
}

function hexToRgba(hex: string, alpha: number): number[] {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map(offset => Number.parseInt(clean.slice(offset, offset + 2), 16) / 255).concat(clamp01(alpha))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1))
}
