// Small timestamped logger so the terminal shows what the streaming layer is doing.
const time = () => new Date().toISOString().slice(11, 19);

export const log = (scope, ...args) => console.log(`${time()} [${scope}]`, ...args);
export const logErr = (scope, ...args) => console.error(`${time()} [${scope}]`, ...args);

// Hide the password in an rtsp://user:pass@host URL before logging it.
export const maskUrl = (url) => String(url).replace(/\/\/[^/@]+@/, '//***:***@');
