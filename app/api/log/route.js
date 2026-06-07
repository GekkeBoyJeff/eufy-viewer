import { getRecentLogs } from '@/lib/log.js';

export const dynamic = 'force-dynamic';

// Recent server log lines (connecting, streams, restarts) for the browser debug panel.
export const GET = async () => Response.json({ lines: getRecentLogs() });
