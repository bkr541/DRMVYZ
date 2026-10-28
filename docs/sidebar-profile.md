# Shared navigation profile/settings control

The profile control now lives at the bottom of `VyzualzSidebar`, after the
license/version footer. It remains visible in both the collapsed rail and the
expanded sidebar, across React, Preset Manager, Show Manager, Lyric Manager and
Media Manager. Shared `VyzualzHeaderActions` renders only page/status/notification
controls; headers no longer own a profile button or settings dialog.

`VyzualzProfileControl` retains the avatar, display-name/email initials fallback,
profile reload on settings open/close, and existing SettingsModal functionality.
A gear fallback keeps settings accessible without cloud configuration or when
account loading is unavailable. The original avatar styling and shared nav-label
typography are reused. Settings is portaled to the app root so the sidebar cannot
clip it or constrain its stacking; the existing dialog focus trap, Escape,
backdrop/close actions, settings tabs and sign-out remain owned by SettingsModal.

Focused validation covers profile loading/fallback/refresh, modal ownership,
header removal, sidebar navigation, all workspace chrome and Show Manager's
header. `node scripts/verify-sidebar-profile.mjs` exercises the real workspace
frame, audio provider, sidebar, shared header and SettingsModal across all five
routes. It checks one navigation control, no header duplicates, viewport dialog
placement, focus return, collapsed/expanded bottom placement and Appearance-tab
access. Screenshots/report are under ignored `artifacts/sidebar-profile/`.
No commit was requested.

Validation completed: 24 focused tests passed (23 profile/header/sidebar/frame
checks plus the targeted Show Manager header check). All 24 production-browser
checks passed across the five workspace routes. TypeScript no-emit, focused ESLint
and diff whitespace checks passed. Changes remain uncommitted.

The navigation avatar was enlarged from 28px to 44px to fill the rail more
comfortably. This is scoped to the sidebar account area; the avatar image still
fills its circular container. All 26 browser checks passed, including 44px size,
bottom placement and centering in collapsed/expanded navigation, and the existing
settings behavior. Lint and diff whitespace checks passed. Changes are uncommitted.

Visual review refined the navigation avatar to 38px after 44px was slightly too
large. The existing sidebar-only sizing scope and settings behavior are retained.


## Navigation notifications

Notifications now sits directly above Profile in the same bottom navigation
area, as a 38px icon-only button in collapsed and expanded layouts. The accessible
name and tooltip retain the notification count. Alert dots, ringing, page-scoped
drawer notices/events, dismissal and read tracking reuse the existing component
and store. Changing workspace closes the previous workspace's drawer. React and
shared manager headers now contain telemetry/activity/status only.

Each workspace maps to its own notification scope; Preset Manager now has an
explicit scope and provider instead of borrowing another workspace's messages.
The production browser check additionally exercises icon-only rendering, unread
indicators, correct drawer messages/read state for all five workspaces, and
Notifications-above-Profile placement in both rail modes.

Notification relocation validation: 46 focused tests passed, including the targeted
Show Manager header case. All 48 real-browser checks passed. TypeScript no-emit,
focused ESLint and diff whitespace checks passed. Changes remain uncommitted.

The notification bell uses the user-supplied `Bell--Streamline-Solar.svg` artwork
(Streamline, https://streamlinehq.com), with theme-inherited strokes and a subdued
lower arc. The rail bell is 24px with a subtle drop shadow; the button has no background or border.
Its 38px hit area, unread dot, animation and drawer actions remain.

The shared production header no longer shows the logo or DRMVYZ wordmark in any
workspace. An accessible chevron button retains sidebar expand/collapse behavior.

The expand/collapse control now sits immediately above Notifications at the bottom
of the left navigation. The Preset Manager header has no title. React, Show Manager,
Lyric Manager and Media Manager action toolbars flow from the left of their headers,
with no enclosing panel or dividers, 38px hit areas and 24px icons with the same drop
shadow as the notification bell. Active/destructive colors, labels, keyboard focus,
disabled states and action handlers remain. Show Manager Save and Show Lyrics use
icon-only keys with accessible labels and tooltips.

Header action update validation: 77 browser checks passed with production header
components and representative manager action markup, plus screenshot inspection.
The shared frame/sidebar, Lyric header and targeted Show Manager save tests passed
(22 focused tests). TypeScript and diff checks passed; lint has no errors and retains
four existing Show Manager hook-dependency warnings. The full Show Manager suite
has 12 unrelated failures, reproduced with its unchanged HEAD implementation;
the icon-only Save regression test was updated to query its accessible label and passed.

Layout Lab is now a shared icon-only navigation button immediately above
Notifications (below expand/collapse), using the same 38px hit area, 24px icon and
drop shadow. Its existing popup opens from every workspace; the React header
no longer contains the trigger.
