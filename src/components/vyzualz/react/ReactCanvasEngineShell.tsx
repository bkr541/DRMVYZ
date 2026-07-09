import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, ToggleRow } from './ReactControlRows'

const CANVAS_DESCRIPTION = 'Upload your own media and turn it into audio-reactive visuals.'
const CANVAS_MEDIA_COPY = 'Videos, images, SVGs, and visual assets will live here once upload is enabled.'
const CANVAS_NEXT_PATCH_NOTE = 'Upload functionality arrives in the next patch.'

function CanvasMediaTokens() {
  return (
    <div className="rv-canvas-media-tokens" aria-label="Supported CANVAS media types">
      <span>Video</span>
      <span>Images</span>
      <span>SVGs</span>
      <span>Visual Assets</span>
    </div>
  )
}

export function CanvasEngineSurface() {
  return (
    <div className="rv-canvas-engine-surface" role="img" aria-label="CANVAS engine placeholder">
      <div className="rv-canvas-engine-card">
        <div className="rv-canvas-engine-eyebrow">User Media Engine</div>
        <h2 className="rv-canvas-engine-title">CANVAS</h2>
        <p className="rv-canvas-engine-desc">{CANVAS_DESCRIPTION}</p>
        <CanvasMediaTokens />
        <button type="button" className="rv-canvas-upload-placeholder" disabled>
          Upload media for CANVAS
        </button>
        <div className="rv-canvas-engine-note">{CANVAS_NEXT_PATCH_NOTE}</div>
      </div>
    </div>
  )
}

export function CanvasEnginePanel() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  return (
    <>
      <CtrlSection label="CANVAS" />
      <div className="rv-canvas-engine-panel">
        <div className="rv-canvas-panel-title">Media Visuals</div>
        <div className="rv-canvas-panel-copy">{CANVAS_DESCRIPTION}</div>
        <CanvasMediaTokens />
        <button type="button" className="rv-canvas-upload-placeholder rv-canvas-upload-placeholder--panel" disabled>
          Upload media for CANVAS
        </button>
        <div className="rv-canvas-engine-note">{CANVAS_NEXT_PATCH_NOTE}</div>
        <div className="rv-canvas-panel-status">
          <span>Loaded media</span>
          <strong>{settings.mediaIds.length}</strong>
        </div>
      </div>
    </>
  )
}

export function CanvasEngineFxPlaceholder() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  return (
    <div className="rv-ctrl-group">
      <Collapsible label="CANVAS" defaultOpen>
        <div className="rv-canvas-panel-copy">{CANVAS_MEDIA_COPY}</div>
        <ToggleRow
          label="Auto Select"
          value={settings.autoSelectEnabled}
          onChange={() => undefined}
          disabled
          title="CANVAS Auto Select arrives with media upload in the next patch."
          description="Placeholder only. Audio Intelligence media selection is not enabled yet."
        />
        <button type="button" className="rv-canvas-upload-placeholder rv-canvas-upload-placeholder--panel" disabled>
          Upload media for CANVAS
        </button>
        <div className="rv-canvas-engine-note">{CANVAS_NEXT_PATCH_NOTE}</div>
      </Collapsible>
    </div>
  )
}
