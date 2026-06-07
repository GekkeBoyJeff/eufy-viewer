// The account/login actions the settings screen needs: log in to Eufy (with captcha
// or 2FA), read the current state, and test a camera's stream. Cameras themselves come
// from the account automatically, so there's nothing to add by hand here.
import { eufyClient } from './Eufy.js';
import { cameraService } from './CameraService.js';
import { saveAccount, loadEufyConfig } from './Account.js';

// Login is interactive, so we bridge its captcha/2FA prompts to plain request/response
// steps with a small "what happens next" promise.
let resolveNext = null;
const captchaAnswers = new Map(); // captchaId -> resolver
let tfaAnswer = null;
let lastAccount = null;

const nextStep = () => new Promise((r) => { resolveNext = r; });
const reportStep = (payload) => { const r = resolveNext; resolveNext = null; if (r) r(payload); };

const finishIfConnected = async (result) => {
  if (result.status === 'connected') {
    try { if (lastAccount) saveAccount(lastAccount); } catch { /* niet kritiek */ }
    cameraService.start(); // begin met camera's ophalen op de achtergrond
    try { result.cameras = await eufyClient.getCameras(); } catch { result.cameras = []; }
  }
  return result;
};

export const getState = async () => {
  let cameras = [];
  if (eufyClient.isConnected()) { try { cameras = await eufyClient.getCameras(); } catch { cameras = []; } }
  return { cameras, eufy: { configured: eufyClient.configured(), connected: eufyClient.isConnected() } };
};

// Full read-out per camera: all properties + the REAL live status from the running
// stream (so it never contradicts what you see in the viewer).
export const getReadout = async () => {
  const cams = await eufyClient.getReadout().catch(() => []);
  return {
    eufy: { connected: eufyClient.isConnected() },
    cameras: cams.map((c) => ({ ...c, live: cameraService.manager.liveStatus(c.id) })),
  };
};

// Start a login attempt and return the first thing that happens (connected / captcha /
// 2fa / error). Shared by a fresh login and a reconnect with the saved account.
const startConnect = async (account) => {
  if (eufyClient.isConnected()) return finishIfConnected({ status: 'connected' });
  lastAccount = account;
  const step = nextStep();
  eufyClient.connectWith(account, {
    captchaHandler: (image, id) => { reportStep({ status: 'captcha', captchaId: id, image }); return new Promise((r) => captchaAnswers.set(id, r)); },
    verifyHandler: () => { reportStep({ status: '2fa' }); return new Promise((r) => { tfaAnswer = r; }); },
  }).then(() => reportStep({ status: 'connected' })).catch((e) => reportStep({ status: 'error', message: String(e?.message || e) }));
  return finishIfConnected(await step);
};

export const eufyConnect = async ({ username, password, country }) => {
  if (!username || !password || !country) throw new Error('gebruikersnaam, wachtwoord en land zijn verplicht');
  return startConnect({ username, password, country });
};

// Reconnect using the account already saved on this device (e.g. after a captcha
// challenge on a fresh start) — no need to type the details again.
export const eufyReconnect = async () => {
  const cfg = loadEufyConfig();
  return startConnect({ username: cfg.username, password: cfg.password, country: cfg.country });
};

export const eufyCaptcha = async ({ captchaId, code }) => {
  const resolver = captchaAnswers.get(captchaId);
  if (!resolver) throw new Error('geen captcha in behandeling');
  captchaAnswers.delete(captchaId);
  const step = nextStep();
  resolver(String(code || ''));
  return finishIfConnected(await step);
};

export const eufyTfa = async ({ code }) => {
  if (!tfaAnswer) throw new Error('geen 2FA in behandeling');
  const resolver = tfaAnswer; tfaAnswer = null;
  const step = nextStep();
  resolver(String(code || ''));
  return finishIfConnected(await step);
};
