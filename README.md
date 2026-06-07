# Eufy Viewer

Bekijk je eigen Eufy-camera's lokaal in de browser. Je logt één keer in met je
Eufy-account; de app vindt je camera's zelf, zet RTSP voor je aan en toont het beeld.

> Belangrijk: het apparaat dat dit draait moet op **hetzelfde netwerk** zitten als je
> camera's, en RTSP geeft pas beeld als de camera op **Continuous recording** staat
> (vereist een microSD, HomeBase 3 of NAS).

## Wat je nodig hebt
- **Node.js 20.9+** en **ffmpeg** (op de Chromebook: in de Linux-container installeren).
- Hetzelfde netwerk als de camera's.

## Draaien
```bash
npm install
npm run build && npm start      # → http://localhost:3000
```
Of in één keer: `./start.sh`.

De eerste keer zie je een **inlogscherm**. Vul je Eufy-account in (e-mail, wachtwoord,
land); bij een captcha of 2FA-code vraagt het scherm daar zelf om. Daarna verschijnen je
camera's vanzelf. Je gegevens worden alleen op dit apparaat bewaard (`.env.local`).

Later iets wijzigen of een camera testen? Klik op **⚙ Instellingen** in de balk.

## Snelkoppeling op de Chromebook
1. Installeer Node + ffmpeg in de Linux-container en start de app (`npm start`).
2. Open `http://localhost:3000` in Chrome → menu → *Snelkoppeling maken* → "Openen als venster".

## Mappen
```
server.js              start alles: Next.js + de live-video-WebSocket (plain Node)
src/
  app/
    layout.jsx         html-shell, laadt globals.css
    page.jsx           de kijker (inloggen, camera's, layout, instellingen)
    globals.css        Tailwind v4 + thema-tokens
    api/               /api/cameras (+ /resolve), /api/log, /api/setup
  components/          alleen React-componenten: Toolbar, CameraPane, AccountLogin, SettingsModal
  lib/                 server-logica (Eufy, ffmpeg, streambeheer); Env.js valideert PORT/NODE_ENV
    client/            browser-only: LivePlayer (JMuxer/MSE), Api (fetch-helper)
    server/            server-only transport: VideoSocket (WebSocket-fan-out)
    sources/           RtspSource, P2pSource (ffmpeg-bronnen)
```
Imports binnen Next gebruiken de alias `@/…` (→ `src/`); `server.js` draait in kale Node
en gebruikt daarom relatieve paden (`./src/lib/…`).

## Ontwikkelen
```bash
npm run dev            # ontwikkelserver
npm run lint           # oxlint (oxlint.config.mjs)
npm run format         # oxfmt (oxfmt.config.mjs)
npm test               # node:test unit-tests
```
Code-kwaliteit volgt de stijl van de [Next.js Boilerplate](https://github.com/ixartz/Next-js-Boilerplate),
aangepast voor JSX: oxlint + oxfmt via Ultracite-presets, met Lefthook-git-hooks
(format + lint-fix bij elke commit). Correctness-regels zijn `error`; strengere stijl-regels
staan op `warn` als groei-backlog. De map blijft bewust **JSX** (geen TypeScript).

## Goed om te weten
- De Indoor Cam C210 ondersteunt RTSP pas recent/gedeeltelijk; bij het opstarten kan een
  camera een paar tellen "laden" voordat het beeld er is. De server herstart een stream
  zelf als de camera 'm laat vallen, zodat het beeld vanzelf terugkomt.
- Een camera heeft vaak maar **één streamslot**: kijkt de Eufy-app live mee, dan kan deze
  viewer "geen beeld" tonen. Sluit dan de live-view in de app.
- **Vertrouwd netwerk vereist.** De app is bedoeld voor één gebruiker op een vertrouwd LAN
  en heeft géén login/rate-limiting op zijn endpoints. Stel 'm niet bloot aan het open
  internet. Gebruik bij voorkeur een apart Eufy-account (met 2FA uit) i.p.v. je hoofdaccount.
- De interface is bewust **Nederlandstalig** (één gebruiker); er is geen i18n-laag.
