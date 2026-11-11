import { createElement, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, MessageCircle, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

function AuthFrame({ children, eyebrow, title, detail, footer }) {
  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <Link className="brand brand-inverse" to="/login"><span className="brand-mark"><MessageCircle size={19} /></span>PRIVATECHAT</Link>
        <div className="aside-message">
          <span className="eyebrow">A quieter kind of connection</span>
          <h1>Your people,<br /><em>in your pocket.</em></h1>
          <p>Private conversations, built around you. Find each other by your own unique ID.</p>
        </div>
        <div className="aside-foot"><ShieldCheck size={16} /> Your identity is yours to keep.</div>
        <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
        <div className="auth-legal">By continuing, you agree to use PRIVATECHAT responsibly and protect your sign-in details.</div>
      </section>
    </main>
  )
}

function Field({ icon, label, type = 'text', value, onChange, placeholder, autoComplete, right, required = true }) {
  return (
    <label className="field-wrap">
      <span className="field-label">{label}</span>
      <span className="field-control">{createElement(icon, { size: 17 })}<input type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required={required} /><span className="field-right">{right}</span></span>
    </label>
  )
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return <Field icon={LockKeyhole} label={label} type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder="At least 10 characters" autoComplete={autoComplete} right={<button className="field-icon-button" type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await login({ identifier, password, rememberMe }); navigate('/', { replace: true }) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  return <AuthFrame eyebrow="Welcome back" title="Sign in" detail="Pick up right where your conversations left off." footer={<>New around here? <Link to="/signup">Create an account <ArrowRight size={14} /></Link></>}>
    <form className="auth-form" onSubmit={submit}>
      <Field icon={UserRound} label="User ID or username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="PC5821 or username" autoComplete="username" />
      <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      <div className="form-options"><label className="check-label"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span className="custom-check"><Check size={12} /></span>Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
      <div className="security-note"><LockKeyhole size={14} /> Password protected. Never share your sign-in details.</div>
    </form>
  </AuthFrame>
}

export function SignupPage() {
  const [form, setForm] = useState({ fullName: '', username: '', password: '', confirm: '', acceptedTerms: false })
  const [error, setError] = useState('')
  const [createdUser, setCreatedUser] = useState(null)
  const [busy, setBusy] = useState(false)
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  async function submit(event) {
    event.preventDefault(); setError('')
    if (form.password !== form.confirm) return setError('Those passwords do not match.')
    if (form.password.length < 10) return setError('Password must be at least 10 characters.')
    if (!/^[a-zA-Z0-9._]{3,24}$/.test(form.username)) return setError('Username must be 3–24 characters and contain only letters, numbers, dots, or underscores.')
    if (!form.acceptedTerms) return setError('Please accept the terms to create an account.')
    setBusy(true)
    try {
      const result = await api('/api/auth/register', { method: 'POST', body: { fullName: form.fullName, username: form.username, password: form.password, acceptedTerms: form.acceptedTerms } })
      setCreatedUser(result.user)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  if (createdUser) return <AuthFrame eyebrow="Account created" title="Your ID is ready" detail="No email is needed. Share this ID so people can find you; it is not a password." footer={<>Ready to chat? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    <div className="generated-id"><span>Your PRIVATECHAT ID</span><strong>{createdUser.userId}</strong><button className="copy-id-button" type="button" onClick={() => navigator.clipboard.writeText(createdUser.userId)}>Copy ID <Check size={14} /></button></div>
  </AuthFrame>

  return <AuthFrame eyebrow="Start a conversation" title="Create your account" detail="Use your name, a username, and a password. No email address required." footer={<>Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    <form className="auth-form signup-form" onSubmit={submit}>
      <Field icon={UserRound} label="Full name" value={form.fullName} onChange={update('fullName')} placeholder="Your name" autoComplete="name" />
      <Field icon={UserRound} label="Username" value={form.username} onChange={update('username')} placeholder="Choose a username" autoComplete="username" />
      <PasswordField label="Create password" value={form.password} onChange={update('password')} autoComplete="new-password" />
      <PasswordField label="Confirm password" value={form.confirm} onChange={update('confirm')} autoComplete="new-password" />
      <p className="password-hint"><KeyRound size={13} /> Use 10 or more characters. A unique passphrase is best.</p>
      <label className="check-label terms-check"><input type="checkbox" checked={form.acceptedTerms} onChange={update('acceptedTerms')} /><span className="custom-check"><Check size={12} /></span>I agree to the PRIVATECHAT terms and privacy notice.</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={17} /></button>
    </form>
  </AuthFrame>
}

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState({ busy: true, error: '', user: null })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token')
    if (!token) { setState({ busy: false, error: 'This verification link is missing its token.', user: null }); return }
    api('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then(({ user }) => setState({ busy: false, error: '', user }))
      .catch((failure) => setState({ busy: false, error: failure.message, user: null }))
  }, [params])

  if (state.busy) return <AuthFrame eyebrow="One moment" title="Verifying email" detail="Checking your secure verification link." footer={<Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link>}><div className="verification-loading" /></AuthFrame>
  if (state.error) return <AuthFrame eyebrow="Verification" title="Link unavailable" detail={state.error} footer={<Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link>}><div className="status-icon status-error"><Mail size={24} /></div></AuthFrame>
  return <AuthFrame eyebrow="You’re all set" title="Your ID is ready" detail="Share this ID so people can find you. It is an identifier, not a password." footer={<button className="text-button" onClick={() => { setUser(state.user); navigate('/', { replace: true }) }}>Continue to PrivateChat <ArrowRight size={14} /></button>}>
    <div className="generated-id"><span>Your PRIVATECHAT ID</span><strong>{state.user.userId}</strong><button className="copy-id-button" onClick={() => navigator.clipboard.writeText(state.user.userId)}>Copy ID <Check size={14} /></button></div>
  </AuthFrame>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await api('/api/auth/forgot-password', { method: 'POST', body: { email } }); setNotice(result.message) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <AuthFrame eyebrow="Account recovery" title="Forgot your password?" detail="Enter your email and we’ll send a reset link if it matches an account." footer={<Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link>}>
    <form className="auth-form" onSubmit={submit}><Field icon={Mail} label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />{error && <p className="form-error">{error}</p>}{notice && <p className="form-success">{notice}</p>}<button className="primary-button full-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={17} /></button></form>
  </AuthFrame>
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError('')
    if (password !== confirm) return setError('Those passwords do not match.')
    setBusy(true)
    try { await api('/api/auth/reset-password', { method: 'POST', body: { token: params.get('token'), password } }); navigate('/login', { replace: true }) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <AuthFrame eyebrow="Account recovery" title="Choose a new password" detail="Your other sessions will be signed out after the password changes." footer={<Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link>}>
    <form className="auth-form" onSubmit={submit}><PasswordField label="New password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><PasswordField label="Confirm new password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />{error && <p className="form-error">{error}</p>}<button className="primary-button full-button" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={17} /></button></form>
  </AuthFrame>
}