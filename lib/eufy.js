import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { EufySecurity, PropertyName } from 'eufy-security-client';
import { loadEufyConfig, eufyConfigFromParts, eufyConfigured } from './config.js';
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

  // Enable RTSP on one camera and resolve its rtsp:// URL. Cached after first success;
  // concurrent callers share one in-flight attempt (no duplicate enable storms).
  async _ensureRtsp(serial) {
    if (this._rtspCache.has(serial)) return this._rtspCache.get(serial);
    if (this._rtspPending.has(serial)) return this._rtspPending.get(serial);
    const attempt = (async () => {
      const device = await this._eufy.getDevice(serial);
      const existing = device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl);
      const enabled = device.getPropertyValue?.(PropertyName.DeviceRTSPStream);
      if (existing && enabled) { this._rtspCache.set(serial, existing); return existing; }

      const station = await this._eufy.getStation(serial);
      await station.connect();
      // RTSP only pushes a continuous stream in Continuous recording mode; in Event/
      // standby mode it negotiates but delivers 0 frames. Enable it best-effort. NOTE:
      // continuous recording needs a storage target (microSD / HomeBase 3 / NAS) — with
      // no storage present this has no effect and the live stream will stay frameless.
      try { await station.setContinuousRecording(device, true); log(`rtsp:eufy_${serial}`, 'continuous recording aangezet (nodig voor live RTSP; vereist microSD/HomeBase/NAS)'); }
      catch { /* not supported / no storage */ }
      const urlPromise = new Promise((resolve) => {
        const onUrl = (_st, d, url) => {
          if (d.getSerial() === serial) { this._eufy.off('station rtsp url', onUrl); resolve(url); }
        };
        this._eufy.on('station rtsp url', onUrl);
        setTimeout(() => {
          this._eufy.off('station rtsp url', onUrl);
          resolve(device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl) || null);
        }, 9000);
      });
      try { await station.setRTSPStream(device, true); } catch { /* may already be on */ }
      const url = await urlPromise;
      if (url) this._rtspCache.set(serial, url);
      return url;
    })();
    this._rtspPending.set(serial, attempt);
    try { return await attempt; } finally { this._rtspPending.delete(serial); }
  }

  async getCameras() {
    if (!this._eufy) return [];
    const devices = await this._eufy.getDevices();
    const cams = devices.filter((d) => typeof d.isCamera === 'function' && d.isCamera());
    // For RTSP-capable cameras, WAIT for the RTSP URL and serve them as 'rtsp'. Never
    // fall back to the broken P2P path just because RTSP is still resolving — that race
    // is exactly what caused "no video on a fresh start". Only genuinely RTSP-incapable
    // cameras (e.g. battery SoloCams) are served as 'p2p'.
    return Promise.all(cams.map(async (d) => {
      const serial = d.getSerial();
      const name = (typeof d.getName === 'function' && d.getName()) || serial;
      if (this._deviceSupportsRtsp(d)) {
        const url = await this._ensureRtsp(serial).catch(() => null);
        if (url) return { id: `eufy_${serial}`, name, type: 'rtsp', url, battery: false, transcode: false, serial };
      }
      return {
        id: `eufy_${serial}`,
        name,
        type: 'p2p',
        serial,
        battery: typeof d.hasBattery === 'function' ? d.hasBattery() : true,
        transcode: false,
      };
    }));
  }

  // Full per-camera readout for the diagnostics view: model, recording mode, RTSP
  // status, detected local storage, signal — everything needed to see WHY a camera
  // does or doesn't stream.
  async getDiagnostics() {
    if (!this._eufy) return [];
    const devices = await this._eufy.getDevices();
    const cams = devices.filter((d) => typeof d.isCamera === 'function' && d.isCamera());
    const out = [];
    for (const d of cams) {
      const serial = d.getSerial();
      const dp = (d.getProperties && d.getProperties()) || {};
      let storage = 'onbekend';
      try {
        const st = await this._eufy.getStation(serial);
        const sp = (st.getProperties && st.getProperties()) || {};
        const sd = Object.entries(sp).find(([k]) => /sdStatus|sdCapacity|storageInfoSdCard/i.test(k));
        if (sd) storage = sd[1] && sd[1] !== 0 ? `aanwezig (${JSON.stringify(sd[1])})` : 'geen kaart';
        else storage = 'geen opslag-property (waarschijnlijk geen SD)';
      } catch { /* ignore */ }
      out.push({
        name: (d.getName && d.getName()) || serial,
        serial,
        model: (d.getModel && d.getModel()) || dp.model || '?',
        type: this._rtspCache.get(serial) ? 'rtsp' : 'p2p',
        url: dp.rtspStreamUrl || this._rtspCache.get(serial) || null,
        rtspEnabled: !!dp.rtspStream,
        continuousRecording: !!dp.continuousRecording,
        battery: typeof d.hasBattery === 'function' ? d.hasBattery() : null,
        storage,
        wifiRssi: dp.wifiRssi ?? null,
      });
    }
    return out;
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
