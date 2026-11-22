# STAGELESS auth email templates

Branded HTML for Supabase Auth emails. Paste each file into the Supabase dashboard (Authentication → Emails → Templates). They are not applied automatically, because this repo has no `supabase/config.toml`.

| File | Dashboard template | Subject suggestion | Delivers |
| --- | --- | --- | --- |
| `confirmation.html` | Confirm sign up | Confirm your STAGELESS email | link |
| `recovery.html` | Reset password | Your STAGELESS password reset code | 6-digit code (`{{ .Token }}`) |
| `magic_link.html` | Magic link | Sign in to STAGELESS | link |
| `invite.html` | Invite user | You're invited to STAGELESS | link |
| `email_change.html` | Change email address | Confirm your new STAGELESS email | link |
| `reauthentication.html` | Reauthentication | Your STAGELESS verification code | code |

`recovery.html` uses a code because the app resets passwords with `supabase.auth.verifyOtp({ type: 'recovery' })` (see `src/components/auth/AuthPage.tsx`).

The wordmark is styled text, not an image, so the emails need no hosted assets. Also set the sender name to STAGELESS under Authentication → SMTP Settings.
