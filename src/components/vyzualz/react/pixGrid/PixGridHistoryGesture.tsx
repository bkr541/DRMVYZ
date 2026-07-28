import type { KeyboardEvent, ReactNode } from 'react'
import { useReactStore } from '../../../../stores/reactStore'

const HISTORY_ADJUSTMENT_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
])

/**
 * Groups pointer drags and keyboard range adjustments into the same PixGrid
 * authoring-history transaction regardless of which control surface hosts the
 * shared binding.
 */
export function PixGridHistoryGesture({ children }: { children: ReactNode }) {
  const begin = useReactStore(store => store.beginPixGridHistoryTransaction)
  const commit = useReactStore(store => store.commitPixGridHistoryTransaction)
  const cancel = useReactStore(store => store.cancelPixGridHistoryTransaction)

  const beginKeyboardAdjustment = (event: KeyboardEvent<HTMLDivElement>) => {
    if (HISTORY_ADJUSTMENT_KEYS.has(event.key)) begin()
  }
  const commitKeyboardAdjustment = (event: KeyboardEvent<HTMLDivElement>) => {
    if (HISTORY_ADJUSTMENT_KEYS.has(event.key)) commit()
  }

  return (
    <div
      onPointerDown={begin}
      onPointerUp={commit}
      onPointerCancel={cancel}
      onKeyDownCapture={beginKeyboardAdjustment}
      onKeyUpCapture={commitKeyboardAdjustment}
      onBlurCapture={commit}
    >
      {children}
    </div>
  )
}
