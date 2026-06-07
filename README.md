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

## Op een Chromebook (voor een niet-techneut)
Bedoeld om door iemand anders te laten gebruiken: éénmalig opzetten, daarna één klik.

**Eenmalig:**
1. Zet de Linux-omgeving aan: *Instellingen → Geavanceerd → Ontwikkelaars → Linux-ontwikkelomgeving → Inschakelen*.
2. Sleep deze projectmap (naam: `eufy-viewer`) in de Bestanden-app naar **Linux-bestanden**.
3. Open de Terminal en draai:
   ```bash
   bash eufy-viewer/setup-chromebook.sh
   ```
   Dit installeert ffmpeg + Node, bouwt de app en maakt een app-icoon **Eufy Viewer**.

**Dagelijks (door de gebruiker):** klik op het **Eufy Viewer**-icoon in de app-lade. Het
icoon opent de viewer via `http://penguin.linux.test:3000` — dus **geen poort doorsturen
nodig**. De eerste keer logt hij in z'n Eufy-account in via het scherm in de browser; daarna
onthoudt de app het en herverbindt vanzelf.

> Wil je een echt app-venster (PWA, fullscreen zonder adresbalk)? Dat vereist een "secure
> context": zet poort **3000** doorsturen aan (*Instellingen → … → Linux → Poort doorsturen*),
> open `http://localhost:3000` in Chrome en kies menu (⋮) → **App installeren**. Optioneel.

Voor een leek-vriendelijk, jargon-vrij stappenplan: zie de meegeleverde PDF-handleiding.

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
