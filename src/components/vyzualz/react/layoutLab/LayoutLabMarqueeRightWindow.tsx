import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { PanelSubtabs } from '../PanelSubtabs'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { LayoutLabAudioIntelligenceTab } from './LayoutLabAudioIntelligenceTab'
import { LayoutLabCanvasReactTab } from './LayoutLabCanvasReactTab'
import { LayoutLabCinema2PresetsTab } from './LayoutLabCinema2PresetsTab'
import { LayoutLabLyricTracksTab } from './LayoutLabLyricTracksTab'

// ── Layout Lab · right window · Cinema 2.0 / MARQUEE ────────────────────────
//
// A disconnected mockup of React View's Inspector. DESIGN has the Cinema 2.0 MARQUEE preset loaded: labels, groups,
// ranges and defaults follow the preset's parameter manifest (Cinema2MarqueePreset.ts) and the four parent groups
// follow Cinema2InspectorPanel. PRESETS is the Cinema 2.0 preset browser, REACT is the Canvas engine's routing
// surface, AUDIO (in place of OUTPUT) is the Track Timeline's Audio Intelligence window, and TRACKS is the Lyric Manager's Tracks tab. Everything is built from the same row components with local state only: no runtime,
// parameter store or persistence. Pattern, Pattern Change, Trigger and the marquee copy start on the values shown in
// the production screenshot.

const RIGHT_TABS: RailTabOption<'presets' | 'design' | 'react' | 'audio' | 'tracks'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'audio', label: 'AUDIO' },
  { id: 'tracks', label: 'TRACKS' },
]

export const PATTERN_OPTIONS = [
  { value: 'opening-night', label: 'Opening Night' },
  { value: 'canopy-cascade', label: 'Canopy Cascade' },
  { value: 'triple-face-relay', label: 'Triple-Face Relay' },
  { value: 'tower-call-response', label: 'Tower Call & Response' },
  { value: 'neon-crown-rise', label: 'Neon Crown Rise' },
  { value: 'velvet-intermission', label: 'Velvet Intermission' },
  { value: 'premiere-burst', label: 'Premiere Burst' },
]

export const TRIGGER_OPTIONS = [
  { value: 'beat', label: 'Beat' }, { value: 'kick', label: 'Kick' }, { value: 'snare', label: 'Snare' },
  { value: 'downbeat', label: 'Downbeat' }, { value: 'beat2', label: 'Every 2 Beats' }, { value: 'beat4', label: 'Every 4 Beats' },
  { value: 'bar', label: 'Bar' }, { value: 'bar4', label: 'Every 4 Bars' }, { value: 'bar8', label: 'Every 8 Bars' },
  { value: 'phrase', label: 'Phrase' }, { value: 'drop', label: 'Drop' },
]

export const LIGHTING_ZONES = [
  ['frontIntensity', 'Front Marquee', 1], ['sideIntensity', 'Side Marquees', 0.86], ['canopyIntensity', 'Canopy Underside', 0.72],
  ['towerIntensity', 'Vertical Towers', 0.82], ['entranceIntensity', 'Entrance LEDs', 0.68], ['neonIntensity', 'Neon Crown', 0.92],
] as const

export const PALETTE = [
  ['night', 'Night Atmosphere', '#030609'], ['marquee', 'Marquee Red', '#db0906'], ['gold', 'Incandescent Gold', '#ff8c24'],
  ['blue', 'Neon Blue', '#0a61ff'], ['architecture', 'Architectural Accent', '#301c13'],
] as const

export const INITIAL = {
  masterIntensity: 0.9, bpmSync: true, autoPerformance: true, cameraMotion: 1,
  pattern: 'opening-night', patternChange: true, trigger: 'kick',
  frontText: 'DVYDRM B2B GOONZ', leftText: 'SHOWINGS', rightText: 'SHOWINGS', signIllumination: 0.78,
  ...Object.fromEntries(LIGHTING_ZONES.map(([id, , value]) => [id, value])),
  bloom: 0.5, haze: 0.008, reflection: 0.72, cinematicFinish: 1,
  ...Object.fromEntries(PALETTE.map(([id, , value]) => [id, value])),
} as Record<string, number | boolean | string>

