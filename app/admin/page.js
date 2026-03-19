'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ADMIN_PASSWORD = '@Dalordz1';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [config, setConfig] = useState({
    proxy: '', email: '', appPassword: '', domain: '', defaultPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Check if already authenticated this session
    const auth = sessionStorage.getItem('admin-authenticated');
    if (auth === 'true') {
      setAuthenticated(true);
      loadConfig();
    }
  }, []);

  const loadConfig = () => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => setConfig(prev => ({ ...prev, ...data })))
      .catch(() => {});
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem('admin-authenticated', 'true');
      setPasswordError('');
      loadConfig();
    } else {
      setPasswordError('ACCESS DENIED — Invalid password');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('admin-authenticated');
    setPasswordInput('');
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateField = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, adminKey: ADMIN_PASSWORD }),
      });
      const data = await resp.json();
      if (data.success) {
        showToast('Configuration saved successfully!');
      } else {
        showToast('Error: ' + (data.error || 'Save failed'));
      }
    } catch (e) {
      showToast('Error: ' + e.message);
    }
    setSaving(false);
  };

  const resetConfig = () => {
    setConfig({ proxy: '', email: '', appPassword: '', domain: '', defaultPassword: '' });
    showToast('Configuration reset');
  };

  const exportConfig = () => {
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
    showToast('Config copied as JSON!');
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="app-container">
        <header className="header">
          <h1 className="header-title">Admin Panel</h1>
          <p className="header-subtitle">Authentication Required</p>
          <div className="header-line"></div>
        </header>

        <nav className="nav">
          <Link href="/" className="nav-link">Terminal</Link>
          <Link href="/admin" className="nav-link active">Admin Panel</Link>
        </nav>

        <div className="card" style={{ maxWidth: '500px', margin: '60px auto' }}>
          <h2 className="card-title">Access Control</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Admin Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Enter admin password..."
                value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                autoFocus
              />
            </div>
            {passwordError && (
              <div style={{
                color: 'var(--danger)',
                fontSize: '0.8rem',
                marginTop: '10px',
                textShadow: 'var(--danger-glow)',
                animation: 'fadeIn 0.3s ease',
              }}>
                ✗ {passwordError}
              </div>
            )}
            <div className="btn-group">
              <button className="btn btn-primary" type="submit">▶ Authenticate</button>
            </div>
          </form>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // Authenticated admin panel
  return (
    <div className="app-container">
      <header className="header">
        <h1 className="header-title">Admin Panel</h1>
        <p className="header-subtitle">System Configuration</p>
        <div className="header-line"></div>
      </header>

      <nav className="nav">
        <Link href="/" className="nav-link">Terminal</Link>
        <Link href="/admin" className="nav-link active">Admin Panel</Link>
        <button className="nav-link" onClick={handleLogout} style={{ cursor: 'pointer', background: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)', color: '#ff5555' }}>
          Logout
        </button>
      </nav>

      <div className="card">
        <h2 className="card-title">Default Settings</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: '1.6' }}>
          These are the default values used when users leave fields empty on the main page.
          Changes here affect all users immediately.
        </p>

        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Proxy URL</label>
            <input className="form-input" placeholder="http://user:pass@host:port or socks5://host:port" value={config.proxy} onChange={e => updateField('proxy', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              HTTP/SOCKS proxy for all registration requests. Leave empty for direct connection.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">IMAP Email</label>
            <input className="form-input" type="email" placeholder="your-email@gmail.com" value={config.email} onChange={e => updateField('email', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Gmail address for receiving OTP codes via IMAP
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">App Password</label>
            <input className="form-input" type="password" placeholder="16-char Gmail App Password" value={config.appPassword} onChange={e => updateField('appPassword', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Google App Password (not your Gmail password)
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Email Domain</label>
            <input className="form-input" placeholder="dalordz.me" value={config.domain} onChange={e => updateField('domain', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Custom domain for generated emails. Empty = random from generator.email
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Default Account Password</label>
            <input className="form-input" placeholder="Min 12 characters" value={config.defaultPassword} onChange={e => updateField('defaultPassword', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Default password for ChatGPT accounts. Empty = random 14-char password
            </span>
          </div>
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
            {saving ? '⟳ Saving...' : '✓ Save Configuration'}
          </button>
          <button className="btn btn-secondary" onClick={exportConfig}>
            ⬡ Export JSON
          </button>
          <button className="btn btn-danger" onClick={resetConfig}>
            ✗ Reset
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Environment Variables</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '16px', lineHeight: '1.6' }}>
          For persistent configuration on Vercel, add these environment variables
          in your Vercel Project Settings → Environment Variables:
        </p>
        <div className="terminal">
          <div className="terminal-header">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
            <span className="terminal-title">.env — reference</span>
          </div>
          <div className="terminal-body">
            <div className="log-line info">ADMIN_PROXY={config.proxy || '(empty)'}</div>
            <div className="log-line info">ADMIN_EMAIL={config.email || '(empty)'}</div>
            <div className="log-line info">ADMIN_APP_PASSWORD={config.appPassword ? '••••••••' : '(empty)'}</div>
            <div className="log-line info">ADMIN_DOMAIN={config.domain || '(empty)'}</div>
            <div className="log-line info">ADMIN_DEFAULT_PASSWORD={config.defaultPassword ? '••••••••' : '(empty)'}</div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
