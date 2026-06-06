'use client';
import { useEffect, useRef, useState } from 'react';
import Toolbar from '@/components/Toolbar.jsx';
import CameraPane from '@/components/CameraPane.jsx';

const STORAGE_KEY = 'eufyViewer.v1';
const DEFAULTS = { mode: 'split-h', mainId: null, pipOn: true };

// The viewer: shows all cameras, lets you switch layout (horizontal / vertical /
// focus+PiP), and remembers your choice. Status and retries are handled per camera.
export default function ViewerPage() {
  const [cameras, setCameras] = useState([]);
  const [eufy, setEufy] = useState({ configured: false, connected: false });
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(DEFAULTS);
  const [debugOn, setDebugOn] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const cfgLoaded = useRef(false);
  const logRef = useRef(null);

  // Remember the last layout you used.
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); setCfg({ ...DEFAULTS, ...saved }); } catch {}
    cfgLoaded.current = true;
  }, []);
  useEffect(() => { if (cfgLoaded.current) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {} } }, [cfg]);

  // Load the camera list; keep polling briefly while RTSP is still being set up.
  useEffect(() => {
    let stop = false; let tries = 0; let timer;
    const tick = async () => {
      try {
        const data = await (await fetch('/api/cameras')).json();
        if (stop) return;
        setLoading(false);
        setEufy(data.eufy);
        if (data.cameras.length) { setCameras(data.cameras); return; }
        if (data.eufy.connected && tries < 12) { tries += 1; timer = setTimeout(tick, 2500); }
      } catch { if (!stop) timer = setTimeout(tick, 3000); }
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // Make sure the focused camera still exists.
  useEffect(() => {
    if (cameras.length && (!cfg.mainId || !cameras.find((c) => c.id === cfg.mainId))) {
      setCfg((p) => ({ ...p, mainId: cameras[0].id }));
    }
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  const dbg = (scope, msg) => setLogLines((prev) => [...prev.slice(-199), `${new Date().toLocaleTimeString('nl-NL')}  ${scope}  ${msg}`]);

  const setMode = (mode) => setCfg((p) => ({ ...p, mode }));
  const swap = () => setCfg((p) => {
    if (cameras.length < 2) return p;
    const other = cameras.find((c) => c.id !== p.mainId);
    return other ? { ...p, mode: 'focus', mainId: other.id } : p;
  });
  const togglePip = () => setCfg((p) => ({ ...p, pipOn: !p.pipOn }));
  const onSelect = (cam) => setCfg((p) => (p.mode === 'focus' ? { ...p, mainId: cam.id } : { ...p, mode: 'focus', mainId: cam.id }));
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); };

  const mainName = cameras.find((c) => c.id === cfg.mainId)?.name;

  return (
    <div className="viewer-root">
      <Toolbar
        mode={cfg.mode} onMode={setMode} onSwap={swap} onTogglePip={togglePip} pipOn={cfg.pipOn} mainName={mainName}
        onFullscreen={fullscreen} onToggleDebug={() => setDebugOn((v) => !v)}
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
            return <CameraPane key={cam.id} camera={cam} role={role} hidden={hidden} onSelect={onSelect} dbg={dbg} />;
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
}
