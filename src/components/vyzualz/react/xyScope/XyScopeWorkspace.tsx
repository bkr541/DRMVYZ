import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, TextInputRow, ToggleRow, type SelectOption } from '../ReactControlRows'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { IconChipButton } from '../controls/IconChipButton'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { ReactPresetCard } from '../ReactPresetCard'
import {
  applyXyScopePreset,
  getXyScopeDefaultParameters,
  getXyScopePreset,
  isXyScopeParameterVisible,
  XY_SCOPE_DESIGN_SUBGROUPS,
  XY_SCOPE_GROUP_LABELS,
  XY_SCOPE_GROUP_ORDER,
  XY_SCOPE_PARAMETERS,
  XY_SCOPE_PRESETS,
  XY_SCOPE_TEXT_MAX_LENGTH,
  type XyScopeParameterDefinition,
  type XyScopeParameterGroup,
  type XyScopeParameterValue,
} from './XyScopeSettings'
import { useXyScopeFont } from './XyScopeFontLibrary'
import { useFontPreviewPreload } from '../useFontPreviewPreload'

export { XyScopeSurface } from './XyScopeSurface'

// Same four parent icons the Cinema 2.0 Design inspector uses; React takes the waveform glyph.
const GROUP_ICONS: Readonly<Record<XyScopeParameterGroup, AppIconKind>> = {
  'master-controls': 'sliders',
  design: 'paintBrush',
  react: 'waveform',
  palette: 'colorPalette',
}

function formatSlider(definition: Extract<XyScopeParameterDefinition, { kind: 'slider' }>): (value: number) => string {
  switch (definition.format) {
    case 'percent': return value => `${Math.round(value * 100)}%`
    case 'ms': return value => `${Math.round(value)} ms`
    default: return value => value.toFixed(2)
  }
}

function XyScopeParameterControl({
  definition,
  value,
  onChange,
}: {
  definition: XyScopeParameterDefinition
  value: XyScopeParameterValue
  onChange: (value: XyScopeParameterValue) => void
}) {
  const id = `xyscope-parameter-${definition.id}`
  switch (definition.kind) {
    case 'slider':
      return (
        <SliderRow
          id={id}
          label={definition.label}
          value={typeof value === 'number' ? value : definition.default}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          resetValue={definition.default}
          description={definition.description}
          formatValue={formatSlider(definition)}
          onChange={onChange}
        />
      )
    case 'toggle':
      return (
        <ToggleRow
          id={id}
          label={definition.label}
          value={typeof value === 'boolean' ? value : definition.default}
          description={definition.description}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <SelectRow
          id={id}
          label={definition.label}
          value={typeof value === 'string' ? value : definition.default}
          options={definition.options.map(option => ({ value: option.value, label: option.label }))}
          description={definition.description}
          onChange={onChange}
        />
      )
    case 'color':
      return (
        <PaletteColorRow
          id={id}
          label={definition.label}
          value={typeof value === 'string' ? value : definition.default}
          description={definition.description}
          onChange={onChange}
        />
      )
  }
}

const XY_SOURCE_CARDS = [
  { id: 'text', label: 'TEXT', icon: 'text' },
  { id: 'svg', label: 'SVG', icon: 'svg' },
  { id: 'oscillator', label: 'OSCILATOR', icon: 'scope' },
] as const

