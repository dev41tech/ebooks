// Isolated test adapter. Never imported by the application.
export const env = {};
export const identity = { email: null };
export async function headers() { return new Headers(identity.email ? { 'oai-authenticated-user-email': identity.email } : {}); }
export function redirect() { throw new Error('unexpected_redirect'); }
