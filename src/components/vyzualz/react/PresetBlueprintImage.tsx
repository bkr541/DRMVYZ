import { useEffect, useState } from 'react'

const capturedArtwork = new Map<string, string>()
const pendingArtwork = new Map<string, Promise<string>>()
let captureTail: Promise<unknown> = Promise.resolve()

function requestCinemaArtwork(presetId: string): Promise<string> {
  const cached = capturedArtwork.get(presetId)
  if (cached) return Promise.resolve(cached)
  const pending = pendingArtwork.get(presetId)
  if (pending) return pending
  // Missing images only, one detached native renderer at a time. Share the
  // result across cards so navigation never causes duplicate captures.
  const job = captureTail.then(async () => {
    const { captureCinema2PresetArtwork } = await import('./captureCinema2PresetArtwork')
    const image = await captureCinema2PresetArtwork(presetId)
    capturedArtwork.set(presetId, image)
    return image
  })
  captureTail = job.catch(() => undefined)
  pendingArtwork.set(presetId, job)
  void job.then(() => pendingArtwork.delete(presetId), () => pendingArtwork.delete(presetId))
  return job
}

/** Prefer shipped renderer captures; generate missing Cinema 2.0 artwork using
 * the native renderer rather than leaving the card blank. Other engines keep
 * their existing missing-artwork behavior. */
export function PresetBlueprintImage({ presetId }: { presetId: string }) {
  return <PresetImage key={presetId} presetId={presetId} />
}

function PresetImage({ presetId }: { presetId: string }) {
  const [failed, setFailed] = useState(false)
  const [captured, setCaptured] = useState(() => capturedArtwork.get(presetId))
  const [captureFailed, setCaptureFailed] = useState(false)
  useEffect(() => {
    if (!failed || captured || !presetId.startsWith('drmvyz.cinema2.')) return
    let mounted = true
    void requestCinemaArtwork(presetId).then(image => {
      if (mounted) setCaptured(image)
    }, () => {
      if (mounted) setCaptureFailed(true)
    })
    return () => { mounted = false }
  }, [failed, captured, presetId])
  const src = captured ?? `${import.meta.env.BASE_URL}preset-artwork/${encodeURIComponent(presetId)}.webp`
  return (
    <img
      className="rv-preset-blueprint-image"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      data-thumbnail-kind="blueprint"
      data-thumbnail-state={captured ? 'captured' : captureFailed ? 'unavailable' : failed ? 'missing' : 'shipped'}
      hidden={failed && !captured || captureFailed}
      onError={() => { if (captured) setCaptureFailed(true); else setFailed(true) }}
    />
  )
}