/** Left SOURCE tab: source cards, with existing text controls under TEXT. */
export function XyScopeEnginePanel() {
  const [source, setSource] = useState<typeof XY_SOURCE_CARDS[number]['id']>('text')
  const { settings, setXyScopeSettings, fontAssets } = useReactStore(useShallow(state => ({
    settings: state.xyScopeSettings,
    setXyScopeSettings: state.setXyScopeSettings,
    fontAssets: state.oscillatorFontAssets,
  })))
  const resolution = useXyScopeFont(settings.fontId)
  const previewStatus = useFontPreviewPreload(fontAssets)
  const options = useMemo(() => {
    const seen = new Set<string>()
    const list: SelectOption[] = [{ value: '', label: 'Anton (default)', style: { fontFamily: '"DRMVYZ Anton", sans-serif' } }]
    for (const asset of fontAssets) {
      if (seen.has(asset.id)) continue
      seen.add(asset.id)
      list.push({ value: asset.id, label: asset.name, style: previewStatus[asset.id] === 'ready'
        ? { fontFamily: `"drmvyz-preview-${asset.id}", sans-serif` } : undefined })
    }
    // A selected font that is not in the list (library still loading) stays visible instead of silently resetting.
    if (settings.fontId && !seen.has(settings.fontId)) list.push({ value: settings.fontId, label: 'Selected font' })
    return list
  }, [fontAssets, settings.fontId, previewStatus])

  const fontDescription = resolution.status === 'loading'
    ? 'Loading this font…'
    : resolution.status === 'error' || resolution.status === 'missing'
      ? `${resolution.error ?? 'This font could not be loaded.'} Drawing in ${resolution.label}.`
      : settings.fontId
        ? 'Letter outlines come straight from this font. Upload more under Media Manager → Fonts.'
        : 'Pick one of your uploaded fonts, or keep the built-in default.'

  return (
    <section className="rv-xyscope-engine-panel" aria-label="Sound Drawing XY source" data-xyscope-engine-panel="true">
      <div className="rv-sound-source-grid rv-xyscope-source-grid" role="group" aria-label="Sound Drawing XY source types">
        {XY_SOURCE_CARDS.map(option => (
          <button key={option.id} type="button"
            className={`rv-sound-source-card${source === option.id ? ' is-active' : ''}`}
            aria-pressed={source === option.id}
            onClick={() => setSource(option.id)}>
            <span className="rv-sound-source-card-icon"><AppIcon kind={option.icon} /></span>
            <span className="rv-sound-source-card-label">{option.label}</span>
          </button>
        ))}
      </div>
      {source === 'text' && <Collapsible label="Input" icon={<AppIcon kind="text" size={15} color="currentColor" />}>
        <div data-xyscope-input-group="true" style={{ display: 'contents' }}>
          <TextInputRow
            id="xyscope-text"
            label="Text"
            value={settings.text}
            maxLength={XY_SCOPE_TEXT_MAX_LENGTH}
            placeholder="Type a word"
            description={`Up to ${XY_SCOPE_TEXT_MAX_LENGTH} characters, drawn in capitals.`}
            onChange={text => setXyScopeSettings({ text })}
          />
          <SelectRow
            id="xyscope-font"
            label="Font"
            value={settings.fontId ?? ''}
            options={options}
            menuSearch
            menuSearchPlaceholder="Search fonts…"
            description={fontDescription}
            onChange={value => setXyScopeSettings({ fontId: value === '' ? null : value })}
          />
        </div>
      </Collapsible>}
    </section>
  )
}

/** Right inspector, PRESETS tab. A preset sets the React and Master values and leaves the word, font and palette alone. */
export function XyScopePresetsPanel() {
  const activePresetId = useReactStore(state => state.xyScopeSettings.presetId)
  const parameters = useReactStore(state => state.xyScopeSettings.parameters)
  const beamColor = parameters.beamColor
  const setXyScopeSettings = useReactStore(state => state.setXyScopeSettings)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const presets = XY_SCOPE_PRESETS.filter(preset => needle === '' || `${preset.name} ${preset.description}`.toLowerCase().includes(needle))

  return (
    <section className="rv-engine-panel-list" aria-label="Sound Drawing XY presets">
      <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search Sound Drawing XY presets" />
      <div className="rv-preset-scroll">
        <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2" data-xyscope-preset-grid="true">
          {presets.map(preset => (
            <ReactPresetCard
              key={preset.id}
              id={preset.id}
              title={preset.name}
              description={preset.description}
              palette={[{ color: String(beamColor) }]}
              isActive={preset.id === activePresetId}
              isModified={preset.id === activePresetId && Object.entries(preset.parameters).some(([id, value]) => parameters[id] !== value)}
              activateLabel={`Load ${preset.name}`}
              onActivate={() => setXyScopeSettings(applyXyScopePreset(useReactStore.getState().xyScopeSettings, preset.id))}
              dataAttributes={{ 'data-xyscope-preset-id': preset.id }}
            />
          ))}
          {presets.length === 0 && <div className="rv-ctrl-info">No presets match “{query}”.</div>}
        </div>
      </div>
    </section>
  )
}

