#!/usr/bin/env bash
# EENMALIGE setup op een Chromebook, uit te voeren in de Linux-omgeving (Crostini).
#
# Voorwaarde (zet dit eerst aan in ChromeOS):
#   Instellingen > Geavanceerd > Ontwikkelaars > Linux-ontwikkelomgeving > Inschakelen
#
# Daarna: open de Terminal, ga naar deze map en draai:  bash setup-chromebook.sh
#
# Dit installeert ffmpeg + Node.js, bouwt de app, en zet een dubbelklik-icoon
# "Eufy Viewer" in de app-lade. Je vader hoeft daarna alleen dat icoon te klikken.
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT=3000

echo "▶ Eufy Viewer — Chromebook setup"
echo "  projectmap: $PROJECT_DIR"
echo ""

# 1) Systeempakketten: ffmpeg (video) + curl (nodig om Node te installeren)
echo "▶ ffmpeg + curl installeren (vraagt mogelijk om je Linux-wachtwoord)…"
sudo apt-get update -y
sudo apt-get install -y ffmpeg curl ca-certificates

# 2) Node.js 20 — alleen installeren als er nog geen (recente) Node is
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge 20 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
  echo "▶ Node.js 20 installeren…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "▶ Node.js $(node -v) is al aanwezig — overslaan."
fi

# 3) App-afhankelijkheden + productie-build
echo "▶ npm-pakketten installeren…"
npm install
echo "▶ app bouwen…"
npm run build

# 4) Dubbelklik-icoon in de ChromeOS-app-lade (.desktop-launcher)
chmod +x "$PROJECT_DIR/start-eufy.sh"
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"
cat > "$APPS_DIR/eufy-viewer.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Eufy Viewer
Comment=Bekijk je Eufy-camera's
Exec=$PROJECT_DIR/start-eufy.sh
Icon=$PROJECT_DIR/public/icon.svg
Terminal=false
Categories=Network;Video;
EOF
echo "✓ App-icoon 'Eufy Viewer' aangemaakt."

cat <<EOF

────────────────────────────────────────────────────────
✓ Klaar!

Klik in je app-lijst op "Eufy Viewer" om te beginnen.
De eerste keer log je in je Eufy-account in via het scherm
in de browser — daarna onthoudt de app het.

(Optioneel, voor een echt app-venster zonder adresbalk: zet in
 Instellingen > Linux > "Poort doorsturen" poort ${PORT} aan, open
 http://localhost:${PORT} in Chrome en kies menu > "App installeren".)
────────────────────────────────────────────────────────
EOF
