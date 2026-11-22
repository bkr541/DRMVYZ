import { useEffect, useId, useRef, useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { IconMorphToggle } from '../controls/IconMorphToggle'
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
    summary: 'Precise and technical. A hairline-bordered form panel beside an engineering view of the engines.',
    animationNote: 'Schematic line drawings with callouts: one engine at a time, each drawn as the diagram of what it does.',
    inspiration: [{ label: 'Dribbble · split-screen register', href: 'https://dribbble.com/search/split-screen-register' }, { label: 'Dribbble · dark theme login', href: 'https://dribbble.com/search/dark-theme-login' }] },
  { id: 'afterglow', name: 'Afterglow', layout: 'Full-bleed animation behind one centred glass card', animation: 'glow',
    summary: 'Immersive and soft. The engines fill the whole screen and the form floats over them as frosted glass with the brand glow.',
    animationNote: 'Additive light: luminous ribbons, a star flight, drifting colour, laser haze, glowing pixels and stage cones.',
    inspiration: [{ label: 'Dribbble · glassmorphism sign-up', href: 'https://dribbble.com/search/signup-glassmorphism' }, { label: 'Dribbble · Animated Glassmorphism', href: 'https://dribbble.com/shots/14844902-Animated-Glassmorphism' }] },
  { id: 'broadsheet', name: 'Broadsheet', layout: 'Editorial: narrow form rail, big type, kinetic type wall', animation: 'type',
    summary: 'Flat and loud. Hard lines, numbered fields and a huge headline; no glass and no glow.',
    animationNote: 'Kinetic typography: each engine\'s name moves the way the engine does (level bars, fly-through, colour split, slit scan, pixelation, marquee).',
    inspiration: [{ label: 'Dribbble · neo-brutalism login and sign-up', href: 'https://dribbble.com/shots/20823980-Neo-Brutalism-Login-and-Sign-up-page' }, { label: 'Dribbble · big typography', href: 'https://dribbble.com/search/big-typography' }] },
  { id: 'rack', name: 'Rack', layout: 'Stacked: an engine display rack above a hardware-style form plate', animation: 'matrix',
    summary: 'Hardware and playful. A plate with LED details, a pill mode switch and two-column fields under a wall of displays.',
    animationNote: 'All six engines at once, each on its own LED dot-matrix display; the one on stage lights up and takes its turn.',
    inspiration: [{ label: 'Dribbble · Synth collection', href: 'https://dribbble.com/paultebbott/collections/98137-Synth' }, { label: 'Dribbble · LED matrix display', href: 'https://dribbble.com/shots/15213693-Matrix-Display-VanMoof-Exploration' }] },
]

function AuthCanvas({ animation }: { animation: AuthAnimationStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => ref.current ? startAuthAnimation(ref.current, animation) : undefined, [animation])
  return <canvas ref={ref} className="ll-am-canvas" aria-hidden="true" />
}

function AuthField({ label, type, placeholder }: { label: string; type: 'text' | 'email' | 'password'; placeholder: string }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return <div className="ll-am-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} className="ll-am-input" type={visible ? 'text' : type} placeholder={placeholder} autoComplete="off" required />
    {type === 'password' && <button className="ll-am-eye" type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(value => !value)}>
      <AppIcon kind={visible ? 'eye' : 'eyeOff'} size={15} />
    </button>}
  </div>
}

function AuthForm({ study, signingUp, other }: { study: Study; signingUp: boolean; other(): void }) {
  const [remember, setRemember] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const title = signingUp ? 'Create account' : 'Sign in'
  const titleId = useId()
  return <form className="ll-am-form" aria-labelledby={titleId} autoComplete="off" onSubmit={event => { event.preventDefault(); setSubmitted(true) }}>
    {study.id === 'aperture' && <img className="ll-am-wordmark" src={asset('stageless_wordmark.png')} alt="STAGELESS" />}
    {study.id === 'afterglow' && <img className="ll-am-mark" src={asset('stageless_logo.png')} alt="STAGELESS" />}
    {study.id === 'broadsheet' && <div className="ll-am-masthead"><img className="ll-am-wordmark" src={asset('stageless_wordmark.png')} alt="STAGELESS" /><span>{signingUp ? 'New member' : 'Members'}</span></div>}
    {study.id === 'rack' && <div className="ll-am-rack-head">
      <img className="ll-am-mark" src={asset('stageless_logo.png')} alt="STAGELESS" />
      <div className="ll-am-segment" role="group" aria-label="Mode">
        <button type="button" aria-pressed={!signingUp} onClick={signingUp ? other : undefined}>Sign in</button>
        <button type="button" aria-pressed={signingUp} onClick={signingUp ? undefined : other}>Create account</button>
      </div>
      <span className="ll-am-leds" aria-hidden="true"><i /><i /><i /></span>
    </div>}
    <h3 id={titleId}>{title}{study.id === 'broadsheet' && <b>.</b>}</h3>
    <div className="ll-am-fields">
      {signingUp && <>
        <AuthField label="Full name" type="text" placeholder="Your name" />
        <AuthField label="Artist name" type="text" placeholder="Your stage name" />
      </>}
      <AuthField label="Email" type="email" placeholder="you@example.com" />
      <AuthField label="Password" type="password" placeholder="••••••••" />
      {signingUp && <AuthField label="Confirm password" type="password" placeholder="••••••••" />}
    </div>
    {!signingUp && <div className="ll-am-remember"><span>Remember me</span><IconMorphToggle checked={remember} onCheckedChange={setRemember} aria-label="Remember me" /></div>}
    <button className="ll-am-submit" type="submit"><span>{title}</span>{study.id === 'broadsheet' && <span aria-hidden="true">→</span>}</button>
    {study.id !== 'rack' && <button className="ll-am-mode" type="button" onClick={other}>{signingUp ? 'Have an account? Sign in' : 'New here? Create an account'}</button>}
    {submitted && <span className="ll-am-status" role="status">Preview submitted.</span>}
  </form>
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
    <style>{studyStyles}</style>
    {STUDIES.map(study => <AuthStudy key={study.id} study={study} />)}
  </div>
}
