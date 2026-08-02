import type { ReactNode } from 'react'

export type EffectGroupId = 'global' | 'motion' | 'audioReactive' | 'distortion' | 'lighting'

type EffectGroupProps = {
  id: EffectGroupId
  title: string
  count: number
  isOpen: boolean
  onToggle: (id: EffectGroupId) => void
  children: ReactNode
}

export function EffectGroup({ id, title, count, isOpen, onToggle, children }: EffectGroupProps) {
  return (
    <section className={`vz-effect-accordion${isOpen ? ' is-open' : ''}`}>
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
      {isOpen && (
        <div className="vz-effect-accordion__body">
          {children}
        </div>
      )}
    </section>
  )
}
