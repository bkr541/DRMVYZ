import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { useInitLive } from './XyScopeInitLive'
import {
  DEFAULT_INIT_SETTINGS, INIT_BEAM_CONTROLS, INIT_CHANGE_EVERY, INIT_DEFAULTS, INIT_ENDPOINT_CONTROLS, INIT_LAYOUTS, INIT_MASTER_CONTROLS, INIT_REACT_CONTROLS,
  INIT_SCOPE_CONTROLS, INIT_SIGNALS, type InitControlSpec, type InitValues,
} from './XyScopeInitSettings'

function formatControl(spec: InitControlSpec): (value: number) => string {
  switch (spec.format) {
    case 'percent': return value => `${Math.round(value * 100)}%`
    case 'ms': return value => `${Math.round(value)} ms`
    case 'px': return value => `${value.toFixed(2)} px`
    default: return value => value.toFixed(2)
  }
}

/** Values Auto Performance drives; their sliders show the live value and are read-only while it runs. */
const AUTO_DRIVEN = new Set<keyof InitValues>(['intensity', 'waveHeight', 'glow', 'trail', 'glide', 'width'])
const SOURCE_LABELS = { stereo: 'LIVE STEREO', mono: 'LIVE MONO', shared: 'SHARED ANALYSIS', none: 'NO SIGNAL' } as const

/** INIT inspector, under the four standard parent groups: Master Controls, Design, React and Palette. */
export function XyScopeInitDesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const live = useInitLive()
  const o = settings.init
  const auto = o.autoPerformance
  const shown = auto && live ? live.values : o.values
  const patch = (next: Partial<typeof o>) => setSettings({ init: { ...o, ...next } })
  const setValue = (id: keyof InitValues, value: number | string | boolean) => patch({ values: { ...o.values, [id]: value } })

  const slider = (spec: InitControlSpec) => (
    <SliderRow key={spec.id} id={`xyscope-init-${spec.id}`} label={spec.label} value={shown[spec.id]} min={spec.min} max={spec.max} step={spec.step}
      resetValue={INIT_DEFAULTS[spec.id]} formatValue={formatControl(spec)} description={spec.description}
      disabled={auto && AUTO_DRIVEN.has(spec.id)} onChange={value => setValue(spec.id, value)} />
  )
  const kv = (label: string, value: string) => (
    <div className="vz-mi-kv-row" key={label}>
      <span className="vz-mi-kv-label">{label}</span>
      <span className="vz-mi-kv-val vz-mi-kv-val--tag">{value}</span>
    </div>
  )
  const colors = [['color1', 'Oscillator 1 Color'], ['color2', 'Oscillator 2 Color'], ['color3', 'Oscillator 3 Color']] as const

  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-init-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              {INIT_MASTER_CONTROLS.map(slider)}
              <ToggleRow id="xyscope-init-bpm-sync" label="BPM Sync" value={o.bpmSync} onChange={bpmSync => patch({ bpmSync })}
                description="Moves the oscillator lines on the track's beat grid. Off, they follow a free-running clock." />
              <ToggleRow id="xyscope-init-auto" label="Auto Performance" value={auto} onChange={autoPerformance => patch({ autoPerformance })}
                description="Audio intelligence conducts height, glow, decay and line speed together: drops open and brighten the scene, breakdowns calm it. Switching off restores your values." />
              {auto && <>
                {kv('State', live?.state ?? 'LISTENING')}
                {kv('Evidence', `${live?.mapped ? 'TRACK + LIVE' : 'LIVE'} · ${Math.round((live?.confidence ?? 0) * 100)}%`)}
                {kv('Signal', SOURCE_LABELS[live?.source ?? 'none'])}
              </>}
              <ToggleRow id="xyscope-init-hold" label="Hold Trace" value={o.hold} onChange={hold => patch({ hold })} description="Freezes the displayed traces while audio and analysis continue." />
            </div>
          </Collapsible>

          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <SelectRow id="xyscope-init-layout" label="Layout" value={o.values.layout} menuBoundarySelector=".vz-inspector" placement="below"
                options={INIT_LAYOUTS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('layout', value)}
                description="How the oscillators share the screen. Omnidirectional places each one at random, diagonals included." />
              <SelectRow id="xyscope-init-signal" label="Signal" value={o.values.signal} menuBoundarySelector=".vz-inspector" placement="below"
                options={INIT_SIGNALS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('signal', value)}
                description="What each oscillator shows: a frequency band, a stereo channel, or the whole signal at a different zoom." />
              <ToggleRow id="xyscope-init-free-endpoints" label="Free Endpoints" value={o.values.freeEndpoints} onChange={freeEndpoints => setValue('freeEndpoints', freeEndpoints)}
                description="Lets each oscillator start and end somewhere other than a horizontal line, at positions it picks at random. Omnidirectional always does this." />
              <Collapsible label="Scope"><div data-xyscope-subgroup="Scope" style={{ display: 'contents' }}>{INIT_SCOPE_CONTROLS.map(slider)}</div></Collapsible>
              <Collapsible label="Endpoints">
                <div data-xyscope-subgroup="Endpoints" style={{ display: 'contents' }}>
                  <SelectRow id="xyscope-init-change-every" label="Change Every" value={o.values.changeEvery} menuBoundarySelector=".vz-inspector" placement="below"
                    options={INIT_CHANGE_EVERY.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('changeEvery', value)}
                    description="How often random oscillators pick new positions, in beats (the track's with BPM Sync, a steady tempo without)." />
                  {INIT_ENDPOINT_CONTROLS.map(slider)}
                </div>
              </Collapsible>
              <Collapsible label="Beam & Phosphor"><div data-xyscope-subgroup="Beam & Phosphor" style={{ display: 'contents' }}>{INIT_BEAM_CONTROLS.map(slider)}</div></Collapsible>
            </div>
          </Collapsible>

          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              {INIT_REACT_CONTROLS.map(slider)}
              <div className="rv-ctrl-info">Each oscillator draws the live waveform. Kicks thicken the lines and snares flare the glow.</div>
            </div>
          </Collapsible>

          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              {colors.slice(0, o.oscillators).map(([id, label]) => (
                <PaletteColorRow key={id} id={`xyscope-init-${id}`} label={label} value={o.values[id]} onChange={color => setValue(id, color)} description="Colour of this oscillator's trace and glow." />
              ))}
              <PaletteColorRow id="xyscope-init-background" label="Background" value={o.values.backgroundColor} onChange={color => setValue('backgroundColor', color)} description="Colour of the screen behind the traces." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: o.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton disabled={auto} onClick={() => setSettings({ init: { ...DEFAULT_INIT_SETTINGS, oscillators: o.oscillators, resetSignals: o.resetSignals + 1 } })}>Reset INIT</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
