# Eufy Viewer (Next.js)

Bekijk je eigen Eufy-camera's lokaal in de browser: Indoor Cams via lokale **RTSP**,
overige via je **Eufy-account** (P2P). Alles draait op je eigen apparaat in je netwerk.

> Belangrijk: dit apparaat moet op **hetzelfde netwerk** zitten als je camera's, en
> RTSP geeft pas continu beeld als de camera op **Continuous recording** staat (vereist
> een microSD, HomeBase 3 of NAS).

## Wat je nodig hebt
- **Node.js 20.9+** en **ffmpeg** (op de Chromebook: in de Linux-container installeren).
- Hetzelfde netwerk als de camera's.

## Instellen
1. `npm install`
2. Account voor je camera's (kies één):
   - **Makkelijkst:** start de app en ga naar `/setup` om in te loggen en camera's toe te voegen.
   - **Of handmatig:** maak `.env.local` met:
     ```
     EUFY_USERNAME=jouw-account@voorbeeld.nl
     EUFY_PASSWORD=...
     EUFY_COUNTRY=NL
     ```
   - Indoor Cams kun je ook in `cameras.json` zetten (zie `/setup` voor de RTSP-URL).

## Draaien
- **Ontwikkelen:** `npm run dev` → http://localhost:3000
- **Gebruiken (sneller):** `npm run build` daarna `npm start` → http://localhost:3000

Eén commando om te bouwen én te starten: `./start.sh`

## Snelkoppeling op de Chromebook
1. Installeer Node + ffmpeg in de Linux-container en start de app (`npm start`).
2. Open `http://localhost:3000` in Chrome.
3. Chrome-menu → *"Verzenden, opslaan en delen" → Snelkoppeling maken* → vink **"Openen als venster"** aan.
   Je krijgt een icoon dat de viewer als losse app opent.

(Wil je dat de server automatisch start bij het opstarten? Dat kan ik later toevoegen met een klein opstart-script.)

## Mappen
```
server.js          start alles: Next.js + de live-video-verbinding
app/
  page.jsx         de kijker (camera's bekijken)
  setup/page.jsx   instellen (inloggen + camera's + diagnose)
  api/             camera-lijst en setup-acties
components/         Toolbar, CameraPane, livePlayer (browser-kant)
lib/               camera-logica (Eufy, ffmpeg, streambeheer) — server-kant
```

## Goed om te weten
- RTSP op de Indoor Cam C210 wordt pas recent/gedeeltelijk ondersteund; 100% stabiel
  24/7 is niet gegarandeerd. Voor een rotsvaste feed: HomeBase 3 of een ONVIF/RTSP-camera.
- Een camera heeft vaak maar **één streamslot**: kijkt de Eufy-app live mee, dan kan deze
  viewer "geen beeld" tonen. Sluit dan de live-view in de app.
