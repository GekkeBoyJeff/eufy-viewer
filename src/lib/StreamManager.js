import { EventEmitter } from 'node:events';

// Owns camera stream lifecycle. Starts a source on the first viewer, stops it when the
// last viewer leaves, and (for battery cameras) force-stops after autoStopMs so SoloCam
// radios sleep. It also tracks live stats per camera (bytes, last frame) so the
// settings screen can show the real status instead of running a second, competing test.

const realTimers = {
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h),
};

export class StreamManager extends EventEmitter {
  constructor({ createSource, autoStopMs = 120000, timers = realTimers }) {
    super();
    this._createSource = createSource;
    this._autoStopMs = autoStopMs;
    this._timers = timers;
    this._entries = new Map(); // id -> { camera, source, viewers:Set, autoStop, state, bytes, lastChunkAt }
  }

  isRunning(id) { return this._entries.get(id)?.source?.isRunning === true; }

  // What a camera is actually doing right now (used by the settings readout).
  liveStatus(id) {
    const e = this._entries.get(id);
    if (!e) return { active: false };
    return {
      active: true,
      state: e.state,
      viewers: e.viewers.size,
      bytes: e.bytes,
      secondsSinceFrame: e.lastChunkAt ? Math.round((Date.now() - e.lastChunkAt) / 1000) : null,
    };
  }

  addViewer(camera, viewerId) {
    let e = this._entries.get(camera.id);
    if (!e) {
      const source = this._createSource(camera);
      e = { camera, source, viewers: new Set(), autoStop: null, state: 'starting', bytes: 0, lastChunkAt: 0 };
      source.on('chunk', (buf) => { e.bytes += buf.length; e.lastChunkAt = Date.now(); this.emit('chunk', camera.id, buf); });
      source.on('status', (s) => { e.state = s; this.emit('status', camera.id, s); });
      source.on('error', (err) => this.emit('camera-error', camera.id, err));
      this._entries.set(camera.id, e);
    }
    const first = e.viewers.size === 0;
    e.viewers.add(viewerId);
    if (first) {
      Promise.resolve(e.source.start()).catch((err) => this.emit('camera-error', camera.id, err));
      if (camera.battery) {
        e.autoStop = this._timers.setTimer(() => this._autoStop(camera.id), this._autoStopMs);
      }
    }
  }

  removeViewer(id, viewerId) {
    const e = this._entries.get(id);
    if (!e) return;
    e.viewers.delete(viewerId);
    if (e.viewers.size === 0) this._teardown(id);
  }

  _autoStop(id) {
    const e = this._entries.get(id);
    if (!e) return;
    this._teardown(id);
    this.emit('autostopped', id);
  }

  _teardown(id) {
    const e = this._entries.get(id);
    if (!e) return;
    if (e.autoStop != null) { this._timers.clearTimer(e.autoStop); e.autoStop = null; }
    Promise.resolve(e.source.stop()).catch(() => {});
    this._entries.delete(id);
  }
}
