import * as setup from '@/lib/setupActions.js';

export const dynamic = 'force-dynamic';

// Current setup state (configured cameras + Eufy login status).
export async function GET() {
  return Response.json(await setup.getState());
}

// One endpoint for every setup action, chosen by `action` in the body.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case 'diagnostics': return Response.json(await setup.getDiagnostics());
      case 'addCamera': return Response.json(setup.addRtspCamera(body));
      case 'deleteCamera': return Response.json(setup.deleteCamera(body.id));
      case 'testRtsp': return Response.json(await setup.testRtsp(body));
      case 'streamTest': return Response.json(await setup.streamTest(body));
      case 'eufyConnect': return Response.json(await setup.eufyConnect(body));
      case 'eufyCaptcha': return Response.json(await setup.eufyCaptcha(body));
      case 'eufyTfa': return Response.json(await setup.eufyTfa(body));
      default: return Response.json({ error: 'onbekende actie' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
