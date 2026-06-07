import { getRecentLogs, clearLogs } from '@/lib/Log.js';

export const dynamic = 'force-dynamic';

// Recent server log lines (connecting, streams, restarts) for the browser debug panel.
export const GET = async () => Response.json({ lines: getRecentLogs() });

// "Wissen" empties the server buffer too — otherwise the next poll just refills it.
export const DELETE = async () => { clearLogs(); return Response.json({ ok: true }); };
