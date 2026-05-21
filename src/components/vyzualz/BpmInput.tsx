import { useState, useEffect } from 'react'

export function BpmInput({ value, onChange, className }: {
  value: number; onChange: (v: number) => void; className?: string
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = (raw: string) => {
    const v = parseInt(raw, 10)
    if (!isNaN(v)) onChange(v)
    else           setDraft(String(value))
  }

  return (
    <input
      type="number"
      className={`vz-bpm-input${className ? ' ' + className : ''}`}
      value={draft}
      min={40} max={300} step={1}
      onChange={e => setDraft(e.target.value)}
      onBlur={e  => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}
