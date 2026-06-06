import * as setup from '@/lib/setupActions.js';

export const dynamic = 'force-dynamic';

// Current state: discovered cameras + Eufy login status.
export const GET = async () => Response.json(await setup.getState());

// One endpoint for every account/login action, chosen by `action` in the body.
export const POST = async (req) => {
  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case 'streamTest': return Response.json(await setup.streamTest(body));
      case 'eufyConnect': return Response.json(await setup.eufyConnect(body));
      case 'eufyCaptcha': return Response.json(await setup.eufyCaptcha(body));
      case 'eufyTfa': return Response.json(await setup.eufyTfa(body));
      default: return Response.json({ error: 'onbekende actie' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
};
