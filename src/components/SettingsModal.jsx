'use client';
import { useEffect, useState } from 'react';
import { postSetup } from '@/lib/client/Api.js';
import { AccountLogin } from './AccountLogin.jsx';

// Settings as an overlay (not a separate page), so opening it never interrupts the live
// streams. Shows the Eufy login plus a full read-out per camera — including the REAL
// live status, so it can't contradict what you see in the viewer.
export const SettingsModal = ({ eufyConfigured, onClose, onConnected }) => {
  const [data, setData] = useState(null);
  const load = async () => {
    try {
      setData(await postSetup('readout'));
    } catch {}
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-[min(520px,100%)] overflow-auto rounded-2xl border border-line bg-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Instellingen</h2>
          <button
            className="h-8 w-8 rounded-lg border border-line bg-[#0e1014] text-[#cdd2db] transition hover:border-accent hover:text-ink"
            onClick={onClose}
            title="Sluiten"
          >
            ✕
          </button>
        </div>

        {!data ? (
          <div className="flex justify-center py-8">
            <div className="spinner" />
          </div>
        ) : !data.eufy.connected ? (
          <AccountLogin
            configured={eufyConfigured}
            onConnected={() => {
              onConnected?.();
              load();
            }}
          />
        ) : (
          <div>
            <p className="text-sm text-live">✓ Verbonden met je Eufy-account</p>
            <p className="mt-1 mb-2 text-sm leading-snug text-muted">
              Camera's komen automatisch van je account. Hieronder de live-status en alle gegevens
              per camera.
            </p>
            {data.cameras.map((c) => (
              <CameraReadout key={c.id} cam={c} />
            ))}
            {data.cameras.length === 0 && (
              <p className="text-sm text-muted">Nog geen camera's gevonden.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const liveLine = (live) => {
  if (!live?.active) {
    return { dot: 'idle', text: 'niet actief' };
  }
  if (live.secondsSinceFrame == null) {
    return { dot: 'connecting', text: 'verbinden…' };
  }
  if (live.secondsSinceFrame <= 4) {
    return { dot: 'live', text: `● live · ${(live.bytes / 1e6).toFixed(1)} MB ontvangen` };
  }
  return { dot: 'error', text: `geen recent beeld (${live.secondsSinceFrame}s geleden)` };
};

const CameraReadout = ({ cam }) => {
  const [showAll, setShowAll] = useState(false);
  const p = cam.props || {};
  const st = cam.station || {};
  // A camera whose RTSP URL isn't ready yet shows amber + "klaarzetten…" instead of its
  // live status — so you can see it's still being set up rather than just "niet actief".
  const pending = cam.ready === false;
  const status = pending
    ? { dot: 'pending', text: 'RTSP wordt klaargezet… (probeert automatisch opnieuw)' }
    : liveLine(cam.live);
  const rows = [
    ['Live-status', status.text],
    ['Model', cam.model],
    ['Serienummer', cam.serial],
    [
      'Pad',
      cam.type === 'rtsp'
        ? 'RTSP (lokaal)'
        : cam.type === 'rtsp-pending'
          ? 'RTSP (klaarzetten…)'
          : 'P2P',
    ],
    ['RTSP-URL', cam.url || '—'],
    [
      'Lokaal IP',
      st.lanIpAddress || st.lanIpAddressStandalone || cam.url?.match(/\/\/([^:/]+)/)?.[1] || '—',
    ],
    ['Firmware', p.softwareVersion || '—'],
    [
      'Wifi',
      p.wifiRssi != null
        ? `${p.wifiRssi} dBm`
        : p.wifiSignalLevel != null
          ? `niveau ${p.wifiSignalLevel}`
          : '—',
    ],
    [
      'Opname',
      p.continuousRecording === true
        ? 'Continu'
        : p.continuousRecording === false
          ? 'Gebeurtenis'
          : '—',
    ],
    ['Bewegingsdetectie', p.motionDetection == null ? '—' : p.motionDetection ? 'aan' : 'uit'],
    ['Ingeschakeld', p.enabled == null ? '—' : p.enabled ? 'ja' : 'nee'],
  ];
  return (
    <div className="mt-3 rounded-xl border border-line bg-[#0e1014] p-3">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className="led" data-state={status.dot} /> {cam.name}
      </div>
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-4 border-b border-[#15181d] py-0.5 text-[.82rem] last:border-0"
        >
          <span className="flex-none text-muted">{k}</span>
          <span className="text-right break-all">{String(v)}</span>
        </div>
      ))}
      <button
        className="mt-2.5 text-sm text-accent hover:underline"
        onClick={() => setShowAll((s) => !s)}
      >
        {showAll ? 'Verberg alle eigenschappen' : 'Toon alle eigenschappen'}
      </button>
      {showAll && (
        <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-line bg-bg p-2.5 text-[.7rem] leading-relaxed break-all whitespace-pre-wrap text-[#aeb4be]">
          {JSON.stringify({ device: p, station: st }, null, 2)}
        </pre>
      )}
    </div>
  );
};
