import { useEffect, useState } from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { ShaderThumbnailRenderer } from '../library/ShaderThumbnailRenderer'

const renderer = new ShaderThumbnailRenderer()

export function ShaderSceneThumbnail({ definition }: { definition: ShaderDefinition }) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => renderer.getCached(definition.id)?.dataUrl ?? null)

  useEffect(() => {
    let disposed = false
    if (dataUrl) return

    renderer.render(definition).then(result => {
      if (!disposed && result?.dataUrl) setDataUrl(result.dataUrl)
    })

    return () => {
      disposed = true
    }
  }, [definition, dataUrl])

  return (
    <div className="rv-shader-scene-thumb" style={{ background: definition.thumbnail?.color ?? '#111' }} aria-hidden="true">
      {dataUrl ? <img className="rv-shader-scene-thumb-img" src={dataUrl} alt="" loading="lazy" /> : null}
    </div>
  )
}
