export interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  role: string;
}

export function decodeAccessToken(token: string): AccessTokenPayload {
  const payload = token.split('.')[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(base64);
  return JSON.parse(json) as AccessTokenPayload;
}
