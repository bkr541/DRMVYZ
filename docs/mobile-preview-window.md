# Mobile Preview window

The iPhone launcher sits in the lower-left sidebar, below Layout Lab and directly above the expand/collapse control.

The sidebar phone button opens **DRMVYZ — Mobile
Preview**, a resizable desktop window initially requesting **1200 × 1000 content
pixels**. Both launchers use the sidebar's standard utility-button sizing and spacing.

A left navigation bar contains four selectable MVP concepts, each with
navigable Presets, Pads, Controls and Cast screens:

- **Option 1 — Classic controller:** persistent current scene and bottom navigation.
- **Option 2 — Scene deck:** top segments, a panoramic scene and preset list.
- **Option 3 — Live console:** vertical tool rail, compact preset tiles and status strip.
- **Option 4 — Session dashboard:** a shortcut hub opens full-page workspaces with
  a back link and persistent session footer.

Preset cards and scene arrows update the example scene. Search/favorites filter
sample presets; pads, sliders, output selection and casting show local demo
feedback. Casting never transmits video, and nothing loads into the live desktop
runtime. Switching concepts resets the sample state; reopening starts on Option 1.
These are visual MVPs for comparing layouts, not production mobile clients.

The iPhone screen retains its **393 × 852 logical-pixel** layout, Dynamic Island,
rounded corners and home indicator. The rendered phone stays at exactly 393 × 852 CSS pixels regardless of the
sidebar or window size. It centers when there is space; smaller windows scroll
the preview area horizontally/vertically instead of shrinking the phone. The
left navigation remains outside that scrolling area.
Shared typography roles and application icons are used in the popout.

The launcher reuses/focuses its existing window and can reopen after manual
close. Escape closes it; parent teardown removes listeners and closes the child.
Blocked browser popups show actionable feedback. Reopening starts on Option 1.

Electron permits only the named `drmvyz-mobile-preview` blank-window request.
The native window allows resizing/maximizing with a 800 × 960 minimum content
size, while retaining context isolation, sandbox, web security and disabled Node
integration. Other application popouts keep their existing window policies.
The preview never mounts another app, audio engine or renderer.

**Relaunch through `launch.command` after updating:** Electron main-process
window dimensions are not replaced by renderer hot reload. Close any old preview
before reopening it. Browsers may constrain popup dimensions to their display.

Validation is maintained in `scripts/verify-mobile-preview.mjs`: all four
concepts and their internal navigation, sample controls, floating-button placement,
popup dimensions, fixed-size phone bounds, compact-window scrolling, reuse,
close/reopen/Escape and blocked-popup feedback. The default run also checks actual
Electron sizing/security preferences using disposable application data; use
`--browser-only` for renderer-only changes. Screenshots and results are written to
ignored `artifacts/mobile-preview/`. No dependency or migration added.
