'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LivePlayer } from './livePlayer.js';

const LABELS = { idle: 'Inactief', connecting: 'Verbinden…', live: 'Live', error: 'Geen beeld', retrying: 'Opnieuw…' };
const START_BACKOFF = 4000, MAX_BACKOFF = 60000, NO_FRAME_MS = 15000;

// One camera tile: shows the video and always shows its status. It connects on its
// own, and if the stream fails it retries with a growing wait (so a busy camera isn't
// hammered). `role` ('split' | 'main' | 'pip') only changes how the tile is placed.
const CameraPane = ({ camera, role, hidden, onSelect, dbg }) => {
  const videoRef = useRef(null);
  const machineRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [detail, setDetail] = useState(LABELS.connecting);

  useEffect(() => {
    const m = { player: new LivePlayer(videoRef.current), timers: {}, backoff: START_BACKOFF, status: 'idle', stopped: false };
    machineRef.current = m;

    const set = (s, d) => { m.status = s; setStatus(s); setDetail(d || LABELS[s]); dbg?.(camera.name, `${s}${d ? ' — ' + d : ''}`); };
    const clear = () => { clearTimeout(m.timers.noFrame); clearTimeout(m.timers.retry); clearInterval(m.timers.count); };

    const begin = () => {
      if (m.stopped) return;
      clear();
      if (camera.battery) { set('idle', 'Klik om te starten (accu)'); return; }
      set('connecting');
      m.player.start(camera.id, {
        onLive: () => { clearTimeout(m.timers.noFrame); m.backoff = START_BACKOFF; set('live'); },
        onError: (e) => fail(e?.message || 'fout'),
        onClose: () => { if (m.status === 'live') fail('verbinding verbroken'); },
        onAutostopped: () => fail('stream gestopt'),
        onDebug: (msg) => dbg?.(camera.name, msg),
      });
      m.timers.noFrame = setTimeout(() => fail('geen beeld — camera bezet (Eufy-app?) of geen opslag'), NO_FRAME_MS);
    };

    const fail = (reason) => {
      clear();
      try { m.player.stop(); } catch {}
      let left = Math.round(m.backoff / 1000);
      set('retrying', `opnieuw in ${left}s`);
      m.timers.count = setInterval(() => { left -= 1; if (left > 0) set('retrying', `opnieuw in ${left}s`); }, 1000);
      m.timers.retry = setTimeout(() => { m.backoff = Math.min(m.backoff * 2, MAX_BACKOFF); begin(); }, m.backoff);
    };

    m.retryNow = () => { clear(); try { m.player.stop(); } catch {} m.backoff = START_BACKOFF; begin(); };
    begin();
    return () => { m.stopped = true; clear(); try { m.player.stop(); } catch {} };
  }, [camera.id, camera.type]); // herstart alleen bij een andere camera of ander pad, niet bij layout-wissel

  // The dot in the chip is the at-a-glance status; the center only shows when there's
  // something to say or do (loading, idle, error). So the status never appears twice.
  return (
    <div className={clsx('pane', role === 'main' && 'is-main', role === 'pip' && 'is-pip', hidden && 'pane-hidden')} data-state={status} onClick={() => onSelect?.(camera)}>
      <video ref={videoRef} autoPlay muted playsInline className="pane-video" />
      <div className="pane-center">
        {status === 'connecting' && (<><div className="spinner" /><div className="center-msg subtle">Verbinden…</div></>)}
        {status === 'idle' && <div className="center-msg subtle">{detail}</div>}
        {(status === 'error' || status === 'retrying') && (
          <>
            <div className="center-msg">{detail}</div>
            <button className="pane-retry" onClick={(e) => { e.stopPropagation(); machineRef.current?.retryNow(); }}>Nu opnieuw</button>
          </>
        )}
      </div>
      <div className="pane-chip">
        <span className="led" data-state={status} />
        <span className="pane-name">{camera.name}</span>
      </div>
    </div>
  );
};

export default CameraPane;
