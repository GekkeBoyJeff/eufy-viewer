import { cameraService } from '@/lib/CameraService.js';
import { eufyClient } from '@/lib/Eufy.js';

export const dynamic = 'force-dynamic';

// "Nu opnieuw proberen" for a stuck camera: drop its cached/abandoned RTSP state and resolve
// fresh in the background, then refresh the list. Returns immediately — the viewer's poll
// picks up the camera once it becomes ready.
export const POST = async (req) => {
  const { id } = await req.json().catch(() => ({}));
  const cam = id && cameraService.getCamera(id);
  if (!cam) {
    return Response.json({ ok: false, error: 'onbekende camera' }, { status: 404 });
  }
  eufyClient
    .forceResolveRtsp(cam.serial)
    .then(() => cameraService.refresh())
    .catch(() => {});
  return Response.json({ ok: true });
};
