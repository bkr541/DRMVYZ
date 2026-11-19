import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { DEFAULT_PHASE_PORTAL_SETTINGS, PHASE_PORTAL_RANGES, type XyScopePhasePortalSettings } from './XyScopePhasePortalSettings'

export function XyScopePhasePortalDesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings.phasePortal)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const patch = (next: Partial<XyScopePhasePortalSettings>) => setSettings({ phasePortal: { ...settings, ...next } })
  const defaults = DEFAULT_PHASE_PORTAL_SETTINGS.values
  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-phase-portal-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design effects palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              <ToggleRow id="xyscope-phase-portal-bpm-sync" label="BPM Sync" value={settings.bpmSync}
                onChange={bpmSync => patch({ bpmSync })} description="Times the continuous beam scan to the track tempo." />
              <ToggleRow id="xyscope-phase-portal-auto" label="Auto Performance" value={settings.autoPerformance}
                onChange={autoPerformance => patch({ autoPerformance })} description="Accents the moving beam on kicks and bar starts." />
              <ToggleRow id="xyscope-phase-portal-grid" label="Graticule" value={settings.grid}
                onChange={grid => patch({ grid })} description="Shows the zero axes and equal divisions on the scope." />
              <ToggleRow id="xyscope-phase-portal-hold" label="Hold Trace" value={settings.hold}
                onChange={hold => patch({ hold })} description="Shows and freezes the measured stereo trace for inspection." />
            </div>
          </Collapsible>
          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <SliderRow id="xyscope-phase-portal-gain" label="XY Gain" value={settings.values.gain}
                min={PHASE_PORTAL_RANGES.gain[0]} max={PHASE_PORTAL_RANGES.gain[1]} step={.1} resetValue={defaults.gain}
                formatValue={value => `${value.toFixed(1)}×`} description="Scales the raw XY trace and the stereo deflection of the lettering beam."
                onChange={gain => patch({ values: { ...settings.values, gain } })} />
              <SliderRow id="xyscope-phase-portal-intensity" label="Trace Intensity" value={settings.values.intensity}
                min={PHASE_PORTAL_RANGES.intensity[0]} max={PHASE_PORTAL_RANGES.intensity[1]} step={1} resetValue={defaults.intensity}
                formatValue={value => `${Math.round(value)}%`} description="Controls the brightness of the XY beam."
                onChange={intensity => patch({ values: { ...settings.values, intensity } })} />
              <SliderRow id="xyscope-phase-portal-text-size" label="Text Size" value={settings.values.textSize}
                min={PHASE_PORTAL_RANGES.textSize[0]} max={PHASE_PORTAL_RANGES.textSize[1]} step={.01} resetValue={defaults.textSize}
                formatValue={value => `${Math.round(value * 100)}%`} description="Fits your text inside the center of the XY display."
                onChange={textSize => patch({ values: { ...settings.values, textSize } })} />
            </div>
          </Collapsible>
          <Collapsible label="Effects" icon={<AppIcon kind="fx" size={15} />}>
            <div data-xyscope-parent-group="effects" style={{ display: 'contents' }}>
              <SliderRow id="xyscope-phase-portal-trace-coupling" label="Trace Coupling" value={settings.values.traceCoupling}
                min={PHASE_PORTAL_RANGES.traceCoupling[0]} max={PHASE_PORTAL_RANGES.traceCoupling[1]} step={.01} resetValue={defaults.traceCoupling}
                description="Controls how strongly live left and right samples deflect the beam along X and Y."
                onChange={traceCoupling => patch({ values: { ...settings.values, traceCoupling } })} />
              <SliderRow id="xyscope-phase-portal-sweep-speed" label="Sweep Speed" value={settings.values.sweepSpeed}
                min={PHASE_PORTAL_RANGES.sweepSpeed[0]} max={PHASE_PORTAL_RANGES.sweepSpeed[1]} step={.05} resetValue={defaults.sweepSpeed}
                formatValue={value => `${value.toFixed(2)}×`} description="Changes how quickly the beam travels around the lettering."
                onChange={sweepSpeed => patch({ values: { ...settings.values, sweepSpeed } })} />
            </div>
          </Collapsible>
          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              <PaletteColorRow id="xyscope-phase-portal-color" label="Phosphor Color" value={settings.values.color}
                onChange={color => patch({ values: { ...settings.values, color } })}
                description="Sets the trace color and the lettering glow." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: settings.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton onClick={() => patch({ ...DEFAULT_PHASE_PORTAL_SETTINGS, resetSignals: settings.resetSignals + 1 })}>Reset Phase Portal</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
