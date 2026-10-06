// Whether the user has the Headliner camera switched on during this app session. It starts off, so a
// freshly launched app never opens the camera on its own (even when Headliner was the last engine).
// Switching to another engine and back keeps the camera on if it was on. It lives in module scope on
// purpose: it must outlive the Headliner surface but not the app.
let cameraWanted = false

export function isHeadlinerCameraWanted(): boolean {
  return cameraWanted
}

export function setHeadlinerCameraWanted(wanted: boolean): void {
  cameraWanted = wanted
}
