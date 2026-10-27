import { useState } from 'react'
import { PaletteColorRow } from '../../ReactControlRows'
import { INITIAL, LIGHTING_ZONES, PALETTE, PATTERN_OPTIONS, TRIGGER_OPTIONS } from '../LayoutLabMarqueeRightWindow'
import { LayoutLabAudioIntelligenceTab } from '../LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from '../LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from '../LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from '../LayoutLabLyricTracksTab'
import { OfField, OfGroup, OfIdentity, OfPanelHead, OfRange, OfSegmented, OfSelect, OfSwitch } from './ofControls'

type Tab = 'presets' | 'design' | 'react' | 'audio' | 'tracks'

export function OptionFInspector() {
  const [tab, setTab] = useState<Tab>('design')
  const [surface, setSurface] = useState<'engine' | 'selection'>('engine')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends string | number | boolean>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string
  return <>
    <OfPanelHead icon="sliders" title="Inspector" subtitle="Properties" />
    <OfSegmented className="of-seg--tabs" options={[{ id: 'presets', label: 'Presets' }, { id: 'design', label: 'Design' }, { id: 'react', label: 'React' }, { id: 'audio', label: 'Audio' }, { id: 'tracks', label: 'Tracks' }]} value={tab} onChange={setTab} label="React right workspace panels" />
    <div className="of-inspector-content of-scroll">
      {tab === 'design' ? <div className="of-design" data-cinema2-inspector="design">
        <div className="of-context"><OfIdentity icon="cinema" title="Marquee" subtitle="Cinema 2.0" /><OfSegmented className="of-seg--mini" label="Cinema 2.0 design surfaces" value={surface} onChange={setSurface} options={[{ id: 'engine', label: 'Engine' }, { id: 'selection', label: 'Selection', disabled: true }]} /></div>
        <div data-cinema2-design-parent-groups="master-controls design effects palette">
          <OfGroup title="Master Controls" icon="sliders">
            <OfRange label="Master Intensity" value={num('masterIntensity')} onChange={set('masterIntensity')} />
            <OfRange label="Camera Motion" value={num('cameraMotion')} onChange={set('cameraMotion')} />
            <OfSwitch label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} />
            <OfSwitch label="Auto Performance" value={bool('autoPerformance')} onChange={set('autoPerformance')} description="Chooses build and drop looks; preserves your authored controls." />
          </OfGroup>
          <OfGroup title="Design" icon="grid">
            <OfGroup title="Pattern" nested>
              <OfSelect label="Pattern" value={text('pattern')} options={PATTERN_OPTIONS} onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))} description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off." />
              <OfSwitch label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />
              {bool('patternChange') && <OfSelect label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />}
            </OfGroup>
            <OfGroup title="Marquee Copy" nested defaultOpen={false}>
              {[['frontText', 'Front Marquee Text'], ['leftText', 'Left Marquee Text'], ['rightText', 'Right Marquee Text']].map(([id, label]) => <OfField key={id} label={label!} value={text(id!)} onChange={set(id!)} maxLength={32} />)}
              <OfRange label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} />
            </OfGroup>
            <OfGroup title="Lighting Zones" nested defaultOpen={false}>{LIGHTING_ZONES.map(([id, label]) => <OfRange key={id} label={label} value={num(id)} onChange={set(id)} />)}</OfGroup>
          </OfGroup>
          <OfGroup title="Effects" icon="fx" defaultOpen={false}>
            {[['bloom', 'Bloom'], ['haze', 'Haze'], ['reflection', 'Wet Street Reflections'], ['cinematicFinish', 'Cinematic Finish']].map(([id, label]) => <OfRange key={id} label={label!} value={num(id!)} onChange={set(id!)} {...(id === 'haze' ? { max: .03, step: .001, format: (value: number) => value.toFixed(3) } : {})} />)}
          </OfGroup>
          <OfGroup title="Palette" icon="shape" defaultOpen={false}>
            <div className="of-palette">{PALETTE.map(([id, label]) => <div className="of-palette-slot" key={id}><PaletteColorRow label={label} value={text(id)} onChange={set(id)} /><output>{text(id).toUpperCase()}</output></div>)}</div>
          </OfGroup>
        </div>
      </div> : <div className="of-feature">{tab === 'presets' ? <LayoutLabCinema2PresetsTab /> : tab === 'react' ? <LayoutLabCanvasReactTab /> : tab === 'audio' ? <LayoutLabAudioIntelligenceTab /> : <LayoutLabLyricTracksTab />}</div>}
    </div>
  </>
}
