'use client';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useLocalStorage, useToggle } from '@reactuses/core';
import Toolbar from '@/components/Toolbar.jsx';
import CameraPane from '@/components/CameraPane.jsx';

const DEFAULTS = { mode: 'split-h', mainId: null, pipOn: true };
const fetchJson = (url) => fetch(url).then((r) => r.json());

// The viewer: shows all cameras, lets you switch layout (horizontal / vertical /
// focus+PiP) and remembers your choice. Each camera handles its own status + retry.
const ViewerPage = () => {
  // SWR polls the list every 2.5s while it's still empty, then stops once cameras arrive.
  const { data } = useSWR('/api/cameras', fetchJson, {
    refreshInterval: (latest) => (latest?.cameras?.length ? 0 : 2500),
    revalidateOnFocus: false,
  });
  const loading = !data;
  const eufy = data?.eufy ?? { configured: false, connected: false };
  const cameras = data?.cameras ?? [];

  const [stored, setCfg] = useLocalStorage('eufyViewer.v1', DEFAULTS);
  const cfg = stored ?? DEFAULTS;
  const [debugOn, toggleDebug] = useToggle(false);
  const [logLines, setLogLines] = useState([]);
  const logRef = useRef(null);

  // Keep the focused camera valid as cameras load.
  useEffect(() => {
    if (cameras.length && (!cfg.mainId || !cameras.find((c) => c.id === cfg.mainId))) {
      setCfg({ ...cfg, mainId: cameras[0].id });
    }
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  const dbg = (scope, msg) => setLogLines((prev) => [...prev.slice(-199), `${new Date().toLocaleTimeString('nl-NL')}  ${scope}  ${msg}`]);

  const setMode = (mode) => setCfg({ ...cfg, mode });
  const swap = () => { const other = cameras.find((c) => c.id !== cfg.mainId); if (other) setCfg({ ...cfg, mode: 'focus', mainId: other.id }); };
  const togglePip = () => setCfg({ ...cfg, pipOn: !cfg.pipOn });
  const selectCamera = (cam) => setCfg(cfg.mode === 'focus' ? { ...cfg, mainId: cam.id } : { ...cfg, mode: 'focus', mainId: cam.id });
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); };

  const mainName = cameras.find((c) => c.id === cfg.mainId)?.name;

  return (
    <div className="viewer-root">
      <Toolbar
        mode={cfg.mode} onMode={setMode} onSwap={swap} onTogglePip={togglePip} pipOn={cfg.pipOn} mainName={mainName}
        onFullscreen={fullscreen} onToggleDebug={() => toggleDebug()}
      />

      {loading ? (
        <div className="empty-viewer"><div className="loading"><div className="spinner" /><p>Verbinden met de server…</p></div></div>
      ) : cameras.length === 0 ? (
        <div className="empty-viewer">
          <div className="loading">
            {eufy.connected && <div className="spinner" />}
            <p>{eufy.connected ? 'Camera’s worden geladen (RTSP wordt klaargezet)…' : (<>Geen camera’s gevonden. Open <a className="link" href="/setup">Instellingen</a> om in te loggen of een camera toe te voegen.</>)}</p>
          </div>
        </div>
      ) : (
        <div className={`stage mode-${cfg.mode}`}>
          {cameras.map((cam) => {
            const role = cfg.mode === 'focus' ? (cam.id === cfg.mainId ? 'main' : 'pip') : 'split';
            const hidden = cfg.mode === 'focus' && role === 'pip' && !cfg.pipOn;
            return <CameraPane key={cam.id} camera={cam} role={role} hidden={hidden} onSelect={selectCamera} dbg={dbg} />;
          })}
        </div>
      )}

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
