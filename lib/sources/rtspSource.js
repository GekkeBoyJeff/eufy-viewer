import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { rtspStreamArgs, snapshotArgs } from '../ffmpegArgs.js';
import { log, logErr, maskUrl } from '../log.js';

// Indoor Cam adapter: runs ffmpeg against the camera's local rtsp:// URL and emits
// raw H.264 chunks. Auto-detects the source codec once; if it is H.265/HEVC it
// transcodes to H.264 (jMuxer/browsers can't render HEVC), otherwise it copies.
export class RtspSource extends EventEmitter {
  constructor(camera, { ffmpeg = 'ffmpeg' } = {}) {
    super();
    this.camera = camera;
    this._ffmpeg = ffmpeg;
    this._proc = null;
    this._codecTranscode = undefined; // cached codec decision
  }
  get id() { return this.camera.id; }
  get isRunning() { return this._proc != null; }

  // Probe the RTSP stream once to learn the video codec. Returns true if a transcode
  // to H.264 is required (source is HEVC/H.265 or unknown-but-not-h264).
  async _needsTranscode() {
    if (this.camera.transcode) return true;
    if (this._codecTranscode !== undefined) return this._codecTranscode;
    return new Promise((resolve) => {
      let err = '';
      let done = false;
      const finish = (v) => { if (!done) { done = true; this._codecTranscode = v; resolve(v); } };
      const p = spawn(this._ffmpeg, ['-hide_banner', '-rtsp_transport', 'tcp', '-i', this.camera.url, '-t', '0.1', '-f', 'null', '-']);
      p.stderr.on('data', (d) => { err += d.toString(); });
      p.on('close', () => {
        const h265 = /Video:\s*(hevc|h265)/i.test(err);
        const h264 = /Video:\s*h264/i.test(err);
        log(`rtsp:${this.id}`, `codec detect → ${h265 ? 'H.265 (transcode)' : h264 ? 'H.264 (copy)' : 'onbekend (copy)'}`);
        finish(h265);
      });
      p.on('error', () => finish(false));
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} finish(/Video:\s*(hevc|h265)/i.test(err)); }, 7000);
    });
  }

  async start() {
    if (this._proc) return;
    this.emit('status', 'starting');
    const transcode = await this._needsTranscode();
    const args = rtspStreamArgs(this.camera.url, { transcode });
    log(`rtsp:${this.id}`, `start ${maskUrl(this.camera.url)} ${transcode ? '(transcode H.264)' : '(copy)'}`);
    const proc = spawn(this._ffmpeg, args);
    this._proc = proc;
    let firstChunk = true;
    let stderrTail = '';

    proc.stdout.on('data', (buf) => {
      if (firstChunk) { firstChunk = false; log(`rtsp:${this.id}`, `eerste videodata (${buf.length} bytes) — streaming`); this.emit('status', 'live'); }
      this.emit('chunk', buf);
    });
    // ffmpeg logs progress/info to stderr; keep the tail for diagnostics, don't treat
    // every line as a fatal error.
    proc.stderr.on('data', (b) => { stderrTail = (stderrTail + b.toString()).slice(-600); });
    proc.on('spawn', () => log(`rtsp:${this.id}`, 'ffmpeg gestart'));
    proc.on('close', (code) => {
      this._proc = null;
      if (firstChunk) {
        // closed before any video → real failure; surface the reason.
        const reason = stderrTail.trim().split('\n').slice(-3).join(' | ') || `ffmpeg exit ${code}`;
        logErr(`rtsp:${this.id}`, `geen beeld — ${reason}`);
        this.emit('error', new Error(reason));
      } else {
        log(`rtsp:${this.id}`, `gestopt (exit ${code})`);
      }
      this.emit('status', 'stopped');
    });
    proc.on('error', (err) => { this._proc = null; logErr(`rtsp:${this.id}`, 'spawn error', err.message); this.emit('error', err); });
  }

  async stop() {
    if (!this._proc) return;
    const p = this._proc;
    this._proc = null;
    p.kill('SIGKILL');
  }

  async snapshot() {
    return new Promise((resolve) => {
      const chunks = [];
      let done = false;
      const finish = (val) => { if (!done) { done = true; resolve(val); } };
      const p = spawn(this._ffmpeg, snapshotArgs(this.camera.url));
      p.stdout.on('data', (c) => chunks.push(c));
      p.on('close', () => finish(chunks.length ? Buffer.concat(chunks) : null));
      p.on('error', () => finish(null));
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} finish(chunks.length ? Buffer.concat(chunks) : null); }, 10000);
    });
  }
}
