import { useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { PaletteColorRow } from '../../ReactControlRows'
import { INITIAL, LIGHTING_ZONES, PALETTE, PATTERN_OPTIONS, TRIGGER_OPTIONS } from '../LayoutLabMarqueeRightWindow'
import { LayoutLabAudioIntelligenceTab } from '../LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from '../LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from '../LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from '../LayoutLabLyricTracksTab'
import { ObField, ObGroup, ObRange, ObSelect, ObSwitch, ObTabs } from './obControls'

export function OptionBInspector() {
  const [tab, setTab] = useState<'presets' | 'design' | 'react' | 'audio' | 'tracks'>('design')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends string | number | boolean>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string
  return <>
    <header className="ob-panel-heading"><div><span className="ob-eyebrow">SHAPE / 02</span><h2>Inspector</h2></div><AppIcon kind="sliders" size={18} /></header>
    <ObTabs options={[{ id: 'presets', label: 'Presets' }, { id: 'design', label: 'Design' }, { id: 'react', label: 'React' }, { id: 'audio', label: 'Audio' }, { id: 'tracks', label: 'Tracks' }]} value={tab} onChange={setTab} label="React right workspace panels" />
    <div className="ob-inspector-content ob-scroll">
      {tab === 'design' ? <div className="ob-design" data-cinema2-inspector="design">
        <div className="ob-inspector-context"><div><small>CINEMA 2.0</small><strong>Marquee</strong></div><span>Engine</span><span aria-disabled="true">Selection</span></div>
        <div data-cinema2-design-parent-groups="master-controls design effects palette">
          <ObGroup title="Master Controls" icon="sliders" index="01">
            <ObRange label="Master Intensity" value={num('masterIntensity')} onChange={set('masterIntensity')} />
            <div className="ob-switch-pair"><ObSwitch label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} /><ObSwitch label="Auto Performance" value={bool('autoPerformance')} onChange={set('autoPerformance')} description="Temporarily chooses build and drop looks without rewriting the authored Pattern or hard controls." /></div>
            <ObRange label="Camera Motion" value={num('cameraMotion')} onChange={set('cameraMotion')} />
          </ObGroup>
          <ObGroup title="Design" icon="grid" index="02">
            <ObGroup title="Pattern" nested><ObSelect label="Pattern" value={text('pattern')} options={PATTERN_OPTIONS} onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))} description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off." /><ObSwitch label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />{bool('patternChange') && <ObSelect label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />}</ObGroup>
            <ObGroup title="Marquee Copy" nested defaultOpen={false}>{[['frontText', 'Front Marquee Text'], ['leftText', 'Left Marquee Text'], ['rightText', 'Right Marquee Text']].map(([id, label]) => <ObField key={id} label={label!} value={text(id!)} onChange={set(id!)} maxLength={32} />)}<ObRange label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} /></ObGroup>
            <ObGroup title="Lighting Zones" nested defaultOpen={false}>{LIGHTING_ZONES.map(([id, label]) => <ObRange key={id} label={label} value={num(id)} onChange={set(id)} />)}</ObGroup>
          </ObGroup>
          <ObGroup title="Effects" icon="fx" index="03">{[['bloom', 'Bloom'], ['haze', 'Haze'], ['reflection', 'Wet Street Reflections'], ['cinematicFinish', 'Cinematic Finish']].map(([id, label]) => <ObRange key={id} label={label!} value={num(id!)} onChange={set(id!)} {...(id === 'haze' ? { max: .03, step: .001, format: (value: number) => value.toFixed(3) } : {})} />)}</ObGroup>
          <ObGroup title="Palette" icon="shape" index="04"><div className="ob-palette">{PALETTE.map(([id, label]) => <div className="ob-palette-slot" key={id}><PaletteColorRow label={label} value={text(id)} onChange={set(id)} /><output>{text(id).toUpperCase()}</output></div>)}</div></ObGroup>
        </div>
      </div> : <div className="ob-adapted">{tab === 'presets' ? <LayoutLabCinema2PresetsTab /> : tab === 'react' ? <LayoutLabCanvasReactTab /> : tab === 'audio' ? <LayoutLabAudioIntelligenceTab /> : <LayoutLabLyricTracksTab />}</div>}
    </div>
    <footer className="ob-panel-foot"><span>Inspector</span><span>{tab.toUpperCase()}</span></footer>
  </>
}
