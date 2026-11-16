import { useState } from 'react'
import { ReactPerformancePads } from '../react/ReactPerformancePads'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { isMobileUsablePad } from '../../../features/performancePads/performancePadSets'

/** A 3 × 4 grid: twelve pads a bank, so the 20 pads are Pads 1 (1–12) and Pads 2 (13–20). */
export const MOBILE_PADS_PER_BANK = 12
type Bank = 'Pads 1' | 'Pads 2'

/**
 * Pads: the production performance pads, driven by the shared store. A pad that loads a Cinema 2.0 preset changes what the Visualizer
 * shows; pads for other engines are disabled because the mobile app runs Cinema 2.0 only.
 */
export function MobilePadsPage() {
  const [bank, setBank] = useState<Bank>('Pads 1')
  return <div className="mpm-panel-content mpm-pads-page">
    <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Pads 1', label: 'Pads 1' }, { id: 'Pads 2', label: 'Pads 2' }]}
      activeTab={bank} onChange={id => setBank(id as Bank)} ariaLabel="Pad banks" />
    <div className="mpm-pads" role="group" aria-label={`Performance ${bank}`}>
      <ReactPerformancePads embedded presentation="expanded" isPadUsable={isMobileUsablePad}
        range={bank === 'Pads 1' ? { start: 0, end: MOBILE_PADS_PER_BANK } : { start: MOBILE_PADS_PER_BANK }} />
    </div>
  </div>
}
