import { createRoot } from 'react-dom/client'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import type { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import '../../styles.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'
import '../../styles/tabRows.css'
import '../../styles/groupSpacing.css'
import '../../styles/typography.css'

/** Actual schema-driven production controls, not a second Inertia-specific UI. */
export function mountInertiaInspector(container: HTMLElement, runtime: Cinema2Runtime): () => void {
  const root = createRoot(container)
  const render = () => root.render(<Cinema2InspectorPanel runtime={runtime} surface="design" sharedAudioAnalysis={false} />)
  render()
  return render
}
