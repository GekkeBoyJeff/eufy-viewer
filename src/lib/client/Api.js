// Small helper to call a named setup action and get JSON back.
export const postSetup = (action, body = {}) =>
  fetch('/api/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  }).then((r) => r.json());
