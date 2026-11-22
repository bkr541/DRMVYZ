import { useEffect, useId, useRef, useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import authStyles from '../../../../styles/auth.css?inline'
import { AUTH_ENGINES, startAuthAnimation, type AuthAnimationStyle } from './authStudyAnimations'
import studyStyles from './authStudies.css?inline'

/**
 * Four sign-in and sign-up mockups. Each is built from the Brand Kit (the S mark and wordmark, the brand colors, Space Grotesk and Manrope, the 6px radius, the
 * glow and the gradient) and differs from the others in layout, styling and in the animation it plays for the app's six engines. Every mockup shows both groups:
 * Sign in and Create account.
 */
const asset = (file: string) => `${import.meta.env.BASE_URL ?? '/'}${file}`

interface Study {
  id: 'aperture' | 'afterglow' | 'broadsheet' | 'rack'
  name: string
  layout: string
  animation: AuthAnimationStyle
  summary: string
  animationNote: string
  inspiration: readonly { label: string; href: string }[]
}
const STUDIES: readonly Study[] = [
  { id: 'aperture', name: 'Aperture', layout: 'Split screen: animation left, form panel right', animation: 'schematic',
    summary: 'Precise and technical. The production form panel beside an engineering view of the engines.',
    animationNote: 'Schematic line drawings with callouts: one engine at a time, each drawn as the diagram of what it does.',
    inspiration: [{ label: 'Dribbble · split-screen register', href: 'https://dribbble.com/search/split-screen-register' }, { label: 'Dribbble · dark theme login', href: 'https://dribbble.com/search/dark-theme-login' }] },
  { id: 'afterglow', name: 'Afterglow', layout: 'Full-bleed animation behind one centred glass card', animation: 'glow',
    summary: 'Immersive and soft. The engines fill the whole screen and the production form floats over them on a frosted glass card with the brand glow.',
    animationNote: 'Additive light: luminous ribbons, a star flight, drifting colour, laser haze, glowing pixels and stage cones.',
    inspiration: [{ label: 'Dribbble · glassmorphism sign-up', href: 'https://dribbble.com/search/signup-glassmorphism' }, { label: 'Dribbble · Animated Glassmorphism', href: 'https://dribbble.com/shots/14844902-Animated-Glassmorphism' }] },
  { id: 'broadsheet', name: 'Broadsheet', layout: 'Editorial: narrow form rail, big type, kinetic type wall', animation: 'type',
    summary: 'Flat and editorial. A square-cornered form rail with a masthead and hard rules beside a wall of kinetic type; no glass and no glow.',
    animationNote: 'Kinetic typography: each engine\'s name moves the way the engine does (level bars, fly-through, colour split, slit scan, pixelation, marquee).',
    inspiration: [{ label: 'Dribbble · neo-brutalism login and sign-up', href: 'https://dribbble.com/shots/20823980-Neo-Brutalism-Login-and-Sign-up-page' }, { label: 'Dribbble · big typography', href: 'https://dribbble.com/search/big-typography' }] },
  { id: 'rack', name: 'Rack', layout: 'Stacked: an engine display rack above a hardware-style form plate', animation: 'matrix',
    summary: 'Hardware and playful. A form plate with LED details and two-column fields under a wall of displays.',
    animationNote: 'All six engines at once, each on its own LED dot-matrix display; the one on stage lights up and takes its turn.',
    inspiration: [{ label: 'Dribbble · Synth collection', href: 'https://dribbble.com/paultebbott/collections/98137-Synth' }, { label: 'Dribbble · LED matrix display', href: 'https://dribbble.com/shots/15213693-Matrix-Display-VanMoof-Exploration' }] },
]

function AuthCanvas({ animation }: { animation: AuthAnimationStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => ref.current ? startAuthAnimation(ref.current, animation) : undefined, [animation])
  return <canvas ref={ref} className="ll-am-canvas" aria-hidden="true" />
}

/**
 * The form is the production sign-in and sign-up form's own markup, classes and copy (src/components/auth/AuthPage.tsx and src/styles/auth.css): the shared text
 * input, field labels and icons, the eye toggle, the remember toggle, the checkbox, the primary action, links and the switch line. The four mockups change only what
 * is around the form (layout, surface, brand lockup, animation), never the controls.
 */
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

function AuthForm({ study, signingUp, other }: { study: Study; signingUp: boolean; other(): void }) {
  const [remember, setRemember] = useState(false)
  const [agreed, setAgreed] = useState(false)
  return <div className="ll-am-panel">
    {study.id === 'aperture' && <img className="ll-am-wordmark" src={asset('stageless_wordmark.png')} alt="STAGELESS" />}
    {study.id === 'afterglow' && <div className="auth-logo"><img src={asset('stageless_logo.png')} alt="STAGELESS" className="auth-logo-img" style={{ width: 72, height: 72, objectFit: 'contain' }} /></div>}
    {study.id === 'broadsheet' && <div className="ll-am-masthead"><img className="ll-am-wordmark" src={asset('stageless_wordmark.png')} alt="STAGELESS" /><span>{signingUp ? 'New member' : 'Members'}</span></div>}
    {study.id === 'rack' && <div className="ll-am-rack-head"><img className="ll-am-wordmark" src={asset('stageless_wordmark.png')} alt="STAGELESS" /><span className="ll-am-leds" aria-hidden="true"><i /><i /><i /></span></div>}
    <form className="auth-form" autoComplete="off" onSubmit={event => event.preventDefault()}>
      <div className="auth-form-heading">
        <h1 className="auth-form-title">{signingUp ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="auth-form-sub">{signingUp ? 'Sign up to start your studio experience' : 'Log in to access your studio'}</p>
      </div>
      <div className="ll-am-fields">
        {signingUp && <>
          <Field label="Full Name" type="text" placeholder="Your name" icon="user" />
          <Field label="Artist Name" type="text" placeholder="Your artist / stage name" icon="mic" />
        </>}
        <Field label="Email" type="email" placeholder="you@example.com" icon={signingUp ? 'mail' : 'user'} />
        <Field label="Password" type="password" placeholder="••••••••" icon="lock" password />
        {signingUp && <Field label="Confirm Password" type="password" placeholder="••••••••" icon="lock" password />}
      </div>
      <div className="auth-form-row">
        {signingUp ? <label className="auth-checkbox">
          <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
          <span className="auth-checkbox-box" />
          <span>I agree to the <button type="button" className="auth-link">Terms &amp; Privacy Policy</button></span>
        </label> : <>
          <label className="auth-remember"><span>Remember me</span><IconMorphToggle checked={remember} onCheckedChange={setRemember} aria-label="Remember me" /></label>
          <button type="button" className="auth-link">Forgot password?</button>
        </>}
      </div>
      <button className="auth-submit" type="submit">{signingUp ? 'Sign Up' : 'Log In'}</button>
      <p className="auth-switch">{signingUp ? 'Already have an account? ' : 'Don\'t have an account? '}<button type="button" className="auth-link" onClick={other}>{signingUp ? 'Log in' : 'Create one'}</button></p>
    </form>
  </div>
}

function AuthStudy({ study }: { study: Study }) {
  const frames = useRef<Record<string, HTMLElement | null>>({})
  const show = (state: string) => frames.current[state]?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  return <section className="ll-am-study" data-auth-study={study.id} aria-labelledby={`ll-am-${study.id}`}>
    <header>
      <h2 id={`ll-am-${study.id}`}><span>{String(STUDIES.indexOf(study) + 1).padStart(2, '0')}</span>{study.name}</h2>
      <p>{study.summary}</p>
      <dl>
        <div><dt>Layout</dt><dd>{study.layout}</dd></div>
        <div><dt>Animation</dt><dd data-auth-animation={study.animation}>{study.animationNote}</dd></div>
        <div><dt>Inspired by</dt><dd>{study.inspiration.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer noopener">{link.label}</a>)}</dd></div>
      </dl>
    </header>
    <div className="ll-am-pair">
      {([false, true] as const).map(signingUp => {
        const state = signingUp ? 'signup' : 'signin'
        return <figure key={state} className="ll-am-frame" ref={node => { frames.current[state] = node }}>
          <figcaption>{signingUp ? 'Create account' : 'Sign in'}</figcaption>
          <div className="ll-am-screen" data-theme="dark" data-layout={study.id} data-auth-state={state}>
            <div className="ll-am-art"><AuthCanvas animation={study.animation} /></div>
            <AuthForm study={study} signingUp={signingUp} other={() => show(signingUp ? 'signin' : 'signup')} />
          </div>
        </figure>
      })}
    </div>
  </section>
}

export function AuthStudies() {
  return <div className="ll-am" aria-label="Sign in and sign up mockups" data-auth-engines={AUTH_ENGINES.join(',')}>
    {/* The production form's own stylesheet travels with the studies, like every other study's CSS, so the form never depends on another page having loaded it. */}
    <style>{authStyles}</style>
    <style>{studyStyles}</style>
    {STUDIES.map(study => <AuthStudy key={study.id} study={study} />)}
  </div>
}
