import { createRoot } from 'react-dom/client'
import { ReviewNotesButton } from '../../dev/reviewNotes/ReviewNotesButton'

// A stand-in for the visualizer: a real WebGL canvas (no preserveDrawingBuffer, like the Cinema 2.0 stage) redrawn every animation frame by its own loop, which is
// queued before the review notes button is used, plus a global Space shortcut like the app's play/pause.
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const gl = canvas.getContext('webgl2')!
let frame = 0
const tick = () => {
  frame++
  const hue = (frame % 120) / 120
  gl.clearColor(0.9 * hue, 0.2, 0.9 * (1 - hue), 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
const shortcuts = { space: 0 }
window.addEventListener('keydown', event => { if (event.code === 'Space') shortcuts.space++ })
Object.assign(window, { __reviewNotesFixture: { shortcuts } })

createRoot(document.querySelector('#notes-host')!).render(
  <ReviewNotesButton engine="cinema2" presetId="review-notes-fixture" presetName="Fixture Preset" canvas={canvas}
    getContext={() => ({ playing: true, bpm: 123, canvas: { width: canvas.width, height: canvas.height }, cinema2ParameterState: { demo: 1 } })} />,
)
