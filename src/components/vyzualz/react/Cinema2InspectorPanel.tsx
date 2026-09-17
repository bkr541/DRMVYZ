import { useMemo, useRef, useState } from 'react'
import {
  createCinema2InspectorModel,
  type Cinema2InspectorControlModel,
  type Cinema2InspectorEntryModel,
  type Cinema2InspectorGroupModel,
  type Cinema2InspectorInstanceModel,
  type Cinema2InspectorSurface,
} from '../cinema2/parameters/Cinema2InspectorModel'
import type { Cinema2JsonValue } from '../cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { PanelSubtabs } from './PanelSubtabs'
import { ReactAudioPanel } from './ReactAudioPanel'

export interface Cinema2InspectorPanelProps {
  runtime: Cinema2Runtime | null
  surface: Cinema2InspectorSurface
}

// Design's ENGINE/SELECTION split and React's PERFORMANCE/ANALYSIS split
// mirror the nested PanelSubtabs every other engine's Design/React tab
// already uses (see ReactDesignWorkspacePanel/ReactReactivityWorkspacePanel
// in panels/ReactWorkspacePanels.tsx) — Cinema2InspectorModel's `surface`
// stays a plain 'design' | 'react' split; these sub-tabs are presentation
// only. SELECTION has no content yet: Cinema 2.0 has no per-object
// selection model (Cinema2LayersPanel, the only "layer" UI that exists, is
// read-only/disabled and lives in its own left-rail Layers tab, unrelated
// to this), so it stays permanently disabled until that feature exists.
type Cinema2DesignSurface = 'engine' | 'selection'
type Cinema2ReactSurface = 'performance' | 'analysis'

