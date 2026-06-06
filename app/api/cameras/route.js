import { cameraService } from '@/lib/cameraService.js';

// Altijd verse data; deze lijst verandert terwijl camera's verbinden.
export const dynamic = 'force-dynamic';

// The camera list for the viewer. We only send safe fields — never the rtsp URL
// (that holds a password) to the browser.
export async function GET() {
  const cameras = cameraService.listCameras().map((c) => ({
    id: c.id, name: c.name, type: c.type, battery: !!c.battery,
  }));
  return Response.json({ eufy: cameraService.status(), cameras });
}
