# Switch It — Phase 2 manual controls and authored motion

Status: approved, including the corrected solid-mask overlay. Phase 3 shared audio delivery is documented in `cinema2-switch-it-phase3.md`. The earlier opaque Demon Mask and 22% enlargement were accepted. The latest user revision enlarges that mask another 30%, retains its solid textured surface over the intact character, removes the divider and replacement skull eyes, and adds a soft contact shadow. This is the historical Phase 2 checkpoint; the completed production release is documented in `cinema2-switch-it-production.md`.

## Run and review

From the repository, run `node scripts/cinema2-assets/accept-switch-it-phase2.mjs --serve` and open the printed local URL. The page renders the native Cinema 2.0 runtime beside the actual generic Design Inspector. **Play preview** runs authored motion; it does not pretend to play an audio recording. The page starts paused on the selected program's baseline. Stop it with Ctrl+C.

Without `--serve`, the script performs focused canvas/Inspector validation and writes captures, `report.json` and `six-patterns.mp4` to ignored `artifacts/switch-it-phase2/`. The film shows Switch Cycle, Split Portrait, Twin Reveal, Facet Peel, Skull Projection and Crown Surge, in that order, for approximately 2.5 seconds each. This is captured native geometry, not a reference-video texture.

## Native programs

| Program | Visible behavior |
| --- | --- |
| Switch Cycle | Intact human hold, lateral traversal to a held hybrid, full supplied-mask hold, then reconstruction. The cycle closes on the same intact head. |
| Split Portrait | Fixed user Reveal Position exposes the solid mask over an intact character. No white divider, time-dependent reveal drift or camera movement. |
| Twin Reveal | Two opposing fronts reveal the mask from the outside toward the center, then reconstruct. |
| Facet Peel | A separate layer of stable facet identities lifts locally above the intact character, alongside the solid mask. The base face, neck and shoulders stay visible. |
| Skull Projection | Complete solid horned mask over the full character, open sockets showing the actual character eyes, and a gently breathing projection column. |
| Crown Surge | Head-local fragments rise into a crest over the intact base and solid mask, then settle. The optional face-local flare remains under manual authorization. |

The supplied model's horn and tooth geometry stays intact. Its current runtime scale is 1.586 relative to the first mask preview (the previous 1.22 scale multiplied by 1.30). Its original material maps remain in use. No procedural replacement skull, invented mandible or extra tooth row is added.

## Parameter → visible output

The shared Inspector uses exactly four parent groups. Seam Width and Seam Glow were removed with the user-requested divider removal; Mask Opacity was removed after the user clarified that the surface must stay solid; they are not left as inert controls. Every visible control has a consumer; later-phase controls are not exposed as inert placeholders.

| Parent / control | Min / default / max or OFF / ON behavior |
| --- | --- |
| Master Controls / Master Intensity | 0 / 1 / 1.5 scales subject, mask, eyes, seam and column illumination. Palette background remains independent. |
| Master Controls / Motion Speed | 0 holds / 1 authored cadence / 2 double cadence; fixed split remains fixed. |
| Master Controls / BPM Sync | ON follows a valid shared tempo when host Sync BPM also permits it; OFF uses the authored free cadence. |
| Design / Pattern | Six different native programs listed above. Manual edits affect the base without turning Pattern Change OFF. |
| Design / Pattern Change | OFF holds the selected base; ON advances on a new canonical selected event. Default OFF. |
| Design / Trigger | All 11 existing shared options, visible only when Pattern Change is ON. No locally synthesized beats or drop events. |
| Design / Portrait Scale | 0.65 / 1 / 1.2 scales the whole registered portrait around the eye line. The requested additional 30% mask enlargement is retained inside that portrait. |
| Design / Reveal Position | Split Portrait only: 0 no mask / 0.5 half mask / 1 full solid mask. The underlying character remains intact throughout. |
| Design / Facet Relief | 0 approved flat bust / up to 0.12 separates human facets along their own normals. |
| Design / Fragment Reach | 0 prevents local lift / 0.35 / 0.8 sets the displacement limit for peel/crown fragments. |
| Design / Eye Intensity | 0 / 1 / 2 scales the actual character eyes visible through the open mask sockets. |
| Design / Eyes Enabled | OFF removes character eye emission; ON allows the actual narrow character eyes. No replacement orb geometry is present. Default ON. |
| Design / Column Intensity | 0 removes the column / 1 / 2 scales its projection light. |
| Effects / Fragment Amount | 0 / 0.5 / 1 selects none / half / all of the stable face identities eligible for local lift. Default 1. Selection is independent of reveal order. |
| Effects / Flare Enabled | OFF hard-disables the accent; ON permits only the brief face-local reconstruction/crown accent. Default OFF. |
| Effects / Flare Strength | 0 / 0.35 / 1 bounds the authorized local accent; visible only when enabled. |
| Palette / Background | Independent environment background. |
| Palette / Human Shell | Human triangle surface color. |
| Palette / Facet Rim | Separate edge-facing facet light. |
| Palette / Skull Mask | Supplied mask surface tint and restrained rim term, preserving material detail. |
| Palette / Energy | Character eyes and authorized face-local accent. |
| Palette / Projection Column | Separate projection-mesh color; never aliases Background. |

