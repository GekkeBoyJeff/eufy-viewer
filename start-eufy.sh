#!/usr/bin/env bash
# Wordt aangeroepen door het "Eufy Viewer"-icoon. Opent de viewer in de browser en zorgt
# dat de server draait. Veilig om vaker te klikken: draait de server al, dan opent het
# alleen de pagina. Ontbreekt er een build (bv. na een update), dan bouwt het die eerst.
set -uo pipefail

cd "$(dirname "$0")"
PORT=3000
# Binnen de Linux-omgeving checken we de server op localhost; de ChromeOS-browser opent
# 'm via penguin.linux.test (zo is GEEN poort-doorsturen nodig).
CHECK_URL="http://localhost:${PORT}"
OPEN_URL="http://penguin.linux.test:${PORT}"

# Draait de server al? Dan alleen de browser openen en klaar.
if curl -fsS "$CHECK_URL" >/dev/null 2>&1; then
  xdg-open "$OPEN_URL" >/dev/null 2>&1 || true
  exit 0
fi

# Geen productie-build aanwezig? Eerst bouwen (alleen de 1e keer of na een update).
# `npm start` bouwt namelijk bewust niet zelf en zou anders crashen.
if [ ! -f ".next/BUILD_ID" ]; then
  npm run build
fi

# Start de server op de achtergrond en wacht tot 'm reageert (max ~60s).
nohup npm start >"/tmp/eufy-viewer.log" 2>&1 &
for _ in $(seq 1 120); do
  if curl -fsS "$CHECK_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Open in de browser. Crostini stuurt http-URLs door naar Chrome op ChromeOS.
xdg-open "$OPEN_URL" >/dev/null 2>&1 || true
