import { useEffect, useState } from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { ShaderThumbnailRenderer } from '../library/ShaderThumbnailRenderer'
import { useBrandKitStore } from '../../../../../features/personalization/brandKitStore'

const renderer = new ShaderThumbnailRenderer()

export function ShaderSceneThumbnail({ definition }: { definition: ShaderDefinition }) {
  const activeKit = useBrandKitStore(state => state.activeKit)
  const [dataUrl, setDataUrl] = useState<string | null>(() => renderer.getCached(definition.id, activeKit)?.dataUrl ?? null)

  useEffect(() => {
    let disposed = false
    const cached = renderer.getCached(definition.id, activeKit)
    if (cached?.dataUrl) {
      setDataUrl(cached.dataUrl)
      return
    }
    setDataUrl(null)

    renderer.render(definition, activeKit).then(result => {
      if (!disposed && result?.dataUrl) setDataUrl(result.dataUrl)
    })

    return () => {
      disposed = true
    }
  }, [definition, activeKit])

  return (
    <div className="rv-shader-scene-thumb" style={{ background: definition.thumbnail?.color ?? '#111' }} aria-hidden="true">
      {dataUrl ? <img className="rv-shader-scene-thumb-img" src={dataUrl} alt="" loading="lazy" /> : null}
    </div>
  )
}
