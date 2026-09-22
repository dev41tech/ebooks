// Isolated test adapter. Never imported by the application.
export const env = {};
export const identity = { email: null, cookie: "" };
export async function headers() { const h = new Headers(identity.email ? { 'oai-authenticated-user-email': identity.email } : {}); if(identity.cookie)h.set("cookie",identity.cookie);return h; }
export function redirect() { throw new Error('unexpected_redirect'); }
