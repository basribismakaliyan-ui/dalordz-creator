'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function HomePage() {
  // License state
  const [licensed, setLicensed] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseChecking, setLicenseChecking] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseError, setLicenseError] = useState('');

  // App state
  const [config, setConfig] = useState({
    proxy: '', email: '', appPassword: '', domain: '', defaultPassword: '',
    totalAccounts: 1,
  });
  const [adminDefaults, setAdminDefaults] = useState({});
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ target: 0, success: 0, failed: 0, attempts: 0 });
  const [toast, setToast] = useState(null);
  const logRef = useRef(null);
  const abortRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    // Check saved license
    const savedKey = localStorage.getItem('chatgpt-creator-license');
    if (savedKey) {
      checkLicense(savedKey, true);
    }
  }, []);

  useEffect(() => {
    if (licensed) {
      // Load admin defaults
      fetch('/api/config').then(r => r.json()).then(data => {
        setAdminDefaults(data);
        const saved = localStorage.getItem('chatgpt-creator-config');
        if (saved) {
          try { setConfig(prev => ({ ...prev, ...JSON.parse(saved) })); } catch {}
        }
      }).catch(() => {});
    }
  }, [licensed]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const checkLicense = async (key, silent = false) => {
    if (!key) { setLicenseError('Masukan license key!'); return; }
    setLicenseChecking(true);
    setLicenseError('');
    try {
      const resp = await fetch(`/api/license?key=${encodeURIComponent(key)}`);
      const data = await resp.json();
      if (data.valid) {
        setLicensed(true);
        setLicenseInfo(data);
        localStorage.setItem('chatgpt-creator-license', key);
      } else {
        setLicenseError(data.message);
        if (!silent) localStorage.removeItem('chatgpt-creator-license');
        setLicensed(false);
      }
    } catch (e) {
      setLicenseError('Error checking license: ' + e.message);
      setLicensed(false);
    }
    setLicenseChecking(false);
  };

  const handleLicenseSubmit = (e) => {
    e.preventDefault();
    checkLicense(licenseKey);
  };

  const handleLogout = () => {
    setLicensed(false);
    setLicenseInfo(null);
    localStorage.removeItem('chatgpt-creator-license');
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const updateConfig = (key, value) => {
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('chatgpt-creator-config', JSON.stringify(next));
      return next;
    });
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, id: Date.now() + Math.random() }]);
  };

  const getMergedConfig = () => ({
    proxy: config.proxy || adminDefaults.proxy || '',
    email: config.email || adminDefaults.email || '',
    appPassword: config.appPassword || adminDefaults.appPassword || '',
    domain: config.domain || adminDefaults.domain || '',
    defaultPassword: config.defaultPassword || adminDefaults.defaultPassword || '',
    totalAccounts: config.totalAccounts || 1,
  });

  const registerOne = async (index, total) => {
    const controller = new AbortController();
    abortRef.current = controller;
    addLog(`[Worker] Starting registration ${index + 1}/${total}...`, 'info');
    setStats(s => ({ ...s, attempts: s.attempts + 1 }));
    try {
      const merged = getMergedConfig();
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
        signal: controller.signal,
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'log') addLog(data.message, 'info');
            else if (data.type === 'success') {
              addLog(`✓ SUCCESS: ${data.email}`, 'success');
              setResults(prev => [...prev, { email: data.email, password: data.password, time: new Date().toLocaleTimeString() }]);
              setStats(s => ({ ...s, success: s.success + 1 }));
              return true;
            } else if (data.type === 'error') {
              addLog(`✗ ERROR: ${data.message}`, 'error');
              setStats(s => ({ ...s, failed: s.failed + 1 }));
              return false;
            }
          } catch {}
        }
      }
      return false;
    } catch (err) {
      if (err.name === 'AbortError') { addLog('Registration cancelled', 'error'); return false; }
      addLog(`✗ ERROR: ${err.message}`, 'error');
      setStats(s => ({ ...s, failed: s.failed + 1 }));
      return false;
    }
  };

  const startRegistration = async () => {
    const total = parseInt(config.totalAccounts) || 1;
    setRunning(true);
    runningRef.current = true;
    setLogs([]);
    setResults([]);
    setStats({ target: total, success: 0, failed: 0, attempts: 0 });
    const merged = getMergedConfig();
    addLog(`[System] Starting batch: ${total} accounts`, 'info');
    if (merged.proxy) addLog(`[System] Proxy: ${merged.proxy}`, 'info');
    if (merged.domain) addLog(`[System] Domain: ${merged.domain}`, 'info');
    let successCount = 0;
    let attemptIndex = 0;
    let consecutiveFailures = 0;
    while (successCount < total && runningRef.current) {
      const success = await registerOne(attemptIndex, total);
      if (success) {
        successCount++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
      }
      attemptIndex++;
      if (successCount >= total) break;
      if (consecutiveFailures >= 3) {
        addLog('[System] 3 consecutive failures, stopping...', 'error');
        break;
      }
    }
    addLog(`[System] Batch complete — Success: ${successCount}/${total}`, successCount === total ? 'success' : 'error');
    setRunning(false);
    runningRef.current = false;
  };

  const stopRegistration = () => {
    if (abortRef.current) abortRef.current.abort();
    setRunning(false);
    runningRef.current = false;
    addLog('[System] Stopping...', 'error');
  };

  const copyResult = (email, password) => { navigator.clipboard.writeText(`${email}|${password}`); showToast('Copied!'); };
  const copyAll = () => { navigator.clipboard.writeText(results.map(r => `${r.email}|${r.password}`).join('\n')); showToast(`Copied ${results.length} accounts!`); };

  // ==================== LICENSE GATE ====================
  if (!licensed) {
    return (
      <div className="app-container">
        <header className="header">
          <h1 className="header-title">ChatGPT Creator</h1>
          <p className="header-subtitle">License Verification</p>
          <div className="header-line"></div>
        </header>

        <div className="card" style={{ maxWidth: '550px', margin: '40px auto' }}>
          <h2 className="card-title">License Activation</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: '1.6' }}>
            Masukan license key / HWID untuk mengakses aplikasi.
            <br />Hubungi admin jika belum memiliki lisensi.
          </p>

          <form onSubmit={handleLicenseSubmit}>
            <div className="form-group">
              <label className="form-label">License Key / HWID</label>
              <input
                className="form-input"
                placeholder="DALORDZ-XXXXXXXXXXXXXXXX"
                value={licenseKey}
                onChange={e => { setLicenseKey(e.target.value); setLicenseError(''); }}
                autoFocus
                style={{ fontSize: '1rem', textAlign: 'center', letterSpacing: '1px' }}
              />
            </div>

            {licenseError && (
              <div style={{
                color: 'var(--danger)',
                fontSize: '0.8rem',
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
                borderRadius: '6px',
                whiteSpace: 'pre-line',
                lineHeight: '1.6',
              }}>
                {licenseError}
              </div>
            )}

            <div className="btn-group" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" type="submit" disabled={licenseChecking}>
                {licenseChecking ? '⟳ Checking...' : '▶ Verify License'}
              </button>
            </div>
          </form>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // ==================== MAIN APP ====================
  return (
    <div className="app-container">
      <header className="header">
        <h1 className="header-title">ChatGPT Creator</h1>
        <p className="header-subtitle">Account Registration System</p>
        <div className="header-line"></div>
      </header>

      <nav className="nav">
        <Link href="/" className="nav-link active">Terminal</Link>
        <Link href="/admin" className="nav-link">Admin Panel</Link>
        {licenseInfo && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '10px', letterSpacing: '1px' }}>
            👤 {licenseInfo.nama} | 📅 Exp: {licenseInfo.expired}
          </span>
        )}
        <button className="nav-link" onClick={handleLogout} style={{ cursor: 'pointer', background: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)', color: '#ff5555', marginLeft: 'auto' }}>
          Logout
        </button>
      </nav>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{stats.target}</div><div className="stat-label">Target</div></div>
        <div className="stat-card"><div className="stat-value">{stats.success}</div><div className="stat-label">Success</div></div>
        <div className="stat-card"><div className="stat-value">{stats.failed}</div><div className="stat-label">Failed</div></div>
        <div className="stat-card"><div className="stat-value">{stats.attempts}</div><div className="stat-label">Attempts</div></div>
      </div>

      <div className="card">
        <h2 className="card-title">Configuration</h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
          Leave fields empty to use admin defaults.
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Proxy URL</label>
            <input className="form-input" placeholder={adminDefaults.proxy || 'http://user:pass@host:port'} value={config.proxy} onChange={e => updateConfig('proxy', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Domain</label>
            <input className="form-input" placeholder={adminDefaults.domain || 'dalordz.me'} value={config.domain} onChange={e => updateConfig('domain', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">IMAP Email</label>
            <input className="form-input" type="email" placeholder={adminDefaults.email || 'email@gmail.com'} value={config.email} onChange={e => updateConfig('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">App Password</label>
            <input className="form-input" type="password" placeholder={adminDefaults.appPassword ? '••••••••' : 'Gmail App Password'} value={config.appPassword} onChange={e => updateConfig('appPassword', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Account Password (optional)</label>
            <input className="form-input" placeholder="Min 12 chars (empty = random)" value={config.defaultPassword} onChange={e => updateConfig('defaultPassword', e.target.value)} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Password for ChatGPT accounts. Leave empty for random 14-char password.
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Total Accounts</label>
            <input className="form-input" type="number" min="1" max="100" value={config.totalAccounts} onChange={e => updateConfig('totalAccounts', e.target.value)} />
          </div>
        </div>
        <div className="btn-group">
          {!running ? (
            <button className="btn btn-primary" onClick={startRegistration}>▶ Start Registration</button>
          ) : (
            <button className="btn btn-danger" onClick={stopRegistration}>■ Stop</button>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Live Terminal</h2>
        <div className="terminal">
          <div className="terminal-header">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
            <span className="terminal-title">chatgpt-creator — output</span>
            <span className={`status ${running ? 'running' : 'idle'}`} style={{ marginLeft: 'auto' }}>
              <span className="status-dot"></span>
              {running ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
          <div className="terminal-body" ref={logRef}>
            {logs.length === 0 && (
              <div className="log-line" style={{ color: 'var(--text-dim)' }}>
                {'>'} Awaiting command...<span className="cursor-blink"></span>
              </div>
            )}
            {logs.map(log => (
              <div key={log.id} className={`log-line ${log.type}`}>{'>'} {log.message}</div>
            ))}
            {logs.length > 0 && <div className="log-line"><span className="cursor-blink"></span></div>}
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <h2 className="card-title">Results ({results.length})</h2>
          <div style={{ marginBottom: '12px' }}><button className="btn btn-secondary" onClick={copyAll}>Copy All</button></div>
          <table className="results-table">
            <thead><tr><th>#</th><th>Email</th><th>Password</th><th>Time</th><th>Action</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td><td>{r.email}</td><td>{r.password}</td><td>{r.time}</td>
                  <td><button className="copy-btn" onClick={() => copyResult(r.email, r.password)}>Copy</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
