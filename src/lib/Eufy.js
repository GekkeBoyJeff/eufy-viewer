import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { EufySecurity, PropertyName } from 'eufy-security-client';
import { eufyConfigFromParts, eufyConfigured } from './Account.js';
import { log, logErr, maskUrl } from './Log.js';

// Run a promise but never wait longer than `ms` — used so a fire-and-forget SDK call can't
// hang one resolve attempt forever (which would block all later retries for that camera).
const withTimeout = (p, ms) =>
  Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, ms))]);

// Singleton wrapper around eufy-security-client. Handles login (with optional
// interactive captcha/2FA handlers, driven by the browser login wizard),
// persists auth to persistentDir, discovers cameras, and re-emits per-serial
// livestream Readables so P2pSource stays decoupled from the SDK.
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

  configured() {
    return eufyConfigured();
  }
  isConnected() {
    return this._connected;
  }

  // Log in with the given account details. The login screen drives this and provides
  // the captcha/2FA handlers; it stays mounted so those prompts can be answered.
  async connectWith(parts, handlers) {
    if (this._connected) {
      return this._eufy;
    }
    if (this._connecting) {
      throw new Error('even wachten — er loopt al een verbindingspoging');
    }
    this._connecting = true;
    log('eufy', 'verbinden met je account…');
    try {
      const e = await this._doConnect(eufyConfigFromParts(parts), handlers);
      this._connected = true;
      this._ready = Promise.resolve(e);
      log('eufy', 'verbonden ✓');
      this._enableRtspInBackground();
      return e;
    } catch (error) {
      logErr('eufy', `verbinden mislukt: ${error.message}`);
      throw error;
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
          log('eufy', 'Eufy vraagt om een captcha');
          if (!captchaHandler) {
            return reject(new Error('captcha vereist — log in via de browser (het inlogscherm)'));
          }
          try {
            const code = await captchaHandler(captcha, id);
            await eufy.connect({ captcha: { captchaId: id, captchaCode: code } });
          } catch (error) {
            reject(error);
          }
        });
        eufy.on('tfa request', async () => {
          if (!verifyHandler) {
            return reject(new Error('2FA vereist — log in via de browser (het inlogscherm)'));
          }
          try {
            const code = await verifyHandler();
            await eufy.connect({ verifyCode: code });
          } catch (error) {
            reject(error);
          }
        });
        eufy.on('connect', () => resolve(eufy));
        eufy.on('connection error', (err) => reject(err));

        try {
          await eufy.connect();
        } catch (error) {
          reject(error);
        }
      })().catch(reject);
    });
  }

  _deviceSupportsRtsp(d) {
    try {
      return typeof d.hasProperty === 'function' && d.hasProperty(PropertyName.DeviceRTSPStream);
    } catch {
      return false;
    }
  }

  // Enable RTSP for all capable cameras and cache their URLs (best-effort, background).
  async _enableRtspInBackground() {
    try {
      const devices = await this._eufy.getDevices();
      for (const d of devices.filter((x) => x.isCamera?.() && this._deviceSupportsRtsp(x))) {
        this._ensureRtsp(d.getSerial()).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  // Wait until the station is really connected. station.connect() resolves before the camera
  // is actually reachable, so we poll isConnected(). Bounded (~12s) so a dead camera fails the
  // round quickly and lets the next retry start, instead of hanging.
  async _connectStation(station) {
    const canCheck = typeof station.isConnected === 'function';
    try {
      station.connect();
    } catch {
      /* volgende ronde opnieuw */
    }
    if (!canCheck) {
      await new Promise((r) => setTimeout(r, 2500));
      return true;
    }
    for (let i = 0; i < 24; i += 1) {
      if (station.isConnected()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return station.isConnected();
  }

  // Find the camera's rtsp:// URL. Two ways it becomes known: the camera reports it
  // (DeviceRTSPStreamUrl, sometimes only after a moment) or we build it from the station's
  // LAN IP (rtsp://<ip>:554/live0). Poll both for a while (~20s) and take whichever comes first.
  async _resolveRtspUrl(device, station) {
    for (let i = 0; i < 40; i += 1) {
      const reported = device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl);
      if (reported) {
        return reported;
      }
      const ip =
        station.getPropertyValue?.(PropertyName.StationLanIpAddress) ||
        station.getPropertyValue?.(PropertyName.StationLanIpAddressStandalone);
      if (ip) {
        return `rtsp://${ip}:554/live0`;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }

  // One full resolve attempt for a camera: connect the station, enable RTSP + recording, and
  // work out the URL. Every step is bounded, so this ALWAYS settles — a failed round returns
  // null and the next refresh simply tries again.
  async _resolveOnce(serial) {
    try {
      // Bound even the SDK lookups: if a mid-session network partition makes them hang, this
      // attempt would otherwise never settle and block all later retries for this camera.
      const device = await withTimeout(this._eufy.getDevice(serial), 10_000);
      if (!device) {
        logErr('rtsp', `${serial}: camera niet gevonden — volgende ronde opnieuw`);
        return null;
      }
      const name = (device.getName?.() && device.getName()) || serial;
      const reported = device.getPropertyValue?.(PropertyName.DeviceRTSPStreamUrl);
      if (reported) {
        this._rtspCache.set(serial, reported);
        log('rtsp', `${name}: RTSP klaar (${maskUrl(reported)})`);
        return reported;
      }

      log('rtsp', `${name}: RTSP klaarzetten…`);
      const station = await withTimeout(this._eufy.getStation(serial), 10_000);
      if (!station) {
        logErr('rtsp', `${name}: station niet gevonden — volgende ronde opnieuw`);
        return null;
      }
      if (!(await this._connectStation(station))) {
        logErr('rtsp', `${name}: station nog niet verbonden — volgende ronde opnieuw`);
        return null;
      }
      await withTimeout(station.setContinuousRecording(device, true), 5000); // geen opslag → genegeerd
      await withTimeout(station.setRTSPStream(device, true), 5000); // stond mogelijk al aan

      const url = await this._resolveRtspUrl(device, station);
      if (url) {
        this._rtspCache.set(serial, url);
        log('rtsp', `${name}: RTSP klaar (${maskUrl(url)})`);
        return url;
      }
      logErr('rtsp', `${name}: RTSP nog niet gelukt — volgende ronde opnieuw`);
      return null;
    } catch (error) {
      logErr('rtsp', `RTSP-fout (${serial}): ${error.message}`);
      return null;
    }
  }

  // Make sure RTSP is set up for one camera, caching the URL. Best-effort and background.
  // Only ever ONE attempt runs per camera at a time (the pending promise is kept for the
  // whole attempt, so the 4s refresh can't stack a second connect on top). On failure the
  // next refresh tries again — so it never gives up and never piles up.
  async _ensureRtsp(serial) {
    if (this._rtspCache.has(serial)) {
      return this._rtspCache.get(serial);
    }
    if (this._rtspPending.has(serial)) {
      return this._rtspPending.get(serial);
    }
    const attempt = this._resolveOnce(serial);
    this._rtspPending.set(serial, attempt);
    try {
      return await attempt;
    } finally {
      this._rtspPending.delete(serial);
    }
  }

  // Manual "Nu opnieuw proberen": drop any cached URL and in-flight attempt, then resolve fresh.
  forceResolveRtsp(serial) {
    this._rtspCache.delete(serial);
    this._rtspPending.delete(serial);
    return this._ensureRtsp(serial);
  }

  async getCameras() {
    if (!this._eufy) {
      return [];
    }
    const devices = await this._eufy.getDevices();
    const cams = devices.filter((d) => typeof d.isCamera === 'function' && d.isCamera());
    // Return immediately — never wait on RTSP here. An RTSP camera whose URL isn't ready
    // yet stays in the list as `ready: false` (shown as "klaarzetten…") and we kick off the
    // resolve in the background. The next refresh picks up the URL once it's ready, and if
    // it failed it simply tries again — so the camera never silently disappears.
    return cams.map((d) => {
      const serial = d.getSerial();
      const name = (typeof d.getName === 'function' && d.getName()) || serial;
      const model = (typeof d.getModel === 'function' && d.getModel()) || '?';
      if (this._deviceSupportsRtsp(d)) {
        const url = this._rtspCache.get(serial) || null;
        if (!url) {
          this._ensureRtsp(serial).catch(() => {});
        }
        return {
          id: `eufy_${serial}`,
          name,
          model,
          type: 'rtsp',
          url,
          battery: false,
          transcode: false,
          serial,
          ready: !!url,
        };
      }
      // Genuinely RTSP-incapable cameras (e.g. battery SoloCams) use P2P.
      return {
        id: `eufy_${serial}`,
        name,
        model,
        type: 'p2p',
        serial,
        battery: typeof d.hasBattery === 'function' ? d.hasBattery() : true,
        transcode: false,
        ready: true,
      };
    });
  }

  // Full read-out per camera: every device property the SDK exposes, plus the station
  // (IP, storage) properties. Honest — we show exactly what the camera reports.
  async getReadout() {
    if (!this._eufy) {
      return [];
    }
    const devices = await this._eufy.getDevices();
    const cams = devices.filter((d) => typeof d.isCamera === 'function' && d.isCamera());
    const out = [];
    for (const d of cams) {
      const serial = d.getSerial();
      const props = (d.getProperties && d.getProperties()) || {};
      let station = {};
      try {
        const st = await this._eufy.getStation(serial);
        station = (st.getProperties && st.getProperties()) || {};
      } catch {
        /* geen station-info */
      }
      const rtspCapable = this._deviceSupportsRtsp(d);
      const url = this._rtspCache.get(serial) || props.rtspStreamUrl || null;
      out.push({
        id: `eufy_${serial}`,
        name: props.name || serial,
        serial,
        model: props.model || (typeof d.getModel === 'function' && d.getModel()) || '?',
        // 'rtsp' once ready, 'rtsp-pending' while we're still working out its URL, else 'p2p'.
        type: url ? 'rtsp' : rtspCapable ? 'rtsp-pending' : 'p2p',
        url,
        rtspCapable,
        ready: rtspCapable ? !!url : true,
        props,
        station,
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
    try {
      await this._eufy.stopStationLivestream(serial);
    } catch {
      /* already stopped */
    }
  }
}

// One shared instance across the custom server and the API routes (and across Next's
// hot-reload), so login state and the connection are never duplicated.
export const eufyClient = (globalThis.__eufyClient ??= new EufyClient());