Audio Response, Auto Performance and postprocessing Bloom are deferred to their planned phases. No disabled toggles are presented as if those features already work. Surface-level fragment/flare controls are implemented here; later finishing refines them and adds postprocessing.

## Solid surface, open sockets and retained character

The user clarified that “transparency” meant retaining the full character behind the mask, not making the skull surface see-through. The mask therefore has a full-opacity textured interior (opacity 1), with its original red PBR material detail restored. Alpha blending remains only for the softly feathered reveal boundary. The Mask Opacity slider has been removed.

The complete character base remains rendered in every state. Eyes are visible through the model's real open sockets; the jaw, neck and shoulders remain visible around/below the solid mask. No replacement eye disks, dark socket fillers, human-face clipping or white divider are added. The mask retains the requested additional 30% size increase and Z offset of 0.28.

A 512px silhouette projected from the supplied triangles is blurred by 4px and offset slightly right/down for a subtle fixed-frontal contact shadow on the character surface. Shadow strength retains the previous subtle level and follows mask visibility; it does not paint over the character's eyes or empty background. No new scene-wide shadow renderer is introduced.

## Camera, time and authority

The engine owns the camera at (0,0,5), looking at (0,0,0), orthographic height 2.8. No camera animation or alternate camera controller is introduced. The portrait geometry scales by `min(1, viewportAspect)` on narrow canvases so the horizontal composition remains visible. Square/landscape framing preserves the approved portrait; at enlarged sizes horn tips may reach the frame edges.

`Cinema2BeatClock` remains the shared timing authority. One cycle spans four shared beats at Motion Speed 1. Free timing, or missing valid tempo, uses a deliberate 2.25-second cycle. Effective lock requires preset BPM Sync AND host Sync BPM. Mode changes retain integrated phase; the clock slews toward a valid grid rather than resetting the pose.

Authored motion follows actual playback even if analysis is temporarily unavailable; that is a visual fallback, not a claim that musical facts exist. Pause freezes pose, Speed 0 freezes cycle progress, and no-track playback remains static. Manual edits remain visible while paused. Track changes, seeks/loops and context restoration rebase to the selected program's deterministic baseline. Pattern handoffs blend signed reveal fields and facet poses over 240 ms, including interrupted manual edits.

The complete standard Pattern trio is connected to the existing generic pattern controller and canonical event selector so the Phase 2 UI has real behavior. Held, stale and paused events are not replayed; a Pattern edit establishes the user's base until a fresh qualifying event. This is a prerequisite hook for Phase 4, not the later transient-envelope choreography program. No saved Pattern/Trigger values are rewritten by automatic advancement.

## Architecture and evidence

- Private Phase 2 manifest/registry: `Cinema2SwitchItPhase2Preset.ts`; no first-party catalog entry.
- Shared Phase 1/2 module resource loader retains the supplied model, textures and scoped disposal.
- Pure authored pose sampler plus `Cinema2SwitchItMotion` consumes shared transport/clock/event facts only.
- Reveal fields control the solid PBR mask and moving facet layer. They no longer remove the base character or its eyes. The mask is composited as an elevated solid front overlay, with depth writes disabled. The base face is retained; solid mask geometry naturally covers the portions directly behind its surface. Stable per-face seeds prevent frame-to-frame remeshing or random identities.
- No continuous audio accents, Director interpretation, Auto Performance override or screen-space finishing is implemented at this checkpoint.

Focused tests cover private compilation/grouping, six distinct closed programs, held split, BPM permissions/fallback, pause/speed zero, seek/loop/track/context resets, interrupted manual handoffs, all 11 canonical triggers, manual authority, paused-event latching and hard limits. Native-canvas checks exercise program motion, min/default/max control effects, colors, hard OFFs, sync permission, fixed camera/aspects, real Inspector controls/typography and disposal/re-entry. The review artifacts establish observable behavior; aesthetic approval remains a human judgment.

Changes remain uncommitted; no commit was requested. The next planned phase is Shared Audio Intelligence after this manual-motion checkpoint is reviewed.

Latest overlay validation: 23 focused tests, TypeScript and 32 native rendered comparisons passed. Eye-shape checks confirm both actual character eyes (approximately 3.9:1 width/height), and the divider scan found zero white pixels outside the eye band. Reveal OFF matches the unmasked character face exactly; the neck/chest region remains unchanged with the solid mask present (mean difference 0). No browser/render errors or retained resource leases were reported.

Run `node scripts/cinema2-assets/verify-switch-it-overlay.mjs` after the native capture script to reproduce the retained-character checks. The current still review is `artifacts/switch-it-phase2/solid-mask-comparison.png`; the current motion recording remains `six-patterns.mp4`. Earlier translucent captures are superseded.
