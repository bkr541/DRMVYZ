import type { ReactNode } from 'react'
import type { HelpId } from '../../../help/HelpCenter'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

export type EffectGroupId = 'global' | 'motion' | 'audioReactive' | 'distortion' | 'lighting'

type EffectGroupProps = {
  id: EffectGroupId
  title: string
  count: number
  isOpen: boolean
  onToggle: (id: EffectGroupId) => void
  children: ReactNode
  helpId?: HelpId
}

export function EffectGroup({ id, title, count, isOpen, onToggle, children, helpId }: EffectGroupProps) {
  return (
    <section className={`vz-effect-accordion drm-help-target${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="vz-effect-accordion__header"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span className="vz-effect-accordion__chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
        <span className="vz-effect-accordion__title">{title}</span>
        <span className="vz-effect-accordion__count">{count}</span>
      </button>
      {helpId && <span className="vz-effect-accordion__help"><HelpInfoTrigger helpId={helpId} /></span>}
      {isOpen && (
        <div className="vz-effect-accordion__body">
          {children}
        </div>
      )}
    </section>
  )
}
