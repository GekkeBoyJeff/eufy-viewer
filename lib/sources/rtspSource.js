import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { rtspStreamArgs, snapshotArgs } from '../ffmpegArgs.js';
import { log, logErr, maskUrl } from '../log.js';

const RESTART_MIN = 1000;
const RESTART_MAX = 8000;

// Indoor Cam adapter: runs ffmpeg on the camera's rtsp:// URL and emits raw H.264.
// If the camera drops the connection (the C210 does this), it quietly restarts ffmpeg
// while someone is watching, so the picture self-heals instead of going black.
export class RtspSource extends EventEmitter {
  constructor(camera, { ffmpeg = 'ffmpeg' } = {}) {
    super();
    this.camera = camera;
    this._ffmpeg = ffmpeg;
    this._proc = null;
    this._started = false;
    this._restartTimer = null;
    this._backoff = RESTART_MIN;
    this._codecTranscode = undefined; // onthouden zodat we maar één keer detecteren
  }
  get id() { return this.camera.id; }
  get isRunning() { return this._started; }

  // Check the codec once: copy H.264, transcode H.265 (browsers can't play HEVC).
  async _needsTranscode() {
    if (this.camera.transcode) return true;
    if (this._codecTranscode !== undefined) return this._codecTranscode;
    return new Promise((resolve) => {
      let err = '';
      let done = false;
      const finish = (v) => { if (!done) { done = true; this._codecTranscode = v; resolve(v); } };
      const probe = spawn(this._ffmpeg, ['-hide_banner', '-rtsp_transport', 'tcp', '-i', this.camera.url, '-t', '0.1', '-f', 'null', '-']);
      probe.stderr.on('data', (d) => { err += d.toString(); });
      probe.on('close', () => { finish(/Video:\s*(hevc|h265)/i.test(err)); });
      probe.on('error', () => finish(false));
      setTimeout(() => { try { probe.kill('SIGKILL'); } catch {} finish(/Video:\s*(hevc|h265)/i.test(err)); }, 7000);
    });
  }

  async start() {
    if (this._started) return;
    this._started = true;
    this._backoff = RESTART_MIN;
    this.emit('status', 'starting');
    this._spawn();
  }

  async _spawn() {
    if (!this._started) return;
    const transcode = await this._needsTranscode();
    if (!this._started) return;
    log(`rtsp:${this.id}`, `start ${maskUrl(this.camera.url)} ${transcode ? '(transcode H.264)' : '(copy)'}`);
    const proc = spawn(this._ffmpeg, rtspStreamArgs(this.camera.url, { transcode }));
    this._proc = proc;
    let gotData = false;
    let stderrTail = '';

    proc.stdout.on('data', (buf) => {
      if (!gotData) { gotData = true; this._backoff = RESTART_MIN; log(`rtsp:${this.id}`, `eerste videodata — streaming`); this.emit('status', 'live'); }
      this.emit('chunk', buf);
    });
    proc.stderr.on('data', (b) => { stderrTail = (stderrTail + b.toString()).slice(-400); });
    proc.on('close', () => {
      this._proc = null;
      if (!this._started) { this.emit('status', 'stopped'); return; }
      // Onverwacht gestopt terwijl er nog gekeken wordt → rustig opnieuw proberen.
      const reason = stderrTail.trim().split('\n').slice(-1)[0] || 'verbinding gesloten';
      log(`rtsp:${this.id}`, `stream brak af (${reason}) — herstart over ${this._backoff} ms`);
      this._restartTimer = setTimeout(() => this._spawn(), this._backoff);
      this._backoff = Math.min(this._backoff * 2, RESTART_MAX);
    });
    proc.on('error', (err) => { logErr(`rtsp:${this.id}`, 'ffmpeg-fout', err.message); });
  }

  async stop() {
    this._started = false;
    clearTimeout(this._restartTimer);
    this._restartTimer = null;
    if (this._proc) { const p = this._proc; this._proc = null; p.kill('SIGKILL'); }
  }

  // One JPEG frame, used by the camera test in settings.
  async snapshot() {
    return new Promise((resolve) => {
      const chunks = [];
      let done = false;
      const finish = (val) => { if (!done) { done = true; resolve(val); } };
      const proc = spawn(this._ffmpeg, snapshotArgs(this.camera.url));
      proc.stdout.on('data', (c) => chunks.push(c));
      proc.on('close', () => finish(chunks.length ? Buffer.concat(chunks) : null));
      proc.on('error', () => finish(null));
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} finish(chunks.length ? Buffer.concat(chunks) : null); }, 10000);
    });
  }
}
