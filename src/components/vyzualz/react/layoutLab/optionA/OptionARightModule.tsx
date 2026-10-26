import { useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { LayoutLabAudioIntelligenceTab } from '../LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from '../LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from '../LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from '../LayoutLabLyricTracksTab'
import { INITIAL, LIGHTING_ZONES, PALETTE, PATTERN_OPTIONS, TRIGGER_OPTIONS } from '../LayoutLabMarqueeRightWindow'
import { OaBank, OaField, OaFader, OaGroup, OaKnob, OaSegments, OaSelect, OaSwatch, OaSwitch } from './oaControls'

// ── Option A · right module (Inspector) ────────────────────────────────────────────────────────────────────────
//
// The Inspector, rebuilt. DESIGN is Option A's own construction end to end: Master Controls are two knobs and two LED
// switches, Pattern is a select, a switch and (when Pattern Change is on) a trigger select, the marquee copy is three
// inset fields over a fader, the six lighting zones are faders, Effects are a knob grid, and Palette is a column of
// swatches. Every row has the same label, range, default and description the production MARQUEE manifest gives it, on the
// same local state. PRESETS, REACT, AUDIO and TRACKS wrap production's own tab bodies (large, store-shaped surfaces)
// inside Option A's module and are skinned by optionAWrapped.css; the audit in the hand-off lists them as wrapped.

type RightTab = 'presets' | 'design' | 'react' | 'audio' | 'tracks'
const RIGHT_TABS = [
  { id: 'presets', label: 'Presets' },
  { id: 'design', label: 'Design' },
  { id: 'react', label: 'React' },
  { id: 'audio', label: 'Audio' },
  { id: 'tracks', label: 'Tracks' },
] as const

const SURFACES = [{ id: 'engine', label: 'Engine' }, { id: 'selection', label: 'Selection' }] as const

export function OptionARightModule() {
  const [tab, setTab] = useState<RightTab>('design')
  const [surface, setSurface] = useState<'engine' | 'selection'>('engine')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends number | boolean | string>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string
  const initial = (key: string) => INITIAL[key] as number
  const percent = (value: number) => `${Math.round(value * 100)}`

  return (
    <>
      <header className="oa-window-head">
        <span className="oa-window-head__kicker">Cinema 2.0 · MARQUEE</span>
        <h2 className="oa-window-head__title">Inspector</h2>
        <AppIcon kind="settings" size={16} className="oa-window-head__icon" aria-hidden="true" />
      </header>

      <OaBank items={RIGHT_TABS} value={tab} onChange={setTab} ariaLabel="React right workspace panels" />

      <div className="oa-module__body">
        {tab === 'design' ? (
          <div data-cinema2-inspector="design" className="oa-design">
            <OaSegments
              items={SURFACES}
              value={surface}
              onChange={next => { if (next === 'engine') setSurface(next) }}
              ariaLabel="Cinema 2.0 design surfaces"
            />

            <div className="oa-stack" data-cinema2-design-parent-groups="master-controls design effects palette">
              <OaGroup label="Master Controls">
                <div className="oa-knobs oa-knobs--pair">
                  <OaKnob label="Master Intensity" size="lg" value={num('masterIntensity')} defaultValue={initial('masterIntensity')} onChange={set('masterIntensity')} format={value => `${percent(value)}%`} />
                  <OaKnob label="Camera Motion" size="lg" tone="ice" value={num('cameraMotion')} defaultValue={initial('cameraMotion')} onChange={set('cameraMotion')} format={value => `${percent(value)}%`} />
                </div>
                <OaSwitch label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} />
                <OaSwitch
                  label="Auto Performance"
                  description="Temporarily chooses build and drop looks without rewriting the authored Pattern or hard controls."
                  value={bool('autoPerformance')}
                  onChange={set('autoPerformance')}
                />
              </OaGroup>

              <OaGroup label="Design">
                <OaGroup label="Pattern" nested>
                  <OaSelect
                    label="Pattern"
                    value={text('pattern')}
                    options={PATTERN_OPTIONS}
                    description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off."
                    onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))}
                  />
                  <OaSwitch label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />
                  {bool('patternChange') && <OaSelect label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />}
                </OaGroup>
                <OaGroup label="Marquee Copy" nested>
                  <OaField label="Front Marquee Text" value={text('frontText')} onChange={set('frontText')} maxLength={32} />
                  <OaField label="Left Marquee Text" value={text('leftText')} onChange={set('leftText')} maxLength={32} />
                  <OaField label="Right Marquee Text" value={text('rightText')} onChange={set('rightText')} maxLength={32} />
                  <OaFader label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} />
                </OaGroup>
                <OaGroup label="Lighting Zones" nested>
                  {LIGHTING_ZONES.map(([id, label]) => <OaFader key={id} label={label} value={num(id)} onChange={set(id)} />)}
                </OaGroup>
              </OaGroup>

              <OaGroup label="Effects">
                <div className="oa-knobs oa-knobs--grid">
                  <OaKnob label="Bloom" value={num('bloom')} defaultValue={initial('bloom')} onChange={set('bloom')} format={value => `${percent(value)}%`} />
                  <OaKnob label="Haze" value={num('haze')} min={0} max={0.03} step={0.001} defaultValue={initial('haze')} onChange={set('haze')} format={value => value.toFixed(3)} tone="ice" />
                  <OaKnob label="Wet Street Reflections" value={num('reflection')} defaultValue={initial('reflection')} onChange={set('reflection')} format={value => `${percent(value)}%`} />
                  <OaKnob label="Cinematic Finish" value={num('cinematicFinish')} defaultValue={initial('cinematicFinish')} onChange={set('cinematicFinish')} format={value => `${percent(value)}%`} tone="ice" />
                </div>
              </OaGroup>

              <OaGroup label="Palette">
                {PALETTE.map(([id, label]) => <OaSwatch key={id} label={label} value={text(id)} onChange={set(id)} />)}
              </OaGroup>
            </div>
          </div>
        ) : (
          <div className="oa-wrapped" data-tab={tab}>
            {tab === 'presets' ? <LayoutLabCinema2PresetsTab />
              : tab === 'react' ? <LayoutLabCanvasReactTab />
              : tab === 'tracks' ? <LayoutLabLyricTracksTab />
              : <LayoutLabAudioIntelligenceTab />}
          </div>
        )}
      </div>
    </>
  )
}
