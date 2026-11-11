import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown,
  ContactRound, Copy, LockKeyhole, LogOut, MessageCircle,
  MoreVertical, Plus, Search, Send, Settings, ShieldAlert, ShieldCheck, Sun,
  Trash2, UserPlus, UserRound, X,
} from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

function Avatar({ user, size = 'normal' }) {
  const initials = (user?.fullName ?? user?.username ?? '?').split(/[\s._-]+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return user?.profilePicture
    ? <img className={`avatar avatar-${size}`} src={user.profilePicture} alt="" />
    : <span className={`avatar avatar-${size} avatar-color-${(user?.userId?.slice(-1).charCodeAt(0) ?? 1) % 5}`}>{initials}</span>
}

function useHeartbeat() {
  useEffect(() => {
    api('/api/users/heartbeat', { method: 'POST' }).catch(() => {})
    const interval = setInterval(() => api('/api/users/heartbeat', { method: 'POST' }).catch(() => {}), 30_000)
    return () => clearInterval(interval)
  }, [])
}

function usePresence(userId) {
  const [lastSeen, setLastSeen] = useState(null)
  useEffect(() => {
    if (!userId) return
    let active = true
    function fetch() {
      api(`/api/users/presence/${userId}`)
        .then((r) => { if (active) setLastSeen(r.lastSeen ? new Date(r.lastSeen) : null) })
        .catch(() => {})
    }
    fetch()
    const interval = setInterval(fetch, 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [userId])
  return lastSeen
}

function PresenceLabel({ userId }) {
  const lastSeen = usePresence(userId)
  if (!lastSeen) return <span className="presence offline">Offline</span>
  const diffMs = Date.now() - lastSeen.getTime()
  if (diffMs < 60_000) return <span className="presence online">Online</span>
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const label = diffDay > 0 ? `last seen ${diffDay}d ago`
    : diffHr > 0 ? `last seen ${diffHr}h ago`
    : `last seen ${diffMin}m ago`
  return <span className="presence offline">{label}</span>
}

function MessageHistory({ conversationId, currentUserId, refreshKey, localMessages, onDelete }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState(null) // { msgId, mine, x, y }
  const bottomRef = useRef(null)

  useEffect(() => {
    let active = true
    function load(initial = false) {
      if (initial) setLoading(true)
      api(`/api/messages/${conversationId}?limit=40`)
        .then((r) => {
          if (!active) return
          setMessages(r.messages)
          if (initial) setLoading(false)
          r.messages
            .filter((m) => (m.senderId?.id ?? m.senderId) !== currentUserId && m.deliveryStatus !== 'read')
            .forEach((m) => api(`/api/messages/${m.id ?? m._id}/read`, { method: 'PATCH' }).catch(() => {}))
        })
        .catch(() => { if (active && initial) setLoading(false) })
    }
    load(true)
    const interval = setInterval(() => load(false), 1500)
    return () => { active = false; clearInterval(interval) }
  }, [conversationId, refreshKey])

  const allMessages = useMemo(() => {
    const serverIds = new Set(messages.map((m) => m.clientMessageId))
    const pending = localMessages.filter((m) => !serverIds.has(m.clientMessageId))
    return [...messages, ...pending]
  }, [messages, localMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [allMessages])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  function openMenu(e, msg, mine) {
    if (msg.pending) return
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 100)
    setMenu({ msgId: msg.id ?? msg._id, mine, x, y })
  }

  if (loading) return <div className="message-status">Loading…</div>
  if (!allMessages.length) return (
    <div className="message-status">
      <span className="empty-chat-icon"><MessageCircle size={23} /></span>
      <strong>Say hello!</strong>
      <span>Messages are private to this conversation.</span>
    </div>
  )
  return (
    <div className="message-list">
      {allMessages.map((msg) => {
        const mine = (msg.senderId?.id ?? msg.senderId?.toString?.() ?? msg.senderId) === currentUserId
        const tick = !mine ? null
          : msg.pending ? <Check size={13} className="tick tick-pending" />
          : msg.deliveryStatus === 'read' ? <CheckCheck size={13} className="tick tick-read" />
          : <CheckCheck size={13} className="tick tick-sent" />
        return (
          <article
            className={`message-row ${mine ? 'message-mine' : ''}`}
            key={msg.clientMessageId ?? msg.id}
            onContextMenu={(e) => openMenu(e, msg, mine)}
            onTouchStart={(e) => {
              const t = e.touches[0]
              const timer = setTimeout(() => openMenu({ preventDefault: () => {}, stopPropagation: () => {}, clientX: t.clientX, clientY: t.clientY }, msg, mine), 500)
              const cancel = () => clearTimeout(timer)
              e.currentTarget.addEventListener('touchend', cancel, { once: true })
              e.currentTarget.addEventListener('touchmove', cancel, { once: true })
            }}
          >
            <div className="message-bubble">
              <p>{msg.encryptedPayload}</p>
              <div className="message-meta">
                <time>{new Date(msg.messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                {tick}
              </div>
            </div>
          </article>
        )
      })}
      <div ref={bottomRef} />
      {menu && (
        <div className="msg-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { onDelete(menu.msgId, 'me'); setMenu(null) }}>
            <Trash2 size={14} /> Delete for me
          </button>
          <button className="danger-text" onClick={() => { onDelete(menu.msgId, 'everyone'); setMenu(null) }}>
            <Trash2 size={14} /> Delete for everyone
          </button>
        </div>
      )}
    </div>
  )
}

function ConversationView({ conversation, onBack, onDeleteChat, currentUser }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [localMessages, setLocalMessages] = useState([])
  const [chatMenu, setChatMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // 'me' | 'everyone'
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [conversation.id])
  useEffect(() => { setLocalMessages([]); setChatMenu(false); setConfirmDelete(null) }, [conversation.id])

  async function send(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const clientMessageId = crypto.randomUUID()
    const optimistic = {
      clientMessageId,
      encryptedPayload: trimmed,
      senderId: currentUser.id,
      messageTimestamp: new Date().toISOString(),
      deliveryStatus: 'sent',
      pending: true,
    }
    setLocalMessages((prev) => [...prev, optimistic])
    setText('')
    setBusy(true); setError('')
    try {
      await api('/api/messages', {
        method: 'POST',
        body: {
          conversationId: conversation.id,
          encryptedPayload: trimmed,
          encryptionMetadata: { protocol: 'plaintext', version: '1' },
          messageType: 'text',
          clientMessageId,
        },
      })
      setRefreshKey((k) => k + 1)
    } catch (f) {
      setLocalMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId))
      setError(f.message)
    }
    finally { setBusy(false) }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) }
  }

  return (
    <section className="conversation-view">
      <header className="conversation-header">
        <button className="icon-button mobile-back" onClick={onBack} aria-label="Back"><ArrowLeft size={19} /></button>
        <Avatar user={conversation.participant} />
        <div className="conversation-person">
          <strong>{conversation.participant?.fullName ?? 'Conversation'}</strong>
          <PresenceLabel userId={conversation.participant?.userId} />
        </div>
        <div style={{position:'relative'}}>
          <button className="icon-button" onClick={() => setChatMenu((v) => !v)} aria-label="More options"><MoreVertical size={19} /></button>
          {chatMenu && (
            <div className="msg-menu" style={{top:'100%', right:0, left:'auto'}} onClick={() => setChatMenu(false)}>
              <button onClick={() => setConfirmDelete('me')}><Trash2 size={14} /> Delete chat for me</button>
              <button className="danger-text" onClick={() => setConfirmDelete('everyone')}><Trash2 size={14} /> Delete chat for everyone</button>
            </div>
          )}
        </div>
      </header>
      {confirmDelete && (
        <div className="confirm-strip">
          <span>{confirmDelete === 'everyone' ? 'Delete entire chat for both users? This cannot be undone.' : 'Delete this chat for yourself?'}</span>
          <button className="text-button" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="text-button danger-text" onClick={() => { onDeleteChat(conversation.id, confirmDelete); setConfirmDelete(null) }}>Delete</button>
        </div>
      )}
      <MessageHistory conversationId={conversation.id} currentUserId={currentUser.id} refreshKey={refreshKey} localMessages={localMessages} onDelete={async (msgId, mode) => {
        try {
          await api(`/api/messages/${msgId}?mode=${mode}`, { method: 'DELETE' })
          setRefreshKey((k) => k + 1)
        } catch (f) { setError(f.message) }
      }} />
      <form className="composer" onSubmit={send}>
        {error && <p className="form-error composer-error" role="alert">{error}</p>}
        <input
          ref={inputRef}
          className="composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          autoComplete="off"
        />
        <button className="send-button" type="submit" disabled={busy || !text.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </section>
  )
}

function ContactsPanel({ onStartChat }) {
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    api('/api/contacts').then(({ contacts: items }) => setContacts(items)).catch((f) => setError(f.message))
  }, [])
  async function remove(contactId) {
    try { await api(`/api/contacts/${contactId}`, { method: 'DELETE' }); setContacts((c) => c.filter((i) => i.id !== contactId)) }
    catch (f) { setError(f.message) }
  }
  return (
    <section className="work-panel list-panel">
      <div className="section-heading"><div><span className="eyebrow">Your circle</span><h2>Contacts <span className="count-label">{contacts.length}</span></h2></div></div>
      {error && <p className="inline-notice error-notice">{error}</p>}
      {contacts.length
        ? <div className="contact-grid">{contacts.map(({ id, user }) => (
          <article className="contact-row" key={id}>
            <Avatar user={user} />
            <div className="contact-name"><strong>{user?.fullName}</strong><span>@{user?.username} · {user?.userId}</span></div>
            <button className="icon-button" title="Start chat" onClick={() => onStartChat(user)}><MessageCircle size={17} /></button>
            <button className="icon-button quiet-danger" title="Remove" onClick={() => remove(id)}><X size={16} /></button>
          </article>
        ))}</div>
        : <div className="empty-panel"><ContactRound size={25} /><strong>No contacts yet</strong><span>Find someone by their PRIVATECHAT ID.</span></div>}
    </section>
  )
}

