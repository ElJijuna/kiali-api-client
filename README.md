# kiali-api-client

[![CI](https://github.com/ElJijuna/kiali-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/ElJijuna/kiali-api-client/actions/workflows/ci.yml)
[![Release](https://github.com/ElJijuna/kiali-api-client/actions/workflows/release.yml/badge.svg)](https://github.com/ElJijuna/kiali-api-client/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/kiali-api-client)](https://www.npmjs.com/package/kiali-api-client)
[![npm downloads](https://img.shields.io/npm/dm/kiali-api-client)](https://www.npmjs.com/package/kiali-api-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/node/v/kiali-api-client)](https://nodejs.org/)
[![semantic-release](https://img.shields.io/badge/release-semantic--release-e10079?logo=semantic-release&logoColor=white)](https://semantic-release.gitbook.io/semantic-release/)

TypeScript client for the [Kiali](https://kiali.io) REST API, the observability console for the
Istio service mesh. Namespaces, services, workloads, apps, health, metrics, traffic graphs, Istio
config, mTLS status, traces and pod logs, through one typed, chainable API.

- Fully typed, zero runtime dependencies, ESM and CommonJS.
- Works with Kiali 2.x, including multi-cluster meshes.
- Supports the `token`, `header` and `anonymous` auth strategies, with automatic session renewal.
- Configurable: web root, default cluster, headers, timeout, custom `fetch`, or environment
  variables.

API documentation: <https://eljijuna.github.io/kiali-api-client>

## Installation

```bash
npm install kiali-api-client
```

Requires Node.js 20 or newer (or any runtime with `fetch`).

### GitHub Packages

Every release is also published to GitHub Packages as `@eljijuna/kiali-api-client`. GitHub
Packages requires authentication even for public packages, so add a token with the
`read:packages` scope to your `.npmrc`:

```ini
@eljijuna:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install it under an alias so imports stay the same:

```bash
npm install kiali-api-client@npm:@eljijuna/kiali-api-client
```

## Quick start

```typescript
import { KialiClient } from 'kiali-api-client';

const kiali = new KialiClient({
  baseUrl: 'https://kiali.example.com',
  sessionToken: process.env.K8S_TOKEN, // `token` auth strategy
});

const namespaces = await kiali.namespaces();
const { services } = await kiali.services({ namespaces: ['bookinfo'] });
const reviews = await kiali.namespace('bookinfo').service('reviews');
const graph = await kiali.graph({ namespaces: ['bookinfo'], graphType: 'versionedApp' });
```

## Configuration

```typescript
const kiali = new KialiClient({
  baseUrl: 'https://kiali.example.com', // scheme, host and port
  webRoot: '/kiali',                    // server.web_root; '' when served at the root
  sessionToken: '...',                  // token strategy: exchanged for a session cookie
  token: '...',                         // header strategy: sent as Authorization: Bearer
  cookies: { 'kiali-token': '...' },    // resume a previous session
  cluster: 'east',                      // default cluster for cluster-scoped endpoints
  headers: { 'X-Team': 'mesh' },        // extra headers on every request
  timeout: 10_000,                      // milliseconds
  credentials: 'include',               // browsers: send Kiali's cookies
  fetch: customFetch,                   // any fetch-compatible function
});
```

| Option | Default | Description |
| --- | --- | --- |
| `baseUrl` | — (required) | Scheme, host and port of the Kiali server |
| `webRoot` | `'/kiali'` | Path Kiali is served under. Use `''` for OpenShift and other root installs |
| `sessionToken` | — | Kubernetes token for the `token` strategy. Logged in lazily, renewed on 401 |
| `token` | — | Bearer token for the `header` strategy or an authenticating proxy |
| `cookies` | — | Initial session cookies, e.g. from `kiali.session()` |
| `cluster` | — | Default `clusterName`, only sent to endpoints that accept it |
| `headers` | — | Extra headers sent on every request |
| `timeout` | none | Request timeout in milliseconds |
| `credentials` | — | `fetch` credentials mode, for browsers |
| `fetch` | global `fetch` | Custom transport (proxies, mTLS agents, testing) |

### From environment variables

```typescript
const kiali = KialiClient.fromEnv(); // reads process.env
const kiali = KialiClient.fromEnv(process.env, { timeout: 5000 }); // with overrides
```

| Variable | Option |
| --- | --- |
| `KIALI_URL` | `baseUrl` (required) |
| `KIALI_WEB_ROOT` | `webRoot` |
| `KIALI_SESSION_TOKEN` | `sessionToken` |
| `KIALI_TOKEN` | `token` |
| `KIALI_CLUSTER` | `cluster` |
| `KIALI_TIMEOUT` | `timeout` |

### Multi-cluster

Kiali rejects query parameters an endpoint does not declare, so the client sends the default
`cluster` only to cluster-scoped endpoints. Override it per call:

```typescript
const kiali = new KialiClient({ baseUrl, sessionToken, cluster: 'east' });

await kiali.services();                                  // clusterName=east
await kiali.services({ cluster: 'west' });               // clusterName=west
await kiali.namespace('bookinfo').workload('reviews-v1'); // clusterName=east
await kiali.namespaces();                                // all clusters, no clusterName
```

## Authentication

| Kiali strategy | Client setup |
| --- | --- |
| `anonymous` | Nothing to configure |
| `token` | `sessionToken: '<k8s token>'`, or `await kiali.login('<k8s token>')` |
| `header` | `token: '<k8s token>'` (sent as `Authorization: Bearer`) |
| `openid`, `openshift` | Pass the session cookies from a browser login with `cookies`, or use `token` when Kiali accepts bearer tokens |

With `sessionToken`, the client logs in before the first request (concurrent requests share one
login), sends the session cookies and Kiali's CSRF token, and logs in again once when a request
returns `401`.

```typescript
const session = await kiali.login(token); // POST /api/authenticate
const cookies = kiali.session();          // persist and pass back later as `cookies`
await kiali.refreshSession();             // GET /api/authenticate
await kiali.logout();                     // GET /api/logout, clears local cookies
```

Browsers cannot read `Set-Cookie`; when calling Kiali from a page on its origin, use
`credentials: 'include'` and let the browser keep the session.

## API reference

Resources that represent a single object can be awaited directly, or chained.

### Server

```typescript
await kiali.healthz();    // GET /healthz, resolves on 2xx
await kiali.status();     // version, state, external services
await kiali.authInfo();   // auth strategy and session
await kiali.config();     // server configuration and clusters
await kiali.grafana();    // Grafana links
await kiali.perses();     // Perses links
```

### Cluster-wide lists

```typescript
await kiali.namespaces();
await kiali.services({ namespaces: ['bookinfo'], health: true, onlyDefinitions: false });
await kiali.workloads({ namespaces: ['bookinfo'], istioResources: true });
await kiali.apps({ namespaces: ['bookinfo'], rateInterval: '10m' });
await kiali.health({ namespaces: ['bookinfo'], type: 'service' });
await kiali.tls({ namespaces: ['bookinfo'] });
await kiali.metrics({ namespaces: ['bookinfo'], filters: ['request_count'], duration: 600 });
```

### Traffic graph

```typescript
const graph = await kiali.graph({
  namespaces: ['bookinfo', 'istio-system'],
  graphType: 'versionedApp', // 'app' | 'versionedApp' | 'workload' | 'service'
  duration: '600s',
  appenders: ['deadNode', 'responseTime', 'securityPolicy', 'serviceEntry'],
  boxBy: ['cluster', 'namespace'],
  injectServiceNodes: true,
});

graph.elements.nodes?.forEach(({ data }) => console.log(data.nodeType, data.app ?? data.service));
```

Node graphs are on each resource: `service(...).graph()`, `workload(...).graph()`,
`app(...).graph({ version: 'v2' })` and `namespace(...).aggregateGraph(...)`.

### Namespace

```typescript
const ns = kiali.namespace('bookinfo');

await ns;                          // namespace info (same as ns.info())
await ns.update({ metadata: { labels: { 'istio-injection': 'enabled' } } });
await ns.health();
await ns.tls();
await ns.validations();
await ns.metrics({ duration: 600, direction: 'inbound' });
await ns.controlPlaneMetrics('istiod');
await ns.customDashboard('envoy');
await ns.ztunnelDashboard('ztunnel');
await ns.aggregateMetrics('request_operation', 'GetReviews');
```

### Services, workloads and apps

```typescript
const svc = kiali.namespace('bookinfo').service('reviews');

await svc;                                   // details, health, Istio objects
await svc.get({ validate: true, rateInterval: '5m' });
await svc.metrics({ duration: 600, step: 15, reporter: 'destination', quantiles: ['0.95'] });
await svc.dashboard();
await svc.graph();
await svc.traces({ limit: 20, tags: { error: 'true' } });
await svc.spans();
await svc.update({ metadata: { labels: { team: 'mesh' } } });

const wl = kiali.namespace('bookinfo').workload('reviews-v1');

await wl;
await wl.update({ spec: { replicas: 2 } }); // Deployment by default
await wl.update(patch, { gvk: { group: 'apps', version: 'v1', kind: 'StatefulSet' } });

const app = kiali.namespace('bookinfo').app('reviews');

await app;
await app.graph({ version: 'v2' });
await app.errorTraces({ duration: 600 }); // number of traces with errors
```

`workload()` and `app()` have the same `metrics`, `dashboard`, `graph`, `traces` and `spans`
methods as `service()`.

### Pods

```typescript
const pod = kiali.namespace('bookinfo').pod('reviews-v1-7d8f9c-abcde');

await pod;
await pod.logs({ container: 'istio-proxy', duration: 600, maxLines: 100 });
await pod.configDump();            // full Envoy config dump
await pod.configDump('clusters');  // 'listeners', 'routes', 'bootstrap', ...
await pod.ztunnelConfigDump();
await pod.setProxyLogLevel('debug');
```

### Istio config

```typescript
const VirtualService = { group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' };
const ns = kiali.namespace('bookinfo');

await ns.istioConfig({ validate: true, objects: [VirtualService] });
await kiali.istio.config({ namespaces: ['bookinfo', 'istio-system'] });

const vs = ns.istioObject(VirtualService, 'reviews');

await vs;                                  // object, permissions, validation
await vs.get({ validate: true, help: true });
await vs.update({ spec: { hosts: ['reviews'] } }); // JSON merge patch
await vs.delete();
await ns.createIstioObject(VirtualService, { metadata: { name: 'reviews' }, spec: { hosts: ['reviews'] } });

await kiali.istio.status();      // control plane component status
await kiali.istio.validations({ namespaces: ['bookinfo'] });
await kiali.istio.permissions({ namespaces: ['bookinfo'] });
```

### Mesh and tracing

```typescript
await kiali.mesh.graph();
await kiali.mesh.controlPlanes();
await kiali.mesh.tls({ revision: 'default' });

await kiali.tracing.info();
await kiali.tracing.trace('4bf92f3577b34da6a3ce929d0e0e4736');
```

## Error handling

Non-2xx responses throw `KialiApiError`. Network errors and aborts are thrown unchanged.

```typescript
import { KialiApiError } from 'kiali-api-client';

try {
  await kiali.namespace('missing').info();
} catch (err) {
  if (err instanceof KialiApiError) {
    console.log(err.status);  // 403, 404, ...
    console.log(err.detail);  // reason from Kiali's { error, detail } body
    console.log(err.body);    // raw body
    console.log(err.request); // { method, url }
  }
}
```

## Cancellation and events

Every method accepts an `AbortSignal`:

```typescript
const controller = new AbortController();

await kiali.services({ signal: controller.signal });
```

Subscribe to `request` events for logging or metrics. Listener errors never affect requests.

```typescript
kiali.on('request', (e) => {
  console.log(`${e.method} ${e.url} → ${e.statusCode} (${e.durationMs}ms)`, e.error ?? '');
});
```

## Development

```bash
npm install
npm run check          # lint, format check, typecheck, tests, build
npm run test:coverage
npm run test:package   # installs the packed tarball and runs CJS/ESM/TypeScript smoke tests
KIALI_URL=http://localhost:20001 npm run test:client  # read-only checks against a real Kiali
```

Tooling comes from [super-configs](https://github.com/ElJijuna/super-configs): ESLint (config
factory), Biome, TypeScript, Jest, TypeDoc, Commitlint, Markdownlint and semantic-release.

Releases are automated: commits on `main` that follow
[Conventional Commits](https://www.conventionalcommits.org/) produce a semantic version, a
`CHANGELOG.md` entry, a GitHub release, and packages on npm and GitHub Packages. See
[CONTRIBUTING.md](.github/CONTRIBUTING.md).

## License

[MIT](LICENSE)
