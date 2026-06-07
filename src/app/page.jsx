'use client';
import { useLocalStorage, useToggle } from '@reactuses/core';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AccountLogin } from '@/components/AccountLogin.jsx';
import { CameraPane } from '@/components/CameraPane.jsx';
import { SettingsModal } from '@/components/SettingsModal.jsx';
import { Toolbar } from '@/components/Toolbar.jsx';

const DEFAULTS = { mode: 'split-h', mainId: null, pipOn: true, fit: 'contain' };
// Treat a non-OK response as a real (retryable) error instead of feeding a bad body into
// state — otherwise one hiccup can leave the list frozen on its last snapshot.
const fetchJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}`);
  }
  return r.json();
};

const Centered = ({ children }) => (
  <div className="flex min-h-[100dvh] animate-rise items-center justify-center p-6">{children}</div>
);
const Loading = ({ text }) => (
  <Centered>
    <div className="flex flex-col items-center gap-4 text-muted">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  </Centered>
);

// The viewer: first run shows a login screen; once your account is connected it shows
// all cameras with a layout switch (horizontal / vertical / focus+PiP), remembered.
const ViewerPage = () => {
  // Keep polling so a camera that resolves a bit later shows up on its own. Poll fast (3s)
  // while any camera is still "klaarzetten" so the ready-moment reaches the tile quickly,
  // calm 8s once all are ready, 2.5s while we have none. Revalidate on focus (what a manual
  // refresh does on tab-return) and retry a cached error quickly so the list never stays stale.
  const { data, mutate } = useSWR('/api/cameras', fetchJson, {
    refreshInterval: (latest) => {
      const cams = latest?.cameras;
      if (!cams?.length) {
        return 2500;
      }
      return cams.some((c) => c.ready === false) ? 3000 : 8000;
    },
    revalidateOnFocus: true,
    errorRetryInterval: 3000,
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
    if (cameras.length && (!cfg.mainId || !cameras.find((c) => c.id === cfg.mainId))) {
      setCfg({ ...cfg, mainId: cameras[0].id });
    }
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the debug panel is open, pull the server log (connecting, streams, restarts).
  useEffect(() => {
    if (!debugOn) {
      return;
    }
    const tick = () =>
      fetch('/api/log')
        .then((r) => r.json())
        .then((d) => setServerLines(d.lines || []))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [debugOn]);

  const allLogLines = [...serverLines, ...logLines].toSorted((a, b) =>
    a.slice(0, 8) < b.slice(0, 8) ? -1 : 1,
  );
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [serverLines, logLines]);

  const dbg = (scope, msg) =>
    setLogLines((prev) => [
      ...prev.slice(-199),
      `${new Date().toLocaleTimeString('nl-NL')}  ${scope}  ${msg}`,
    ]);
  // Clear both sides: the client lines and the server buffer (so the next poll stays empty).
  const clearLog = () => {
    setLogLines([]);
    setServerLines([]);
    fetch('/api/log', { method: 'DELETE' }).catch(() => {});
  };
  const setMode = (mode) => setCfg({ ...cfg, mode });
  const swap = () => {
    const other = cameras.find((c) => c.id !== cfg.mainId);
    if (other) {
      setCfg({ ...cfg, mode: 'focus', mainId: other.id });
    }
  };
  const togglePip = () => setCfg({ ...cfg, pipOn: !cfg.pipOn });
  const toggleFit = () => setCfg({ ...cfg, fit: cfg.fit === 'cover' ? 'contain' : 'cover' });
  // "Nu opnieuw proberen" on a stuck tile: ask the server to drop its state and resolve the
  // RTSP URL fresh, then refresh the list — no full page reload needed.
  const forceRetry = (id) => {
    fetch('/api/cameras/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    mutate();
  };
  const selectCamera = (cam) =>
    setCfg(
      cfg.mode === 'focus' ? { ...cfg, mainId: cam.id } : { ...cfg, mode: 'focus', mainId: cam.id },
    );
  const fullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };
  const mainName = cameras.find((c) => c.id === cfg.mainId)?.name;

  // ── full-screen states ──
  if (!data) {
    return <Loading text="Verbinden met de server…" />;
  }
  if (!eufy.connected) {
    return (
      <Centered>
        <AccountLogin configured={eufy.configured} onConnected={() => mutate()} />
      </Centered>
    );
  }

  const stageClass = clsx('flex-1 min-h-0 bg-black animate-rise', {
    'flex flex-row gap-0.5 max-[720px]:flex-col': cfg.mode === 'split-h',
    'flex flex-col gap-0.5': cfg.mode === 'split-v',
    'relative block': cfg.mode === 'focus',
  });

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Toolbar
        mode={cfg.mode}
        onMode={setMode}
        onSwap={swap}
        onTogglePip={togglePip}
        pipOn={cfg.pipOn}
        mainName={mainName}
        fit={cfg.fit}
        onToggleFit={toggleFit}
        onFullscreen={fullscreen}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleDebug={() => toggleDebug()}
      />

      {cameras.length === 0 ? (
        <div className="flex flex-1 animate-rise items-center justify-center text-muted">
          <div className="flex flex-col items-center gap-4">
            <div className="spinner" />
            <p>Camera’s worden geladen…</p>
          </div>
        </div>
      ) : (
        <div className={stageClass}>
          {cameras.map((cam) => {
            const role = cfg.mode === 'focus' ? (cam.id === cfg.mainId ? 'main' : 'pip') : 'split';
            const hidden = cfg.mode === 'focus' && role === 'pip' && !cfg.pipOn;
            // Key on ready too: when a camera flips pending->ready the tile remounts fresh
            // (new player, clean state) — the same clean start a manual page refresh gave.
            return (
              <CameraPane
                key={`${cam.id}:${cam.type}:${cam.ready ? 'r' : 'p'}`}
                camera={cam}
                role={role}
                hidden={hidden}
                fit={cfg.fit}
                onSelect={selectCamera}
                onForce={forceRetry}
                dbg={dbg}
              />
            );
          })}
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          eufyConfigured={eufy.configured}
          onClose={() => setSettingsOpen(false)}
          onConnected={() => mutate()}
        />
      )}

      {debugOn && (
        <div className="absolute right-0 bottom-0 left-0 z-40 flex h-[38vh] flex-col border-t border-line bg-black/95">
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-sm text-muted">
            Debug-log{' '}
            <button
              className="rounded-md border border-line bg-[#0e1014] px-2 py-0.5 text-xs hover:text-ink"
              onClick={clearLog}
            >
              wissen
            </button>
          </div>
          <div
            className="flex-1 overflow-auto px-3 py-1.5 font-mono text-[.7rem] leading-relaxed whitespace-pre-wrap text-[#aeb4be]"
            ref={logRef}
          >
            {allLogLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
