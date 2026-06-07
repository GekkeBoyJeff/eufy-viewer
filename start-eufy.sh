#!/usr/bin/env bash
# Wordt aangeroepen door het "Eufy Viewer"-icoon. Start de server (als die nog niet
# draait) en opent 'm in de browser. Veilig om vaker te klikken: draait de server al,
# dan opent het alleen de pagina.
set -uo pipefail

cd "$(dirname "$0")"
PORT=3000
URL="http://localhost:${PORT}"

# Draait de server al? Zo niet: start 'm op de achtergrond.
if ! curl -fsS "$URL" >/dev/null 2>&1; then
  nohup npm start >"/tmp/eufy-viewer.log" 2>&1 &
  # Wacht tot de server reageert (max ~30s).
  for _ in $(seq 1 60); do
    if curl -fsS "$URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Open in de browser. Crostini stuurt http-URLs door naar Chrome op ChromeOS.
xdg-open "$URL" >/dev/null 2>&1 || true
