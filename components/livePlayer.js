import JMuxer from 'jmuxer';

// Plays one camera in a <video>: opens the /stream WebSocket and feeds the raw H.264
// into the browser. Reports what happens (live, error, closed) so the pane can show
// status and retry. A stall watch recovers a frozen stream that never closed.
export class LivePlayer {
  constructor(videoEl) { this.videoEl = videoEl; this.jmuxer = null; this.ws = null; this.watch = null; this.stopped = false; }

  start(cameraId, { onLive, onError, onClose, onAutostopped, onDebug } = {}) {
    this.stopped = false;
    // 300ms buffer rides out small gaps in an imperfect feed (less black flicker).
    this.jmuxer = new JMuxer({ node: this.videoEl, mode: 'video', flushingTime: 300, fps: 15, debug: false,
      onError: (e) => onDebug?.('jmuxer: ' + (e?.message || e)) });

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/stream/${encodeURIComponent(cameraId)}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    let first = true;
    let lastData = Date.now();

    ws.onopen = () => onDebug?.('ws open');
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const m = JSON.parse(ev.data);
          if (m.event === 'autostopped') onAutostopped?.();
          else if (m.event === 'error') onError?.(new Error(m.message || 'stream-fout'));
        } catch { /* negeren */ }
        return;
      }
      lastData = Date.now();
      if (first) { first = false; onLive?.(); }
      try { this.jmuxer.feed({ video: new Uint8Array(ev.data) }); } catch { /* decoder-hik */ }
    };
    ws.onerror = () => onError?.(new Error('verbinding mislukt'));
    ws.onclose = (e) => { onDebug?.(`ws dicht (code ${e.code})`); if (!this.stopped) onClose?.(); };

    this.watch = setInterval(() => {
      if (!first && Date.now() - lastData > 10000) {
        clearInterval(this.watch); this.watch = null;
        onDebug?.('stream gestald (10s geen data)');
        onError?.(new Error('stream gestald'));
      }
    }, 3000);
  }

  stop() {
    this.stopped = true;
    try { clearInterval(this.watch); } catch {}
    this.watch = null;
    try { this.ws?.close(); } catch {}
    try { this.jmuxer?.destroy(); } catch {}
    this.ws = null; this.jmuxer = null;
    try { this.videoEl.removeAttribute('src'); this.videoEl.load?.(); } catch {}
  }
}
