// Reads and checks the configuration: cameras.json (your Indoor Cams over RTSP) and
// the Eufy account from the environment (used for the SoloCam P2P route).
import fs from 'node:fs';
import path from 'node:path';

// The app is always started from its own folder, so this is the project root.
const ROOT = process.cwd();

export const loadCameras = (data) => {
  const list = Array.isArray(data?.cameras) ? data.cameras : [];
  const seen = new Set();
  return list.map((c) => {
    if (!c.id || !c.name || !c.type) throw new Error(`camera mist id/naam/type: ${JSON.stringify(c)}`);
    if (seen.has(c.id)) throw new Error(`dubbele camera-id: ${c.id}`);
    seen.add(c.id);
    if (c.type === 'rtsp' && !c.url) throw new Error(`rtsp-camera ${c.id} mist url`);
    if (c.type === 'p2p' && !c.serial) throw new Error(`p2p-camera ${c.id} mist serial`);
    return { battery: c.type === 'p2p', transcode: false, ...c };
  });
};

export const loadCamerasFile = (file = path.join(ROOT, 'cameras.json')) =>
  (fs.existsSync(file) ? loadCameras(JSON.parse(fs.readFileSync(file, 'utf8'))) : []);

// Fill in the fixed defaults around the account details.
const withDefaults = (username, password, country, persistentDir) => ({
  username, password, country,
  language: 'en',
  persistentDir: persistentDir || path.join(ROOT, 'data'),
  p2pConnectionSetup: 0,
  pollingIntervalMinutes: 10,
  eventDurationSeconds: 10,
  acceptInvitations: false,
});

export const loadEufyConfig = (env = process.env) => {
  const { EUFY_USERNAME, EUFY_PASSWORD, EUFY_COUNTRY, EUFY_PERSISTENT_DIR } = env;
  for (const [key, value] of Object.entries({ EUFY_USERNAME, EUFY_PASSWORD, EUFY_COUNTRY })) {
    if (!value) throw new Error(`${key} ontbreekt in de omgeving`);
  }
  return withDefaults(EUFY_USERNAME, EUFY_PASSWORD, EUFY_COUNTRY, EUFY_PERSISTENT_DIR);
};

// Used by the setup wizard, which passes the account details directly.
export const eufyConfigFromParts = ({ username, password, country, persistentDir } = {}) => {
  if (!username || !password || !country) throw new Error('gebruikersnaam, wachtwoord en land zijn verplicht');
  return withDefaults(username, password, country, persistentDir);
};

export const eufyConfigured = (env = process.env) =>
  Boolean(env.EUFY_USERNAME && env.EUFY_PASSWORD && env.EUFY_COUNTRY);
