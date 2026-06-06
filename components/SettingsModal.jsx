'use client';
import { useEffect, useState } from 'react';
import AccountLogin from './AccountLogin.jsx';
import { postSetup } from './api.js';

// Settings as an overlay (not a separate page), so opening it never interrupts the
// live streams. Shows the Eufy login plus a full read-out per camera — including the
// REAL live status, so it can't contradict what you see in the viewer.
const SettingsModal = ({ onClose, onConnected }) => {
  const [data, setData] = useState(null);
  const load = async () => { try { setData(await postSetup('readout')); } catch {} };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Instellingen</h2>
          <button className="icon" onClick={onClose} title="Sluiten">✕</button>
        </div>

        {!data ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !data.eufy.connected ? (
          <AccountLogin onConnected={() => { onConnected?.(); load(); }} />
        ) : (
          <div>
            <p className="result ok">✓ Verbonden met je Eufy-account</p>
            <p className="hint">Camera's komen automatisch van je account. Hieronder de live-status en alle gegevens per camera.</p>
            {data.cameras.map((c) => <CameraReadout key={c.id} cam={c} />)}
            {data.cameras.length === 0 && <p className="hint">Nog geen camera's gevonden.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const liveLine = (live) => {
  if (!live?.active) return { dot: 'idle', text: 'niet actief' };
  if (live.secondsSinceFrame == null) return { dot: 'connecting', text: 'verbinden…' };
  if (live.secondsSinceFrame <= 4) return { dot: 'live', text: `● live · ${(live.bytes / 1e6).toFixed(1)} MB ontvangen` };
  return { dot: 'error', text: `geen recent beeld (${live.secondsSinceFrame}s geleden)` };
};

const CameraReadout = ({ cam }) => {
  const [showAll, setShowAll] = useState(false);
  const p = cam.props || {};
  const st = cam.station || {};
  const status = liveLine(cam.live);
  const rows = [
    ['Live-status', status.text],
    ['Model', cam.model],
    ['Serienummer', cam.serial],
    ['Pad', cam.type === 'rtsp' ? 'RTSP (lokaal)' : 'P2P'],
    ['RTSP-URL', cam.url || '—'],
    ['Lokaal IP', st.lanIpAddress || st.lanIpAddressStandalone || cam.url?.match(/\/\/([^:/]+)/)?.[1] || '—'],
    ['Firmware', p.softwareVersion || '—'],
    ['Wifi', p.wifiRssi != null ? `${p.wifiRssi} dBm` : (p.wifiSignalLevel != null ? `niveau ${p.wifiSignalLevel}` : '—')],
    ['Opname', p.continuousRecording === true ? 'Continu' : p.continuousRecording === false ? 'Gebeurtenis' : '—'],
    ['Bewegingsdetectie', p.motionDetection == null ? '—' : (p.motionDetection ? 'aan' : 'uit')],
    ['Ingeschakeld', p.enabled == null ? '—' : (p.enabled ? 'ja' : 'nee')],
  ];
  return (
    <div className="diag-card">
      <div className="diag-title"><span className="led" data-state={status.dot} /> {cam.name}</div>
      {rows.map(([k, v]) => <div className="diag-row" key={k}><span className="k">{k}</span><span className="v">{String(v)}</span></div>)}
      <button className="btn small" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Verberg alle eigenschappen' : 'Toon alle eigenschappen'}</button>
      {showAll && <pre className="props-dump">{JSON.stringify({ device: p, station: st }, null, 2)}</pre>}
    </div>
  );
};

export default SettingsModal;
