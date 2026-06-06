'use client';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useLocalStorage, useToggle } from '@reactuses/core';
import Toolbar from '@/components/Toolbar.jsx';
import CameraPane from '@/components/CameraPane.jsx';
import AccountLogin from '@/components/AccountLogin.jsx';
import SettingsModal from '@/components/SettingsModal.jsx';

const DEFAULTS = { mode: 'split-h', mainId: null, pipOn: true };
const fetchJson = (url) => fetch(url).then((r) => r.json());

// The viewer: first run shows a login screen; once your account is set, it shows all
// cameras with a layout switch (horizontal / vertical / focus+PiP) and remembers it.
const ViewerPage = () => {
  // Keep polling so a camera that resolves a bit later still shows up (every 2.5s while
  // we have none yet, then a calm 8s once cameras are present — never fully stops).
  const { data, mutate } = useSWR('/api/cameras', fetchJson, {
    refreshInterval: (latest) => (latest?.cameras?.length ? 8000 : 2500),
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const loading = !data;
  const eufy = data?.eufy ?? { configured: false, connected: false };
  const cameras = data?.cameras ?? [];

  const [stored, setCfg] = useLocalStorage('eufyViewer.v1', DEFAULTS);
  const cfg = stored ?? DEFAULTS;
  const [debugOn, toggleDebug] = useToggle(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    if (cameras.length && (!cfg.mainId || !cameras.find((c) => c.id === cfg.mainId))) setCfg({ ...cfg, mainId: cameras[0].id });
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  const dbg = (scope, msg) => setLogLines((prev) => [...prev.slice(-199), `${new Date().toLocaleTimeString('nl-NL')}  ${scope}  ${msg}`]);

  const setMode = (mode) => setCfg({ ...cfg, mode });
  const swap = () => { const other = cameras.find((c) => c.id !== cfg.mainId); if (other) setCfg({ ...cfg, mode: 'focus', mainId: other.id }); };
  const togglePip = () => setCfg({ ...cfg, pipOn: !cfg.pipOn });
  const selectCamera = (cam) => setCfg(cfg.mode === 'focus' ? { ...cfg, mainId: cam.id } : { ...cfg, mode: 'focus', mainId: cam.id });
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); };

  const mainName = cameras.find((c) => c.id === cfg.mainId)?.name;

  // First run: no account yet → a calm, centered login screen.
  if (!loading && !eufy.configured) {
    return <div className="screen fade-in"><AccountLogin onConnected={() => mutate()} /></div>;
  }

  return (
    <div className="viewer-root">
      <Toolbar
        mode={cfg.mode} onMode={setMode} onSwap={swap} onTogglePip={togglePip} pipOn={cfg.pipOn} mainName={mainName}
        onFullscreen={fullscreen} onOpenSettings={() => setSettingsOpen(true)} onToggleDebug={() => toggleDebug()}
      />

      {loading || cameras.length === 0 ? (
        <div className="empty-viewer fade-in">
          <div className="loading">
            <div className="spinner" />
            <p>{loading ? 'Verbinden met de server…' : 'Camera’s worden geladen…'}</p>
          </div>
        </div>
      ) : (
        <div className={`stage mode-${cfg.mode} fade-in`}>
          {cameras.map((cam) => {
            const role = cfg.mode === 'focus' ? (cam.id === cfg.mainId ? 'main' : 'pip') : 'split';
            const hidden = cfg.mode === 'focus' && role === 'pip' && !cfg.pipOn;
            return <CameraPane key={`${cam.id}:${cam.type}`} camera={cam} role={role} hidden={hidden} onSelect={selectCamera} dbg={dbg} />;
          })}
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onConnected={() => mutate()} />}

      {debugOn && (
        <div className="debug-panel">
          <div className="debug-head">Debug-log <button onClick={() => setLogLines([])}>wissen</button></div>
          <div className="debug-log" ref={logRef}>{logLines.map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
