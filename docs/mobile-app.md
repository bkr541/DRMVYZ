# Mobile app

Phones that sign in get a dedicated set of mobile screens instead of the full desktop application. Auth is unchanged: the same sign-in page and Supabase session, then the shell is chosen. Built from the same stores and components as the desktop, guided by the Mobile Preview mockups (`docs/mobile-preview-window.md`).

## Who gets it
`src/components/vyzualz/mobile/mobileDevice.ts`, decided once per page load in `App.tsx`.
- A phone is touch-first (`pointer: coarse`, `hover: none`, touch points) with a short viewport side of at most 820 CSS px. iPads (including iPadOS, which reports a Mac user agent with touch points) and Android tablets stay on the desktop app.
- Override: `?view=mobile` or `?view=desktop` in the address is remembered in `localStorage`. The Remote page has a "Use desktop version" link (it stores the choice and reloads).
- The Mobile App Preview frame is always a phone, so a desktop can see the mobile screens.
- The shell is a lazy chunk (`MobileApp`), so desktop users never download it.

## Screens
`MobileApp.tsx` owns the shell: header (`RailWindowHeader` with the real page-scoped Notifications bell), the page body, and the bottom navigation.
- **Perform** (`MobilePerformPage`): the production engine dropdown (all engines listed; only Cinema 2.0 is selectable on mobile, the rest are disabled), then Presets and Controls tabs. Presets is the real `Cinema2PresetsPanel` (SYSTEM / USER, search; USER comes from the signed-in account's preset catalog). Controls is the real `Cinema2InspectorPanel` (Design and React surfaces) bound to the live runtime.
- **Pads** (`MobilePadsPage`): the real `ReactPerformancePads`, twelve a bank (Pads 1 and Pads 2). A pad whose destination is a Cinema 2.0 preset loads that preset; pads for other engines are disabled (`isMobileUsablePad`).
- **Visualizer** (`MobileVisualizerPage`, `MobileAudioPanel`): the live Cinema 2.0 output, with a "Select preset to display" notice when no preset is loaded, and the audio source below it: Mic (Live Input) or Track (the user's saved tracks, loaded through `loadSavedTrackIntoEngine`).
- **Remote**: a mockup (static list of example desktops, buttons disabled).

The stage is mounted by the shell, not by a page, and positioned over the Visualizer page's slot. It keeps its WebGL context while the user is on other pages (Perform's Controls needs the runtime), but rendering is suspended whenever the Visualizer page is not showing or the tab is hidden. A pad press or preset choice writes to the shared store (`cinema2Workspace`), which is what the stage renders.

No preset is chosen for the user: the desktop auto-activates a default preset, the phone does not.

## Pad sync
Pad assignments follow the account (`docs/mobile-stage-links.md`, table `performance_pad_sets`). `usePerformancePadSync` runs for both apps once signed in; `PerformancePadSync` holds the rules.
- The cloud set has a revision. A device pushes unsynced edits (debounced 1.5 s) against the revision it last saw.
- If the cloud moved on, the cloud set wins and this device's unsynced pads are first written to `localStorage` key `drmvyz.padSync.backup.v1.<userId>`.
- A fresh device with the stock pads never pushes them, so a new phone cannot overwrite a desktop's custom pads.
- Refreshed on focus, when the page becomes visible, when the network returns, and every minute while visible.

## Not built yet
- Casting (stage links over WebRTC: `docs/mobile-stage-links.md`).
- Remote control of a desktop.
- Engines other than Cinema 2.0.
- A phone-side fullscreen stage.

## Validation
`mobileDevice.test.ts`, `MobilePads.test.tsx` (banks, pad to preset, unusable pads, disabled engines), `PerformancePadSync.test.ts`. Rendered in Chromium at 393 × 852 with the real Cinema 2.0 runtime (software GL): Perform, Controls, Pads, Visualizer, Remote, the empty Visualizer notice, a pad changing the loaded preset, and Live Input from a fake microphone. Not run on a real phone.
