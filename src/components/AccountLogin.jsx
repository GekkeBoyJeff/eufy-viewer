'use client';
import { useEffect, useState } from 'react';
import { postSetup } from '@/lib/client/Api.js';

const field =
  'bg-[#0e1014] border border-line text-ink rounded-lg px-3 py-2.5 text-[.9rem] outline-none focus:border-accent transition-colors';
const primary =
  'w-full bg-accent text-[#04222a] font-bold rounded-lg px-4 py-2.5 hover:brightness-110 active:scale-[.99] transition disabled:opacity-60';

// Login card for your Eufy account. If an account is already saved, it reconnects
// automatically (and walks through captcha/2FA if Eufy asks). Otherwise it shows the
// form. Used as the first-time screen and inside settings.
export const AccountLogin = ({ configured, onConnected }) => {
  const [account, setAccount] = useState({ username: '', password: '', country: 'NL' });
  const [view, setView] = useState(configured ? 'saved' : 'account');
  const [captcha, setCaptcha] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  const apply = (r) => {
    setBusy(false);
    if (r.status === 'captcha') {
      setCaptcha({ id: r.captchaId, image: r.image });
      setView('captcha');
      setError('');
      setCode('');
    } else if (r.status === '2fa') {
      setView('2fa');
      setError('');
      setCode('');
    } else if (r.status === 'connected') {
      onConnected?.();
    } else {
      setError(r.message || 'verbinden mislukt');
      setView(configured ? 'saved' : 'account');
    }
  };

  const reconnect = async () => {
    setBusy(true);
    setError('');
    apply(await postSetup('eufyReconnect'));
  };
  const connect = async () => {
    setBusy(true);
    setError('');
    apply(await postSetup('eufyConnect', account));
  };

  // Saved account → reconnect right away (shows a spinner, and the captcha/2FA prompt
  // appears here if needed). This component stays mounted, so the prompt isn't lost.
  useEffect(() => {
    if (configured) {
      reconnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submitCaptcha = async () => {
    setBusy(true);
    apply(await postSetup('eufyCaptcha', { captchaId: captcha.id, code }));
  };
  const submitTfa = async () => {
    setBusy(true);
    apply(await postSetup('eufyTfa', { code }));
  };

  return (
    <div className="w-[min(380px,100%)] animate-fade rounded-2xl border border-line bg-surface p-7 shadow-[0_20px_60px_rgba(0,0,0,.5)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
        <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />{' '}
        Eufy Viewer
      </div>

      {view === 'saved' && (
        <div className="flex flex-col items-center gap-4 py-4">
          {busy ? (
            <div className="spinner" />
          ) : (
            <p className="text-center text-sm text-muted">Je Eufy-account staat op dit apparaat.</p>
          )}
          <button className={primary} onClick={reconnect} disabled={busy}>
            {busy ? 'Verbinden…' : 'Verbinden met je account'}
          </button>
          {error && <p className="text-sm text-[#ff9aa6]">✗ {error}</p>}
          <button
            className="text-sm text-accent hover:underline"
            onClick={() => setView('account')}
          >
            Ander account gebruiken
          </button>
        </div>
      )}

      {view === 'account' && (
        <>
          <h2 className="mb-1 text-xl font-semibold">Inloggen bij Eufy</h2>
          <p className="mb-4 text-sm leading-snug text-muted">
            Je gegevens blijven op dit apparaat. Tip: gebruik een apart account met 2FA uit.
          </p>
          <div className="grid gap-2.5">
            <input
              className={field}
              type="email"
              placeholder="E-mail"
              value={account.username}
              onChange={(e) => setAccount({ ...account, username: e.target.value })}
            />
            <input
              className={field}
              type="password"
              placeholder="Wachtwoord"
              value={account.password}
              onChange={(e) => setAccount({ ...account, password: e.target.value })}
            />
            <input
              className={field}
              placeholder="Land (NL)"
              maxLength={2}
              value={account.country}
              onChange={(e) => setAccount({ ...account, country: e.target.value.toUpperCase() })}
            />
            <button className={primary} onClick={connect} disabled={busy}>
              {busy ? 'Verbinden…' : 'Verbinden'}
            </button>
            {error && <p className="text-sm text-[#ff9aa6]">✗ {error}</p>}
          </div>
        </>
      )}

      {view === 'captcha' && (
        <div className="grid gap-2.5">
          <p className="text-sm text-muted">Captcha — type de tekens over:</p>
          <img
            className="max-w-[320px] rounded-lg bg-white p-1"
            src={captcha.image}
            alt="captcha"
          />
          <input
            className={field}
            placeholder="captcha-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className={primary} onClick={submitCaptcha} disabled={busy}>
            {busy ? 'Controleren…' : 'Verzenden'}
          </button>
        </div>
      )}

      {view === '2fa' && (
        <div className="grid gap-2.5">
          <p className="text-sm text-muted">2FA-code uit je e-mail:</p>
          <input
            className={field}
            placeholder="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className={primary} onClick={submitTfa} disabled={busy}>
            {busy ? 'Controleren…' : 'Verzenden'}
          </button>
        </div>
      )}
    </div>
  );
};
