# Running the private beta

Beta remediation packages 05 (authentication and beta access) and 06 (performance, output and beta operations).

## Before handing out a build

1. **Apply migrations** `0064_preset_catalog_off_switch.sql`, `0065_beta_invites.sql` and `0066_beta_issue_reports.sql` (each has a rollback in `supabase/rollback/`). Run `supabase/tests/beta_invites_security.sql` and `beta_issue_reports_security.sql` on a staging database first.
2. **Supabase dashboard › Authentication:**
   - **Policies:** set the minimum password length to 10 (the app asks for 10; only the server enforces it).
   - **Emails › Templates:** paste `supabase/templates/recovery.html` into *Reset password*. The app's reset screen asks for the 6-digit code (`{{ .Token }}`); a template that only sends a link leaves testers stuck. Paste the other templates too (see `supabase/templates/README.md`).
   - Then try sign-up, email confirmation, password reset and the new password with a fresh test account.
3. **Invite the testers:** Admin Console › User Accounts › **Beta Invites**. Add each tester's email (no email is sent; tell them yourself), and only then let them sign up.
4. **Bump the version** in `package.json` for every build you hand out (`1.0.0-beta.1`, `1.0.0-beta.2`, …) and commit before building, so the build reads as a clean commit.

## Invitation-only sign-up (AUTH-01)

Migration 0065 adds `beta_invites` (admins only) and a trigger on `auth.users`: a sign-up through Supabase Auth is refused unless its email is invited (case and spaces aside), or the user was invited from the Supabase dashboard. The invite is then marked **Joined**. Existing accounts are unaffected. The app explains the refusal ("This email has not been invited to the beta"). There is no public check of whether an email is invited, so the list cannot be probed.

**Revoking access:** withdrawing an invite stops a future sign-up. To remove a tester who already has an account, delete or ban the user in Supabase › Authentication › Users. Accounts an admin adds by hand in the dashboard (rather than inviting) need an invite first.

## Terms and privacy (PRIV-01)

The sign-up form's **Terms & Privacy Policy** link opens `src/components/auth/BetaTermsDialog.tsx`: a plain-language beta notice written from what the app does (uploads, account data, camera and microphone, lyric transcription, diagnostics, casting). **It is a draft: have it reviewed before any public release.** Change `BETA_TERMS_VERSION` when the text changes.

## Offline sign-in (AUTH-03)

Offline, the app opens only as the account the server last confirmed on this computer, and only for 14 days after that confirmation (`src/lib/offlineSessionFallback.ts`). Every confirmed sign-in and token refresh renews it; signing out clears it. Admin pages and anything checked on the server stay unavailable until the app is back online. After this update, each tester needs one online start before offline use works.

## Recording (PERF-01)

- **Desktop app:** recordings are written to disk as they are made, in `Downloads/STAGELESS Recordings/` (`native/recording/recordingBridge.cjs`, `src/hooks/recordingSink.ts`). The file is `<name>.partial` while recording and gets its final name when recording stops. If the app or computer stops first, the `.partial` file keeps everything recorded so far (WebM plays as it is; rename it to `.webm`). Recording needs 2 GB free to start, and stops itself (keeping the file) if free space drops below 512 MB.
- **Browser:** recordings stay in memory and stop themselves at 1.5 GB (about 30 minutes at 8 Mbps), saving what was recorded. Use the desktop app for full sets.

## Google Cast (PERF-02)

The live stream's send queue is bounded (`src/components/vyzualz/react/output/castBackpressure.ts`). About 2 seconds behind, the performer is told the network is too slow. About 5 seconds behind (or 16 MB waiting), the cast ends with that reason rather than lagging further and using more memory, and it can be started again.

## Versions (DEP-03)

Every build carries its version, commit (with `-modified` if built from uncommitted changes) and build date (`src/lib/buildInfo.ts`, written by `vite.config.ts`). It is shown in Settings › **Beta & Support**, included in copied diagnostics and in every issue report, and the desktop log records `app.getVersion()` on start.

## Issue reports (UX-01)

Settings › **Beta & Support** › **Report an Issue**: a category, what happened, steps to reproduce, and **Include Diagnostics** (on by default). Diagnostics carry the build, platform, graphics, screen, what was active (engine and presets) and the last 150 log lines, with links reduced to origin and path, local user folders, sign-in tokens, long identifiers and email addresses removed (`src/features/beta/issueReport.ts`). Media is never included. Each tester can send up to 20 reports a day. Settings › System Settings › **Copy Diagnostics** uses the same clean-up.

Reports are in the `beta_issue_reports` table (Supabase › Table Editor). Testers can read their own; admins read all and can set `status` to `triaged`, `fixed` or `closed`.
