import type { ReactNode } from 'react'

type StageAreaProps = {
  preview: ReactNode
  overlay?: ReactNode
  className?: string
}

export function StageArea({
  preview,
  overlay,
  className = '',
}: StageAreaProps) {
  return (
    <main className={`vz-center-col${className ? ` ${className}` : ''}`}>
      <div className="vz-center">
        {preview}
        {overlay}
      </div>
    </main>
  )
}
