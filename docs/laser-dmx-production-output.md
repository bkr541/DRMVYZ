# LaserDMX production output security and safety boundary

Patch 9 keeps DRMVYZ virtual-first. The repository is currently a Vite/React browser application. It does not contain an Electron main process, preload script, context-isolated IPC bridge, or packaged desktop runtime. Therefore:

- `VirtualProductionOutputAdapter` is the only executable adapter and the canonical default.
- Art-Net 4 and sACN/E1.31 are represented by typed protocol and adapter descriptors only.
- No UDP socket, network DMX packet, USB-DMX dependency, or native module is included.
- A future real adapter must live in a trusted host process, expose a narrow validated IPC API, remain disabled by default, require a user-selected network binding, and require a fresh session arm after every restart.

## Frame path

Spatial Fixtures compile once into `ProductionOutputFrame`. The virtual stage renderer consumes the fixture frames, while the output controller consumes that same compiled production frame. The controller validates fixture profiles and patches, prepares 512-channel universe buffers, applies adapter-side limits, and sends only to the selected registered adapter.

Virtual preview intensity and adapter output intensity are separate domains. Renderer controls continue to affect the preview. `hardwareMasterIntensity` is applied only while preparing adapter channel buffers.

## Session-only safety state

Physical enablement, network binding, arming, emergency blackout, heartbeat state, and adapter errors are runtime-only. They are not part of LaserDMX preset persistence, so a future physical adapter cannot auto-arm after restart or preset load.

The output controller fails dark for adapter failures, invalid patch errors, stale frames, heartbeat timeout, renderer crashes, authentication/account changes, transport stop, page close, and lifecycle disposal. Atmospheric trigger channels are edge-gated and respect profile cooldown metadata. Strobe output is capped independently from preview rendering.

Fixture patch diagnostics cover universe bounds, start address, channel footprint, address overflow, overlap, missing profiles, and excluded-zone target metadata. These checks are engineering safeguards only. They do not certify laser safety, venue compliance, electrical safety, atmospheric-effect suitability, or regulatory compliance.
