import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { AuthVisualizer } from '../../../auth/AuthVisualizer'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import { BRAND_FONT_LINK } from './brandKitModel'
import baseStyles from '../../../../styles.css?inline'
import appearanceStyles from '../../../../styles/appearance.css?inline'
import typographyStyles from '../../../../styles/typography.css?inline'
import authStyles from '../../../../styles/auth.css?inline'
import canonicalStyles from '../controls/canonicalControls.css?inline'
import iconStyles from '../../../shared/icons/appIcon.css?inline'
import studyStyles from './authStudies.css?inline'

/**
 * The production sign-in and sign-up page (src/components/auth/AuthPage.tsx), shown as it is on a desktop and on a phone. Its markup, class names, copy and
 * stylesheets are the production page's own; the animated panel is the production `AuthVisualizer`. Each device is its own iframe so the production CSS (including
 * its `max-width: 640px` rules) answers to the frame's real width, not the Layout Lab window's. Layout Lab is itself a separate window that receives none of the app's
 * stylesheets, so the ones the page needs are carried into each frame here. Nothing is submitted: this page has no account behind it.
 */
const asset = (file: string) => `${import.meta.env.BASE_URL ?? '/'}${file}`
const FRAME_CSS = [baseStyles, appearanceStyles, typographyStyles, canonicalStyles, iconStyles, authStyles].join('\n')
const FRAME_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${BRAND_FONT_LINK}"></head><body></body></html>`

function Field({ label, type, placeholder, icon, password }: { label: string; type: string; placeholder: string; icon: 'user' | 'mail' | 'lock' | 'mic'; password?: boolean }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return <div className="auth-field">
    <label className="rv-ctrl-label" htmlFor={id}>{label}</label>
    <div className="auth-field-wrap">
      <span className="auth-field-icon"><AppIcon kind={icon} size="15" /></span>
      <DreamVizTextInput id={id} className="auth-field-input" type={password ? (visible ? 'text' : 'password') : type} placeholder={placeholder} autoComplete="off" />
      {password && <button className="auth-field-eye" type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(value => !value)}>
        <AppIcon kind={visible ? 'eye' : 'eyeOff'} size="15" />
      </button>}
    </div>
  </div>
}

function LoginForm({ onSwitch }: { onSwitch(): void }) {
  const [remember, setRemember] = useState(false)
  return <form className="auth-form" noValidate onSubmit={event => event.preventDefault()}>
    <div className="auth-form-heading">
      <h1 className="auth-form-title">Welcome Back</h1>
      <p className="auth-form-sub">Log in to access your studio</p>
    </div>
    <Field label="Email" type="email" placeholder="you@example.com" icon="user" />
    <Field label="Password" type="password" placeholder="••••••••" icon="lock" password />
    <div className="auth-form-row">
      <label className="auth-remember" htmlFor="auth-remember"><span>Remember me</span><IconMorphToggle id="auth-remember" checked={remember} onCheckedChange={setRemember} aria-label="Remember me" /></label>
      <button type="button" className="auth-link">Forgot password?</button>
    </div>
    <button className="auth-submit" type="submit">Log In</button>
    <p className="auth-switch">Don't have an account?{' '}<button type="button" className="auth-link" onClick={onSwitch}>Create one</button></p>
  </form>
}

function SignupForm({ onSwitch }: { onSwitch(): void }) {
  const [agreed, setAgreed] = useState(false)
  return <form className="auth-form" noValidate onSubmit={event => event.preventDefault()}>
    <div className="auth-form-heading">
      <h1 className="auth-form-title">Create Account</h1>
      <p className="auth-form-sub">Sign up to start your studio experience</p>
    </div>
    <Field label="Full Name" type="text" placeholder="Your name" icon="user" />
    <Field label="Artist Name" type="text" placeholder="Your artist / stage name" icon="mic" />
    <Field label="Email" type="email" placeholder="you@example.com" icon="mail" />
    <Field label="Password" type="password" placeholder="••••••••" icon="lock" password />
    <Field label="Confirm Password" type="password" placeholder="••••••••" icon="lock" password />
    <div className="auth-form-row">
      <label className="auth-checkbox">
        <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
        <span className="auth-checkbox-box" />
        <span>I agree to the{' '}<button type="button" className="auth-link">Terms &amp; Privacy Policy</button></span>
      </label>
    </div>
    <button className="auth-submit" type="submit" disabled={!agreed}>Sign Up</button>
    <p className="auth-switch">Already have an account?{' '}<button type="button" className="auth-link" onClick={onSwitch}>Log in</button></p>
  </form>
}

/** The production page: the form panel (logo and the login or sign-up form) beside the animated emblem panel. */
function ProductionAuthPage({ mode, onMode }: { mode: 'login' | 'signup'; onMode(mode: 'login' | 'signup'): void }) {
  return <div className="auth-root">
    <div className={`auth-panels ${mode === 'signup' ? 'auth-panels--signup' : ''}`}>
      <div className="auth-panel auth-panel--form">
        <div className={`auth-logo ${mode === 'signup' ? 'auth-logo--compact' : ''}`}>
          <img src={asset('stageless_logo.png')} alt="STAGELESS" className="auth-logo-img" style={{ width: mode === 'signup' ? 72 : 106, height: mode === 'signup' ? 72 : 106, objectFit: 'contain' }} />
        </div>
        {mode === 'login' ? <LoginForm onSwitch={() => onMode('signup')} /> : <SignupForm onSwitch={() => onMode('login')} />}
      </div>
      <div className="auth-panel auth-panel--emblem">
        <div className="auth-emblem-panel" aria-hidden="true">
          <div className="auth-emblem-glow-outer" />
          <div className="auth-emblem-glow-inner" />
          <AuthVisualizer />
          <div className="auth-emblem-mist" />
        </div>
      </div>
    </div>
  </div>
}

/** One device: an iframe whose document carries the app's stylesheets, with the production page rendered into it. */
function DeviceFrame({ device, initial, width, height }: { device: 'desktop' | 'mobile'; initial: 'login' | 'signup'; width: number | string; height: number }) {
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [mode, setMode] = useState(initial)
  return <figure className={`ll-auth-device ll-auth-device--${device}`} data-auth-device={device} data-auth-initial={initial}>
    <figcaption>{device === 'desktop' ? 'Desktop' : 'Mobile'} · {initial === 'login' ? 'Log in' : 'Sign up'}</figcaption>
    <iframe className="ll-auth-frame" title={`${device} ${initial} page`} srcDoc={FRAME_HTML} style={{ width, height }}
      onLoad={event => {
        const doc = event.currentTarget.contentDocument
        if (!doc) return
        doc.documentElement.dataset.theme = 'dark'
        setBody(doc.body)
      }} />
    {body && createPortal(<><style>{FRAME_CSS}</style><ProductionAuthPage mode={mode} onMode={setMode} /></>, body)}
  </figure>
}

export function AuthStudies(): ReactNode {
  return <div className="ll-auth-studies" aria-label="Production sign-in and sign-up page, desktop and mobile">
    <style>{studyStyles}</style>
    <section className="ll-auth-section" data-auth-section="desktop" aria-label="Desktop">
      <DeviceFrame device="desktop" initial="login" width="100%" height={700} />
      <DeviceFrame device="desktop" initial="signup" width="100%" height={700} />
    </section>
    <section className="ll-auth-section ll-auth-section--mobile" data-auth-section="mobile" aria-label="Mobile">
      <DeviceFrame device="mobile" initial="login" width={390} height={780} />
      <DeviceFrame device="mobile" initial="signup" width={390} height={780} />
    </section>
  </div>
}
