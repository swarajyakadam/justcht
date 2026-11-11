import { createElement, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, CircleHelp,
  ContactRound, LockKeyhole, LogOut, MessageCircle,
  MoreHorizontal, Plus, Search, Settings, ShieldAlert, ShieldCheck, Sun,
  UserPlus, UserRound, X,
} from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

const navigation = [
  { path: '/', label: 'Messages', icon: MessageCircle },
  { path: '/contacts', label: 'Contacts', icon: ContactRound },
  { path: '/connect', label: 'Connect', icon: UserPlus },
]

function Avatar({ user, size = 'normal', className = '' }) {
  const initials = (user?.fullName ?? user?.username ?? '?').split(/[\s._-]+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return user?.profilePicture
    ? <img className={`avatar avatar-${size} ${className}`} src={user.profilePicture} alt="" />
    : <span className={`avatar avatar-${size} avatar-color-${(user?.userId?.slice(-1).charCodeAt(0) ?? 1) % 5} ${className}`}>{initials}</span>
}

function Notice({ error, success }) {
  if (!error && !success) return null
  return <p className={error ? 'inline-notice error-notice' : 'inline-notice success-notice'} role="status">{error || success}</p>
}

function ConnectPanel({ onStartChat }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function search(event) {
    event.preventDefault(); setError(''); setResult(null); setBusy(true)
    try { setResult((await api(`/api/users/search/${encodeURIComponent(query.trim())}`)).user) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  return <section className="work-panel connect-panel">
    <div className="section-heading"><div><span className="eyebrow">Find your people</span><h2>Connect with someone</h2><p>Search with a PRIVATECHAT ID or username.</p></div><div className="heading-icon"><UserPlus size={19} /></div></div>
    <form className="connect-search" onSubmit={search}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try PC5821 or username" aria-label="Search User ID or username" /><button className="primary-button" disabled={busy || query.trim().length < 3}>{busy ? 'Searching' : 'Search'} <ArrowRight size={16} /></button></form>
    <Notice error={error} />
    {result && <div className="person-result"><Avatar user={result} size="large" /><div className="person-copy"><strong>{result.fullName}</strong><span>@{result.username}</span><small>{result.userId}</small></div><button className="primary-button" onClick={() => onStartChat(result)}>Start chat <MessageCircle size={16} /></button></div>}
    {!result && !error && <div className="connect-hint"><div className="hint-illustration"><MessageCircle size={26} /><span><Plus size={15} /></span></div><strong>Good conversations start somewhere.</strong><p>Enter their ID or username above to find the right person.</p></div>}
  </section>
}

function ContactsPanel({ onStartChat }) {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    api('/api/contacts').then(({ contacts: items }) => setContacts(items)).catch((failure) => setError(failure.message))
  }, [])
  async function remove(contactId) {
    try { await api(`/api/contacts/${contactId}`, { method: 'DELETE' }); setContacts((items) => items.filter((item) => item.id !== contactId)) }
    catch (failure) { setError(failure.message) }
  }
  return <section className="work-panel list-panel">
    <div className="section-heading"><div><span className="eyebrow">Your circle</span><h2>Contacts <span className="count-label">{contacts.length}</span></h2><p>People you have connected with.</p></div></div>
    <Notice error={error} />
    {contacts.length ? <div className="contact-grid">{contacts.map(({ id, user }) => <article className="contact-row" key={id}><Avatar user={user} /><div className="contact-name"><strong>{user?.fullName}</strong><span>@{user?.username} · {user?.userId}</span></div><button className="icon-button" title="Start chat" aria-label={`Start chat with ${user?.fullName}`} onClick={() => onStartChat(user)}><MessageCircle size={17} /></button><button className="icon-button quiet-danger" title="Remove contact" aria-label={`Remove ${user?.fullName}`} onClick={() => remove(id)}><X size={16} /></button></article>)}</div> : <div className="empty-panel"><ContactRound size={25} /><strong>Your contacts will appear here</strong><span>Find a person by their PRIVATECHAT ID.</span></div>}
  </section>
}

function ProfilePanel({ user, setUser, onLogout }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [username, setUsername] = useState(user.username)
  const [picture, setPicture] = useState(user.profilePicture ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try { const result = await api('/api/users/profile', { method: 'PATCH', body: { fullName, username, profilePicture: picture } }); setUser(result.user); setSuccess('Profile updated.') }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="work-panel profile-panel">
    <div className="section-heading"><div><span className="eyebrow">Your account</span><h2>Profile & identity</h2><p>Your permanent ID is how other people find you.</p></div></div>
    <div className="profile-id-strip"><Avatar user={user} size="large" /><div><span>Your PRIVATECHAT ID</span><strong>{user.userId}</strong></div><button className="secondary-button" onClick={() => navigator.clipboard.writeText(user.userId)}><Copy size={15} /> Copy ID</button></div>
    <form className="profile-form" onSubmit={save}><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} required /></label><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required /></label><label>Profile image URL<input value={picture} onChange={(event) => setPicture(event.target.value)} placeholder="https://…" type="url" /></label><Notice error={error} success={success} /><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={16} /></button></form>
    <div className="account-actions"><div><strong>Sign out</strong><span>End this session and clear the local account state.</span></div><button className="secondary-button danger-button" onClick={onLogout}><LogOut size={15} /> Log out</button></div>
  </section>
}

function SettingsPanel({ onLogout, onLogoutAll }) {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark')
  const [confirming, setConfirming] = useState('')
  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('privatechat-theme', next ? 'dark' : 'light')
  }
  return <section className="work-panel settings-panel">
    <div className="section-heading"><div><span className="eyebrow">Make it yours</span><h2>Settings</h2><p>Manage the way PRIVATECHAT works for you.</p></div></div>
    <div className="settings-row"><span className="settings-icon"><Sun size={18} /></span><div className="settings-copy"><strong>Appearance</strong><span>{dark ? 'Dark theme' : 'Light theme'}</span></div><button className={`toggle ${dark ? 'toggle-on' : ''}`} onClick={toggleTheme} role="switch" aria-checked={dark} aria-label="Toggle dark theme"><span /></button></div>
    <div className="settings-row"><span className="settings-icon"><ShieldAlert size={18} /></span><div className="settings-copy"><strong>End-to-end encryption</strong><span>Not yet enabled. Message sending is disabled until a vetted protocol is configured.</span></div><span className="status-pill status-pending">Not enabled</span></div>
    <div className="settings-row"><span className="settings-icon"><LogOut size={18} /></span><div className="settings-copy"><strong>Log out from all devices</strong><span>Revoke every active session for your account.</span></div><button className="secondary-button danger-button" onClick={() => setConfirming('all')}>Log out all</button></div>
    {confirming && <div className="confirm-strip"><span>{confirming === 'all' ? 'Sign out every active device?' : 'Sign out of this session?'}</span><button className="text-button" onClick={() => setConfirming('')}>Cancel</button><button className="text-button danger-text" onClick={() => confirming === 'all' ? onLogoutAll() : onLogout()}>Confirm</button></div>}
    <div className="security-callout"><LockKeyhole size={17} /><div><strong>Transport security is not end-to-end encryption.</strong><p>Messages are stored as encrypted envelopes, but PRIVATECHAT does not currently have a verified client-side key exchange protocol. Do not send sensitive content.</p></div></div>
  </section>
}

