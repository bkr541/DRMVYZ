import type { ReactNode } from 'react'
import { DualRailCollapsible } from '../react/DualRailCollapsible'

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
    <DualRailCollapsible
      label={title}
      open={isOpen}
      onOpenChange={() => onToggle(id)}
      headerAccessory={count}
      className="vz-effect-accordion"
      bodyClassName="vz-effect-accordion__body"
    >
      {children}
    </DualRailCollapsible>
  )
}
