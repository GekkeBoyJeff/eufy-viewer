'use client';
import clsx from 'clsx';

// The top bar: choose the layout, swap/PiP controls in focus mode, and the buttons
// for fullscreen, settings and the debug log. Per-camera status lives on the camera
// tiles themselves, so it isn't repeated here.
const MODES = [
  { id: 'split-h', label: 'Horizontaal' },
  { id: 'split-v', label: 'Verticaal' },
  { id: 'focus', label: 'Focus' },
];

const Toolbar = ({ mode, onMode, onSwap, onTogglePip, pipOn, mainName, onFullscreen, onOpenSettings, onToggleDebug }) => (
  <div className="topbar">
    <div className="brand"><span className="brand-dot" /><span className="brand-name">Eufy Viewer</span></div>

    <div className="modes" role="group" aria-label="Weergave">
      {MODES.map((m) => (
        <button key={m.id} className={clsx(mode === m.id && 'active')} onClick={() => onMode(m.id)}>{m.label}</button>
      ))}
    </div>

    {mode === 'focus' && (
      <div className="focus-ctrls">
        {mainName && <span className="main-label">Hoofd: {mainName}</span>}
        <button onClick={onSwap}>⇄ Wissel</button>
        <button onClick={onTogglePip}>PiP: {pipOn ? 'aan' : 'uit'}</button>
      </div>
    )}

    <span className="spacer" />

    <div className="tools">
      <button className="icon" title="Volledig scherm" onClick={onFullscreen}>⛶</button>
      <button className="icon" title="Instellingen" onClick={onOpenSettings}>⚙</button>
      <button className="icon" title="Debug-log" onClick={onToggleDebug}>🐞</button>
    </div>
  </div>
);

export default Toolbar;
