import * as setup from '@/lib/SetupActions.js';

export const dynamic = 'force-dynamic';

// Current state: discovered cameras + Eufy login status.
export const GET = async () => Response.json(await setup.getState());

// One endpoint for every account/login action, chosen by `action` in the body.
export const POST = async (req) => {
  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case 'readout': {
        return Response.json(await setup.getReadout());
      }
      case 'eufyConnect': {
        return Response.json(await setup.eufyConnect(body));
      }
      case 'eufyReconnect': {
        return Response.json(await setup.eufyReconnect());
      }
      case 'eufyCaptcha': {
        return Response.json(await setup.eufyCaptcha(body));
      }
      case 'eufyTfa': {
        return Response.json(await setup.eufyTfa(body));
      }
      default: {
        return Response.json({ error: 'onbekende actie' }, { status: 400 });
      }
    }
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
};
