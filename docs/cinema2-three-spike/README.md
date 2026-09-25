# Cinema 2.0 Three.js spike (roadmap #5): reference code

Throwaway spike code, kept as reference for roadmap #6. Files are `.txt` so lint and tsc ignore them. Results and decisions are in
`docs/cinema2-advanced-3d-roadmap.md`, section "#5 Three.js spike".

- `Cinema2ThreeSpikeBrowserHarness.ts.txt` - the harness. Put it back at `src/test/browser/Cinema2ThreeSpikeBrowserHarness.ts` (with the html file next to it).
  It registers a `three-spike` module and a clone of the Atmosphere Reference preset, and exposes `window.spike` (shot, stateLeak, depthCheck, soak, cycles,
  contextLoss, calibrate, exportHeroGlb, loadGlb, ...). Contains the pieces #6 will promote to product code: `ThreeBridge` (camera and light mapping, the
  external-framebuffer draw, the RT+copy fallback), `MinimalGlStateGuard`, the shared per-context renderer and cached PMREM environment.
- `cinema2-three-spike.html.txt` - the page.
- `drive.mjs.txt` - Playwright driver skeleton (real Chrome, Apple GPU). Run vite on port 5197, then `node drive.mjs ./your-script.mjs`.
- `electron-main.cjs.txt` - minimal Electron main that mirrors the production `drmvyz-app://` protocol and sandbox settings, used to run the same checks in
  Electron 43. Needs `env -u ELECTRON_RUN_AS_NODE`. It expects a `vite build` of the harness page in `dist/`, with the GLB files and
  `cinema2-decoders/draco/` copied in.
- To recreate the test GLBs: export from the harness (`exportHeroGlb`) and compress with `npx @gltf-transform/cli meshopt|draco in.glb out.glb`.
