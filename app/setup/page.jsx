'use client';
import { useEffect, useState } from 'react';

// Talk to the one setup endpoint with a named action.
async function post(action, body = {}) {
  const res = await fetch('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  return res.json();
}

export default function SetupPage() {
  const [state, setState] = useState({ cameras: [], solocams: [], eufy: { configured: false, connected: false } });
  const [account, setAccount] = useState({ username: '', password: '', country: 'NL' });
  const [login, setLogin] = useState({ status: 'idle' }); // status, message, captchaId, image
  const [cam, setCam] = useState({ name: '', url: '', transcode: false });
  const [rtsp, setRtsp] = useState(null); // { ok, text, image }
  const [diag, setDiag] = useState([]);

  const refresh = async () => { try { setState(await (await fetch('/api/setup')).json()); } catch {} };
  useEffect(() => { refresh(); }, []);

  // ── Eufy login ──
  const handleLoginResult = (r) => { setLogin(r); if (r.status === 'connected') refresh(); };
  const connect = async () => { setLogin({ status: 'busy' }); handleLoginResult(await post('eufyConnect', account)); };
  const sendCaptcha = async (code) => { setLogin((l) => ({ ...l, status: 'busy' })); handleLoginResult(await post('eufyCaptcha', { captchaId: login.captchaId, code })); };
  const sendTfa = async (code) => { setLogin((l) => ({ ...l, status: 'busy' })); handleLoginResult(await post('eufyTfa', { code })); };

  // ── Indoor Cam (RTSP) ──
  const testRtsp = async () => {
    setRtsp({ ok: false, text: 'Testen…' });
    const r = await post('testRtsp', cam);
    if (r.image) setRtsp({ ok: true, text: '✓ Beeld ontvangen — je kunt opslaan.', image: r.image });
    else setRtsp({ ok: false, text: `✗ ${r.error || 'geen beeld'}` });
  };
  const saveRtsp = async () => {
    const r = await post('addCamera', cam);
    if (r.cameras) { setCam({ name: '', url: '', transcode: false }); setRtsp({ ok: true, text: '✓ Opgeslagen.' }); refresh(); }
    else setRtsp({ ok: false, text: `✗ ${r.error || 'opslaan mislukt'}` });
  };
  const removeCam = async (id) => { await post('deleteCamera', { id }); refresh(); };

  // ── Diagnose ──
  const loadDiag = async () => { const r = await post('diagnostics'); setDiag(r.cameras || []); };

  return (
    <div className="setup">
      <header>
        <h1>Setup</h1>
        <a className="link" href="/">← naar de kijker</a>
      </header>

      {/* Indoor Cams */}
      <section className="panel">
        <h2>Indoor Cams (RTSP — lokaal)</h2>
        <p className="hint">Zet in de Eufy-app per camera RTSP aan en kies <strong>Continuous recording</strong> (vereist een microSD), geef de camera een vast IP, en plak hier de <code>rtsp://…/live0</code>-URL.</p>
        <ul className="cam-list">
          {state.cameras.filter((c) => c.type === 'rtsp').map((c) => (
            <li key={c.id}><span>{c.name} — {c.url}</span><button className="btn small danger" onClick={() => removeCam(c.id)}>Verwijderen</button></li>
          ))}
          {!state.cameras.some((c) => c.type === 'rtsp') && <li><span>Nog geen Indoor Cams toegevoegd.</span></li>}
        </ul>
        <div className="form">
          <label>Naam <input value={cam.name} onChange={(e) => setCam({ ...cam, name: e.target.value })} placeholder="Woonkamer" /></label>
          <label>RTSP-URL <input value={cam.url} onChange={(e) => setCam({ ...cam, url: e.target.value })} placeholder="rtsp://user:pass@192.168.1.50:554/live0" /></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>
            <input type="checkbox" checked={cam.transcode} onChange={(e) => setCam({ ...cam, transcode: e.target.checked })} /> Transcoderen (alleen bij H.265 / schokkerig beeld)
          </label>
          <div className="row"><button className="btn" onClick={testRtsp}>Testen</button><button className="btn primary" onClick={saveRtsp}>Opslaan</button></div>
          {rtsp && <div className={`result ${rtsp.ok ? 'ok' : 'err'}`}>{rtsp.text}{rtsp.image && <img className="preview" alt="testbeeld" src={rtsp.image} />}</div>}
        </div>
      </section>

      {/* SoloCams / Eufy account */}
      <section className="panel">
        <h2>Eufy-account (voor camera’s via je account)</h2>
        <p className="hint">Aanbevolen: een <strong>apart Eufy-account</strong> (deel je huis ermee als admin, 2FA uit). {state.eufy.connected ? '✓ Verbonden.' : state.eufy.configured ? 'Ingesteld, niet verbonden.' : 'Nog niet ingesteld.'}</p>
        {!state.eufy.connected && (
          <div className="form">
            <label>E-mail <input type="email" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></label>
            <label>Wachtwoord <input type="password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} /></label>
            <label>Land (ISO) <input value={account.country} maxLength={2} style={{ width: '5rem' }} onChange={(e) => setAccount({ ...account, country: e.target.value.toUpperCase() })} /></label>
            <div className="row"><button className="btn primary" onClick={connect} disabled={login.status === 'busy'}>Verbinden</button></div>
          </div>
        )}
        {login.status === 'captcha' && <CaptchaForm image={login.image} onSubmit={sendCaptcha} />}
        {login.status === '2fa' && <CodeForm label="2FA-code uit je e-mail" onSubmit={sendTfa} />}
        {login.status === 'error' && <div className="result err">✗ {login.message}</div>}
        {login.status === 'connected' && <div className="result ok">✓ Verbonden!</div>}
        {state.solocams.length > 0 && (
          <ul className="cam-list" style={{ marginTop: '.8rem' }}>
            {state.solocams.map((c) => <li key={c.serial}><span>{c.name} — {c.serial}</span></li>)}
          </ul>
        )}
      </section>

      {/* Diagnose */}
      <section className="panel">
        <h2>Camera’s uitlezen (diagnose)</h2>
        <p className="hint">Status per camera + een live frame-test (ziet de tool echt beeld?).</p>
        <div className="row"><button className="btn" onClick={loadDiag}>Uitlezen / vernieuwen</button></div>
        {diag.map((c, i) => <DiagCard key={i} cam={c} />)}
      </section>
    </div>
  );
}

function CaptchaForm({ image, onSubmit }) {
  const [code, setCode] = useState('');
  return (
    <div className="form">
      <p className="hint">Captcha vereist — type de tekens over:</p>
      <img className="captcha" alt="captcha" src={image} />
      <label>Captcha-code <input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <div className="row"><button className="btn primary" onClick={() => onSubmit(code)}>Verzenden</button></div>
    </div>
  );
}

function CodeForm({ label, onSubmit }) {
  const [code, setCode] = useState('');
  return (
    <div className="form">
      <label>{label} <input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <div className="row"><button className="btn primary" onClick={() => onSubmit(code)}>Verzenden</button></div>
    </div>
  );
}

function DiagCard({ cam }) {
  const [test, setTest] = useState(null);
  const run = async () => {
    setTest('Testen… (max ~15s)');
    const r = await post('streamTest', { url: cam.url });
    setTest(r.ok ? `✓ ${r.frames} frames — beeld werkt` : `✗ ${r.error || 'geen beeld'}`);
  };
  const rows = [
    ['Naam', cam.name], ['Model', cam.model], ['Pad', cam.type === 'rtsp' ? 'RTSP (lokaal)' : 'P2P'],
    ['RTSP-URL', cam.url || '—'], ['RTSP aan', cam.rtspEnabled ? 'ja' : 'nee'],
    ['Continuous', cam.continuousRecording == null ? 'n.v.t.' : cam.continuousRecording ? 'ja' : 'nee'],
    ['Opslag', cam.storage ?? 'onbekend'],
  ];
  return (
    <div className="diag-card">
      {rows.map(([k, v]) => <div className="diag-row" key={k}><span className="k">{k}</span><span className="v">{String(v)}</span></div>)}
      {cam.url && <div className="row" style={{ marginTop: '.4rem' }}><button className="btn small" onClick={run}>Test stream</button>{test && <span className="result">{test}</span>}</div>}
    </div>
  );
}