/** Right inspector, DESIGN tab: the standard Master Controls, Design, React and Palette groups, in that order. */
export function XyScopeDesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setXyScopeSettings = useReactStore(state => state.setXyScopeSettings)
  const values = settings.parameters
  const defaults = getXyScopeDefaultParameters()
  const preset = getXyScopePreset(settings.presetId)
  const baseline = { ...defaults, ...(preset?.parameters ?? {}) }
  const isModified = XY_SCOPE_PARAMETERS.some(definition => values[definition.id] !== baseline[definition.id])

  const setValue = (id: string, value: XyScopeParameterValue) => {
    // The preset id is kept after an edit (the card shows Modified), so the look can be restored in one click.
    setXyScopeSettings({ parameters: { ...values, [id]: value } })
  }
  const resetParameters = () => setXyScopeSettings({ parameters: baseline })

  const renderControl = (definition: XyScopeParameterDefinition) => (
    <XyScopeParameterControl
      key={definition.id}
      definition={definition}
      value={values[definition.id]}
      onChange={value => setValue(definition.id, value)}
    />
  )
  // Nested groups sit inside their parent as collapsible sub-headings, exactly as in the Cinema 2.0 Design inspector.
  const renderControls = (controls: readonly XyScopeParameterDefinition[]) => (
    <>
      {controls.filter(definition => !definition.subgroup).map(renderControl)}
      {XY_SCOPE_DESIGN_SUBGROUPS.map(subgroup => {
        const inGroup = controls.filter(definition => definition.subgroup === subgroup)
        if (inGroup.length === 0) return null
        return (
          <Collapsible key={subgroup} label={subgroup}>
            <div data-xyscope-subgroup={subgroup} style={{ display: 'contents' }}>{inGroup.map(renderControl)}</div>
          </Collapsible>
        )
      })}
    </>
  )

  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group" data-xyscope-design-groups={XY_SCOPE_GROUP_ORDER.join(' ')}>
            {XY_SCOPE_GROUP_ORDER.map(group => {
              const controls = XY_SCOPE_PARAMETERS.filter(definition => definition.group === group && isXyScopeParameterVisible(definition, values))
              return (
                <Collapsible
                  key={group}
                  label={XY_SCOPE_GROUP_LABELS[group]}
                  icon={<AppIcon kind={GROUP_ICONS[group]} size={15} color="currentColor" />}
                  bodyClassName={group === 'palette' ? 'rv-cinema2-palette-body' : undefined}
                >
                  <div data-xyscope-parent-group={group} style={{ display: 'contents' }}>
                    {controls.length === 0
                      ? <div className="rv-ctrl-info">No controls yet.</div>
                      : renderControls(controls)}
                  </div>
                </Collapsible>
              )
            })}
          </div>
          <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
            <IconChipButton onClick={resetParameters} disabled={!isModified}>Reset Parameters</IconChipButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Right inspector, REACT tab: the reactive controls live under Design → React; shared music analysis stays here. */
export function XyScopeReactivityPanel() {
  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-info" data-xyscope-react-note="true">
            What the music does to the word is set under Design → React. Shared music analysis is below.
          </div>
          <ReactAudioPanel />
        </div>
      </div>
    </div>
  )
}
