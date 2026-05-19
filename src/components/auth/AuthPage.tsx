import { useState } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import '../../styles/auth.css'

// ── SVG emblem mark ───────────────────────────────────────────────────────────

function EmblemMark({ size = 120, uid = 'a' }: { size?: number; uid?: string }) {
  const g  = `${uid}g`
  const g2 = `${uid}g2`
  const gl = `${uid}gl`
  const gl2 = `${uid}gl2`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="auth-emblem-svg"
    >
      <defs>
        <radialGradient id={g} cx="50%" cy="38%" r="65%">
          <stop offset="0%"   stopColor="#a8f0ff"/>
          <stop offset="35%"  stopColor="#19bff2"/>
          <stop offset="75%"  stopColor="#0678a0"/>
          <stop offset="100%" stopColor="#043f62" stopOpacity="0.6"/>
        </radialGradient>
        <radialGradient id={g2} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#19bff2" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="#19bff2" stopOpacity="0"/>
        </radialGradient>
        <filter id={gl} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="2.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={gl2} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Ambient glow disc */}
      <circle cx="60" cy="60" r="56" fill={`url(#${g2})`}/>

      {/* Concentric orbital rings */}
      <circle cx="60" cy="60" r="56" stroke="#19bff2" strokeWidth="0.3" opacity="0.18"/>
      <circle cx="60" cy="60" r="52" stroke="#19bff2" strokeWidth="0.9" opacity="0.55" filter={`url(#${gl})`}/>
      <circle cx="60" cy="60" r="47" stroke="#19bff2" strokeWidth="0.4" opacity="0.28"/>
      <circle cx="60" cy="60" r="42" stroke="#19bff2" strokeWidth="0.6" opacity="0.38" filter={`url(#${gl})`}/>

      {/* Bat / crest outer wings */}
      <path
        d={`
          M 60 22
          C 53 22, 44 25, 38 31
          C 28 33, 20 40, 22 50
          C 23 57, 30 62, 36 62
          C 37 67, 38 72, 40 76
          L 40 87
          C 40 92, 44 96, 49 96
          L 52 96
          L 52 80
          C 52 76, 55 72, 58 71
          L 62 71
          C 65 72, 68 76, 68 80
          L 68 96
          L 71 96
          C 76 96, 80 92, 80 87
          L 80 76
          C 82 72, 83 67, 84 62
          C 90 62, 97 57, 98 50
          C 100 40, 92 33, 82 31
          C 76 25, 67 22, 60 22 Z
        `}
        fill={`url(#${g})`}
        filter={`url(#${gl})`}
        opacity="0.92"
      />

      {/* Central void — gives the metallic frame / medallion look */}
      <ellipse cx="60" cy="54" rx="16" ry="20" fill="#030508"/>
      <ellipse
        cx="60" cy="54" rx="16" ry="20"
        stroke="#19bff2" strokeWidth="1.1" fill="none"
        opacity="0.65" filter={`url(#${gl})`}
      />

      {/* Inner highlight ring */}
      <ellipse cx="60" cy="54" rx="11" ry="14" stroke="#7ae8ff" strokeWidth="0.4" fill="none" opacity="0.3"/>
    </svg>
  )
}

// ── Logo: mark + wordmark ─────────────────────────────────────────────────────

function AuthLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`auth-logo ${compact ? 'auth-logo--compact' : ''}`}>
      <img
        src="/drmvyz_logo.png"
        alt="DRMVYZ"
        className="auth-logo-img"
        style={{ width: compact ? 72 : 106, height: compact ? 72 : 106, objectFit: 'contain' }}
      />
    </div>
  )
}

// ── Large emblem background panel ────────────────────────────────────────────

function EmblemPanel() {
  return (
    <div className="auth-emblem-panel">
      <div className="auth-emblem-glow-outer"/>
      <div className="auth-emblem-glow-inner"/>
      <img
        src="/drmvyz_logo.png"
        alt=""
        aria-hidden="true"
        className="auth-emblem-logo-img"
        style={{ width: 380, height: 380, objectFit: 'contain', opacity: 0.92 }}
      />
      <div className="auth-emblem-mist"/>
    </div>
  )
}

// ── Icon components ───────────────────────────────────────────────────────────

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
  </svg>
)

const IconMail = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
)

const IconLock = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
)

const IconMic = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
)

const EyeOpen = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
)

const EyeClosed = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zm10.53 10.53l-1.55-1.55a3.01 3.01 0 01-.65-.08l-1.55 1.55c.67.33 1.41.53 2.2.53.22 0 .44-.03.65-.08l.9-.37z"/>
  </svg>
)

// ── Reusable field ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  icon: React.ReactNode
  showToggle?: { visible: boolean; onToggle: () => void }
  autoComplete?: string
}

