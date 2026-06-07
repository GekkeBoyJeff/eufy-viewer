// Validated, static server configuration — read once at import time.
//
// NOTE: the Eufy credentials (EUFY_USERNAME / EUFY_PASSWORD / EUFY_COUNTRY) are
// deliberately NOT handled here. They can be set at runtime through the browser login
// wizard (Account.js writes them back to .env.local AND into process.env on the fly),
// so they must be read dynamically — caching them at boot would break that flow.
// Account.js is the single source of truth for credentials; this module owns only the
// static, deploy-time configuration.
//
// Every field uses .catch(default) so a bad value falls back instead of throwing —
// this module is imported by server.js (the entry point) and must never block boot.
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).catch('development'),
  PORT: z.coerce.number().int().positive().catch(3000),
});

const parsed = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});

export const Env = {
  ...parsed,
  isDev: parsed.NODE_ENV !== 'production',
  isProd: parsed.NODE_ENV === 'production',
};
