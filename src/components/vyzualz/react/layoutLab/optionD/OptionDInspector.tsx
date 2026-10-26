import { useState } from 'react'
import { PaletteColorRow } from '../../ReactControlRows'
import { INITIAL, LIGHTING_ZONES, PALETTE, PATTERN_OPTIONS, TRIGGER_OPTIONS } from '../LayoutLabMarqueeRightWindow'
import { LayoutLabAudioIntelligenceTab } from '../LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from '../LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from '../LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from '../LayoutLabLyricTracksTab'
import { OdField, OdGroup, OdLabel, OdRange, OdSegmented, OdSelect, OdSwitch } from './odControls'

type Tab = 'presets' | 'design' | 'react' | 'audio' | 'tracks'

export function OptionDInspector() {
  const [tab, setTab] = useState<Tab>('design')
  const [surface, setSurface] = useState<'engine' | 'selection'>('engine')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends string | number | boolean>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string
  return <>
    <OdLabel>Inspector</OdLabel>
    <OdSegmented className="od-seg--tabs" options={[{ id: 'presets', label: 'Presets' }, { id: 'design', label: 'Design' }, { id: 'react', label: 'React' }, { id: 'audio', label: 'Audio' }, { id: 'tracks', label: 'Tracks' }]} value={tab} onChange={setTab} label="React right workspace panels" />
    <div className="od-inspector-content od-scroll">
      {tab === 'design' ? <div className="od-design" data-cinema2-inspector="design">
        <div className="od-context"><div><small>CINEMA 2.0</small><strong>Marquee</strong></div><OdSegmented className="od-seg--mini" label="Cinema 2.0 design surfaces" value={surface} onChange={setSurface} options={[{ id: 'engine', label: 'Engine' }, { id: 'selection', label: 'Selection', disabled: true }]} /></div>
        <div data-cinema2-design-parent-groups="master-controls design effects palette">
          <OdGroup title="Master Controls" icon="sliders">
            <div className="od-bento">
              <OdRange readout label="Master Intensity" value={num('masterIntensity')} onChange={set('masterIntensity')} />
              <OdRange readout label="Camera Motion" value={num('cameraMotion')} onChange={set('cameraMotion')} />
              <OdSwitch tile icon="sync" label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} />
              <OdSwitch tile icon="fx" label="Auto Performance" value={bool('autoPerformance')} onChange={set('autoPerformance')} description="Chooses build and drop looks; preserves your authored controls." />
            </div>
          </OdGroup>
          <OdGroup title="Design" icon="grid">
            <OdGroup title="Pattern" nested>
              <OdSelect label="Pattern" value={text('pattern')} options={PATTERN_OPTIONS} onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))} description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off." />
              <OdSwitch label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />
              {bool('patternChange') && <OdSelect label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />}
            </OdGroup>
            <OdGroup title="Marquee Copy" nested defaultOpen={false}>
              {[['frontText', 'Front Marquee Text'], ['leftText', 'Left Marquee Text'], ['rightText', 'Right Marquee Text']].map(([id, label]) => <OdField key={id} label={label!} value={text(id!)} onChange={set(id!)} maxLength={32} />)}
              <OdRange label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} />
            </OdGroup>
            <OdGroup title="Lighting Zones" nested defaultOpen={false}>{LIGHTING_ZONES.map(([id, label]) => <OdRange key={id} label={label} value={num(id)} onChange={set(id)} />)}</OdGroup>
          </OdGroup>
          <OdGroup title="Effects" icon="fx" defaultOpen={false}>
            {[['bloom', 'Bloom'], ['haze', 'Haze'], ['reflection', 'Wet Street Reflections'], ['cinematicFinish', 'Cinematic Finish']].map(([id, label]) => <OdRange key={id} label={label!} value={num(id!)} onChange={set(id!)} {...(id === 'haze' ? { max: .03, step: .001, format: (value: number) => value.toFixed(3) } : {})} />)}
          </OdGroup>
          <OdGroup title="Palette" icon="shape" defaultOpen={false}>
            <div className="od-palette">{PALETTE.map(([id, label]) => <div className="od-palette-slot" key={id}><PaletteColorRow label={label} value={text(id)} onChange={set(id)} /><output>{text(id).toUpperCase()}</output></div>)}</div>
          </OdGroup>
        </div>
      </div> : <div className="od-feature">{tab === 'presets' ? <LayoutLabCinema2PresetsTab /> : tab === 'react' ? <LayoutLabCanvasReactTab /> : tab === 'audio' ? <LayoutLabAudioIntelligenceTab /> : <LayoutLabLyricTracksTab />}</div>}
    </div>
  </>
}
