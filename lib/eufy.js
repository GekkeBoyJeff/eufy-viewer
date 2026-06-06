import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { EufySecurity, PropertyName } from 'eufy-security-client';
import { loadEufyConfig, eufyConfigFromParts, eufyConfigured } from './account.js';
import { log } from './log.js';

// Singleton wrapper around eufy-security-client. Handles login (with optional
// interactive captcha/2FA handlers, used by both `npm run setup` and the browser
// wizard), persists auth to persistentDir, discovers cameras, and re-emits
// per-serial livestream Readables so P2pSource stays decoupled from the SDK.
//
// AUTO-RTSP: for discovered cameras that support RTSP (Indoor Cams), we enable RTSP
// in the background and cache the camera-reported rtsp:// URL. Such cameras are then
// surfaced as type 'rtsp' so they stream over the reliable local RTSP path instead
// of the fragile P2P video channel. Cameras without RTSP stay type 'p2p'.
class EufyClient extends EventEmitter {
  constructor() {
    super();
    this._eufy = null;
    this._ready = null;
    this._connected = false;
    this._connecting = false;
    this._rtspCache = new Map(); // serial -> rtsp url
    this._rtspPending = new Map(); // serial -> in-flight Promise<url>
  }

  configured() { return eufyConfigured(); }
  isConnected() { return this._connected; }

  connect(handlers) {
    if (this._ready) return this._ready;
    this._ready = this._doConnect(loadEufyConfig(), handlers)
      .then((e) => { this._connected = true; this._enableRtspInBackground(); return e; })
      .catch((e) => { this._ready = null; throw e; });
    return this._ready;
  }

  async connectWith(parts, handlers) {
    if (this._connected) return this._eufy;
    if (this._connecting) throw new Error('er loopt al een verbindingspoging');
    this._connecting = true;
    try {
      const e = await this._doConnect(eufyConfigFromParts(parts), handlers);
      this._connected = true;
      this._ready = Promise.resolve(e);
      this._enableRtspInBackground();
      return e;
    } finally {
      this._connecting = false;
    }
  }

  _doConnect(cfg, { captchaHandler, verifyHandler } = {}) {
    return new Promise((resolve, reject) => {
      (async () => {
        fs.mkdirSync(cfg.persistentDir, { recursive: true });
        const eufy = await EufySecurity.initialize(cfg);
        this._eufy = eufy;

        eufy.on('station livestream start', (_station, device, _meta, videoStream) => {
          this.emit('livestream', device.getSerial(), videoStream);
        });
        eufy.on('station livestream stop', (_station, device) => {
          this.emit('livestream-stop', device.getSerial());
        });

        eufy.on('captcha request', async (id, captcha) => {
          if (!captchaHandler) return reject(new Error('captcha vereist — gebruik de setup-wizard of `npm run setup`'));
          try {
            const code = await captchaHandler(captcha, id);
            await eufy.connect({ captcha: { captchaId: id, captchaCode: code } });
          } catch (e) { reject(e); }
        });
        eufy.on('tfa request', async () => {
          if (!verifyHandler) return reject(new Error('2FA vereist — gebruik de setup-wizard of `npm run setup`'));
          try {
            const code = await verifyHandler();
            await eufy.connect({ verifyCode: code });
          } catch (e) { reject(e); }
        });
        eufy.on('connect', () => resolve(eufy));
        eufy.on('connection error', (err) => reject(err));

        try { await eufy.connect(); } catch (e) { reject(e); }
      })().catch(reject);
    });
  }

  _deviceSupportsRtsp(d) {
    try { return typeof d.hasProperty === 'function' && d.hasProperty(PropertyName.DeviceRTSPStream); }
    catch { return false; }
  }

  // Enable RTSP for all capable cameras and cache their URLs (best-effort, background).
  async _enableRtspInBackground() {
    try {
      const devices = await this._eufy.getDevices();
      for (const d of devices.filter((x) => x.isCamera?.() && this._deviceSupportsRtsp(x))) {
        this._ensureRtsp(d.getSerial()).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  // Read the camera's LAN IP (it can take a moment to populate after connecting).
  async _waitForLanIp(station) {
    const read = () => station.getPropertyValue?.(PropertyName.StationLanIpAddress)
      || station.getPropertyValue?.(PropertyName.StationLanIpAddressStandalone) || null;
    for (let i = 0; i < 16; i += 1) {
      const ip = read();
      if (ip) return ip;
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }

  // Turn on RTSP for one camera and work out its rtsp:// URL. We prefer the URL the
  // camera reports, but the report can be slow/flaky, so we fall back to building it
  // from the camera's LAN IP (rtsp://<ip>:554/live0) — which is what these cameras use.
  // Needs Continuous recording (microSD/HomeBase/NAS) to actually deliver frames.
  async _ensureRtsp(serial) {
    if (this._rtspCache.has(serial)) return this._rtspCache.get(serial);
    if (this._rtspPending.has(serial)) return this._rtspPending.get(serial);
    const attempt = (async () => {
      const device = await this._eufy.getDevice(serial);
      const reported = device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl);
      if (reported) { this._rtspCache.set(serial, reported); return reported; }

      const station = await this._eufy.getStation(serial);
      await station.connect();
      try { await station.setContinuousRecording(device, true); } catch { /* geen opslag */ }
      try { await station.setRTSPStream(device, true); } catch { /* stond al aan */ }

      const fresh = device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl);
      const ip = fresh ? null : await this._waitForLanIp(station);
      const url = fresh || (ip ? `rtsp://${ip}:554/live0` : null);
      if (url) { this._rtspCache.set(serial, url); log(`rtsp:eufy_${serial}`, `RTSP klaar (${url})`); }
      return url;
    })();
    this._rtspPending.set(serial, attempt);
    try { return await attempt; } finally { this._rtspPending.delete(serial); }
  }

  async getCameras() {
    if (!this._eufy) return [];
    const devices = await this._eufy.getDevices();
    const cams = devices.filter((d) => typeof d.isCamera === 'function' && d.isCamera());
    const list = await Promise.all(cams.map(async (d) => {
      const serial = d.getSerial();
      const name = (typeof d.getName === 'function' && d.getName()) || serial;
      const model = (typeof d.getModel === 'function' && d.getModel()) || '?';
      if (this._deviceSupportsRtsp(d)) {
        // RTSP is the reliable path for these cameras. Wait for its URL; if it isn't
        // ready yet, leave the camera OUT of the list (the caller retries) rather than
        // showing it on the broken P2P path. So a camera only ever appears as 'rtsp'.
        const url = await this._ensureRtsp(serial).catch(() => null);
        return url ? { id: `eufy_${serial}`, name, model, type: 'rtsp', url, battery: false, transcode: false, serial } : null;
      }
      // Genuinely RTSP-incapable cameras (e.g. battery SoloCams) use P2P.
      return { id: `eufy_${serial}`, name, model, type: 'p2p', serial, battery: typeof d.hasBattery === 'function' ? d.hasBattery() : true, transcode: false };
    }));
    return list.filter(Boolean);
  }

  // Standalone SoloCam: its station serial equals its device serial. Uses the
  // higher-level helper which manages the P2P connection setup.
  async startLivestream(serial) {
    await this._eufy.startStationLivestream(serial);
  }

  async stopLivestream(serial) {
    try { await this._eufy.stopStationLivestream(serial); } catch { /* already stopped */ }
  }
}

export const eufyClient = new EufyClient();
