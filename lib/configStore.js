// Saves what the setup wizard changes from the browser: cameras.json (Indoor Cam
// entries) and .env.local (the Eufy account). Each function takes a path so it is
// easy to test against a temporary folder.
import fs from 'node:fs';
import path from 'node:path';
import { loadCameras } from './config.js';

const ROOT = process.cwd();
export const CAMERAS_PATH = path.join(ROOT, 'cameras.json');
export const ENV_PATH = path.join(ROOT, '.env.local');

export const readCameras = (file = CAMERAS_PATH) =>
  (fs.existsSync(file) ? loadCameras(JSON.parse(fs.readFileSync(file, 'utf8'))) : []);

export const writeCameras = (cameras, file = CAMERAS_PATH) => {
  const checked = loadCameras({ cameras }); // gooit een fout bij ongeldige/dubbele invoer
  fs.writeFileSync(file, JSON.stringify({ cameras: checked }, null, 2) + '\n');
  return checked;
};

export const upsertCamera = (cam, file = CAMERAS_PATH) => {
  const list = readCameras(file);
  const at = list.findIndex((c) => c.id === cam.id);
  if (at >= 0) list[at] = cam; else list.push(cam);
  return writeCameras(list, file);
};

export const removeCamera = (id, file = CAMERAS_PATH) =>
  writeCameras(readCameras(file).filter((c) => c.id !== id), file);

export const parseEnv = (text) => {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
};

export const serializeEnv = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';

// Merge new values into .env.local (creating it if needed). Comments aren't kept.
export const writeEnvFile = (updates, file = ENV_PATH) => {
  const existing = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const merged = { ...existing, ...updates };
  fs.writeFileSync(file, serializeEnv(merged), { mode: 0o600 });
  return merged;
};
