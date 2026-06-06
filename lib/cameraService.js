// The one place that knows about all cameras: it keeps the live list, makes the right
// video source per camera, and manages who is watching. Shared by the server and the
// API routes (cached on globalThis so it survives Next's hot-reload in development).
import { StreamManager } from './streamManager.js';
import { RtspSource } from './sources/rtspSource.js';
import { P2pSource } from './sources/p2pSource.js';
import { eufyClient } from './eufy.js';
import { readCameras } from './configStore.js';
import { eufyConfigured } from './config.js';
import { log } from './log.js';

class CameraService {
  constructor() {
    this.discovered = [];
    this.started = false;
    this.makeSource = (cam) => (cam.type === 'p2p' ? new P2pSource(cam, { client: eufyClient }) : new RtspSource(cam));
    this.manager = new StreamManager({ createSource: this.makeSource });
  }

  // Connect to Eufy in the background so the page is usable immediately.
  start() {
    if (this.started) return;
    this.started = true;
    if (!eufyConfigured()) return;
    eufyClient.connect()
      .then(async () => { this.discovered = await eufyClient.getCameras(); log('eufy', `verbonden — ${this.discovered.length} camera('s) gevonden`); })
      .catch((e) => log('eufy', `login niet beschikbaar — open /setup. ${e.message}`));
    setInterval(() => this.refresh(), 15000).unref?.();
  }

  async refresh() {
    if (eufyClient.isConnected()) { try { this.discovered = await eufyClient.getCameras(); } catch { /* volgende keer weer */ } }
  }

  // RTSP cameras from cameras.json + the Eufy-discovered cameras, without duplicates.
  listCameras() {
    const rtsp = readCameras().filter((c) => c.type === 'rtsp');
    const seen = new Set();
    return [...rtsp, ...this.discovered].filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
  }

  getCamera(id) { return this.listCameras().find((c) => c.id === id); }

  status() { return { configured: eufyConfigured() || eufyClient.isConnected(), connected: eufyClient.isConnected() }; }
}

export const cameraService = (globalThis.__eufyCameraService ??= new CameraService());
