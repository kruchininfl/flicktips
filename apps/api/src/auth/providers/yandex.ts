// Yandex ID (oauth.yandex.ru, authorization code flow with a client secret); port of api/src/Services/Yandex.php
// and the yandex branch of OAuthUserInfoListener. The app needs the "login, name, gender" and "avatar"
// permissions in the oauth.yandex.ru cabinet; login.yandex.ru/info returns only what they grant.
// Docs: https://yandex.ru/dev/id/doc/ru/codes/code-url
import {
  OAuthError,
  type AuthorizationRequest,
  type CallbackRequest,
  type OAuthIdentity,
  type OAuthProvider,
} from '../oauth.js';
import { getJson, postForm, str, type FetchLike } from './http.js';

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';
const USER_INFO_URL = 'https://login.yandex.ru/info?format=json';

export interface YandexOptions {
  clientId: string;
  secret: string;
  fetch?: FetchLike;
}

export class YandexProvider implements OAuthProvider {
  private readonly fetch: FetchLike;

  constructor(private readonly options: YandexOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  authorizationUrl({ state, redirectUri }: AuthorizationRequest): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.options.clientId,
      redirect_uri: redirectUri,
      state,
    }).toString();
    return url.toString();
  }

  async fetchIdentity({ query }: CallbackRequest): Promise<OAuthIdentity> {
    const code = str(query.code);
    if (!code) throw new OAuthError('params', 'Yandex ID callback is missing code');

    const token = await postForm(this.fetch, TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      client_id: this.options.clientId,
      client_secret: this.options.secret,
    });
    const accessToken = str(token.access_token);
    if (!accessToken) throw new OAuthError('provider', 'Yandex ID returned no access_token');

    const info = await getJson(this.fetch, USER_INFO_URL, { authorization: `OAuth ${accessToken}` });
    return yandexIdentity(info);
  }
}

// login.yandex.ru/info → identity, as the PHP listener mapped it.
export function yandexIdentity(info: Record<string, unknown>): OAuthIdentity {
  const id = str(info.id);
  if (!id) throw new OAuthError('provider', 'Yandex ID info has no id');
  const username = [info.real_name, info.display_name, info.login].map(str).find(Boolean) ?? '';
  const sex = info.sex;
  const avatarId = str(info.default_avatar_id);
  return {
    id,
    username,
    avatar: info.is_avatar_empty || !avatarId ? null : `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`,
    gender: sex === 'male' || sex === 'female' ? sex : null,
  };
}
