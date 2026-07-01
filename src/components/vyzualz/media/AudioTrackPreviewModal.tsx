import { useEffect, useState } from 'react'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'

export function AudioTrackPreviewModal({ track, onClose }: { track: SavedAudioTrack; onClose: () => void }) {
  const getSignedUrl = useAudioStore(state => state.getSignedUrl)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    if (!track.storagePath) {
      setLoading(false)
      setError('This track has no stored audio file.')
      return
    }
    void getSignedUrl(track.storagePath).then(nextUrl => {
      if (cancelled) return
      setUrl(nextUrl)
      setLoading(false)
      if (!nextUrl) setError('A preview URL could not be created. Refresh the library or check storage access.')
    })
    return () => { cancelled = true }
  }, [getSignedUrl, track.id, track.storagePath])

  return (
    <div className="mum-backdrop" role="presentation">
      <div className="mmv-editor-modal mmv-audio-preview" role="dialog" aria-modal="true" aria-labelledby="audio-preview-title">
        <div className="mmv-editor-header">
          <div>
            <h2 id="audio-preview-title">{track.title}</h2>
            <p>{[track.artist, track.genre].filter(Boolean).join(' · ') || track.fileName}</p>
          </div>
          <button type="button" className="mpm-close" onClick={onClose} aria-label="Close audio preview">×</button>
        </div>
        <div className="mmv-audio-preview-body">
          {loading ? (
            <div className="mmv-audio-preview-state">Creating secure preview…</div>
          ) : error ? (
            <div className="mmv-editor-error" role="alert">{error}</div>
          ) : (
            <audio controls autoPlay={false} preload="metadata" src={url ?? undefined} onError={() => setError('The audio file could not be loaded.')} />
          )}
        </div>
      </div>
    </div>
  )
}
