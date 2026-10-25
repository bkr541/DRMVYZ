import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { TemplateAudioDockMockup } from './TemplateAudioDockMockup'
import './layoutLabDesignWorkbench.css'

/** A blank React-View-shaped canvas: empty left window, empty visualizer, empty right window and the bottom audio dock. */
export function LayoutLabDesignWorkbench() {
  return (
    <div className="rv-shell ll-template-audio-theme ll-design-workbench">
      <div className="rv-layout">
        <WorkspaceRail side="left" label="Layout Lab left window">
          <div className="vz-panel-body" />
        </WorkspaceRail>

        <div className="rv-center-col">
          <div className="rv-canvas-wrap" role="region" aria-label="Layout Lab visualizer" />
        </div>

        <WorkspaceRail side="right" label="Layout Lab right window">
          <div className="vz-panel-body" />
        </WorkspaceRail>
      </div>

      {/* Outside the grid, full width, matching production's dock placement. */}
      <TemplateAudioDockMockup />
    </div>
  )
}
