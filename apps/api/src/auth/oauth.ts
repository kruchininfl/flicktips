// Sign-in providers behind a small interface, so the routes never talk to VK ID / Yandex ID directly and tests
// can plug in fakes. Real implementations: ./providers/vk-id.ts, ./providers/yandex.ts.

import { LOGIN_SERVICES, type LoginService } from '../repositories/users.js';

export { LOGIN_SERVICES, type LoginService };

export function isLoginService(value: unknown): value is LoginService {
  return typeof value === 'string' && (LOGIN_SERVICES as readonly string[]).includes(value);
}

// What the PHP OAuthUserInfoListener produced as `userInfo`: the provider account mapped onto `user` columns.
export interface OAuthIdentity {
  // account id at the provider, stored in user.<service>_id (varchar)
  id: string;
  username: string;
  // user.avatar_source
  avatar: string | null;
  gender: 'male' | 'female' | null;
}

export interface AuthorizationRequest {
  // random state (hex) stored in the login cookie; also seeds the PKCE verifier for VK ID
  state: string;
  // exact callback URL registered in the provider's cabinet
  redirectUri: string;
}

export interface CallbackRequest extends AuthorizationRequest {
  // the query string of the callback, as the provider sent it
  query: Record<string, string>;
}

// Raised for anything the provider or the user did wrong (denied access, bad code, HTTP errors). The route
// turns it into a redirect with ?error=; everything else stays a 500.
export class OAuthError extends Error {
  constructor(
    // short code that ends up in the redirect URL
    readonly code: 'denied' | 'provider' | 'params',
    message: string,
  ) {
    super(message);
  }
}

export interface OAuthProvider {
  // where to send the browser to sign in
  authorizationUrl(request: AuthorizationRequest): string;
  // exchanges the callback for the account's identity (token request + profile request)
  fetchIdentity(request: CallbackRequest): Promise<OAuthIdentity>;
}

export type OAuthProviders = Record<LoginService, OAuthProvider>;