function ConnectPanel({ onStartChat }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function search(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try { setResult((await api(`/api/users/search/${encodeURIComponent(query.trim())}`)).user) }
    catch (f) { setError(f.message) }
    finally { setBusy(false) }
  }
  return (
    <section className="work-panel connect-panel">
      <div className="section-heading"><div><span className="eyebrow">Find your people</span><h2>Connect with someone</h2><p>Search by PRIVATECHAT ID or username.</p></div></div>
      <form className="connect-search" onSubmit={search}>
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try PC5821 or username" />
        <button className="primary-button" disabled={busy || query.trim().length < 3}>{busy ? 'Searching…' : 'Search'} <ArrowRight size={16} /></button>
      </form>
      {error && <p className="inline-notice error-notice">{error}</p>}
      {result && (
        <div className="person-result">
          <Avatar user={result} size="large" />
          <div className="person-copy"><strong>{result.fullName}</strong><span>@{result.username}</span><small>{result.userId}</small></div>
          <button className="primary-button" onClick={() => onStartChat(result)}>Chat <MessageCircle size={16} /></button>
        </div>
      )}
    </section>
  )
}

function ProfilePanel({ user, setUser, onLogout }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [username, setUsername] = useState(user.username)
  const [picture, setPicture] = useState(user.profilePicture ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try { const r = await api('/api/users/profile', { method: 'PATCH', body: { fullName, username, profilePicture: picture } }); setUser(r.user); setSuccess('Profile updated.') }
    catch (f) { setError(f.message) }
    finally { setBusy(false) }
  }
  return (
    <section className="work-panel profile-panel">
      <div className="section-heading"><div><span className="eyebrow">Your account</span><h2>Profile & identity</h2></div></div>
      <div className="profile-id-strip"><Avatar user={user} size="large" /><div><span>Your PRIVATECHAT ID</span><strong>{user.userId}</strong></div><button className="secondary-button" onClick={() => navigator.clipboard.writeText(user.userId)}><Copy size={15} /> Copy</button></div>
      <form className="profile-form" onSubmit={save}>
        <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required /></label>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} required /></label>
        <label>Profile image URL<input value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://…" type="url" /></label>
        {error && <p className="inline-notice error-notice">{error}</p>}
        {success && <p className="inline-notice success-notice">{success}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={16} /></button>
      </form>
      <div className="account-actions"><div><strong>Sign out</strong><span>End this session.</span></div><button className="secondary-button danger-button" onClick={onLogout}><LogOut size={15} /> Log out</button></div>
    </section>
  )
}

