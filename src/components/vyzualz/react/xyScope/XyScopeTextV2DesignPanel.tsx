import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { DEFAULT_TEXT_V2_SETTINGS, TEXT_V2_STYLES, type XyScopeTextV2Settings } from './XyScopeTextV2Settings'
import { getXyScopeDefaultParameters } from './XyScopeSettings'

/** Compact controls: the performance controller owns the detailed oscillator instrument. */
export function XyScopeTextV2DesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const v2 = settings.textV2
  const p = settings.parameters
  const defaults = getXyScopeDefaultParameters()
  const setV2 = (patch: Partial<XyScopeTextV2Settings>) => setSettings({ textV2: { ...v2, ...patch } })
  const setParameter = (id: string, value: number | string) => setSettings({ parameters: { ...p, [id]: value } })
  const slider = (id: string, label: string, min: number, max: number, step: number, description: string) => (
    <SliderRow id={`xyscope-parameter-${id}`} label={label} value={Number(p[id])} min={min} max={max} step={step}
      resetValue={Number(defaults[id])} formatValue={value => `${Math.round(value * 100)}%`} description={description} onChange={value => setParameter(id, value)} />
  )
  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-text-v2-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              <ToggleRow id="xyscope-v2-auto" label="Auto Performance" value={v2.autoPerformance} onChange={autoPerformance => setV2({ autoPerformance })}
                description="Audio intelligence conducts response styles, geometry, departure and reform, beam, and letter channels together." />
              <SelectRow id="xyscope-v2-grouping" label="Oscillator Grouping" value={v2.grouping} menuBoundarySelector=".vz-inspector" placement="below"
                options={[{ value: 'both', label: 'Both' }, { value: 'word', label: 'Single Word Oscillator' }, { value: 'letters', label: 'Individual Letter Oscillators' }]}
                onChange={grouping => setV2({ grouping: grouping as XyScopeTextV2Settings['grouping'] })}
                description="Both combines one coherent word signal with independently phased letter responses." />
              {slider('intensity', 'Master Intensity', 0, 2, .01, 'Sets overall brightness while Auto Performance shapes beam accents.')}
            </div>
          </Collapsible>
          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <SliderRow id="xyscope-v2-abstraction" label="Abstraction" value={v2.abstraction} min={0} max={1} step={.01} resetValue={.35}
                formatValue={value => `${Math.round(value * 100)}%`} onChange={abstraction => setV2({ abstraction })}
                description="Sets the maximum departure from the lettering. Continuous contours and protected passes prevent a random line cloud." />
              {slider('size', 'Text Size', .3, 1, .01, 'How much of the stage the text fills.')}
              {slider('letterSpacing', 'Letter Spacing', -.05, .3, .002, 'Space between the original letter contours.')}
            </div>
          </Collapsible>
          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              <SliderRow id="xyscope-v2-response" label="Audio Response" value={v2.response} min={0} max={1.5} step={.01} resetValue={1}
                formatValue={value => `${Math.round(value * 100)}%`} onChange={response => setV2({ response })}
                description="Scales the real audio response. Zero settles the contours; music changes select new words without a timer." />
              {!v2.autoPerformance && <SelectRow id="xyscope-v2-style" label="Response Style" value={v2.manualStyle} menuBoundarySelector=".vz-inspector" placement="below"
                options={[...TEXT_V2_STYLES]} onChange={manualStyle => setV2({ manualStyle: manualStyle as XyScopeTextV2Settings['manualStyle'] })}
                description="Choose a manual audio-reactive style. Auto Performance restores its own coordinated control when enabled." />}
              <div className="rv-ctrl-info">Word changes follow confident phrase, section, drop, or significant energy changes. Pausing holds the current word.</div>
            </div>
          </Collapsible>
          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              {(['beamColor', 'glowColor', 'backgroundColor'] as const).map((id, index) => <PaletteColorRow key={id} id={`xyscope-parameter-${id}`}
                label={['Beam Core', 'Beam Glow', 'Background'][index]} value={String(p[id])} onChange={value => setParameter(id, value)}
                description={id === 'backgroundColor' ? 'The screen behind the beam.' : 'Auto Performance blends accents within your chosen beam colors.'} />)}
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => setSettings({ textV2: { ...DEFAULT_TEXT_V2_SETTINGS } })}>Reset Performance</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
