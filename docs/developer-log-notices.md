# Developer system-log notices

New `warn` and `error` entries appended to Electron's persistent `main.log` create the shared warning/error NoticeCards in the sidebar Notifications drawer. Notices are global across workspaces, newest first, capped at 20, dismissible and marked read when the drawer opens. Each card includes its timestamp, component, scope, message and subsequent stack/context lines. Debug/info entries and pre-subscription history do not create cards. This monitors the app's current system log, not arbitrary files in the logs directory.

## Developer access

Inspection of the linked Supabase project's public profile schema and existing auth app metadata on 2026-10-28 found no developer role field or assigned developer claim. The production Developer settings tab previously had no access condition.

A shared rule now enables the tab and notices in local Vite development builds, or in production for a verified Supabase user whose **server-managed `app_metadata`** contains `role: "developer"` or `is_developer: true`. User-editable metadata, email matching and ordinary authenticated/admin roles do not grant access. No database records or account roles were changed. Production accounts therefore need one of these developer claims assigned through trusted Supabase administration. Failed/offline production verification denies access. Sign-out, access loss and unmount remove the subscription and clear its notices.

The monitor mounts once in the authenticated application. Native log watching is shared with Settings → Developer → Logging; closing that panel cannot disconnect notices. The watcher serializes reads and follows log rotation; the consumer buffers incomplete lines, resets on rotation and updates multiline records without recreating dismissed cards. Notifications never write logs themselves. Electron must be restarted to load updated preload/native bridge code. Browser-only sessions have no persistent native log stream.

Focused coverage: developer authority, severity filtering, fragmented and multiline writes, rotation reset, retention, read/dismiss behavior, access cleanup, native file watching and multiple preload subscribers.