function SettingsPanel({ onLogout, onLogoutAll }) {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark')
  const [confirming, setConfirming] = useState('')
  function toggleTheme() {
    const next = !dark; setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('privatechat-theme', next ? 'dark' : 'light')
  }
  return (
    <section className="work-panel settings-panel">
      <div className="section-heading"><div><span className="eyebrow">Make it yours</span><h2>Settings</h2></div></div>
      <div className="settings-row"><span className="settings-icon"><Sun size={18} /></span><div className="settings-copy"><strong>Appearance</strong><span>{dark ? 'Dark' : 'Light'} theme</span></div><button className={`toggle ${dark ? 'toggle-on' : ''}`} onClick={toggleTheme} role="switch" aria-checked={dark}><span /></button></div>
      <div className="settings-row"><span className="settings-icon"><ShieldAlert size={18} /></span><div className="settings-copy"><strong>End-to-end encryption</strong><span>Not yet enabled.</span></div><span className="status-pill status-pending">Not enabled</span></div>
      <div className="settings-row"><span className="settings-icon"><LogOut size={18} /></span><div className="settings-copy"><strong>Log out all devices</strong><span>Revoke every active session.</span></div><button className="secondary-button danger-button" onClick={() => setConfirming('all')}>Log out all</button></div>
      {confirming && <div className="confirm-strip"><span>Sign out every device?</span><button className="text-button" onClick={() => setConfirming('')}>Cancel</button><button className="text-button danger-text" onClick={onLogoutAll}>Confirm</button></div>}
    </section>
  )
}

