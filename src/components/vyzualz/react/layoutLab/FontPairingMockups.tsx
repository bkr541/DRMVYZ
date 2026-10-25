import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { PanelSubtabs } from '../PanelSubtabs'
import { Collapsible, SliderRow, ToggleRow } from '../ReactControlRows'
import './fontPairingMockups.css'

// ── FontPairingMockups ───────────────────────────────────────────────────────
//
// Layout Lab / PixGrid left rail. Twenty copies of the same real Design tab (tab
// row, ENGINE / SELECTION sub-tabs, and the Master Controls parent group) where
// each copy overrides the app's two font tokens. To make the pairing readable
// at a glance, the primary font (--az-font) carries every word of UI chrome
// (tabs, pills, group heading, control labels) and the secondary font
// (--az-font-data) carries the numeric values and detail text. That split is
// applied by fontPairingMockups.css for these cards only; production styles
// most in-panel text with the secondary font today. Every control inside is
// the production component. Fully local and disconnected, and the fonts are
// fetched only while this view is mounted.

interface FontPairing {
  id: string
  primary: string
  secondary: string
  /** Generic family the pairing falls back to if the web font is unavailable. */
  primaryFallback: string
  secondaryFallback: string
  note: string
}

const FONT_PAIRINGS: FontPairing[] = [
  { id: 'quicksand-dm-sans', primary: 'Quicksand', secondary: 'DM Sans', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Soft rounded geometric labels over a sturdy geometric sans.' },
  { id: 'zen-dots-exo-2', primary: 'Zen Dots', secondary: 'Exo 2', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Original. Wide techno display face over a narrow sci-fi data face.' },
  { id: 'orbitron-roboto-mono', primary: 'Orbitron', secondary: 'Roboto Mono', primaryFallback: 'sans-serif', secondaryFallback: 'monospace', note: 'Futuristic geometric display with a monospaced readout.' },
  { id: 'bebas-neue-barlow', primary: 'Bebas Neue', secondary: 'Barlow', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Tall, condensed all-caps poster type over a sturdy industrial sans.' },
  { id: 'fraunces-inter', primary: 'Fraunces', secondary: 'Inter', primaryFallback: 'serif', secondaryFallback: 'sans-serif', note: 'Warm, high-contrast serif labels over the neutral UI standard.' },
  { id: 'space-grotesk-space-mono', primary: 'Space Grotesk', secondary: 'Space Mono', primaryFallback: 'sans-serif', secondaryFallback: 'monospace', note: 'Previous app pairing. Quirky grotesque labels with its typewriter-style monospaced sibling.' },
  { id: 'michroma-work-sans', primary: 'Michroma', secondary: 'Work Sans', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Extra-wide, squared techno display over a plain, friendly grotesque.' },
  { id: 'josefin-sans-lato', primary: 'Josefin Sans', secondary: 'Lato', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Elegant vintage-geometric labels with a warm humanist body face.' },
  { id: 'audiowide-rubik', primary: 'Audiowide', secondary: 'Rubik', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Rounded, retro-futuristic display over a slightly rounded, chunky sans.' },
  { id: 'ibm-plex-mono-ibm-plex-sans', primary: 'IBM Plex Mono', secondary: 'IBM Plex Sans', primaryFallback: 'monospace', secondaryFallback: 'sans-serif', note: 'Terminal-style monospaced labels over an engineered sans. Inverts the usual split.' },
  { id: 'righteous-nunito', primary: 'Righteous', secondary: 'Nunito', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Chunky, rounded retro display over soft rounded body text.' },
  { id: 'russo-one-open-sans', primary: 'Russo One', secondary: 'Open Sans', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Heavy, squared industrial display over a highly neutral humanist sans.' },
  { id: 'roboto-slab-roboto', primary: 'Roboto Slab', secondary: 'Roboto', primaryFallback: 'serif', secondaryFallback: 'sans-serif', note: 'Sturdy slab-serif labels over its plain sans sibling.' },
  { id: 'silkscreen-vt323', primary: 'Silkscreen', secondary: 'VT323', primaryFallback: 'sans-serif', secondaryFallback: 'monospace', note: 'Pixel-art caps over a CRT terminal readout. Retro arcade.' },
  { id: 'caveat-poppins', primary: 'Caveat', secondary: 'Poppins', primaryFallback: 'cursive', secondaryFallback: 'sans-serif', note: 'Handwritten marker-style labels over clean geometric type.' },
  { id: 'cinzel-montserrat', primary: 'Cinzel', secondary: 'Montserrat', primaryFallback: 'serif', secondaryFallback: 'sans-serif', note: 'Classical Roman capitals over a wide, urban geometric sans.' },
  { id: 'rajdhani-share-tech-mono', primary: 'Rajdhani', secondary: 'Share Tech Mono', primaryFallback: 'sans-serif', secondaryFallback: 'monospace', note: 'Squared, condensed instrument-panel labels with a thin technical monospace.' },
  { id: 'chakra-petch-jetbrains-mono', primary: 'Chakra Petch', secondary: 'JetBrains Mono', primaryFallback: 'sans-serif', secondaryFallback: 'monospace', note: 'Angular, cut-corner display over a developer-grade monospace.' },
  { id: 'unbounded-plus-jakarta-sans', primary: 'Unbounded', secondary: 'Plus Jakarta Sans', primaryFallback: 'sans-serif', secondaryFallback: 'sans-serif', note: 'Very wide, rounded, heavy display over a modern friendly sans.' },
  { id: 'outfit-source-serif-4', primary: 'Outfit', secondary: 'Source Serif 4', primaryFallback: 'sans-serif', secondaryFallback: 'serif', note: 'Crisp geometric labels over a serif readout. Inverts the usual split.' },
]

/** Variable-font axes requested per family; an empty string is a single-weight family. */
const FONT_AXES: Record<string, string> = {
  'Quicksand': 'wght@300..700',
  'DM Sans': 'wght@300..700',
  'Zen Dots': '',
  'Exo 2': 'wght@300..700',
  'Orbitron': 'wght@400..700',
  'Roboto Mono': 'wght@300..700',
  'Bebas Neue': '',
  'Barlow': 'wght@300;400;500;600;700',
  'Fraunces': 'wght@300..700',
  'Inter': 'wght@300..700',
  'Space Grotesk': 'wght@300..700',
  'Space Mono': 'wght@400;700',
  'Michroma': '',
  'Work Sans': 'wght@300..700',
  'Josefin Sans': 'wght@300..700',
  'Lato': 'wght@300;400;700',
  'Audiowide': '',
  'Rubik': 'wght@300..700',
  'IBM Plex Mono': 'wght@300;400;500;600;700',
  'IBM Plex Sans': 'wght@300;400;500;600;700',
  'Righteous': '',
  'Nunito': 'wght@300..700',
  'Russo One': '',
  'Open Sans': 'wght@300..700',
  'Roboto Slab': 'wght@300..700',
  'Roboto': 'wght@300;400;500;700',
  'Silkscreen': 'wght@400;700',
  'VT323': '',
  'Caveat': 'wght@400..700',
  'Poppins': 'wght@300;400;500;600;700',
  'Cinzel': 'wght@400..700',
  'Montserrat': 'wght@300..700',
  'Rajdhani': 'wght@300;400;500;600;700',
  'Share Tech Mono': '',
  'Chakra Petch': 'wght@300;400;500;600;700',
  'JetBrains Mono': 'wght@300..700',
  'Unbounded': 'wght@300..700',
  'Plus Jakarta Sans': 'wght@300..700',
  'Outfit': 'wght@300..700',
  'Source Serif 4': 'wght@300..700',
}

/** One stylesheet request for every family above, loaded only while the mockups are mounted. */
const FONT_PAIRINGS_STYLESHEET = 'https://fonts.googleapis.com/css2?'
  + Object.entries(FONT_AXES).map(([family, axes]) => `family=${family.replace(/ /g, '+')}${axes ? `:${axes}` : ''}`).join('&')
  + '&display=swap'

const FONT_PAIRINGS_LINK_ID = 'layout-lab-font-pairings'

const SAMPLE_TABS: RailTabOption<'presets' | 'design' | 'react' | 'output'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

const SAMPLE_SLIDERS = [
  { id: 'musicReactivity', label: 'Music Reactivity', value: 0.8 },
  { id: 'kickReaction', label: 'Kick Reaction', value: 0.72 },
  { id: 'transientReaction', label: 'Transient Reaction', value: 0.58 },
  { id: 'dropReaction', label: 'Drop Reaction', value: 0.92 },
  { id: 'structureReaction', label: 'Structure Reaction', value: 0.7 },
] as const

function stack(family: string, fallback: string) {
  return `'${family}', ${fallback}`
}

function FontPairingCard({ pairing, index }: { pairing: FontPairing; index: number }) {
  const [tab, setTab] = useState<'presets' | 'design' | 'react' | 'output'>('design')
  const [subtab, setSubtab] = useState<'engine' | 'selection'>('engine')
  const [intensity, setIntensity] = useState(0.82)
  const [bpmSync, setBpmSync] = useState(true)
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(SAMPLE_SLIDERS.map(slider => [slider.id, slider.value])))
  const primary = stack(pairing.primary, pairing.primaryFallback)
  const secondary = stack(pairing.secondary, pairing.secondaryFallback)
  const style = {
    '--az-font': primary,
    '--az-font-data': secondary,
    '--font-ui': primary,
    '--font-mono': primary,
  } as CSSProperties

  return (
    <div className="lldd-gallery-row" data-font-pairing={pairing.id}>
      <div className="lldd-gallery-copy">
        <span className="lldd-gallery-title">{String(index + 1).padStart(2, '0')} · {pairing.primary} + {pairing.secondary}</span>
        <span className="lldd-gallery-blurb">Primary {pairing.primary} (tabs, headings, labels) · Secondary {pairing.secondary} (values, detail). {pairing.note}</span>
      </div>
      <div className="lldd-gallery-sample llfp-frame" style={style}>
        <RailTabs
          variant="underline"
          tabs={SAMPLE_TABS}
          activeTab={tab}
          onChange={setTab}
          ariaLabel={`${pairing.primary} + ${pairing.secondary} inspector tabs`}
        />
        <div className="rv-workspace-panel">
          <PanelSubtabs
            value={subtab}
            onChange={setSubtab}
            ariaLabel={`${pairing.primary} + ${pairing.secondary} design surfaces`}
            options={[
              { id: 'engine', label: 'ENGINE' },
              { id: 'selection', label: 'SELECTION', disabled: true },
            ]}
          />
          <div className="rv-workspace-panel-body">
            <div className="rv-inspector llfp-inspector">
              <div className="rv-ctrl-group">
                <Collapsible label="Master Controls">
                  <SliderRow label="Master Intensity" value={intensity} onChange={setIntensity} formatValue={value => value.toFixed(2)} />
                  <ToggleRow label="BPM Sync" value={bpmSync} onChange={setBpmSync} />
                  {SAMPLE_SLIDERS.map(slider => (
                    <SliderRow
                      key={slider.id}
                      label={slider.label}
                      value={values[slider.id] ?? slider.value}
                      onChange={next => setValues(current => ({ ...current, [slider.id]: next }))}
                    />
                  ))}
                </Collapsible>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FontPairingMockups() {
  const galleryRef = useRef<HTMLDivElement>(null)

  // Layout Lab renders into its own popup window, and a window only sees the fonts its own document
  // loaded, so the stylesheet goes into the document that owns this node rather than the opener's.
  useEffect(() => {
    const ownerDocument = galleryRef.current?.ownerDocument ?? document
    if (ownerDocument.getElementById(FONT_PAIRINGS_LINK_ID)) return undefined
    const link = ownerDocument.createElement('link')
    link.id = FONT_PAIRINGS_LINK_ID
    link.rel = 'stylesheet'
    link.href = FONT_PAIRINGS_STYLESHEET
    ownerDocument.head.appendChild(link)
    return () => link.remove()
  }, [])

  return (
    <div ref={galleryRef} className="llfp-gallery" aria-label="Font pairing mockups">
      {FONT_PAIRINGS.map((pairing, index) => <FontPairingCard key={pairing.id} pairing={pairing} index={index} />)}
    </div>
  )
}
