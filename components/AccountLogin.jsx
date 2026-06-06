'use client';
import { useState } from 'react';
import { postSetup } from './api.js';

// Login card for your Eufy account. Walks through captcha / 2FA if Eufy asks for it,
// then calls onConnected. Used both as the first-time screen and inside settings.
const AccountLogin = ({ onConnected }) => {
  const [account, setAccount] = useState({ username: '', password: '', country: 'NL' });
  const [view, setView] = useState('account'); // account | captcha | 2fa
  const [captcha, setCaptcha] = useState(null); // { id, image }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  const apply = (r) => {
    setBusy(false);
    if (r.status === 'captcha') { setCaptcha({ id: r.captchaId, image: r.image }); setView('captcha'); setError(''); setCode(''); }
    else if (r.status === '2fa') { setView('2fa'); setError(''); setCode(''); }
    else if (r.status === 'connected') { onConnected?.(); }
    else { setError(r.message || 'verbinden mislukt'); setView('account'); }
  };

  const connect = async () => { setBusy(true); setError(''); apply(await postSetup('eufyConnect', account)); };
  const submitCaptcha = async () => { setBusy(true); apply(await postSetup('eufyCaptcha', { captchaId: captcha.id, code })); };
  const submitTfa = async () => { setBusy(true); apply(await postSetup('eufyTfa', { code })); };

  return (
    <div className="login-card">
      <div className="login-logo"><span className="brand-dot" /> Eufy Viewer</div>
      <h2>Inloggen bij Eufy</h2>
      <p className="hint">Je gegevens blijven op dit apparaat. Tip: gebruik een apart Eufy-account met 2FA uit.</p>

      {view === 'account' && (
        <div className="form">
          <label>E-mail<input type="email" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></label>
          <label>Wachtwoord<input type="password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} /></label>
          <label>Land (ISO)<input value={account.country} maxLength={2} onChange={(e) => setAccount({ ...account, country: e.target.value.toUpperCase() })} /></label>
          <button className="btn primary" onClick={connect} disabled={busy}>{busy ? 'Verbinden…' : 'Verbinden'}</button>
          {error && <div className="result err">✗ {error}</div>}
        </div>
      )}

      {view === 'captcha' && (
        <div className="form">
          <p className="hint">Captcha — type de tekens uit de afbeelding over:</p>
          <img className="captcha" src={captcha.image} alt="captcha" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="captcha-code" />
          <button className="btn primary" onClick={submitCaptcha} disabled={busy}>{busy ? 'Controleren…' : 'Verzenden'}</button>
        </div>
      )}

      {view === '2fa' && (
        <div className="form">
          <p className="hint">2FA-code uit je e-mail:</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="code" />
          <button className="btn primary" onClick={submitTfa} disabled={busy}>{busy ? 'Controleren…' : 'Verzenden'}</button>
        </div>
      )}
    </div>
  );
};

export default AccountLogin;