function MessageHistory({ conversationId, currentUserId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let client
    async function loadMessages() {
      const result = await api(`/api/messages/${conversationId}?limit=40`)
      if (active) setMessages(result.messages)
    }
    const start = async () => {
      try {
        await loadMessages()
        if (!active) return
        const ably = await import('ably')
        if (!active) return
        client = new ably.default.Realtime({
          authCallback(_params, callback) {
            api('/api/realtime/token', { method: 'POST', body: { conversationId } })
              .then((tokenRequest) => callback(null, tokenRequest))
              .catch((failure) => callback(failure.message, null))
          },
        })
        const channel = client.channels.get(`privatechat:conversation:${conversationId}`)
        channel.subscribe('message', (event) => {
          setMessages((items) => items.some((item) => item.id === event.data.id) ? items : [...items, event.data])
        })
        client.connection.on('connected', () => { loadMessages().catch(() => {}) })
        client.connection.on('failed', () => { if (active) setError('Realtime connection could not be established.') })
        setError('')
      } catch (failure) { if (active) setError(failure.message) }
      finally { if (active) setLoading(false) }
    }
    start()
    return () => { active = false; client?.close() }
  }, [conversationId])

  if (loading) return <div className="message-status">Loading conversation…</div>
  if (!messages.length) return <div className="message-status"><span className="empty-chat-icon"><MessageCircle size={23} /></span><strong>Say hello to start the conversation.</strong><span>Messages are private to this conversation.</span>{error && <small>{error}</small>}</div>
  return <div className="message-list">
    {error && <p className="realtime-warning">{error} Reconnecting and syncing history…</p>}
    {messages.map((message) => {
      const mine = message.senderId === currentUserId || message.senderId?.id === currentUserId
      return <article className={`message-row ${mine ? 'message-mine' : ''}`} key={message.id}><div className="message-bubble"><p>{message.deletedForEveryone ? 'This message was deleted.' : 'Encrypted message. This device cannot decrypt it because end-to-end encryption is not configured.'}</p><div className="message-meta"><time>{new Date(message.messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{mine && (message.deliveryStatus === 'read' ? <CheckCheck size={13} /> : <Check size={13} />)}</div></div></article>
    })}
  </div>
}

function ConversationView({ conversation, onBack, currentUser }) {
  return <section className="conversation-view">
    <header className="conversation-header"><button className="icon-button mobile-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={19} /></button><Avatar user={conversation.participant} /><div className="conversation-person"><strong>{conversation.participant?.fullName ?? 'Conversation'}</strong><span>{conversation.participant?.userId}</span></div><span className="encryption-indicator"><LockKeyhole size={13} /> Not E2EE</span></header>
    <div className="chat-date-rule"><span>PRIVATE CONVERSATION</span></div>
    <MessageHistory conversationId={conversation.id} currentUserId={currentUser.id} />
    <div className="composer-locked"><div className="composer-lock-icon"><LockKeyhole size={16} /></div><div><strong>Message sending is paused</strong><span>End-to-end encryption has not been configured or verified.</span></div></div>
  </section>
}

export default function Dashboard() {
  const { user, setUser, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(true)
  const selectedId = searchParams.get('conversation')
  const selectedConversation = conversations.find((item) => item.id === selectedId)

  const activeSection = location.pathname
  const shownConversations = useMemo(() => conversations.filter((item) => {
    const term = search.trim().toLowerCase()
    return !term || item.participant?.fullName?.toLowerCase().includes(term) || item.participant?.username?.toLowerCase().includes(term) || item.participant?.userId?.toLowerCase().includes(term)
  }), [conversations, search])

  useEffect(() => {
    api('/api/conversations').then(({ conversations: items }) => setConversations(items)).catch((failure) => setError(failure.message))
  }, [])

  useEffect(() => {
    const theme = localStorage.getItem('privatechat-theme')
    if (theme) document.documentElement.dataset.theme = theme
  }, [])

  async function openConversation(person) {
    try {
      const { conversation } = await api('/api/conversations', { method: 'POST', body: { userId: person.userId ?? person.username } })
      setConversations((items) => [
        { ...conversation, unreadCount: 0 },
        ...items.filter((item) => item.id !== conversation.id),
      ])
      setSearchParams({ conversation: conversation.id })
      setMobileListOpen(false)
      navigate('/')
    } catch (failure) { setError(failure.message) }
  }

  async function confirmLogout(all = false, alreadyConfirmed = false) {
    if (!all && !alreadyConfirmed && !window.confirm('Log out of PRIVATECHAT?')) return
    await logout(all)
    navigate('/login', { replace: true })
  }

  return <main className={`app-shell ${activeSection !== '/' ? 'app-shell-detail' : ''}`}>
    <aside className="app-sidebar">
      <div className="sidebar-top"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}><span className="brand-mark"><MessageCircle size={18} /></span>PRIVATECHAT</a></div>
      <div className="sidebar-profile"><Avatar user={user} /><div><strong>{user.fullName}</strong><span>{user.userId}</span></div><button className="icon-button" aria-label="Open profile" onClick={() => navigate('/profile')}><ChevronDown size={16} /></button></div>
      <nav className="primary-nav" aria-label="Main navigation">{navigation.map(({ path, label, icon }) => <button key={path} className={`nav-item ${activeSection === path ? 'nav-active' : ''}`} onClick={() => { navigate(path); setMobileListOpen(true); setSearchParams({}) }}>{createElement(icon, { size: 18 })}<span>{label}</span>{path === '/' && <span className="nav-count">{conversations.length || ''}</span>}</button>)}</nav>
      <div className="conversation-sidebar-heading"><span>YOUR CHATS</span><button className="icon-button" title="New conversation" onClick={() => navigate('/connect')}><Plus size={17} /></button></div>
      <label className="conversation-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search conversations" /><kbd>/</kbd></label>
      <div className="conversation-list">
        {shownConversations.map((item) => <button key={item.id} className={`conversation-item ${selectedId === item.id ? 'conversation-selected' : ''}`} onClick={() => { setSearchParams({ conversation: item.id }); setMobileListOpen(false); navigate('/') }}><Avatar user={item.participant} /><span className="conversation-summary"><strong>{item.participant?.fullName}</strong><span>{item.lastMessage ? 'Encrypted message' : 'Start a conversation'}</span></span><span className="conversation-trailing">{item.lastMessage && <time>{new Date(item.lastMessage.messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</span></button>)}
        {!shownConversations.length && <div className="sidebar-empty"><span>{search ? 'No matching chats' : 'No conversations yet'}</span><button onClick={() => navigate('/connect')}>Find someone <ArrowRight size={13} /></button></div>}
      </div>
      {error && <div className="sidebar-error" role="alert">{error}</div>}
      <footer className="sidebar-footer"><button className={`nav-item ${activeSection === '/settings' ? 'nav-active' : ''}`} onClick={() => navigate('/settings')}><Settings size={18} /><span>Settings</span></button><button className="nav-item" onClick={() => confirmLogout()}><LogOut size={18} /><span>Log out</span></button><div className="sidebar-status"><span className="online-dot" /> Secure session active</div></footer>
    </aside>
    <section className={`workspace ${!mobileListOpen && selectedConversation ? 'workspace-chat-open' : ''}`}>
      {selectedConversation && activeSection === '/' ? <ConversationView conversation={selectedConversation} currentUser={user} onBack={() => { setMobileListOpen(true); setSearchParams({}) }} /> : activeSection === '/connect' ? <ConnectPanel onStartChat={openConversation} /> : activeSection === '/contacts' ? <ContactsPanel onStartChat={openConversation} /> : activeSection === '/profile' ? <ProfilePanel user={user} setUser={setUser} onLogout={() => confirmLogout()} /> : activeSection === '/settings' ? <SettingsPanel onLogout={() => confirmLogout()} onLogoutAll={() => confirmLogout(true)} /> : <div className="welcome-panel"><div className="welcome-mark"><MessageCircle size={27} /></div><span className="eyebrow">A little more personal</span><h1>Your conversations<br /><em>start here.</em></h1><p>Connect with someone using their PRIVATECHAT ID, then make the conversation your own.</p><button className="primary-button" onClick={() => navigate('/connect')}>Find someone <ArrowRight size={16} /></button><div className="welcome-note"><ShieldCheck size={15} /> Your identity is yours to keep.</div></div>}
    </section>
    <div className="mobile-bottom-nav">{navigation.map(({ path, label, icon }) => <button key={path} className={activeSection === path ? 'mobile-nav-active' : ''} onClick={() => { navigate(path); setMobileListOpen(true); setSearchParams({}) }}>{createElement(icon, { size: 19 })}<span>{label}</span></button>)}<button onClick={() => navigate('/profile')}><UserRound size={19} /><span>Profile</span></button></div>
  </main>
}