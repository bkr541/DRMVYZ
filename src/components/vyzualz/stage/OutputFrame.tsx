import type { ReactNode } from 'react'

type OutputFrameProps = {
  controls?: ReactNode
  children: ReactNode
  overlay?: ReactNode
  className?: string
}

export function OutputFrame({ controls, children, overlay }: OutputFrameProps) {
  return (
    <>
      {controls}
      {children}
      {overlay}
    </>
  )
}
