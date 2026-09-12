import { useEffect, useState } from 'react'
import type { LyricAnimation, LyricEffects, LyricStyle } from '../../../types/lyrics'

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

export function LyricCueJsonField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: Partial<LyricStyle> | Partial<LyricAnimation> | Partial<LyricEffects> | Record<string, unknown> | undefined
  onCommit: (value: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState(stableJson(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(stableJson(value)); setError(null) }, [value])

  const commit = () => {
    try {
      const parsed = JSON.parse(draft) as unknown
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Use a JSON object')
      setError(null)
      onCommit(parsed as Record<string, unknown>)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Invalid JSON')
    }
  }

  return (
    <div className="lyric-cue-inspector__json-field">
      <label>{label}</label>
      <textarea
        className="lmv-textarea"
        rows={4}
        value={draft}
        aria-invalid={!!error}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') commit()
        }}
      />
      {error && <span role="alert" className="lyric-cue-inspector__error">{error}</span>}
    </div>
  )
}
