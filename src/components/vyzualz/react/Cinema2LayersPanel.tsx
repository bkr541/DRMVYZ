import type { Cinema2Runtime } from '../cinema2'
import { LayerRow } from './controls/LayerRow'

const CINEMA2_LAYER_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#61d6aa', '#d8b95a']

export interface Cinema2LayersPanelProps {
  runtime: Cinema2Runtime | null
}

/** Read-only authored Scene/Layer view. Editable layer state is not invented here. */
export function Cinema2LayersPanel({ runtime }: Cinema2LayersPanelProps) {
  if (!runtime) return <EmptyCinema2Layers copy="Cinema 2.0 layers are unavailable until the runtime is active." />
  const scene = runtime.getSceneGraph()
  if (scene.layers.length === 0) return <EmptyCinema2Layers copy="This Cinema 2.0 preset does not declare user-facing layers." />

  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema 2.0 layers" data-cinema2-layers="scene">
      <div className="rv-cinema-panel-list__header"><strong>Layers</strong><span>{scene.layers.length}</span></div>
      <div className="rv-cinema-layer-tree">
        {scene.layers.map((layer, index) => {
          const role = layer.role ? `${layer.role} · ` : ''
          const status = `${role}${layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'} · ${layer.blendMode}`
          return (
            <LayerRow
              key={layer.id}
              index={index + 1}
              label={layer.label}
              status={status}
              tone={CINEMA2_LAYER_TONES[index % CINEMA2_LAYER_TONES.length]}
              data-cinema2-layer-id={layer.id}
              data-cinema2-layer-source={layer.sourceNodeId}
              data-cinema2-layer-depth={layer.depthPolicy}
              aria-label={`${layer.label}, ${status}`}
              disabled
            />
          )
        })}
      </div>
    </section>
  )
}

function EmptyCinema2Layers({ copy }: { copy: string }) {
  return <div className="rv-ctrl-group"><div className="rv-ctrl-info" data-cinema2-layers="empty">{copy}</div></div>
}
