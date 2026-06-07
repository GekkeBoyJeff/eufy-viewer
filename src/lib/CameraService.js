// The one place that knows about all cameras: it keeps the live list (everything the
// Eufy account finds, auto-set to RTSP where possible), makes the right video source
// per camera, and manages who is watching. Shared by the server and the API routes
// (cached on globalThis so it survives Next's hot-reload in development).
import { StreamManager } from './streamManager.js';
import { RtspSource } from './sources/rtspSource.js';
import { P2pSource } from './sources/p2pSource.js';
import { eufyClient } from './eufy.js';
import { eufyConfigured } from './account.js';
import { log } from './log.js';

class CameraService {
  constructor() {
    this.cameras = [];
    this.started = false;
    this.refreshing = false;
    this.makeSource = (cam) => (cam.type === 'p2p' ? new P2pSource(cam, { client: eufyClient }) : new RtspSource(cam));
    this.manager = new StreamManager({ createSource: this.makeSource });
  }

  // Start the camera-list refresh loop. The connection itself is made by the login
  // screen (which can handle captcha/2FA); here we just keep the list fresh once
  // connected. Refresh often: RTSP URLs can take a couple of tries after a fresh login,
  // and a camera only joins the list once its RTSP is ready.
  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    setInterval(() => this.refresh(), 4000).unref?.();
  }

  async refresh() {
    if (this.refreshing || !eufyClient.isConnected()) return;
    this.refreshing = true;
    try {
      const next = await eufyClient.getCameras();
      if (next.length !== this.cameras.length) log('eufy', `${next.length} camera('s) gevonden`);
      this.cameras = next;
    } catch { /* volgende keer weer */ } finally { this.refreshing = false; }
  }

  listCameras() { return this.cameras; }
  getCamera(id) { return this.cameras.find((c) => c.id === id); }
  status() {
    return { configured: eufyConfigured() || eufyClient.isConnected(), connected: eufyClient.isConnected() };
  }
}

export const cameraService = (globalThis.__eufyCameraService ??= new CameraService());