export function Cinema2InspectorPanel({ runtime, surface }: Cinema2InspectorPanelProps) {
  const [, setRevision] = useState(0)
  const actionSequence = useRef(0)
  const [designSurface, setDesignSurface] = useState<Cinema2DesignSurface>('engine')
  const [reactSurface, setReactSurface] = useState<Cinema2ReactSurface>('performance')
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

  // Core and Shrapnel are pulled out of the flat "Design" section listing so
  // they can render nested inside Master Controls > Design instead, Palette
  // is pulled out to render nested inside Master Controls > Palette (with
  // PaletteColorRow styling, see Cinema2PaletteColorGroup), and Feedback and
  // Bloom are pulled out of the flat "Effects" section listing to render
  // degrouped (flat, no Feedback/Bloom sub-headers) inside Master Controls >
  // Effects — see the designSurface === 'engine' branch below.
  const masterControlsDesignEntries: Cinema2InspectorEntryModel[] = []
  let masterControlsPaletteGroup: Cinema2InspectorGroupModel | null = null
  const masterControlsEffectsControls: Cinema2InspectorControlModel[] = []
  // Reactivity and Build Contraction are re-authored onto the "Design"
  // section (they used to live under "React" > Response) specifically so
  // they land in this same sections computation and can be pulled straight
  // into Master Controls' own body, flat — not nested under a "Response"
  // sub-header, since only the parameters were asked to move, not the group.
  const masterControlsRootControls: Cinema2InspectorControlModel[] = []
  // Afterhours 2.0's Background color is authored at the top of Design >
  // Color (see CINEMA2_AFTERHOURS_BACKGROUND_ID's order:10 in
  // Cinema2AfterhoursPreset), but it must also be referenced from the
  // preset's `environment.controls` so Cinema2TargetRuntime can drive the
  // live background render target from it — that reference is what makes
  // Cinema2InspectorModel pull it into its own single-control "Environment"
  // section instead. Fold that control back into Color here (UI only, the
  // runtime binding is untouched) and drop the now-empty Environment
  // section from the render entirely.
  const environmentSection = sections.find(section => section.label === 'Environment')
  const environmentInstance = environmentSection?.groups.find(
    (entry): entry is Cinema2InspectorInstanceModel => entry.kind === 'instance',
  )
  const environmentControls = environmentInstance?.controls ?? []
  const visibleSections = environmentSection
    ? sections.filter(section => section.label !== 'Environment')
    : sections
  const sectionsContent = visibleSections.length === 0
    ? <div className="rv-ctrl-group"><div className="rv-ctrl-info">No Cinema 2.0 parameters are declared for this workspace.</div></div>
    : (
      <>
        {visibleSections.map(section => {
          const visibleGroups = section.label === 'Design'
            ? section.groups
                .map(entry => (
                  entry.kind === 'group' && entry.label === 'Color' && environmentControls.length > 0
                    ? { ...entry, controls: [...environmentControls, ...entry.controls] }
                    : entry
                ))
                .filter(entry => {
                  if (entry.kind !== 'group') return true
                  if (entry.label === 'Core' || entry.label === 'Shrapnel' || entry.label === 'Composite') {
                    masterControlsDesignEntries.push(entry)
                    return false
                  }
                  if (entry.label === 'Palette') {
                    masterControlsPaletteGroup = entry
                    return false
                  }
                  if (entry.label === 'Response') {
                    masterControlsRootControls.push(...entry.controls)
                    return false
                  }
                  return true
                })
            : section.label === 'Effects'
              ? section.groups.filter(entry => {
                  // Feedback and Bloom are authored as effect instances (bound
                  // via the preset's `effects` array), not plain parameter
                  // groups, so they arrive here as kind:'instance' entries —
                  // unlike Core/Shrapnel/Palette above, which are plain
                  // module-bound groups. Match by label regardless of kind.
                  // Their controls are flattened (degrouped) rather than
                  // re-wrapped in their own Feedback/Bloom sub-collapsible,
                  // so they read as plain controls directly under Effects.
                  if (entry.label === 'Feedback' || entry.label === 'Bloom') {
                    masterControlsEffectsControls.push(...entry.controls)
                    return false
                  }
                  return true
                })
              : section.label === 'Advanced'
                ? section.groups.filter(entry => {
                    // Quality / Performance is a rendering-cost control, not a
                    // visual-design one — it now lives in the OUTPUT tab
                    // (Cinema2RuntimeDiagnostics) instead of Design.
                    if (entry.label === 'Performance') return false
                    return true
                  })
                : section.groups
          if (visibleGroups.length === 0) return null
          return (
            <div className="rv-ctrl-group" key={section.label} data-cinema2-section={section.label}>
              <CtrlSection label={section.label} />
              {visibleGroups.map((entry, entryIndex) => (
                <Cinema2InspectorEntry
                  key={entry.kind === 'instance' ? `${entry.instanceKind}:${entry.instanceId}` : entry.label ?? `ungrouped-${entryIndex}`}
                  entry={entry}
                  onChange={commit}
                  onTrigger={dispatch}
                />
              ))}
            </div>
          )
        })}
      </>
    )

  const resetParametersButton = hasResettablePersistentValue && (
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
  )

  if (surface === 'design') {
    return (
      <div className="rv-workspace-panel" data-cinema2-inspector={surface}>
        <PanelSubtabs
          value={designSurface}
          onChange={setDesignSurface}
          ariaLabel="Cinema 2.0 design surfaces"
          options={[
            { id: 'engine', label: 'ENGINE' },
            { id: 'selection', label: 'SELECTION', disabled: true },
          ]}
        />
        <div className="rv-workspace-panel-body">
          <div className="rv-inspector rv-inspector-scroll">
            {designSurface === 'engine' ? (
              <>
                {sectionsContent}
                <div className="rv-ctrl-group" data-cinema2-placeholder-group="master-controls">
                  <Collapsible label="Master Controls">
                    {masterControlsRootControls.length === 0 ? (
                      <div className="rv-ctrl-info">No controls yet.</div>
                    ) : (
                      <Cinema2InspectorControls
                        controls={masterControlsRootControls}
                        onChange={commit}
                        onTrigger={dispatch}
                      />
                    )}
                  </Collapsible>
                  <Collapsible label="Design">
                    {masterControlsDesignEntries.length === 0 ? (
                      <div className="rv-ctrl-info">No controls yet.</div>
                    ) : (
                      masterControlsDesignEntries.map((entry, entryIndex) => (
                        <Cinema2InspectorEntry
                          key={entry.kind === 'instance' ? `${entry.instanceKind}:${entry.instanceId}` : entry.label ?? `ungrouped-${entryIndex}`}
                          entry={entry}
                          onChange={commit}
                          onTrigger={dispatch}
                        />
                      ))
                    )}
                  </Collapsible>
                  <Collapsible label="Effects">
                    {masterControlsEffectsControls.length === 0 ? (
                      <div className="rv-ctrl-info">No controls yet.</div>
                    ) : (
                      <Cinema2InspectorControls
                        controls={masterControlsEffectsControls}
                        onChange={commit}
                        onTrigger={dispatch}
                      />
                    )}
                  </Collapsible>
                  <Collapsible label="Palette" bodyClassName="rv-cinema2-palette-body">
                    {masterControlsPaletteGroup == null ? (
                      <div className="rv-ctrl-info">No controls yet.</div>
                    ) : (
                      <Cinema2PaletteColorGroup group={masterControlsPaletteGroup} onChange={commit} />
                    )}
                  </Collapsible>
                </div>
                {resetParametersButton}
              </>
            ) : (
              <div className="rv-ctrl-group"><div className="rv-ctrl-info">Select an object in the scene to edit its properties here.</div></div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rv-workspace-panel" data-cinema2-inspector={surface}>
      <PanelSubtabs
        value={reactSurface}
        onChange={setReactSurface}
        ariaLabel="Cinema 2.0 reactivity surfaces"
        options={[
          { id: 'performance', label: 'PERFORMANCE' },
          { id: 'analysis', label: 'ANALYSIS' },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {reactSurface === 'performance' ? (
            <>
              {sectionsContent}
              <div className="rv-ctrl-group" data-cinema2-placeholder-group="reactive-controls">
                <Collapsible label="Reactive Controls">
                  <div className="rv-ctrl-info">No controls yet.</div>
                </Collapsible>
              </div>
            </>
          ) : <ReactAudioPanel />}
        </div>
      </div>
    </div>
  )
}

function Cinema2InspectorEntry({
  entry,
  onChange,
  onTrigger,
}: {
  entry: Readonly<Cinema2InspectorEntryModel>
  onChange: (control: Readonly<Cinema2InspectorControlModel>, value: Cinema2JsonValue) => void
  onTrigger: (control: Readonly<Cinema2InspectorControlModel>) => void
}) {
  if (entry.kind === 'instance') {
    return (
      <Cinema2InspectorInstance
        instance={entry}
        onChange={onChange}
        onTrigger={onTrigger}
      />
    )
  }
  return (
    <Cinema2InspectorGroup
      group={entry}
      onChange={onChange}
      onTrigger={onTrigger}
    />
  )
}

function Cinema2InspectorInstance({
  instance,
  onChange,
  onTrigger,
}: {
  instance: Readonly<Cinema2InspectorInstanceModel>
  onChange: (control: Readonly<Cinema2InspectorControlModel>, value: Cinema2JsonValue) => void
  onTrigger: (control: Readonly<Cinema2InspectorControlModel>) => void
}) {
  const singleGroup = instance.groups.length === 1 ? instance.groups[0] : null
  const canInlineSingleGroup = singleGroup != null && (singleGroup.label == null || singleGroup.label === instance.label)

  return (
    <div
      data-cinema2-instance-kind={instance.instanceKind}
      data-cinema2-instance-id={instance.instanceId}
    >
      <Collapsible label={instance.label}>
        {canInlineSingleGroup && singleGroup ? (
          <Cinema2InspectorControls
            controls={singleGroup.controls}
            onChange={onChange}
            onTrigger={onTrigger}
          />
        ) : instance.groups.map((group, groupIndex) => (
          <Cinema2InspectorGroup
            key={group.label ?? `ungrouped-${groupIndex}`}
            group={group}
            onChange={onChange}
            onTrigger={onTrigger}
          />
        ))}
      </Collapsible>
    </div>
  )
}

function Cinema2InspectorGroup({
  group,
  onChange,
  onTrigger,
}: {
  group: Readonly<Cinema2InspectorGroupModel>
  onChange: (control: Readonly<Cinema2InspectorControlModel>, value: Cinema2JsonValue) => void
  onTrigger: (control: Readonly<Cinema2InspectorControlModel>) => void
}) {
  if (!group.label) {
    return <Cinema2InspectorControls controls={group.controls} onChange={onChange} onTrigger={onTrigger} />
  }
  // Afterhours 2.0's Design > Color group uses the same PaletteColorRow
  // treatment as Master Controls > Palette — see Cinema2PaletteColorGroup.
  const body = group.label === 'Color'
    ? <Cinema2PaletteColorGroup group={group} onChange={onChange} onTrigger={onTrigger} />
    : <Cinema2InspectorControls controls={group.controls} onChange={onChange} onTrigger={onTrigger} />
  return (
    <Collapsible label={group.label}>
      {body}
    </Collapsible>
  )
}

/**
 * Renders a group's `color`-type controls with Layout Lab / Template's
 * "01 · Palette Group - ReactControlRows.tsx" treatment (PaletteColorRow):
 * a collapsed swatch-dot + label + caret row that expands in place into a
 * saturation/lightness gradient square, hue strip, and hex field — instead
 * of the generic ColorRow native-picker-plus-hex-readout used elsewhere.
 * Non-color controls in the group (e.g. Afterhours' Color Mode enum,
 * Accent Mix float) fall through to the standard Cinema2SchemaControl
 * dispatch unchanged. Used for Master Controls > Palette (all-color) and
 * Afterhours 2.0's Design > Color group (mixed); every other `color`
 * control in the app keeps ColorRow.
 */
function Cinema2PaletteColorGroup({
  group,
  onChange,
  onTrigger,
}: {
  group: Readonly<Cinema2InspectorGroupModel>
  onChange: (control: Readonly<Cinema2InspectorControlModel>, value: Cinema2JsonValue) => void
  onTrigger?: (control: Readonly<Cinema2InspectorControlModel>) => void
}) {
  return (
    <>
      {group.controls.map(control => {
        if (control.definition.type !== 'color') {
          return (
            <Cinema2SchemaControl
              key={control.definition.id}
              control={control}
              onChange={candidate => onChange(control, candidate)}
              onTrigger={() => onTrigger?.(control)}
            />
          )
        }
        const { definition, value, enabled, disabledReason } = control
        const rgba = isNumericArray(value, 4) ? value : [1, 1, 1, 1]
        const description = [definition.description, disabledReason].filter(Boolean).join(' ')
        return (
          <PaletteColorRow
            key={definition.id}
            id={`cinema2-parameter-${definition.id}`}
            label={definition.label}
            value={rgbaToHex(rgba)}
            disabled={!enabled}
            description={description || undefined}
            onChange={hex => onChange(control, hexToRgba(hex, rgba[3]))}
          />
        )
      })}
    </>
  )
}

function Cinema2InspectorControls({
  controls,
  onChange,
  onTrigger,
}: {
  controls: readonly Readonly<Cinema2InspectorControlModel>[]
  onChange: (control: Readonly<Cinema2InspectorControlModel>, value: Cinema2JsonValue) => void
  onTrigger: (control: Readonly<Cinema2InspectorControlModel>) => void
}) {
  return (
    <>
      {controls.map(control => (
        <Cinema2SchemaControl
          key={control.definition.id}
          control={control}
          onChange={candidate => onChange(control, candidate)}
          onTrigger={() => onTrigger(control)}
        />
      ))}
    </>
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
              resetValue={typeof definition.defaultValue === 'number' ? definition.defaultValue : undefined}
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