function Field({ label, type, placeholder, value, onChange, icon, showToggle, autoComplete }: FieldProps) {
  return (
    <div className="auth-field">
      <label className="auth-field-label">{label}</label>
      <div className="auth-field-wrap">
        <span className="auth-field-icon">{icon}</span>
        <input
          className="auth-field-input"
          type={showToggle ? (showToggle.visible ? 'text' : 'password') : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete ?? type}
        />
        {showToggle && (
          <button
            className="auth-field-eye"
            type="button"
            tabIndex={-1}
            onClick={showToggle.onToggle}
          >
            {showToggle.visible ? <EyeOpen/> : <EyeClosed/>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({
  checked, onChange, children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="auth-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="auth-checkbox-box"/>
      <span>{children}</span>
    </label>
  )
}

// ── Login form ────────────────────────────────────────────────────────────────

function LoginForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  void remember // stored for future persistent session logic

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields'); return }
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-form-heading">
        <h1 className="auth-form-title">Welcome Back</h1>
        <p className="auth-form-sub">Log in to access your studio</p>
      </div>

      <Field
        label="EMAIL" type="email" placeholder="you@example.com"
        value={email} onChange={setEmail} icon={<IconUser/>}
        autoComplete="email"
      />
      <Field
        label="PASSWORD" type="password" placeholder="••••••••"
        value={password} onChange={setPassword} icon={<IconLock/>}
        showToggle={{ visible: showPwd, onToggle: () => setShowPwd(p => !p) }}
        autoComplete="current-password"
      />

      <div className="auth-form-row">
        <Checkbox checked={remember} onChange={setRemember}>Remember me</Checkbox>
        <button type="button" className="auth-link">Forgot password?</button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? <span className="auth-spinner"/> : 'Log In'}
      </button>

      <p className="auth-switch">
        Don't have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitch}>Create one</button>
      </p>
    </form>
  )
}

// ── Signup form ───────────────────────────────────────────────────────────────

function SignupForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const [name, setName]           = useState('')
  const [artistName, setArtistName] = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showCfm, setShowCfm]     = useState(false)
  const [agreed, setAgreed]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !artistName || !email || !password || !confirm) { setError('Please fill in all fields'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!agreed) { setError('Please agree to the Terms & Privacy Policy'); return }
    setError(null)
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, artist_name: artistName } },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    // If email confirmation is disabled, session is returned immediately
    if (data.session) { onSuccess(); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="auth-form auth-form--done">
        <div className="auth-done-icon">
          <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
            <circle cx="28" cy="28" r="26" stroke="#19bff2" strokeWidth="1.5"/>
            <path d="M17 28.5l7.5 7.5L39 21" stroke="#19bff2" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="auth-form-title" style={{ textAlign: 'center' }}>Check your inbox</h2>
        <p className="auth-form-sub" style={{ textAlign: 'center' }}>
          A confirmation link was sent to <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</strong>.
          Click it to activate your account, then log in.
        </p>
        <button className="auth-submit" style={{ marginTop: 12 }} onClick={onSwitch}>
          Back to Log In
        </button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-form-heading">
        <h1 className="auth-form-title">Create Account</h1>
        <p className="auth-form-sub">Sign up to start your studio experience</p>
      </div>

      <Field
        label="FULL NAME" type="text" placeholder="Your name"
        value={name} onChange={setName} icon={<IconUser/>}
        autoComplete="name"
      />
      <Field
        label="ARTIST NAME" type="text" placeholder="Your artist / stage name"
        value={artistName} onChange={setArtistName} icon={<IconMic/>}
        autoComplete="off"
      />
      <Field
        label="EMAIL" type="email" placeholder="you@example.com"
        value={email} onChange={setEmail} icon={<IconMail/>}
        autoComplete="email"
      />
      <Field
        label="PASSWORD" type="password" placeholder="••••••••"
        value={password} onChange={setPassword} icon={<IconLock/>}
        showToggle={{ visible: showPwd, onToggle: () => setShowPwd(p => !p) }}
        autoComplete="new-password"
      />
      <Field
        label="CONFIRM PASSWORD" type="password" placeholder="••••••••"
        value={confirm} onChange={setConfirm} icon={<IconLock/>}
        showToggle={{ visible: showCfm, onToggle: () => setShowCfm(p => !p) }}
        autoComplete="new-password"
      />

      <div className="auth-form-row">
        <Checkbox checked={agreed} onChange={setAgreed}>
          I agree to the{' '}
          <button type="button" className="auth-link">Terms &amp; Privacy Policy</button>
        </Checkbox>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="auth-submit" type="submit" disabled={loading || !agreed}>
        {loading ? <span className="auth-spinner"/> : 'Sign Up'}
      </button>

      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitch}>Log in</button>
      </p>
    </form>
  )
}

// ── Auth page root ────────────────────────────────────────────────────────────

export function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  if (!supabaseConfigured) {
    return (
      <div className="auth-root">
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', maxWidth: 400, padding: '0 24px' }}>
          <div style={{ fontSize: 13, marginBottom: 12, color: '#f87171', fontFamily: 'monospace' }}>
            ⚠ Supabase not configured
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.6 }}>
            Copy <code>.env.example</code> → <code>.env</code> and set{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>,
            then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-root">
      <div className={`auth-panels ${mode === 'signup' ? 'auth-panels--signup' : ''}`}>
        {/* Form panel */}
        <div className="auth-panel auth-panel--form">
          <AuthLogo compact={mode === 'signup'}/>
          {mode === 'login'
            ? <LoginForm  onSuccess={onAuth} onSwitch={() => setMode('signup')}/>
            : <SignupForm onSuccess={onAuth} onSwitch={() => setMode('login')} />
          }
        </div>

        {/* Emblem panel */}
        <div className="auth-panel auth-panel--emblem">
          <EmblemPanel/>
        </div>
      </div>
    </div>
  )
}