export function LayoutLabMarqueeRightWindow({ appearance }: { appearance?: 'midnight' } = {}) {
  const [tab, setTab] = useState<'presets' | 'design' | 'react' | 'audio' | 'tracks'>('design')
  const [surface, setSurface] = useState<'engine' | 'selection'>('engine')
  const [values, setValues] = useState(INITIAL)
  const set = <T extends number | boolean | string>(key: string) => (next: T) => setValues(current => ({ ...current, [key]: next }))
  const num = (key: string) => values[key] as number
  const bool = (key: string) => values[key] as boolean
  const text = (key: string) => values[key] as string

  return (
    <>
      <RailWindowHeader
        side="right"
        icon={<AppIcon kind="settings" size={15} color="currentColor" aria-hidden="true" />}
        label="Inspector"
      />
      <RailTabs
        tabs={appearance === 'midnight' ? RIGHT_TABS.map(item => ({ ...item, label: item.label[0] + item.label.slice(1).toLowerCase() })) : RIGHT_TABS}
        activeTab={tab}
        onChange={setTab}
        ariaLabel="React right workspace panels"
        className="rv-main-workspace-tabs"
        variant="underline"
      />
      <div className="vz-panel-body">
        {tab === 'design' ? (
          <div className="rv-workspace-panel" data-cinema2-inspector="design">
            <PanelSubtabs
              value={surface}
              onChange={setSurface}
              ariaLabel="Cinema 2.0 design surfaces"
              options={[{ id: 'engine', label: 'ENGINE' }, { id: 'selection', label: 'SELECTION', disabled: true }]}
            />
            <div className="rv-workspace-panel-body">
              <div className="rv-inspector rv-inspector-scroll">
                <div className="rv-ctrl-group" data-cinema2-design-parent-groups="master-controls design effects palette">
                  <Collapsible label="Master Controls">
                    <SliderRow label="Master Intensity" value={num('masterIntensity')} onChange={set('masterIntensity')} />
                    <ToggleRow label="BPM Sync" value={bool('bpmSync')} onChange={set('bpmSync')} />
                    <ToggleRow
                      label="Auto Performance"
                      description="Temporarily chooses build and drop looks without rewriting the authored Pattern or hard controls."
                      value={bool('autoPerformance')}
                      onChange={set('autoPerformance')}
                    />
                    <SliderRow label="Camera Motion" value={num('cameraMotion')} onChange={set('cameraMotion')} />
                  </Collapsible>

                  <Collapsible label="Design">
                    <Collapsible label="Pattern">
                      <SelectRow
                        label="Pattern"
                        value={text('pattern')}
                        options={PATTERN_OPTIONS}
                        description="Selects the authored bulb and neon program immediately; direct edits also turn Auto Performance off."
                        onChange={next => setValues(current => ({ ...current, pattern: next, autoPerformance: false }))}
                      />
                      <ToggleRow label="Pattern Change" value={bool('patternChange')} onChange={set('patternChange')} />
                      {bool('patternChange') && (
                        <SelectRow label="Trigger" value={text('trigger')} options={TRIGGER_OPTIONS} onChange={set('trigger')} />
                      )}
                    </Collapsible>
                    <Collapsible label="Marquee Copy">
                      <TextInputRow label="Front Marquee Text" value={text('frontText')} onChange={set('frontText')} maxLength={32} />
                      <TextInputRow label="Left Marquee Text" value={text('leftText')} onChange={set('leftText')} maxLength={32} />
                      <TextInputRow label="Right Marquee Text" value={text('rightText')} onChange={set('rightText')} maxLength={32} />
                      <SliderRow label="Sign Illumination" value={num('signIllumination')} onChange={set('signIllumination')} />
                    </Collapsible>
                    <Collapsible label="Lighting Zones">
                      {LIGHTING_ZONES.map(([id, label]) => (
                        <SliderRow key={id} label={label} value={num(id)} onChange={set(id)} />
                      ))}
                    </Collapsible>
                  </Collapsible>

                  <Collapsible label="Effects">
                    <SliderRow label="Bloom" value={num('bloom')} onChange={set('bloom')} />
                    <SliderRow label="Haze" value={num('haze')} min={0} max={0.03} step={0.001} formatValue={value => value.toFixed(3)} onChange={set('haze')} />
                    <SliderRow label="Wet Street Reflections" value={num('reflection')} onChange={set('reflection')} />
                    <SliderRow label="Cinematic Finish" value={num('cinematicFinish')} onChange={set('cinematicFinish')} />
                  </Collapsible>

                  <Collapsible label="Palette" bodyClassName="rv-cinema2-palette-body">
                    {PALETTE.map(([id, label]) => (
                      <PaletteColorRow key={id} label={label} value={text(id)} onChange={set(id)} />
                    ))}
                  </Collapsible>
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'presets' ? (
          <LayoutLabCinema2PresetsTab />
        ) : tab === 'react' ? (
          <LayoutLabCanvasReactTab />
        ) : tab === 'tracks' ? (
          <LayoutLabLyricTracksTab />
        ) : (
          <LayoutLabAudioIntelligenceTab />
        )}
      </div>
    </>
  )
}
