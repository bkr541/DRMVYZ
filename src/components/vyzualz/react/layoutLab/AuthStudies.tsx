import { useId, useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import studyStyles from './authStudies.css?inline'

const STUDIES = [
  { id: 'backstage', name: 'Backstage', artwork: '/layout-lab/headliner.png' },
  { id: 'signal-room', name: 'Signal Room', artwork: '/layout-lab/sound-drawing.jpg' },
  { id: 'studio-pass', name: 'Studio Pass', artwork: '/layout-lab/pixgrid.jpg' },
  { id: 'marquee', name: 'Marquee', artwork: '/preset-artwork/drmvyz.cinema2.marquee.webp' },
] as const

function AuthField({ label, type, placeholder }: { label: string; type: 'text' | 'email' | 'password'; placeholder: string }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return <div className="ll-auth-field">
    <label htmlFor={id}>{label}</label>
    <DreamVizTextInput id={id} type={visible ? 'text' : type} placeholder={placeholder} required />
    {type === 'password' && <button className="ll-auth-eye" type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(value => !value)}>
      <AppIcon kind={visible ? 'eye' : 'eyeOff'} size={15} />
    </button>}
  </div>
}

function AuthForm({ signingUp, onModeChange }: { signingUp: boolean; onModeChange(): void }) {
  const [remember, setRemember] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const title = signingUp ? 'Create account' : 'Sign in'
  const titleId = useId()
  return <form className="ll-auth-form" aria-labelledby={titleId} autoComplete="off" onSubmit={event => {
    event.preventDefault()
    setSubmitted(true)
  }}>
    <span className="ll-auth-brand"><AppIcon kind="brand" size={26} /> DRMVYZ</span>
    <h3 id={titleId}>{title}</h3>
    {signingUp && <>
      <AuthField label="Full name" type="text" placeholder="Your name" />
      <AuthField label="Artist name" type="text" placeholder="Your stage name" />
    </>}
    <AuthField label="Email" type="email" placeholder="you@example.com" />
    <AuthField label="Password" type="password" placeholder="••••••••" />
    {signingUp ? <AuthField label="Confirm password" type="password" placeholder="••••••••" /> : <div className="ll-auth-remember">
      <span>Remember me</span>
      <IconMorphToggle checked={remember} onCheckedChange={setRemember} aria-label="Remember me" />
    </div>}
    <button className="ll-auth-submit" type="submit">{title}</button>
    <button className="ll-auth-mode" type="button" onClick={onModeChange}>{signingUp ? 'Back to sign in' : 'Create an account'}</button>
    {submitted && <span className="ll-auth-status" role="status">Preview submitted.</span>}
  </form>
}

function AuthStudy({ id, name, artwork }: typeof STUDIES[number]) {
  const [signingUp, setSigningUp] = useState(false)
  return <section data-auth-study={id} aria-labelledby={`ll-auth-${id}`}>
    <h2 id={`ll-auth-${id}`}>{name}</h2>
    <div className="ll-auth-screen">
      <img className="ll-auth-art" src={artwork} alt="" loading="lazy" decoding="async" />
      <AuthForm key={String(signingUp)} signingUp={signingUp} onModeChange={() => setSigningUp(value => !value)} />
    </div>
  </section>
}

export function AuthStudies() {
  return <div className="ll-auth-studies">
    <style>{studyStyles}</style>
    {STUDIES.map(study => <AuthStudy key={study.id} {...study} />)}
  </div>
}
