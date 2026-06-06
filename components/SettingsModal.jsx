'use client';
import { useEffect, useState } from 'react';
import AccountLogin from './AccountLogin.jsx';
import { postSetup } from './api.js';

// Settings as an overlay (not a separate page), so opening it never interrupts the
// live streams. Shows the Eufy login status and lets you test each camera's stream.
const SettingsModal = ({ onClose, onConnected }) => {
  const [state, setState] = useState(null);
  const load = async () => { try { setState(await (await fetch('/api/setup')).json()); } catch {} };
  useEffect(() => { load(); }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Instellingen</h2>
          <button className="icon" onClick={onClose} title="Sluiten">✕</button>
        </div>

        {!state ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !state.eufy.connected ? (
          <AccountLogin onConnected={() => { onConnected?.(); load(); }} />
        ) : (
          <div>
            <p className="result ok">✓ Verbonden met je Eufy-account</p>
            <p className="hint">Camera's worden automatisch van je account gehaald. Test hieronder of er beeld doorkomt.</p>
            <ul className="cam-list">
              {state.cameras.map((c) => <CameraRow key={c.id} cam={c} />)}
              {state.cameras.length === 0 && <li><span>Nog geen camera's gevonden.</span></li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const CameraRow = ({ cam }) => {
  const [test, setTest] = useState(null);
  const run = async () => {
    setTest('Testen…');
    const r = await postSetup('streamTest', { url: cam.url });
    setTest(r.ok ? `✓ ${r.frames} frames` : `✗ ${r.error || 'geen beeld'}`);
  };
  return (
    <li>
      <span>{cam.name} · {cam.model} · {cam.type}</span>
      <span className="row">
        {test && <span className="result">{test}</span>}
        {cam.url && <button className="btn small" onClick={run}>Test</button>}
      </span>
    </li>
  );
};

export default SettingsModal;
