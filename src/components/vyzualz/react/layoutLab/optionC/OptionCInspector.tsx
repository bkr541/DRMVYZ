import { useState } from 'react'
import { PaletteColorRow } from '../../ReactControlRows'
import { INITIAL, LIGHTING_ZONES, PALETTE, PATTERN_OPTIONS, TRIGGER_OPTIONS } from '../LayoutLabMarqueeRightWindow'
import { LayoutLabAudioIntelligenceTab } from '../LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from '../LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from '../LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from '../LayoutLabLyricTracksTab'
import { OcField, OcGroup, OcRange, OcSelect, OcSwitch, OcTabs } from './ocControls'

export function OptionCInspector() {
  const [tab, setTab] = useState<'presets' | 'design' | 'react' | 'audio' | 'tracks'>('design')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends string | number | boolean>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string
  return <>
    <header className="oc-panel-head"><span className="oc-caption">INSPECTOR</span><h2>Shape the feeling.</h2></header>
    <OcTabs options={[{ id: 'presets', label: 'Presets' }, { id: 'design', label: 'Design' }, { id: 'react', label: 'React' }, { id: 'audio', label: 'Audio' }, { id: 'tracks', label: 'Tracks' }]} value={tab} onChange={setTab} label="React right workspace panels" />
    <div className="oc-inspector-content oc-scroll">
      {tab === 'design' ? <div className="oc-design" data-cinema2-inspector="design">
        <div className="oc-inspector-context"><div><span className="oc-caption">CINEMA 2.0</span><strong>Marquee</strong></div><div role="tablist" aria-label="Cinema 2.0 design surfaces"><button role="tab" aria-selected="true" type="button">Engine</button><button role="tab" aria-selected="false" type="button" disabled>Selection</button></div></div>
        <div data-cinema2-design-parent-groups="master-controls design effects palette">
          <OcGroup title="Master Controls" icon="sliders">
            <div className="oc-master-dials"><OcRange dial label="Master Intensity" value={num('masterIntensity')} onChange={set('masterIntensity')} /><OcRange dial label="Camera Motion" value={num('cameraMotion')} onChange={set('cameraMotion')} /></div>
            <div className="oc-switch-pair"><OcSwitch label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} /><OcSwitch label="Auto Performance" value={bool('autoPerformance')} onChange={set('autoPerformance')} description="Chooses build and drop looks; preserves your authored controls." /></div>
          </OcGroup>
          <OcGroup title="Design" icon="grid">
            <OcGroup title="Pattern" nested><OcSelect label="Pattern" value={text('pattern')} options={PATTERN_OPTIONS} onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))} description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off." /><OcSwitch label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />{bool('patternChange') && <OcSelect label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />}</OcGroup>
            <OcGroup title="Marquee Copy" nested defaultOpen={false}>{[['frontText', 'Front Marquee Text'], ['leftText', 'Left Marquee Text'], ['rightText', 'Right Marquee Text']].map(([id, label]) => <OcField key={id} label={label!} value={text(id!)} onChange={set(id!)} maxLength={32} />)}<OcRange label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} /></OcGroup>
            <OcGroup title="Lighting Zones" nested defaultOpen={false}>{LIGHTING_ZONES.map(([id, label]) => <OcRange key={id} label={label} value={num(id)} onChange={set(id)} />)}</OcGroup>
          </OcGroup>
          <OcGroup title="Effects" icon="fx" defaultOpen={false}>{[['bloom', 'Bloom'], ['haze', 'Haze'], ['reflection', 'Wet Street Reflections'], ['cinematicFinish', 'Cinematic Finish']].map(([id, label]) => <OcRange key={id} label={label!} value={num(id!)} onChange={set(id!)} {...(id === 'haze' ? { max: .03, step: .001, format: (value: number) => value.toFixed(3) } : {})} />)}</OcGroup>
          <OcGroup title="Palette" icon="shape" defaultOpen={false}><div className="oc-palette">{PALETTE.map(([id, label]) => <div className="oc-palette-slot" key={id}><PaletteColorRow label={label} value={text(id)} onChange={set(id)} /><output>{text(id).toUpperCase()}</output></div>)}</div></OcGroup>
        </div>
      </div> : <div className="oc-feature">{tab === 'presets' ? <LayoutLabCinema2PresetsTab /> : tab === 'react' ? <LayoutLabCanvasReactTab /> : tab === 'audio' ? <LayoutLabAudioIntelligenceTab /> : <LayoutLabLyricTracksTab />}</div>}
    </div>
    <footer className="oc-panel-foot"><span>Inspector</span><span>{tab.toUpperCase()}</span></footer>
  </>
}
