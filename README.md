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
server.js          start alles: Next.js + de live-video-verbinding
app/
  page.jsx         de kijker (inloggen, camera's bekijken, layout, instellingen)
  api/             camera-lijst (/api/cameras) en account-acties (/api/setup)
components/        Toolbar, CameraPane, AccountLogin, SettingsModal, livePlayer
lib/               camera-logica (Eufy, ffmpeg, streambeheer) — server-kant
```

## Goed om te weten
- De Indoor Cam C210 ondersteunt RTSP pas recent/gedeeltelijk; bij het opstarten kan een
  camera een paar tellen "laden" voordat het beeld er is. De server herstart een stream
  zelf als de camera 'm laat vallen, zodat het beeld vanzelf terugkomt.
- Een camera heeft vaak maar **één streamslot**: kijkt de Eufy-app live mee, dan kan deze
  viewer "geen beeld" tonen. Sluit dan de live-view in de app.
