// Minimal timestamped logger so the user can see exactly what the streaming layer
// is doing in the terminal (camera connect, ffmpeg command, errors, stop).
function ts() { return new Date().toISOString().slice(11, 19); }
export function log(scope, ...args) { console.log(`${ts()} [${scope}]`, ...args); }
export function logErr(scope, ...args) { console.error(`${ts()} [${scope}]`, ...args); }

// Hide credentials in rtsp://user:pass@host URLs before logging.
export function maskUrl(url) { return String(url).replace(/\/\/[^/@]+@/, '//***:***@'); }
