'use client';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useLocalStorage, useToggle } from '@reactuses/core';
import Toolbar from '@/components/Toolbar.jsx';
import CameraPane from '@/components/CameraPane.jsx';
import AccountLogin from '@/components/AccountLogin.jsx';
import SettingsModal from '@/components/SettingsModal.jsx';

const DEFAULTS = { mode: 'split-h', mainId: null, pipOn: true, fit: 'contain' };
const fetchJson = (url) => fetch(url).then((r) => r.json());

const Centered = ({ children }) => (
  <div className="min-h-[100dvh] flex items-center justify-center p-6 animate-fade">{children}</div>
);
const Loading = ({ text }) => (
  <Centered><div className="flex flex-col items-center gap-4 text-muted"><div className="spinner" /><p>{text}</p></div></Centered>
);

// The viewer: first run shows a login screen; once your account is connected it shows
// all cameras with a layout switch (horizontal / vertical / focus+PiP), remembered.
const ViewerPage = () => {
  // Keep polling so a camera that resolves a bit later still shows up (2.5s while we
  // have none, a calm 8s once cameras are present — never fully stops).
  const { data, mutate } = useSWR('/api/cameras', fetchJson, {
    refreshInterval: (latest) => (latest?.cameras?.length ? 8000 : 2500),
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const eufy = data?.eufy ?? { configured: false, connected: false };
  const cameras = data?.cameras ?? [];

  const [stored, setCfg] = useLocalStorage('eufyViewer.v1', DEFAULTS);
  const cfg = stored ?? DEFAULTS;
  const [debugOn, toggleDebug] = useToggle(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [serverLines, setServerLines] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    if (cameras.length && (!cfg.mainId || !cameras.find((c) => c.id === cfg.mainId))) setCfg({ ...cfg, mainId: cameras[0].id });
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the debug panel is open, pull the server log (connecting, streams, restarts).
  useEffect(() => {
    if (!debugOn) return undefined;
    const tick = () => fetch('/api/log').then((r) => r.json()).then((d) => setServerLines(d.lines || [])).catch(() => {});
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [debugOn]);

  const allLogLines = [...serverLines, ...logLines].sort((a, b) => (a.slice(0, 8) < b.slice(0, 8) ? -1 : 1));
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [serverLines, logLines]);

  const dbg = (scope, msg) => setLogLines((prev) => [...prev.slice(-199), `${new Date().toLocaleTimeString('nl-NL')}  ${scope}  ${msg}`]);
  const setMode = (mode) => setCfg({ ...cfg, mode });
  const swap = () => { const other = cameras.find((c) => c.id !== cfg.mainId); if (other) setCfg({ ...cfg, mode: 'focus', mainId: other.id }); };
  const togglePip = () => setCfg({ ...cfg, pipOn: !cfg.pipOn });
  const toggleFit = () => setCfg({ ...cfg, fit: cfg.fit === 'cover' ? 'contain' : 'cover' });
  const selectCamera = (cam) => setCfg(cfg.mode === 'focus' ? { ...cfg, mainId: cam.id } : { ...cfg, mode: 'focus', mainId: cam.id });
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); };
  const mainName = cameras.find((c) => c.id === cfg.mainId)?.name;

  // ── full-screen states ──
  if (!data) return <Loading text="Verbinden met de server…" />;
  if (!eufy.connected) return <Centered><AccountLogin configured={eufy.configured} onConnected={() => mutate()} /></Centered>;

  const stageClass = clsx('flex-1 min-h-0 bg-black', {
    'flex flex-row gap-0.5 max-[720px]:flex-col': cfg.mode === 'split-h',
    'flex flex-col gap-0.5': cfg.mode === 'split-v',
    'relative block': cfg.mode === 'focus',
  });

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <Toolbar
        mode={cfg.mode} onMode={setMode} onSwap={swap} onTogglePip={togglePip} pipOn={cfg.pipOn} mainName={mainName}
        fit={cfg.fit} onToggleFit={toggleFit}
        onFullscreen={fullscreen} onOpenSettings={() => setSettingsOpen(true)} onToggleDebug={() => toggleDebug()}
      />

      {cameras.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted animate-fade"><div className="flex flex-col items-center gap-4"><div className="spinner" /><p>Camera’s worden geladen…</p></div></div>
      ) : (
        <div className={stageClass}>
          {cameras.map((cam) => {
            const role = cfg.mode === 'focus' ? (cam.id === cfg.mainId ? 'main' : 'pip') : 'split';
            const hidden = cfg.mode === 'focus' && role === 'pip' && !cfg.pipOn;
            return <CameraPane key={`${cam.id}:${cam.type}`} camera={cam} role={role} hidden={hidden} fit={cfg.fit} onSelect={selectCamera} dbg={dbg} />;
          })}
        </div>
      )}

      {settingsOpen && <SettingsModal eufyConfigured={eufy.configured} onClose={() => setSettingsOpen(false)} onConnected={() => mutate()} />}

      {debugOn && (
        <div className="absolute left-0 right-0 bottom-0 h-[38vh] bg-black/95 border-t border-line z-40 flex flex-col">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-line text-sm text-muted">
            Debug-log <button className="px-2 py-0.5 text-xs rounded-md bg-[#0e1014] border border-line hover:text-ink" onClick={() => setLogLines([])}>wissen</button>
          </div>
          <div className="flex-1 overflow-auto px-3 py-1.5 font-mono text-[.7rem] leading-relaxed text-[#aeb4be] whitespace-pre-wrap" ref={logRef}>
            {allLogLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
