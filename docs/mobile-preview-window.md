# Mobile Preview window

The phone-shaped floating button immediately left of Layout Lab opens a separate
window titled **DRMVYZ — iPhone 16 Preview**. Both keys are 36px square, share the
same baseline/style, and have a 10px gap. The shared application frame includes
this launcher in all workspaces.

The blank portrait screen is **393 × 852 logical pixels**. This design canvas
uses a 3× interpretation of the iPhone 16's 1179 × 2556 physical-pixel display,
as documented in [Apple's specifications](https://www.apple.com/iphone-16/specs/).
Rounded corners, a Dynamic Island area, a home indicator and reserved top/bottom
content insets provide the phone layout. Those visual inset/shape measurements
are design approximations. No mobile performance controls or live renderer have
been added; this change supplies the requested external mobile-format shell.

The launcher opens synchronously from the click, reuses/focuses its existing
window, and can reopen after manual close. Escape closes it. Parent teardown
removes listeners and closes its child. A blocked browser popup shows actionable
feedback next to the launchers.

Electron permits only the named `drmvyz-mobile-preview` blank-window request.
Its BrowserWindow uses a fixed 393 × 852 **content** size (OS title-bar chrome is
additional), `useContentSize`, and disabled resizing/maximize/fullscreen. It
retains context isolation, sandbox, web security and disabled Node integration.
Layout Lab and other existing popup sizes are unchanged. The preview has its own
small stylesheet and does not mount another app, audio engine or visualizer.

**Relaunch through `launch.command` after updating:** the native popup policy is
main-process code and is not replaced by renderer hot reload. Browsers may apply
their own popup sizing or window-manager constraints.

Validation: `node scripts/verify-mobile-preview.mjs` passed five browser/native
checks for position, dimensions, reuse, close/reopen/Escape, blocked-popup feedback
and actual Electron sizing/security preferences. It uses a disposable app-data
directory and loads the actual Electron main file, leaving existing application
windows/profile untouched. Screenshots/results are in ignored
`artifacts/mobile-preview/`. The 16 shared-frame tests, TypeScript, focused ESLint
Electron syntax checks and the production build passed. Changes are uncommitted; no new dependency,
cloud schema or mobile connectivity service is introduced.
