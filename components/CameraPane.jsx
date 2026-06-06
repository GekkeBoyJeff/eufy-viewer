'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LivePlayer } from './livePlayer.js';

const LABELS = { idle: 'Inactief', connecting: 'Verbinden…', live: 'Live', error: 'Geen beeld', retrying: 'Opnieuw…' };
const START_BACKOFF = 4000, MAX_BACKOFF = 60000, NO_FRAME_MS = 15000;

// One camera tile: shows the video and always shows its status. It connects on its own
// and, if the stream fails, retries with a growing wait so a busy camera isn't hammered.
// `role` ('split' | 'main' | 'pip') only changes how the tile is placed.
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
  }, [camera.id, camera.type]); // herstart alleen bij een andere camera of ander pad

  const place = role === 'main'
    ? 'absolute inset-0'
    : role === 'pip'
      ? 'absolute right-4 bottom-4 w-[min(34%,380px)] aspect-video border border-[#2b3340] rounded-xl shadow-[0_10px_34px_rgba(0,0,0,.6)] z-[6]'
      : 'relative flex-1 min-w-0 min-h-0';

  return (
    <div
      onClick={() => onSelect?.(camera)}
      data-state={status}
      className={clsx('bg-black overflow-hidden cursor-pointer animate-fade', place, hidden && 'hidden')}
    >
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain bg-black block" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
        {status === 'connecting' && (<><div className="spinner" /><div className="text-muted text-sm">Verbinden…</div></>)}
        {status === 'idle' && <div className="text-muted text-sm">{detail}</div>}
        {(status === 'error' || status === 'retrying') && (
          <>
            <div className="text-[#cdd2db] text-sm bg-black/65 px-3.5 py-1.5 rounded-lg max-w-[82%] text-center leading-snug">{detail}</div>
            <button
              className="pointer-events-auto bg-accent text-[#04222a] font-bold text-sm px-3.5 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition"
              onClick={(e) => { e.stopPropagation(); machineRef.current?.retryNow(); }}
            >
              Nu opnieuw
            </button>
          </>
        )}
      </div>

      <div className="absolute left-2.5 bottom-2.5 flex items-center gap-2 bg-black/60 backdrop-blur border border-white/10 px-2.5 py-1 rounded-full text-[.78rem] z-[3]">
        <span className="led" data-state={status} />
        <span className="font-semibold">{camera.name}</span>
      </div>
    </div>
  );
};

export default CameraPane;
