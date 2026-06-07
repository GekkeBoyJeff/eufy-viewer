import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { p2pStreamArgs } from '../FfmpegArgs.js';
import { log, logErr } from '../Log.js';

// SoloCam adapter: asks eufyClient to start the on-demand P2P livestream, pipes the
// raw H.264 Readable into ffmpeg, and emits the resulting H.264 chunks. A watchdog
// surfaces a clear error if the camera connects but never delivers video (the known
// mid-2026 P2P breakage looks exactly like that).
export class P2pSource extends EventEmitter {
  constructor(camera, { client, ffmpeg = 'ffmpeg', noDataMs = 15000 } = {}) {
    super();
    this.camera = camera;
    this._client = client;
    this._ffmpeg = ffmpeg;
    this._noDataMs = noDataMs;
    this._proc = null;
    this._onStream = null;
    this._watchdog = null;
    this._gotData = false;
  }
  get id() { return this.camera.id; }
  get isRunning() { return this._proc != null; }

  async start() {
    if (this._proc) return;
    this.emit('status', 'starting');
    const proc = spawn(this._ffmpeg, p2pStreamArgs({ transcode: this.camera.transcode }));
    this._proc = proc;
    log(`p2p:${this.id}`, `start (serial ${this.camera.serial})`);

    proc.stdout.on('data', (buf) => {
      if (!this._gotData) { this._gotData = true; clearTimeout(this._watchdog); log(`p2p:${this.id}`, `eerste videodata (${buf.length} bytes) — streaming`); this.emit('status', 'live'); }
      this.emit('chunk', buf);
    });
    proc.stderr.on('data', () => {});
    proc.on('close', () => { this._proc = null; this.emit('status', 'stopped'); });
    proc.on('error', (err) => { this._proc = null; logErr(`p2p:${this.id}`, 'ffmpeg error', err.message); this.emit('error', err); });

    this._onStream = (serial, videoStream) => {
      if (serial !== this.camera.serial || !this._proc) return;
      log(`p2p:${this.id}`, 'livestream data ontvangen van camera, koppel aan ffmpeg');
      videoStream.pipe(this._proc.stdin, { end: false });
      videoStream.on('error', () => {});
    };
    this._client.on('livestream', this._onStream);

    this._watchdog = setTimeout(() => {
      if (!this._gotData) {
        logErr(`p2p:${this.id}`, `geen videodata binnen ${this._noDataMs / 1000}s — camera verbond wel maar levert geen beeld (waarschijnlijk de mei-2026 P2P-bug). Probeer RTSP voor deze camera.`);
        this.emit('error', new Error('camera verbond maar leverde geen videodata (P2P)'));
      }
    }, this._noDataMs);

    try {
      await this._client.startLivestream(this.camera.serial);
      log(`p2p:${this.id}`, 'startLivestream commando verstuurd');
    } catch (err) {
      logErr(`p2p:${this.id}`, 'startLivestream faalde', err.message);
      this.emit('error', err);
      await this.stop();
    }
  }

  async stop() {
    clearTimeout(this._watchdog);
    this._gotData = false;
    if (this._onStream) { this._client.off('livestream', this._onStream); this._onStream = null; }
    try { await this._client.stopLivestream(this.camera.serial); } catch {}
    if (this._proc) { const p = this._proc; this._proc = null; p.kill('SIGKILL'); }
  }
}
