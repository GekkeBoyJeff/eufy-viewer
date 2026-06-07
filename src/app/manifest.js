// Web App Manifest (Next App Router auto-serves this at /manifest.webmanifest and injects
// the <link rel="manifest">). Makes the viewer installable as a standalone PWA — an app
// icon that opens fullscreen without the browser chrome.
//
// NOTE: PWA install + standalone mode require a secure context, which on a Chromebook means
// reaching the server via http://localhost:3000 (enable "Port forwarding" for port 3000 in
// the ChromeOS Linux settings). http://penguin.linux.test:3000 is NOT a secure context.
export default function manifest() {
  return {
    name: 'Eufy Viewer',
    short_name: 'Eufy Viewer',
    description: "Bekijk je Eufy-camera's lokaal",
    lang: 'nl',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0b0d',
    theme_color: '#0a0b0d',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
