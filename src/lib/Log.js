// Small timestamped logger. Also keeps the last lines in memory so the browser's
// debug panel can show what the server is doing (connecting, streams, restarts).
const time = () => new Date().toISOString().slice(11, 19);

// Shared across the custom server and the API routes (survives Next's hot-reload).
const buffer = (globalThis.__eufyLog ??= []);
const remember = (line) => {
  buffer.push(line);
  if (buffer.length > 300) {
    buffer.shift();
  }
};
const format = (scope, args) =>
  `${time()} [${scope}] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;

export const log = (scope, ...args) => {
  const line = format(scope, args);
  remember(line);
  console.log(line);
};
export const logErr = (scope, ...args) => {
  const line = format(scope, args);
  remember(line);
  console.error(line);
};
export const getRecentLogs = () => buffer.slice();
export const clearLogs = () => {
  buffer.length = 0;
};

// Hide the password in an rtsp://user:pass@host URL before logging it.
export const maskUrl = (url) => String(url).replace(/\/\/[^/@]+@/, '//***:***@');
