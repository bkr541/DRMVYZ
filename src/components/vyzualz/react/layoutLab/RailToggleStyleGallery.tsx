import { AppIcon } from '../../../shared/icons/AppIcon'
import { useState } from 'react'

type Variant = 'tucked' | 'edge-tab' | 'header' | 'seam' | 'footer'
type Side = 'left' | 'right'

function Chevron({ points }: { points: 'left' | 'right' }) { return <AppIcon kind={points === 'left' ? 'left' : 'chevronRight'} size={12} /> }

/** Collapsing a rail points the chevron at the rail's own outer edge; expanding points it back at the visualizer. */
const direction = (side: Side, collapsed: boolean): 'left' | 'right' => (side === 'left') === !collapsed ? 'left' : 'right'

interface ConceptCopy { id: Variant; title: string; blurb: string }

const CONCEPTS: readonly ConceptCopy[] = [
  { id: 'tucked', title: '01 · Tucked Circle', blurb: 'The same round button, moved fully inside the rail so none of it crosses into the visualizer. Smallest change.' },
  { id: 'edge-tab', title: '02 · Edge Tab', blurb: 'A flat tab seated against the rail’s inner edge, rounded only toward the rail. Reads as part of the rail.' },
  { id: 'header', title: '03 · Header Button', blurb: 'No floating control at all: a small chevron button in each rail’s header bar, like the other header actions.' },
  { id: 'seam', title: '04 · Seam Notch', blurb: 'A slim grip on the rail’s edge line that widens into a chevron on hover. Almost no visual weight.' },
  { id: 'footer', title: '05 · Footer Toggle', blurb: 'A slim footer row at the bottom of each rail with a chevron and label; the label drops away when collapsed.' },
]

function RailToggle({ variant, side, collapsed, onToggle }: { variant: Variant; side: Side; collapsed: boolean; onToggle: () => void }) {
  const label = `${collapsed ? 'Expand' : 'Collapse'} ${side} rail`
  return (
    <button type="button" className={`llrt-toggle llrt-toggle--${variant}`} aria-label={label} title={label} aria-expanded={!collapsed} onClick={onToggle}>
      <Chevron points={direction(side, collapsed)} />
    </button>
  )
}

function Rail({ variant, side, title, collapsed, onToggle }: { variant: Variant; side: Side; title: string; collapsed: boolean; onToggle: () => void }) {
  const toggle = <RailToggle variant={variant} side={side} collapsed={collapsed} onToggle={onToggle} />
  return (
    <aside className={`llrt-rail llrt-rail--${side}${collapsed ? ' is-collapsed' : ''}`} data-variant={variant} data-collapsed={collapsed ? 'true' : 'false'}>
      <header className="llrt-head">
        <span className="llrt-title">{title}</span>
        {variant === 'header' && toggle}
      </header>
      <div className="llrt-body" aria-hidden="true">
        {[78, 56, 88, 64].map((width, index) => <i key={index} style={{ width: `${width}%` }} />)}
      </div>
      {variant === 'footer' && (
        <footer className="llrt-foot">
          {toggle}
          <span className="llrt-foot-label">{collapsed ? '' : 'Collapse'}</span>
        </footer>
      )}
      {(variant === 'tucked' || variant === 'edge-tab' || variant === 'seam') && toggle}
    </aside>
  )
}

function RailMock({ variant }: { variant: Variant }) {
  const [left, setLeft] = useState(false)
  const [right, setRight] = useState(false)
  return (
    <div className="llrt-mock" data-testid={`rail-toggle-${variant}`}>
      <Rail variant={variant} side="left" title="Tracks" collapsed={left} onToggle={() => setLeft(value => !value)} />
      <div className="llrt-visualizer" aria-hidden="true">
        <span>Visualizer</span>
        <div>{[40, 72, 54, 90, 46, 80, 60, 34, 70, 52].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      </div>
      <Rail variant={variant} side="right" title="Inspector" collapsed={right} onToggle={() => setRight(value => !value)} />
    </div>
  )
}

/** Layout Lab · Template: five ways to draw the rails' collapse / expand control so none of it overflows into the visualizer. Click a control to collapse that rail. */
export function RailToggleStyleGallery() {
  return (
    <div className="llrt-gallery" aria-label="Rail collapse and expand toggle concepts">
      {CONCEPTS.map(concept => (
        <section key={concept.id} className="llrt-concept">
          <div className="llrt-copy"><span>{concept.title}</span><p>{concept.blurb}</p></div>
          <RailMock variant={concept.id} />
        </section>
      ))}
    </div>
  )
}
