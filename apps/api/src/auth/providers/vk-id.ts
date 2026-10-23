// VK ID (OAuth 2.1 + PKCE) for apps created in the VK ID cabinet; port of api/src/Services/VkId.php and the
// vkontakte branch of OAuthUserInfoListener. The app is a public client: `secret` is any random string, used
// only to derive the PKCE code_verifier from the state, so nothing beyond the state has to be kept in the cookie.
// Docs: https://id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/start-integration/auth-without-sdk/auth-without-sdk-web
import { createHash, createHmac } from 'node:crypto';

import {
  OAuthError,
  type AuthorizationRequest,
  type CallbackRequest,
  type OAuthIdentity,
  type OAuthProvider,
} from '../oauth.js';
import { base64Url, postForm, str, type FetchLike } from './http.js';

const AUTHORIZE_URL = 'https://id.vk.ru/authorize';
const TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';

export interface VkIdOptions {
  clientId: string;
  secret: string;
  fetch?: FetchLike;
}

export class VkIdProvider implements OAuthProvider {
  private readonly fetch: FetchLike;

  constructor(private readonly options: VkIdOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  authorizationUrl({ state, redirectUri }: AuthorizationRequest): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.options.clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: base64Url(createHash('sha256').update(this.codeVerifier(state)).digest()),
      code_challenge_method: 'S256',
      scope: 'vkid.personal_info',
    }).toString();
    return url.toString();
  }

  async fetchIdentity({ query, state, redirectUri }: CallbackRequest): Promise<OAuthIdentity> {
    // the redirect flow returns code/state/device_id as query params, the SDK flow as JSON in `payload`
    let params: Record<string, unknown> = query;
    if (typeof query.payload === 'string') {
      try {
        params = { ...query, ...(JSON.parse(query.payload) as Record<string, unknown>) };
      } catch {
        throw new OAuthError('params', 'VK ID payload is not JSON');
      }
    }
    const code = str(params.code);
    const deviceId = str(params.device_id);
    if (!code || !deviceId) throw new OAuthError('params', 'VK ID callback is missing code or device_id');

    const token = await postForm(this.fetch, TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      code_verifier: this.codeVerifier(state),
      client_id: this.options.clientId,
      device_id: deviceId,
      redirect_uri: redirectUri,
      state,
    });
    const accessToken = str(token.access_token);
    if (!accessToken) throw new OAuthError('provider', 'VK ID returned no access_token');

    // VK ID's own endpoints take the user token as a form field
    const info = await postForm(this.fetch, USER_INFO_URL, {
      access_token: accessToken,
      client_id: this.options.clientId,
    });
    const user = info.user;
    if (!user || typeof user !== 'object') throw new OAuthError('provider', 'VK ID user_info has no user');
    return vkIdentity(user as Record<string, unknown>);
  }

  private codeVerifier(state: string): string {
    return base64Url(createHmac('sha256', this.options.secret).update(state).digest());
  }
}

// oauth2/user_info `user` → identity, as the PHP listener mapped it: "first last", sex 1/2 → female/male.
export function vkIdentity(user: Record<string, unknown>): OAuthIdentity {
  const id = str(user.user_id);
  if (!id) throw new OAuthError('provider', 'VK ID user_info has no user_id');
  const first = str(user.first_name);
  const last = str(user.last_name);
  const sex = Number(user.sex);
  return {
    id,
    username: first + (first && last ? ' ' : '') + last,
    avatar: str(user.avatar) || null,
    gender: sex === 1 ? 'female' : sex === 2 ? 'male' : null,
  };
}
