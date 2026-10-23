import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { OAuthError } from '../oauth.js';
import { VkIdProvider, vkIdentity } from './vk-id.js';
import { YandexProvider, yandexIdentity } from './yandex.js';

// A fetch that answers from a script of {url substring → body} and records the requests it got.
function scriptedFetch(script: Record<string, unknown>, status = 200) {
  const calls: { url: string; init: RequestInit; form: URLSearchParams | null }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init, form: typeof init.body === 'string' ? new URLSearchParams(init.body) : null });
    const key = Object.keys(script).find((k) => url.includes(k));
    if (!key) return new Response('not found', { status: 404 });
    const body = script[key];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const request = { state: 'a'.repeat(48), redirectUri: 'https://flicktips.ru/auth/vkontakte/callback' };

describe('VkIdProvider', () => {
  it('builds the authorization URL with a PKCE challenge derived from the state', () => {
    const provider = new VkIdProvider({ clientId: '123', secret: 'pepper' });
    const url = new URL(provider.authorizationUrl(request));
    expect(url.origin + url.pathname).toBe('https://id.vk.ru/authorize');
    const verifier = createHmac('sha256', 'pepper').update(request.state).digest('base64url');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: '123',
      redirect_uri: request.redirectUri,
      state: request.state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      scope: 'vkid.personal_info',
    });
  });

  it('exchanges the code with the matching verifier and reads user_info', async () => {
    const { fetchImpl, calls } = scriptedFetch({
      'oauth2/auth': { access_token: 'tok', expires_in: 3600 },
      'oauth2/user_info': {
        user: { user_id: 42, first_name: 'Анна', last_name: 'Иванова', sex: 1, avatar: 'https://a/b.jpg' },
      },
    });
    const provider = new VkIdProvider({ clientId: '123', secret: 'pepper', fetch: fetchImpl });
    const identity = await provider.fetchIdentity({
      ...request,
      query: { code: 'c0de', state: request.state, device_id: 'dev' },
    });
    expect(identity).toEqual({ id: '42', username: 'Анна Иванова', avatar: 'https://a/b.jpg', gender: 'female' });

    expect(calls[0]!.url).toBe('https://id.vk.ru/oauth2/auth');
    expect(Object.fromEntries(calls[0]!.form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c0de',
      code_verifier: createHmac('sha256', 'pepper').update(request.state).digest('base64url'),
      client_id: '123',
      device_id: 'dev',
      redirect_uri: request.redirectUri,
      state: request.state,
    });
    expect(calls[1]!.url).toBe('https://id.vk.ru/oauth2/user_info');
    expect(Object.fromEntries(calls[1]!.form!)).toEqual({ access_token: 'tok', client_id: '123' });
  });

  it('accepts the SDK flow payload and fails cleanly on provider errors', async () => {
    const ok = scriptedFetch({
      'oauth2/auth': { access_token: 'tok' },
      'oauth2/user_info': { user: { user_id: '7', first_name: 'Solo' } },
    });
    const provider = new VkIdProvider({ clientId: '123', secret: 'pepper', fetch: ok.fetchImpl });
    const payload = JSON.stringify({ code: 'x', device_id: 'd', state: request.state });
    expect(await provider.fetchIdentity({ ...request, query: { payload } })).toEqual({
      id: '7',
      username: 'Solo',
      avatar: null,
      gender: null,
    });

    await expect(provider.fetchIdentity({ ...request, query: { code: 'x' } })).rejects.toMatchObject({
      code: 'params',
    });

    const failing = scriptedFetch({ 'oauth2/auth': { error: 'invalid_grant', error_description: 'expired' } }, 400);
    const bad = new VkIdProvider({ clientId: '123', secret: 'pepper', fetch: failing.fetchImpl });
    const error = await bad.fetchIdentity({ ...request, query: { code: 'x', device_id: 'd' } }).catch((e) => e);
    expect(error).toBeInstanceOf(OAuthError);
    expect(error.code).toBe('provider');
    expect(error.message).toContain('invalid_grant');
  });

  it('maps user_info like the PHP listener', () => {
    expect(vkIdentity({ user_id: 1, first_name: 'A', sex: 2 })).toEqual({
      id: '1',
      username: 'A',
      avatar: null,
      gender: 'male',
    });
    expect(vkIdentity({ user_id: 1, last_name: 'B', sex: 0 })).toMatchObject({ username: 'B', gender: null });
    expect(() => vkIdentity({})).toThrow(OAuthError);
  });
});

describe('YandexProvider', () => {
  it('builds the authorization URL', () => {
    const provider = new YandexProvider({ clientId: 'cid', secret: 'sec' });
    const url = new URL(
      provider.authorizationUrl({ ...request, redirectUri: 'https://flicktips.ru/auth/yandex/callback' }),
    );
    expect(url.origin + url.pathname).toBe('https://oauth.yandex.ru/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'cid',
      redirect_uri: 'https://flicktips.ru/auth/yandex/callback',
      state: request.state,
    });
  });

  it('exchanges the code with the client secret and reads login.yandex.ru/info', async () => {
    const { fetchImpl, calls } = scriptedFetch({
      'oauth.yandex.ru/token': { access_token: 'ya-tok', token_type: 'bearer' },
      'login.yandex.ru/info': {
        id: '555',
        login: 'ivan',
        real_name: 'Иван',
        sex: 'male',
        default_avatar_id: '0/0-0',
        is_avatar_empty: false,
      },
    });
    const provider = new YandexProvider({ clientId: 'cid', secret: 'sec', fetch: fetchImpl });
    const identity = await provider.fetchIdentity({ ...request, query: { code: 'c', state: request.state } });
    expect(identity).toEqual({
      id: '555',
      username: 'Иван',
      avatar: 'https://avatars.yandex.net/get-yapic/0/0-0/islands-200',
      gender: 'male',
    });
    expect(Object.fromEntries(calls[0]!.form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      client_id: 'cid',
      client_secret: 'sec',
    });
    expect(calls[1]!.url).toBe('https://login.yandex.ru/info?format=json');
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBe('OAuth ya-tok');
  });

  it('maps info like the PHP listener', () => {
    expect(yandexIdentity({ id: 1, display_name: 'disp', login: 'lg' })).toEqual({
      id: '1',
      username: 'disp',
      avatar: null,
      gender: null,
    });
    expect(
      yandexIdentity({ id: '2', login: 'lg', sex: 'other', default_avatar_id: 'x', is_avatar_empty: true }),
    ).toMatchObject({
      username: 'lg',
      avatar: null,
      gender: null,
    });
    expect(() => yandexIdentity({ login: 'x' })).toThrow(OAuthError);
  });
});
