import { useEffect, useRef } from 'react'
import { BRAND_NAME } from '../../brand'

/** When this notice last changed. Shown in the dialog so testers know which version they agreed to. */
export const BETA_TERMS_VERSION = '2026-11-28 (private beta draft)'

/**
 * The private beta's Terms and Privacy notice, opened from the sign-up form. It is a plain-language draft written from what the app actually
 * does (see docs/beta-operations.md); have it reviewed before any public release.
 */
export function BetaTermsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="auth-terms-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-terms" role="dialog" aria-modal="true" aria-labelledby="auth-terms-title">
        <header className="auth-terms-header">
          <h2 id="auth-terms-title">{BRAND_NAME} Beta Terms &amp; Privacy</h2>
          <p className="auth-terms-version">Version {BETA_TERMS_VERSION}</p>
        </header>
        <div className="auth-terms-body">
          <h3>The beta</h3>
          <p>{BRAND_NAME} is pre-release software offered by invitation for testing. Features may change, break or be removed, and saved work may need to be recreated. Keep your own copies of anything you upload. Please do not share builds, invites or unreleased presets.</p>
          <h3>What you upload</h3>
          <p>Music, images, videos, logos, fonts and 3D models you upload stay yours. They are stored in private storage for your account so the app can play and render them. Only upload material you have the right to use. You can delete your uploads in the Media Manager.</p>
          <h3>Account data</h3>
          <p>We keep your email, display and artist names, profile picture and sign-in times to run your account, and your projects, Shows, pads and presets so they are there on every device. Admins can see account details to support the beta.</p>
          <h3>Camera and microphone</h3>
          <p>The camera and microphone are used only when you turn on a feature that needs them (for example HEADLINER camera effects or live audio input). Video and audio from them are processed on your computer and are not uploaded.</p>
          <h3>Lyric transcription</h3>
          <p>If you ask the app to transcribe lyrics, the audio of that track is sent to a speech-recognition service to produce the text. Nothing else is sent, and each account has a daily limit.</p>
          <h3>Diagnostics and issue reports</h3>
          <p>The app keeps a local log to help diagnose problems. When you send a report, it can include that log after links, file paths and sign-in tokens are removed, plus your app version, operating system, graphics card and what the app was doing. You choose whether to include diagnostics with each report.</p>
          <h3>Casting</h3>
          <p>Casting to another screen sends the picture directly between your devices where possible; the cast service only helps them connect.</p>
          <h3>Leaving the beta</h3>
          <p>You can stop using {BRAND_NAME} at any time and ask us to delete your account and uploads.</p>
        </div>
        <footer className="auth-terms-footer">
          <button ref={closeRef} type="button" className="auth-submit" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  )
}
