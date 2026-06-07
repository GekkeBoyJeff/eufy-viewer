'use client';
import clsx from 'clsx';

// The top bar: choose the layout, swap/PiP controls in focus mode, and the buttons for
// fullscreen, settings and the debug log. Per-camera status lives on the tiles, not here.
const MODES = [
  { id: 'split-h', label: 'Horizontaal' },
  { id: 'split-v', label: 'Verticaal' },
  { id: 'focus', label: 'Focus' },
];

const ctrlBtn = 'inline-flex items-center justify-center h-9 px-3 rounded-lg bg-[#0e1014] border border-line text-[#cdd2db] text-sm transition-[transform,border-color,color] hover:border-accent hover:text-ink active:scale-95';
const iconBtn = 'inline-flex items-center justify-center h-9 min-w-9 px-2.5 rounded-lg bg-[#0e1014] border border-line text-[#cdd2db] transition-[transform,border-color,color] hover:border-accent hover:text-ink active:scale-95';

const Toolbar = ({ mode, onMode, onSwap, onTogglePip, pipOn, mainName, fit, onToggleFit, onFullscreen, onOpenSettings, onToggleDebug }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-surface/85 backdrop-blur border-b border-line z-20">
    <div className="flex items-center gap-2 font-semibold whitespace-nowrap">
      <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
      <span className="max-[720px]:hidden">Eufy Viewer</span>
    </div>

    <div className="flex bg-[#0e1014] border border-line rounded-lg overflow-hidden max-[720px]:flex-1 max-[720px]:order-3 max-[720px]:basis-full">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onMode(m.id)}
          className={clsx('px-3 py-2 text-sm transition-colors max-[720px]:flex-1', mode === m.id ? 'bg-[#1b2330] text-ink' : 'text-muted hover:text-ink')}
        >
          {m.label}
        </button>
      ))}
    </div>

    {mode === 'focus' && (
      <div className="flex items-center gap-1.5 min-w-0 max-[720px]:order-4 max-[720px]:basis-full">
        {mainName && <span className="text-xs text-muted truncate min-w-0 max-[720px]:hidden">Hoofd: {mainName}</span>}
        <button onClick={onSwap} className={clsx(ctrlBtn, 'min-w-[7rem] max-[720px]:min-w-0 max-[720px]:flex-1')}>⇄ Wissel</button>
        <button onClick={onTogglePip} className={clsx(ctrlBtn, 'min-w-[7rem] max-[720px]:min-w-0 max-[720px]:flex-1')}>PiP: {pipOn ? 'aan' : 'uit'}</button>
      </div>
    )}

    <span className="flex-1 max-[720px]:hidden" />

    <div className="flex items-center gap-1.5 max-[720px]:ml-auto max-[720px]:order-2">
      <button className={ctrlBtn} title="Beeld passend (alles zien) of vullend (ruimte opvullen)" onClick={onToggleFit}>{fit === 'cover' ? 'Vullend' : 'Passend'}</button>
      <button className={iconBtn} title="Volledig scherm" onClick={onFullscreen}>⛶</button>
      <button className={iconBtn} title="Instellingen" onClick={onOpenSettings}>⚙</button>
      <button className={iconBtn} title="Debug-log" onClick={onToggleDebug}>🐞</button>
    </div>
  </div>
);

export default Toolbar;
