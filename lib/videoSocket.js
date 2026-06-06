import { WebSocketServer } from 'ws';
import { log } from './log.js';

// The live-video WebSocket. The browser connects to /stream/<cameraId>; each
// connection is one viewer. Video chunks for a camera go to that camera's sockets;
// control messages (stopped/error) are sent as small JSON frames.
//
// Returns a `handleUpgrade` the server calls for every upgrade: it claims /stream
// connections and ignores the rest (so Next's hot-reload socket keeps working).
export function createVideoSocket(service) {
  const wss = new WebSocketServer({ noServer: true });
  const { manager } = service;
  const channels = new Map(); // cameraId -> Set<ws>
  let counter = 0;

  const sendToChannel = (id, payload) => {
    for (const ws of channels.get(id) || []) if (ws.readyState === 1) ws.send(payload);
  };
  manager.on('chunk', (id, buf) => sendToChannel(id, buf));
  manager.on('autostopped', (id) => sendToChannel(id, JSON.stringify({ event: 'autostopped' })));
  manager.on('camera-error', (id, err) => sendToChannel(id, JSON.stringify({ event: 'error', message: String(err?.message || err) })));

  wss.on('connection', (ws, camera) => {
    const viewerId = `ws${++counter}`;
    if (!channels.has(camera.id)) channels.set(camera.id, new Set());
    channels.get(camera.id).add(ws);
    log('socket', `kijker erbij op ${camera.id} (${camera.type})`);
    manager.addViewer(camera, viewerId);
    ws.on('close', () => { channels.get(camera.id)?.delete(ws); manager.removeViewer(camera.id, viewerId); log('socket', `kijker weg bij ${camera.id}`); });
    ws.on('error', () => { try { ws.close(); } catch {} });
  });

  function handleUpgrade(req, socket, head) {
    const match = /^\/stream\/([^/?]+)/.exec(req.url || '');
    if (!match) return false; // niet voor ons (bijv. Next hot-reload)
    const camera = service.getCamera(decodeURIComponent(match[1]));
    if (!camera) { socket.destroy(); return true; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, camera));
    return true;
  }

  return { wss, handleUpgrade };
}
