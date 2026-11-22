# Mobile App Preview

The phone icon above Layout Lab opens the running STAGELESS mobile app in a
separate window. The app loads in a same-origin iframe with
`?mobilePreview=1`, shares the signed-in session, and uses the mobile shell
described in [Mobile app](mobile-app.md). The iframe keeps the iPhone 16 logical
viewport at 393 × 852 CSS pixels.

The launcher focuses the existing preview if it is already open and closes it
when the launcher unmounts. If the browser blocks the popup, the launcher shows
how to retry.

Electron allows the named `drmvyz-mobile-app-preview` request for a blank
window. Its initial content area is 449 × 908, including the padding around
the phone frame.
