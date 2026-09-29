import { KialiApiError } from '../src';
import { json, rejection, setup, target, type Call } from './helpers';

const SESSION = 'kiali-token-east=abc; Path=/kiali; HttpOnly; SameSite=Strict';

function loginResponse(...cookies: string[]): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });

  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(JSON.stringify({ username: 'system:serviceaccount:kiali', expiresOn: 'x' }), {
    headers,
  });
}

const isLogin = (call: Call) =>
  call.url.pathname.endsWith('/api/authenticate') && call.init.method === 'POST';

describe('token strategy sessions', () => {
  it('login() posts the token as a form and keeps the session cookies', async () => {
    const { client, calls } = setup(
      {},
      () => loginResponse(SESSION, 'csrf-token=c5rf; Path=/'),
      () => json([]),
    );

    await expect(client.login('sa-token')).resolves.toMatchObject({ expiresOn: 'x' });
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0]?.init.body).toBe('token=sa-token');
    expect(client.session()).toEqual({ 'kiali-token-east': 'abc', 'csrf-token': 'c5rf' });

    await client.namespaces();
    expect(calls[1]?.headers.Cookie).toBe('kiali-token-east=abc; csrf-token=c5rf');
    expect(calls[1]?.headers['X-CSRFToken']).toBeUndefined();
  });

  it('sends the CSRF token on writes', async () => {
    const { client, calls } = setup({ cookies: { 'kiali-token': 'abc', 'csrf-token': 'c5rf' } });

    await client.namespace('ns').update({ metadata: { labels: { a: 'b' } } });
    expect(calls[0]?.headers['X-CSRFToken']).toBe('c5rf');
    expect(calls[0]?.headers['Content-Type']).toBe('application/json');
    expect(calls[0]?.init.body).toBe('{"metadata":{"labels":{"a":"b"}}}');
  });

  it('logs in lazily with sessionToken, once for concurrent requests', async () => {
    const { client, calls } = setup({ sessionToken: 'sa-token' }, (call) =>
      isLogin(call) ? loginResponse(SESSION) : json([]),
    );

    await Promise.all([client.namespaces(), client.status(), client.config()]);
    expect(calls.filter(isLogin)).toHaveLength(1);
    expect(
      calls
        .filter((call) => !isLogin(call))
        .every((call) => call.headers.Cookie === 'kiali-token-east=abc'),
    ).toBe(true);
  });

  it('does not log in for auth info or healthz', async () => {
    const { client, calls } = setup({ sessionToken: 'sa-token' });

    await client.authInfo();
    await client.healthz();
    expect(calls.map(target)).toEqual(['/kiali/api/auth/info', '/kiali/healthz']);
  });

  it('logs in again once when the session expired', async () => {
    let logins = 0;
    let rejected = false;

    const { client, calls } = setup(
      { sessionToken: 'sa-token', cookies: { 'kiali-token': 'old' } },
      (call) => {
        if (isLogin(call)) {
          logins += 1;

          return loginResponse(`kiali-token=new${logins}`);
        }

        if (!rejected) {
          rejected = true;

          return json({ error: 'session expired' }, { status: 401 });
        }

        return json([]);
      },
    );

    await expect(client.namespaces()).resolves.toEqual([]);
    expect(logins).toBe(1);
    expect(calls.map((call) => call.headers.Cookie)).toEqual([
      'kiali-token=old',
      undefined,
      'kiali-token=new1',
    ]);
  });

  it('gives up after one retry', async () => {
    const { client, calls } = setup({ sessionToken: 'sa-token' }, (call) =>
      isLogin(call) ? loginResponse(SESSION) : json({ error: 'nope' }, { status: 401 }),
    );

    await expect(client.namespaces()).rejects.toBeInstanceOf(KialiApiError);
    expect(calls.filter(isLogin)).toHaveLength(2);
    expect(calls).toHaveLength(4);
  });

  it('does not retry 401s without a session token', async () => {
    const { client, calls } = setup({}, () => json({ error: 'unauthorized' }, { status: 401 }));

    await expect(client.status()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
  });

  it('propagates login failures', async () => {
    const { client } = setup({ sessionToken: 'bad' }, () =>
      json({ error: 'invalid token' }, { status: 401 }),
    );

    await expect(client.namespaces()).rejects.toMatchObject({
      status: 401,
      detail: 'invalid token',
    });
  });

  it('logout() clears cookies even when the request fails', async () => {
    const { client, calls } = setup(
      { cookies: { 'kiali-token': 'abc' } },
      () => json({ redirect_url: '/' }),
      () => Promise.reject(new TypeError('offline')),
    );

    await expect(client.logout()).resolves.toEqual({ redirect_url: '/' });
    expect(target(calls[0])).toBe('/kiali/api/logout');
    expect(client.session()).toEqual({});

    await rejection(client.login('x'));
    await expect(client.logout()).rejects.toThrow('offline');
    expect(client.session()).toEqual({});
  });

  it('removes expired cookies', async () => {
    const { client } = setup(
      { cookies: { 'kiali-token': 'abc', 'kiali-token-chunks': '2', other: 'x' } },
      () =>
        loginResponse(
          'kiali-token=; Max-Age=0',
          'kiali-token-chunks=2; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          'other=y; Expires=Fri, 01 Jan 2100 00:00:00 GMT',
          'invalid',
        ),
    );

    await client.status();
    expect(client.session()).toEqual({ other: 'y' });
  });

  it('parses a combined Set-Cookie header when getSetCookie is missing', async () => {
    const headers = new Headers();

    Object.defineProperty(headers, 'getSetCookie', { value: undefined });
    headers.set('set-cookie', 'a=1; Expires=Fri, 01 Jan 2100 00:00:00 GMT, b=2; Path=/');
    const { client } = setup(
      {},
      () => ({ ok: true, status: 200, headers, text: async () => '' }) as unknown as Response,
    );

    await client.status();
    expect(client.session()).toEqual({ a: '1', b: '2' });
  });
});
