import { spawn } from 'node:child_process';

// Probes an rtsp:// URL with ffmpeg and reports how many video frames actually came
// in. This is the "does this camera really stream?" check that tells a reachable-but-
// frameless camera (no storage / event mode) apart from a working one.
export const streamTest = (url, { ffmpeg = 'ffmpeg', seconds = 7 } = {}) =>
  new Promise((resolve) => {
    let err = '';
    let done = false;
    const countFrames = () => { const m = err.match(/frame=\s*(\d+)/g); return m ? parseInt(m[m.length - 1].match(/\d+/)[0], 10) : 0; };
    const knownError = () => (err.match(/Operation timed out|404 Not Found|401 Unauthorized|Connection refused|Invalid data|Network is unreachable|No route to host/i) || [])[0] || null;
    const finish = (frames) => {
      if (done) return;
      done = true;
      resolve({ frames, ok: frames > 0, error: frames > 0 ? null : (knownError() || 'geen videoframes ontvangen (camera bereikbaar maar streamt niet — vaak: geen opslag / event-modus)') });
    };
    const proc = spawn(ffmpeg, ['-hide_banner', '-rw_timeout', '10000000', '-rtsp_transport', 'tcp', '-i', url, '-t', String(seconds), '-an', '-f', 'null', '-']);
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('close', () => finish(countFrames()));
    proc.on('error', () => finish(0));
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} finish(countFrames()); }, (seconds + 8) * 1000);
  });
