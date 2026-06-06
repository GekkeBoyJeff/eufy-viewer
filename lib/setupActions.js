// All the setup-screen actions in one place: add/test Indoor Cams, log in to Eufy
// (with captcha/2FA), read out cameras, and test a stream. The API route just calls
// these. The Eufy login is interactive, so we bridge its captcha/2FA prompts to plain
// request/response steps with a small "what happens next" promise.
import { eufyClient } from './eufy.js';
import { RtspSource } from './sources/rtspSource.js';
import { streamTest as runStreamTest } from './streamTest.js';
import { readCameras, upsertCamera, removeCamera, writeEnvFile } from './configStore.js';

// Login state (single user on a LAN, so module-level is fine).
let resolveNext = null;
const captchaAnswers = new Map(); // captchaId -> resolver
let tfaAnswer = null;
let lastAccount = null;

const nextStep = () => new Promise((r) => { resolveNext = r; });
const reportStep = (payload) => { const r = resolveNext; resolveNext = null; if (r) r(payload); };

async function finishIfConnected(result) {
  if (result.status === 'connected') {
    try { if (lastAccount) writeEnvFile({ EUFY_USERNAME: lastAccount.username, EUFY_PASSWORD: lastAccount.password, EUFY_COUNTRY: lastAccount.country }); } catch { /* niet kritiek */ }
    try { result.cameras = await eufyClient.getCameras(); } catch { result.cameras = []; }
  }
  return result;
}

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cam';
}
function uniqueId(base, taken) {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function getState() {
  let solocams = [];
  if (eufyClient.isConnected()) { try { solocams = await eufyClient.getCameras(); } catch { solocams = []; } }
  return { cameras: readCameras(), solocams, eufy: { configured: eufyClient.configured(), connected: eufyClient.isConnected() } };
}

export async function getDiagnostics() {
  const cameras = eufyClient.isConnected() && eufyClient.getDiagnostics ? await eufyClient.getDiagnostics().catch(() => []) : [];
  const manual = readCameras().filter((c) => c.type === 'rtsp').map((c) => ({
    name: c.name, serial: null, model: 'handmatig', type: 'rtsp', url: c.url,
    rtspEnabled: true, continuousRecording: null, battery: false, storage: 'n.v.t.', wifiRssi: null,
  }));
  return { cameras: [...cameras, ...manual], eufy: { connected: eufyClient.isConnected() } };
}

export function addRtspCamera({ name, url, transcode }) {
  if (!name || !url) throw new Error('naam en url zijn verplicht');
  const taken = readCameras().map((c) => c.id);
  const id = uniqueId(slug(name), taken);
  return { cameras: upsertCamera({ id, name, type: 'rtsp', url, transcode: !!transcode }) };
}

export function deleteCamera(id) { return { cameras: removeCamera(id) }; }

export async function testRtsp({ url, transcode }) {
  if (!url) throw new Error('url ontbreekt');
  const source = new RtspSource({ id: '__test', name: 'test', type: 'rtsp', url, transcode: !!transcode });
  const jpg = await source.snapshot();
  await source.stop?.();
  if (!jpg) throw new Error('geen beeld — controleer url, ip en inloggegevens');
  return { image: `data:image/jpeg;base64,${jpg.toString('base64')}` };
}

export async function streamTest({ url }) {
  if (!url) throw new Error('url ontbreekt');
  return runStreamTest(url);
}

export async function eufyConnect({ username, password, country }) {
  if (!username || !password || !country) throw new Error('gebruikersnaam, wachtwoord en land zijn verplicht');
  if (eufyClient.isConnected()) return finishIfConnected({ status: 'connected' });
  lastAccount = { username, password, country };
  const step = nextStep();
  eufyClient.connectWith(lastAccount, {
    captchaHandler: (image, id) => { reportStep({ status: 'captcha', captchaId: id, image }); return new Promise((r) => captchaAnswers.set(id, r)); },
    verifyHandler: () => { reportStep({ status: '2fa' }); return new Promise((r) => { tfaAnswer = r; }); },
  }).then(() => reportStep({ status: 'connected' })).catch((e) => reportStep({ status: 'error', message: String(e?.message || e) }));
  return finishIfConnected(await step);
}

export async function eufyCaptcha({ captchaId, code }) {
  const resolver = captchaAnswers.get(captchaId);
  if (!resolver) throw new Error('geen captcha in behandeling');
  captchaAnswers.delete(captchaId);
  const step = nextStep();
  resolver(String(code || ''));
  return finishIfConnected(await step);
}

export async function eufyTfa({ code }) {
  if (!tfaAnswer) throw new Error('geen 2FA in behandeling');
  const resolver = tfaAnswer; tfaAnswer = null;
  const step = nextStep();
  resolver(String(code || ''));
  return finishIfConnected(await step);
}
