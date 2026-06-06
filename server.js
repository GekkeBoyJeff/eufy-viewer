// Starts everything: Next.js for the web pages/API, plus the live-video WebSocket on
// the same port. Run with `npm run dev` (development) or `npm start` (production).
import { createServer } from 'node:http';
import next from 'next';
import { cameraService } from './lib/cameraService.js';
import { createVideoSocket } from './lib/videoSocket.js';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handlePage = app.getRequestHandler();
await app.prepare(); // laadt o.a. .env.local in

const server = createServer((req, res) => handlePage(req, res));

// Send /stream/* to our video socket; everything else (incl. Next's hot-reload) to Next.
const video = createVideoSocket(cameraService);
const handleNextUpgrade = app.getUpgradeHandler();
server.on('upgrade', (req, socket, head) => {
  if (video.handleUpgrade(req, socket, head)) return;
  handleNextUpgrade(req, socket, head);
});

server.listen(port, () => {
  console.log(`Eufy Viewer → http://localhost:${port}`);
  cameraService.start(); // verbindt op de achtergrond met Eufy
});
