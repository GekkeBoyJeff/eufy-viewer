// The Eufy account: read it from the environment and save it locally on this device.
// Everything else (which cameras exist) comes from the account itself, so this is the
// only thing the app needs you to fill in.
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.join(process.cwd(), '.env.local');

const withDefaults = (username, password, country) => ({
  username, password, country,
  language: 'en',
  persistentDir: path.join(process.cwd(), 'data'),
  p2pConnectionSetup: 0,
  pollingIntervalMinutes: 10,
  eventDurationSeconds: 10,
  acceptInvitations: false,
});

export const loadEufyConfig = (env = process.env) => {
  const { EUFY_USERNAME, EUFY_PASSWORD, EUFY_COUNTRY } = env;
  if (!EUFY_USERNAME || !EUFY_PASSWORD || !EUFY_COUNTRY) throw new Error('Eufy-account is niet ingesteld');
  return withDefaults(EUFY_USERNAME, EUFY_PASSWORD, EUFY_COUNTRY);
};

// Used by the login screen, which passes the details straight in.
export const eufyConfigFromParts = ({ username, password, country } = {}) => {
  if (!username || !password || !country) throw new Error('gebruikersnaam, wachtwoord en land zijn verplicht');
  return withDefaults(username, password, country);
};

export const eufyConfigured = (env = process.env) =>
  Boolean(env.EUFY_USERNAME && env.EUFY_PASSWORD && env.EUFY_COUNTRY);

const parseEnv = (text) => {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
};

// Save the account to .env.local so it survives a restart. Also put it into the live
// environment right away, so the running server can use it without a restart.
export const saveAccount = ({ username, password, country }) => {
  const existing = fs.existsSync(ENV_PATH) ? parseEnv(fs.readFileSync(ENV_PATH, 'utf8')) : {};
  const merged = { ...existing, EUFY_USERNAME: username, EUFY_PASSWORD: password, EUFY_COUNTRY: country };
  fs.writeFileSync(ENV_PATH, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  Object.assign(process.env, { EUFY_USERNAME: username, EUFY_PASSWORD: password, EUFY_COUNTRY: country });
};
