'use client';

// The top bar: choose the layout, swap/PiP controls in focus mode, status lights per
// camera, fullscreen and the debug-log toggle.
const MODES = [
  { id: 'split-h', label: 'Horizontaal' },
  { id: 'split-v', label: 'Verticaal' },
  { id: 'focus', label: 'Focus' },
];

export default function Toolbar({ mode, onMode, onSwap, onTogglePip, pipOn, mainName, cameras, stateById, onFullscreen, onToggleDebug }) {
  return (
    <div className="topbar">
      <div className="brand"><span className="brand-dot" /><span className="brand-name">Eufy Viewer</span></div>

      <div className="modes" role="group" aria-label="Weergave">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => onMode(m.id)}>{m.label}</button>
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

      <div className="leds" aria-label="Camerastatus">
        {cameras.map((c) => (
          <span key={c.id} className="led mini" data-state={stateById[c.id] || 'idle'} title={`${c.name}: ${stateById[c.id] || 'idle'}`} />
        ))}
      </div>
      <button className="icon" title="Volledig scherm" onClick={onFullscreen}>⛶</button>
      <button className="icon" title="Debug-log" onClick={onToggleDebug}>🐞</button>
    </div>
  );
}