const SECTIONS = ['/', '/contacts', '/connect', '/profile', '/settings']

export default function Dashboard() {
  const { user, setUser, logout } = useAuth()
  useHeartbeat()
  const [section, setSection] = useState('/')
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/conversations')
      .then(({ conversations: items }) => setConversations(items))
      .catch((f) => setError(f.message))
  }, [])

  useEffect(() => {
    const theme = localStorage.getItem('privatechat-theme')
    if (theme) document.documentElement.dataset.theme = theme
  }, [])

  const shownConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return !term ? conversations : conversations.filter((c) =>
      c.participant?.fullName?.toLowerCase().includes(term) ||
      c.participant?.username?.toLowerCase().includes(term) ||
      c.participant?.userId?.toLowerCase().includes(term)
    )
  }, [conversations, search])

  async function openConversation(person) {
    try {
      const { conversation } = await api('/api/conversations', { method: 'POST', body: { userId: person.userId ?? person.username } })
      const merged = { ...conversation, participant: conversation.participant ?? person, unreadCount: 0 }
      setConversations((prev) => [merged, ...prev.filter((c) => c.id !== conversation.id)])
      setSelectedConversation(merged)
      setSection('/')
    } catch (f) { setError(f.message) }
  }

  async function deleteChat(conversationId, mode) {
    try {
      await api(`/api/conversations/${conversationId}?mode=${mode}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      setSelectedConversation(null)
    } catch (f) { setError(f.message) }
  }

  async function confirmLogout(all = false) {
    if (!window.confirm('Log out of PRIVATECHAT?')) return
    await logout(all)
  }

  const nav = [
    { key: '/', label: 'Messages', icon: MessageCircle },
    { key: '/contacts', label: 'Contacts', icon: ContactRound },
    { key: '/connect', label: 'Connect', icon: UserPlus },
  ]

  return (
    <main className={`app-shell ${selectedConversation && section === '/' ? 'chat-open' : ''}`}>
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <span className="brand"><span className="brand-mark"><MessageCircle size={18} /></span>PRIVATECHAT</span>
        </div>
        <div className="sidebar-profile">
          <Avatar user={user} />
          <div><strong>{user.fullName}</strong><span>{user.userId}</span></div>
          <button className="icon-button" onClick={() => { setSection('/profile'); setSelectedConversation(null) }}><ChevronDown size={16} /></button>
        </div>
        <nav className="primary-nav">
          {nav.map(({ key, label, icon }) => (
            <button key={key} className={`nav-item ${section === key && !selectedConversation ? 'nav-active' : ''}`}
              onClick={() => { setSection(key); setSelectedConversation(null) }}>
              {createElement(icon, { size: 18 })}<span>{label}</span>
              {key === '/' && <span className="nav-count">{conversations.length || ''}</span>}
            </button>
          ))}
        </nav>
        <div className="conversation-sidebar-heading">
          <span>YOUR CHATS</span>
          <button className="icon-button" onClick={() => { setSection('/connect'); setSelectedConversation(null) }}><Plus size={17} /></button>
        </div>
        <label className="conversation-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" />
        </label>
        <div className="conversation-list">
          {shownConversations.map((item) => (
            <button key={item.id}
              className={`conversation-item ${selectedConversation?.id === item.id ? 'conversation-selected' : ''}`}
              onClick={() => { setSelectedConversation(item); setSection('/') }}>
              <Avatar user={item.participant} />
              <span className="conversation-summary">
                <strong>{item.participant?.fullName}</strong>
                <span>{item.lastMessage ? item.lastMessage.encryptedPayload || 'Message' : 'Start a conversation'}</span>
              </span>
              <span className="conversation-trailing">
                {item.lastMessage && <time>{new Date(item.lastMessage.messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
                {item.unreadCount > 0 && <b>{item.unreadCount}</b>}
              </span>
            </button>
          ))}
          {!shownConversations.length && (
            <div className="sidebar-empty">
              <span>{search ? 'No matching chats' : 'No conversations yet'}</span>
              <button onClick={() => { setSection('/connect'); setSelectedConversation(null) }}>Find someone <ArrowRight size={13} /></button>
            </div>
          )}
        </div>
        {error && <div className="sidebar-error" role="alert">{error}</div>}
        <footer className="sidebar-footer">
          <button className={`nav-item ${section === '/settings' && !selectedConversation ? 'nav-active' : ''}`} onClick={() => { setSection('/settings'); setSelectedConversation(null) }}><Settings size={18} /><span>Settings</span></button>
          <button className="nav-item" onClick={() => confirmLogout()}><LogOut size={18} /><span>Log out</span></button>
          <div className="sidebar-status"><span className="online-dot" /> Secure session active</div>
        </footer>
      </aside>

      <section className={`workspace ${section !== '/' || !selectedConversation ? 'has-panel' : ''}`}>
        {selectedConversation && section === '/'
          ? <ConversationView conversation={selectedConversation} currentUser={user} onBack={() => setSelectedConversation(null)} onDeleteChat={deleteChat} />
          : section === '/contacts' ? <ContactsPanel onStartChat={openConversation} />
          : section === '/connect' ? <ConnectPanel onStartChat={openConversation} />
          : section === '/profile' ? <ProfilePanel user={user} setUser={setUser} onLogout={() => confirmLogout()} />
          : section === '/settings' ? <SettingsPanel onLogout={() => confirmLogout()} onLogoutAll={() => confirmLogout(true)} />
          : (
            <div className="welcome-panel">
              <div className="welcome-mark"><MessageCircle size={27} /></div>
              <span className="eyebrow">A little more personal</span>
              <h1>Your conversations<br /><em>start here.</em></h1>
              <p>Connect with someone using their PRIVATECHAT ID.</p>
              <button className="primary-button" onClick={() => setSection('/connect')}>Find someone <ArrowRight size={16} /></button>
              <div className="welcome-note"><ShieldCheck size={15} /> Your identity is yours to keep.</div>
            </div>
          )}
      </section>

      <div className="mobile-bottom-nav">
        {nav.map(({ key, label, icon }) => (
          <button key={key} className={section === key && !selectedConversation ? 'mobile-nav-active' : ''}
            onClick={() => { setSection(key); setSelectedConversation(null) }}>
            {createElement(icon, { size: 19 })}<span>{label}</span>
          </button>
        ))}
        <button className={section === '/profile' ? 'mobile-nav-active' : ''} onClick={() => { setSection('/profile'); setSelectedConversation(null) }}>
          <UserRound size={19} /><span>Profile</span>
        </button>
      </div>
    </main>
  )
}
