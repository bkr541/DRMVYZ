import { useState } from 'react'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import { LAYOUT_LAB_DESIGNS, type LayoutLabDesignId } from './layoutLabDesignCatalog'
import './layoutLabDesignWorkbench.css'

export function LayoutLabDesignWorkbench() {
  const [design, setDesign] = useState<LayoutLabDesignId>('design-01')

  return (
    <div className="ll-design-workbench" data-lab-design={design}>
      <header className="ll-design-toolbar">
        <strong>Layout Lab</strong>
        <UnderlineDropdown
          ariaLabel="Layout Lab design"
          eyebrow="Design"
          size="compact"
          value={design}
          options={LAYOUT_LAB_DESIGNS}
          onChange={value => setDesign(value as LayoutLabDesignId)}
        />
      </header>
      <div className="ll-design-stage">
        {LAYOUT_LAB_DESIGNS.map(option => (
          <section
            key={option.value}
            className="ll-design-canvas"
            aria-label={`${option.label} canvas`}
            data-lab-canvas={option.value}
            hidden={design !== option.value}
          />
        ))}
      </div>
    </div>
  )
}
