import { spawn } from 'node:child_process';

// Run a bounded ffmpeg probe against an rtsp:// URL and report how many video frames
// actually arrived. This is the "does the camera really stream video" check — the
// thing that distinguishes a reachable-but-frameless camera (no storage / event mode)
// from a working one.
export function streamTest(url, { ffmpeg = 'ffmpeg', seconds = 7 } = {}) {
  return new Promise((resolve) => {
    let err = '';
    let done = false;
    const parseFrames = () => { const m = err.match(/frame=\s*(\d+)/g); return m ? parseInt(m[m.length - 1].match(/\d+/)[0], 10) : 0; };
    const knownErr = () => (err.match(/Operation timed out|404 Not Found|401 Unauthorized|Connection refused|Invalid data|Network is unreachable|No route to host/i) || [])[0] || null;
    const finish = (frames) => {
      if (done) return; done = true;
      resolve({ frames, ok: frames > 0, error: frames > 0 ? null : (knownErr() || 'geen videoframes ontvangen (camera bereikbaar maar streamt niet — vaak: geen opslag / event-modus)') });
    };
    const p = spawn(ffmpeg, ['-hide_banner', '-rw_timeout', '10000000', '-rtsp_transport', 'tcp', '-i', url, '-t', String(seconds), '-an', '-f', 'null', '-']);
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', () => finish(parseFrames()));
    p.on('error', () => finish(0));
    setTimeout(() => { try { p.kill('SIGKILL'); } catch {} finish(parseFrames()); }, (seconds + 8) * 1000);
  });
}
