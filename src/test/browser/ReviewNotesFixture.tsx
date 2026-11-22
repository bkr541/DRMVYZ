import { createRoot } from 'react-dom/client'
import { AppReviewNotes } from '../../dev/reviewNotes/AppReviewNotes'
import { setReviewNotesScene } from '../../dev/reviewNotes/reviewNotesSceneStore'

// A stand-in for the app: a header with the review notes button in its middle, and a stage with a real WebGL canvas (no preserveDrawingBuffer, like the Cinema 2.0
// stage) redrawn every animation frame, with a label sitting over it. A global Space shortcut stands in for the app's play/pause.
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const gl = canvas.getContext('webgl2')!
const tick = () => { gl.clearColor(0.9, 0.2, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT); requestAnimationFrame(tick) }
requestAnimationFrame(tick)
const shortcuts = { space: 0 }
window.addEventListener('keydown', event => { if (event.code === 'Space') shortcuts.space++ })
Object.assign(window, {
  __reviewNotesFixture: {
    shortcuts,
    /** The visualizer says which preset is on stage (or nothing). */
    setScene: (on: boolean) => setReviewNotesScene(on ? { engine: 'cinema2', presetId: 'review-notes-fixture', presetName: 'Fixture Preset', getContext: () => ({ playing: true, bpm: 123, canvas: { width: canvas.width, height: canvas.height }, cinema2ParameterState: { demo: 1 } }) } : null),
  },
})
createRoot(document.querySelector('#header-center')!).render(<AppReviewNotes page={{ id: 'review-notes-fixture-page', label: 'Fixture Page' }} />)
