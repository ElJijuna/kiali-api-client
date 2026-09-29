import { KialiApiError, KialiClient, type RequestEvent } from '../src';
import { json, rejection, setup, target } from './helpers';

describe('KialiClient configuration', () => {
  it('requires a baseUrl', () => {
    expect(() => new KialiClient({ baseUrl: '' })).toThrow(TypeError);
  });

  it.each([
    [undefined, '/kiali/api/status'],
    ['/custom/', '/custom/api/status'],
    ['custom', '/custom/api/status'],
    ['', '/api/status'],
    ['/', '/api/status'],
  ])('resolves webRoot %p', async (webRoot, path) => {
    const { client, calls } = setup({ baseUrl: 'https://kiali.example.com/', webRoot });

    await client.status();
    expect(calls[0]?.url.pathname).toBe(path);
  });

  it('sends Accept, custom headers and the bearer token', async () => {
    const { client, calls } = setup({ token: 't0k3n', headers: { 'X-Team': 'mesh' } });

    await client.config();
    expect(calls[0]?.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer t0k3n',
      'X-Team': 'mesh',
    });
    client.setToken(undefined);
    await client.config();
    expect(calls[1]?.headers.Authorization).toBeUndefined();
  });

  it('passes the credentials mode to fetch', async () => {
    const { client, calls } = setup({ credentials: 'include' });

    await client.status();
    expect(calls[0]?.init.credentials).toBe('include');
  });

  it('uses the global fetch when none is given, resolved at call time', async () => {
    const original = globalThis.fetch;
    const mock = jest.fn(async () => json({ status: {} }));

    globalThis.fetch = mock as unknown as typeof fetch;

    try {
      await new KialiClient({ baseUrl: 'http://localhost:20001', webRoot: '' }).status();
      expect(mock).toHaveBeenCalledWith('http://localhost:20001/api/status', expect.any(Object));
    } finally {
      globalThis.fetch = original;
    }
  });

  it('aborts requests that exceed the timeout', async () => {
    const { client } = setup(
      { timeout: 10 },
      ({ init }) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    await expect(client.status()).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('combines the caller signal with the timeout', async () => {
    const { client } = setup(
      { timeout: 60_000 },
      ({ init }) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const controller = new AbortController();
    const pending = client.status({ signal: controller.signal });

    controller.abort(new Error('cancelled'));
    await expect(pending).rejects.toThrow('cancelled');
  });
});

describe('KialiClient.fromEnv', () => {
  it('reads the KIALI_* variables', async () => {
    const { calls, fetch } = setup();
    const client = KialiClient.fromEnv(
      {
        KIALI_URL: 'https://env.example.com',
        KIALI_WEB_ROOT: '/',
        KIALI_TOKEN: 'env-token',
        KIALI_CLUSTER: 'east',
        KIALI_TIMEOUT: '5000',
      },
      { fetch: fetch as unknown as typeof globalThis.fetch },
    );

    await client.namespace('bookinfo').info();
    expect(calls[0]?.url.origin).toBe('https://env.example.com');
    expect(target(calls[0])).toBe('/api/namespaces/bookinfo/info?clusterName=east');
    expect(calls[0]?.headers.Authorization).toBe('Bearer env-token');
  });

  it('defaults to process.env and lets overrides win', () => {
    process.env.KIALI_URL = 'https://process.example.com';

    try {
      expect(() => KialiClient.fromEnv()).not.toThrow();
      expect(() => KialiClient.fromEnv({}, { baseUrl: 'https://x.example.com' })).not.toThrow();
    } finally {
      delete process.env.KIALI_URL;
    }
  });

  it('throws without KIALI_URL', () => {
    expect(() => KialiClient.fromEnv({})).toThrow(/KIALI_URL/);
  });
});

describe('errors', () => {
  it('throws KialiApiError with the Kiali error body', async () => {
    const { client } = setup({}, () =>
      json(
        { error: 'Namespace not found', detail: 'namespaces "nope" not found' },
        { status: 404 },
      ),
    );
    const error = await rejection(client.namespace('nope').info());

    expect(error).toBeInstanceOf(KialiApiError);
    expect(error).toMatchObject({
      status: 404,
      detail: 'Namespace not found: namespaces "nope" not found',
      request: { method: 'GET', url: 'https://kiali.example.com/kiali/api/namespaces/nope/info' },
    });
    expect((error as Error).message).toBe(
      'Kiali API error: 404 — Namespace not found: namespaces "nope" not found',
    );
  });

  it.each([
    ['plain text', 'upstream timeout', 'upstream timeout'],
    ['HTML page', '<html>Bad Gateway</html>', undefined],
    ['empty body', '', undefined],
    ['message field', JSON.stringify({ message: 'forbidden' }), 'forbidden'],
    ['long text', 'x'.repeat(400), `${'x'.repeat(300)}…`],
    ['JSON without reason', JSON.stringify({ code: 1 }), undefined],
    ['JSON null', 'null', undefined],
  ])('extracts the detail from a %s', async (_, body, detail) => {
    const { client } = setup(
      {},
      () => new Response(body, { status: 502, statusText: 'Bad Gateway' }),
    );
    const error = (await rejection(client.status())) as KialiApiError;

    expect(error.detail).toBe(detail);
    expect(error.message.startsWith('Kiali API error: 502 Bad Gateway')).toBe(true);
  });

  it('keeps fetch errors as they are', async () => {
    const failure = new TypeError('fetch failed');
    const { client } = setup({}, () => Promise.reject(failure));

    await expect(client.status()).rejects.toBe(failure);
  });
});

describe('request events', () => {
  it('emits once per request and isolates failing listeners', async () => {
    const { client } = setup(
      {},
      () => json({}),
      () => json({ error: 'boom' }, { status: 500 }),
    );
    const events: RequestEvent[] = [];

    client.on('request', () => {
      throw new Error('sync listener');
    });
    client.on('request', async () => {
      throw new Error('async listener');
    });
    client.on('request', (event) => {
      events.push(event);
    });

    await client.status();
    await expect(client.status()).rejects.toBeInstanceOf(KialiApiError);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ method: 'GET', statusCode: 200 });
    expect(events[0]?.error).toBeUndefined();
    expect(events[1]).toMatchObject({ statusCode: 500, error: expect.any(KialiApiError) });
    expect(events[1]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('stops emitting after off()', async () => {
    const { client } = setup();
    const listener = jest.fn();

    client.on('request', listener);
    await client.status();
    client.off('request', listener);
    client.off('request', listener);
    await client.status();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('server endpoints', () => {
  it.each([
    ['status', (c: KialiClient) => c.status(), '/kiali/api/status'],
    ['authInfo', (c: KialiClient) => c.authInfo(), '/kiali/api/auth/info'],
    ['config', (c: KialiClient) => c.config(), '/kiali/api/config'],
    ['grafana', (c: KialiClient) => c.grafana(), '/kiali/api/grafana'],
    ['perses', (c: KialiClient) => c.perses(), '/kiali/api/perses'],
    ['namespaces', (c: KialiClient) => c.namespaces(), '/kiali/api/namespaces'],
    ['refreshSession', (c: KialiClient) => c.refreshSession(), '/kiali/api/authenticate'],
    ['istio.status', (c: KialiClient) => c.istio.status(), '/kiali/api/istio/status'],
    [
      'mesh.controlPlanes',
      (c: KialiClient) => c.mesh.controlPlanes(),
      '/kiali/api/mesh/controlplanes',
    ],
    [
      'mesh.graph',
      (c: KialiClient) => c.mesh.graph({ includeGateways: true }),
      '/kiali/api/mesh/graph?includeGateways=true',
    ],
    ['tracing.info', (c: KialiClient) => c.tracing.info(), '/kiali/api/tracing'],
    ['tracing.trace', (c: KialiClient) => c.tracing.trace('abc/1'), '/kiali/api/traces/abc%2F1'],
  ])('%s never sends the default cluster', async (_, call, path) => {
    const { client, calls } = setup({ cluster: 'east' });

    await call(client);
    expect(`${calls[0]?.url.pathname}${calls[0]?.url.search}`).toBe(path);
  });

  it('healthz resolves against the web root and ignores the body', async () => {
    const { client, calls } = setup({}, () => new Response('ok'));

    await expect(client.healthz()).resolves.toBeUndefined();
    expect(target(calls[0])).toBe('/kiali/healthz');
  });

  it('returns undefined for empty JSON responses', async () => {
    const { client } = setup({}, () => new Response(null, { status: 204 }));

    await expect(client.namespaces()).resolves.toBeUndefined();
  });
});

describe('cluster-wide endpoints', () => {
  it('lists services with namespaces, options and the default cluster', async () => {
    const { client, calls } = setup({ cluster: 'east' });

    await client.services({
      namespaces: ['bookinfo', 'istio-system'],
      health: false,
      onlyDefinitions: true,
      rateInterval: '10m',
    });
    expect(target(calls[0])).toBe(
      '/kiali/api/clusters/services?health=false&onlyDefinitions=true&rateInterval=10m&namespaces=bookinfo,istio-system&clusterName=east',
    );
  });

  it('lets the call override the default cluster', async () => {
    const { client, calls } = setup({ cluster: 'east' });

    await client.workloads({ namespaces: 'bookinfo', cluster: 'west' });
    await client.apps();
    expect(target(calls[0])).toBe(
      '/kiali/api/clusters/workloads?namespaces=bookinfo&clusterName=west',
    );
    expect(target(calls[1])).toBe('/kiali/api/clusters/apps?clusterName=east');
  });

  it('omits clusterName when there is no cluster', async () => {
    const { client, calls } = setup();

    await client.apps();
    expect(target(calls[0])).toBe('/kiali/api/clusters/apps');
  });

  it('gets health, tls and metrics', async () => {
    const { client, calls } = setup();

    await client.health({ namespaces: ['a', 'b'], type: 'app', queryTime: 1700000000 });
    await client.tls({ namespaces: ['a'] });
    await client.metrics({
      namespaces: ['a'],
      filters: ['request_count', 'tcp_sent'],
      duration: 60,
    });
    expect(target(calls[0])).toBe(
      '/kiali/api/clusters/health?type=app&queryTime=1700000000&namespaces=a,b',
    );
    expect(target(calls[1])).toBe('/kiali/api/clusters/tls?namespaces=a');
    expect(target(calls[2])).toBe(
      '/kiali/api/clusters/metrics?duration=60&filters[]=request_count&filters[]=tcp_sent&namespaces=a',
    );
  });

  it('builds the namespaces graph query', async () => {
    const { client, calls } = setup({ cluster: 'east' });

    await client.graph({
      namespaces: ['bookinfo'],
      graphType: 'versionedApp',
      duration: '600s',
      appenders: ['deadNode', 'responseTime'],
      boxBy: ['cluster', 'namespace'],
      injectServiceNodes: true,
    });
    await client.graph({ namespaces: 'a,b', appenders: 'deadNode', boxBy: 'app' });
    expect(target(calls[0])).toBe(
      '/kiali/api/namespaces/graph?graphType=versionedApp&duration=600s&injectServiceNodes=true&appenders=deadNode,responseTime&boxBy=cluster,namespace&namespaces=bookinfo',
    );
    expect(target(calls[1])).toBe(
      '/kiali/api/namespaces/graph?appenders=deadNode&boxBy=app&namespaces=a,b',
    );
  });

  it('queries istio config, validations and permissions', async () => {
    const { client, calls } = setup();

    await client.istio.config({
      namespaces: ['bookinfo'],
      validate: true,
      objects: [
        { group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' },
        'gateway.networking.k8s.io/v1, Kind=HTTPRoute',
      ],
    });
    await client.istio.validations({ namespaces: ['a', 'b'], cluster: 'west' });
    await client.istio.permissions({ namespaces: 'a' });
    await client.istio.config();
    expect(calls[0]?.url.pathname).toBe('/kiali/api/istio/config');
    expect(calls[0]?.url.searchParams.get('objects')).toBe(
      'networking.istio.io/v1, Kind=VirtualService;gateway.networking.k8s.io/v1, Kind=HTTPRoute',
    );
    expect(calls[0]?.url.searchParams.get('validate')).toBe('true');
    expect(calls[0]?.url.searchParams.get('namespaces')).toBe('bookinfo');
    expect(target(calls[1])).toBe('/kiali/api/istio/validations?namespaces=a,b&clusterName=west');
    expect(target(calls[2])).toBe('/kiali/api/istio/permissions?namespaces=a');
    expect(target(calls[3])).toBe('/kiali/api/istio/config');
  });

  it('gets the mesh tls for a revision', async () => {
    const { client, calls } = setup({ cluster: 'east' });

    await client.mesh.tls({ revision: 'canary' });
    expect(target(calls[0])).toBe('/kiali/api/mesh/tls?revision=canary&clusterName=east');
  });
});
