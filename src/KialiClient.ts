import { CookieJar } from './cookies';
import type { KialiAppList } from './domain/app';
import type { KialiGraph, KialiGraphQuery } from './domain/graph';
import type { KialiClustersHealth } from './domain/health';
import type { KialiMetricsQuery, KialiMetricsPerNamespace } from './domain/metrics';
import type { KialiNamespace } from './domain/namespace';
import type { KialiServiceList } from './domain/service';
import type {
  KialiAuthInfo,
  KialiGrafanaInfo,
  KialiLoginSession,
  KialiLogoutResponse,
  KialiPersesInfo,
  KialiServerConfig,
  KialiStatus,
} from './domain/status';
import type { KialiTlsStatus } from './domain/tls';
import type { KialiWorkloadList } from './domain/workload';
import { KialiApiError } from './errors/KialiApiError';
import type { KialiNamespacesOption } from './resources/IstioResource';
import { IstioResource } from './resources/IstioResource';
import { MeshResource } from './resources/MeshResource';
import { NamespaceResource } from './resources/NamespaceResource';
import { graphQuery, metricsQuery } from './resources/queries';
import { TracingResource } from './resources/TracingResource';
import {
  clusterQuery,
  joinList,
  splitOptions,
  type CallOptions,
  type HttpMethod,
  type QueryParams,
  type RequestOptions,
  type ResourceContext,
} from './resources/types';

const DEFAULT_WEB_ROOT = '/kiali';
const SESSION_COOKIE_PREFIX = 'kiali-token';
const CSRF_COOKIE = 'csrf-token';

interface InternalRequestOptions extends RequestOptions {
  /** Resolve the path against the web root instead of `/api`. */
  root?: boolean;
  /** Do not log in first (login, logout and anonymous endpoints). */
  skipLogin?: boolean;
  /** Set on the retry after a 401. */
  retried?: boolean;
}

/** Payload emitted on every HTTP request made by {@link KialiClient}. */
export interface RequestEvent {
  /** Full URL that was requested. */
  url: string;
  method: HttpMethod;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  /** HTTP status code, if a response was received. */
  statusCode?: number;
  /** Error thrown, if the request failed. */
  error?: Error;
}

/** Map of supported client events to their callback signatures. */
export interface KialiClientEvents {
  request: (event: RequestEvent) => void;
}

/** Constructor options for {@link KialiClient}. */
export interface KialiClientOptions {
  /**
   * Scheme, host and port of the Kiali server, e.g. `'https://kiali.example.com'`
   * or `'http://localhost:20001'`.
   */
  baseUrl: string;
  /**
   * Path Kiali is served under (`server.web_root`). Default `'/kiali'`.
   * Use `''` or `'/'` when Kiali is served at the root (the OpenShift default).
   */
  webRoot?: string;
  /**
   * Bearer token sent as `Authorization: Bearer <token>` on every request.
   * Use with the `header` auth strategy, or behind a proxy that forwards it.
   */
  token?: string;
  /**
   * Kubernetes token exchanged for a Kiali session (the `token` auth strategy).
   * The client logs in before the first request and again when the session
   * expires. Requires a runtime that exposes `Set-Cookie` (Node.js, Deno, Bun).
   */
  sessionToken?: string;
  /** Session cookies to start with, e.g. from a previous {@link KialiClient.session}. */
  cookies?: Record<string, string>;
  /**
   * Default cluster in a multi-cluster mesh, sent as `clusterName` to the
   * endpoints that accept it. Override per call with the `cluster` option.
   */
  cluster?: string;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. No timeout by default. */
  timeout?: number;
  /** `fetch` credentials mode. Set `'include'` in browsers to send Kiali's cookies. */
  credentials?: RequestCredentials;
  /** Fetch-compatible function. Defaults to the global `fetch`. */
  fetch?: typeof globalThis.fetch;
}

/**
 * Environment variables read by {@link KialiClient.fromEnv}.
 */
export interface KialiEnv {
  KIALI_URL?: string;
  KIALI_WEB_ROOT?: string;
  KIALI_TOKEN?: string;
  KIALI_SESSION_TOKEN?: string;
  KIALI_CLUSTER?: string;
  KIALI_TIMEOUT?: string;
  [key: string]: string | undefined;
}

/** Options for the cluster-wide list endpoints. */
export interface KialiListOptions extends KialiNamespacesOption, CallOptions {
  /** Include health. Default `true`. */
  health?: boolean;
  /** Include Istio references and validations. Default `true`. */
  istioResources?: boolean;
  /** Prometheus rate interval for health, e.g. `'10m'`. */
  rateInterval?: string;
  /** Unix timestamp in seconds. */
  queryTime?: number;
}

/** Options for {@link KialiClient.services}. */
export interface KialiServiceListOptions extends KialiListOptions {
  /** Only return the service definitions, without joined workload data. */
  onlyDefinitions?: boolean;
}

/** Options for {@link KialiClient.health}. */
export interface KialiHealthOptions extends KialiNamespacesOption, CallOptions {
  type?: 'app' | 'service' | 'workload';
  rateInterval?: string;
  queryTime?: number;
}

async function ignoreRejection(value: unknown): Promise<void> {
  try {
    await value;
  } catch {
    // Observers are isolated from request results.
  }
}

function normalizeWebRoot(webRoot: string | undefined): string {
  const trimmed = (webRoot ?? DEFAULT_WEB_ROOT).trim().replace(/\/+$/, '');

  if (trimmed === '') {
    return '';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function buildUrl(base: string, query?: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value as readonly unknown[]) {
        search.append(key, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }

  const qs = search.toString();

  return qs ? `${base}?${qs}` : base;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();

    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Nothing to release.
  }
}

function combineSignals(
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): AbortSignal | undefined {
  if (timeout === undefined) {
    return signal;
  }

  const timeoutSignal = AbortSignal.timeout(timeout);

  if (!signal) {
    return timeoutSignal;
  }

  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeoutSignal]) : signal;
}

/**
 * Client for the Kiali REST API.
 *
 * @example
 * ```typescript
 * import { KialiClient } from 'kiali-api-client';
 *
 * const kiali = new KialiClient({
 *   baseUrl: 'https://kiali.example.com',
 *   sessionToken: process.env.K8S_TOKEN, // `token` auth strategy
 * });
 *
 * const namespaces = await kiali.namespaces();
 * const services = await kiali.services({ namespaces: ['bookinfo'] });
 * const reviews = await kiali.namespace('bookinfo').service('reviews');
 * const graph = await kiali.graph({ namespaces: ['bookinfo'], graphType: 'versionedApp' });
 * ```
 */
export class KialiClient {
  /** Mesh-wide endpoints. */
  readonly mesh: MeshResource;
  /** Istio-wide endpoints. */
  readonly istio: IstioResource;
  /** Tracing endpoints. */
  readonly tracing: TracingResource;

  private readonly rootUrl: string;
  private readonly apiUrl: string;
  private readonly ctx: ResourceContext;
  private readonly jar: CookieJar;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly extraHeaders: Record<string, string>;
  private readonly timeout?: number;
  private readonly credentials?: RequestCredentials;
  private token?: string;
  private sessionToken?: string;
  private loginPromise?: Promise<KialiLoginSession>;
  private listeners: KialiClientEvents['request'][] = [];

  constructor(options: KialiClientOptions) {
    if (!options?.baseUrl) {
      throw new TypeError('KialiClient: `baseUrl` is required');
    }

    this.rootUrl = `${options.baseUrl.replace(/\/+$/, '')}${normalizeWebRoot(options.webRoot)}`;
    this.apiUrl = `${this.rootUrl}/api`;
    this.token = options.token;
    this.sessionToken = options.sessionToken;
    this.jar = new CookieJar(options.cookies);
    this.extraHeaders = { ...options.headers };
    this.timeout = options.timeout;
    this.credentials = options.credentials;
    // Resolve `fetch` lazily so a global replaced later (tests, polyfills) is used.
    this.fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.ctx = {
      request: (method, path, requestOptions) => this.request(method, path, requestOptions),
      cluster: options.cluster,
    };
    this.mesh = new MeshResource(this.ctx);
    this.istio = new IstioResource(this.ctx);
    this.tracing = new TracingResource(this.ctx);
  }

  /**
   * Creates a client from environment variables:
   * `KIALI_URL` (required), `KIALI_WEB_ROOT`, `KIALI_TOKEN`, `KIALI_SESSION_TOKEN`,
   * `KIALI_CLUSTER` and `KIALI_TIMEOUT` (milliseconds).
   *
   * @param env - Defaults to `process.env`.
   * @param overrides - Options that take precedence over the environment.
   */
  static fromEnv(env?: KialiEnv, overrides: Partial<KialiClientOptions> = {}): KialiClient {
    const source: KialiEnv =
      env ??
      ((globalThis as { process?: { env?: KialiEnv } }).process?.env as KialiEnv | undefined) ??
      {};
    const baseUrl = overrides.baseUrl ?? source.KIALI_URL;

    if (!baseUrl) {
      throw new TypeError('KialiClient.fromEnv: KIALI_URL is not set');
    }

    const timeout = source.KIALI_TIMEOUT ? Number(source.KIALI_TIMEOUT) : undefined;

    return new KialiClient({
      baseUrl,
      webRoot: source.KIALI_WEB_ROOT,
      token: source.KIALI_TOKEN || undefined,
      sessionToken: source.KIALI_SESSION_TOKEN || undefined,
      cluster: source.KIALI_CLUSTER || undefined,
      timeout: Number.isFinite(timeout) ? timeout : undefined,
      ...overrides,
    });
  }

  // --- Events ---------------------------------------------------------------

  /**
   * Subscribes to a client event. Listener errors never affect requests.
   *
   * @example
   * ```typescript
   * kiali.on('request', (e) => console.log(`${e.method} ${e.url} ${e.statusCode} ${e.durationMs}ms`));
   * ```
   */
  on<K extends keyof KialiClientEvents>(_event: K, callback: KialiClientEvents[K]): this {
    // Replace rather than mutate, so an emission in progress is unaffected.
    this.listeners = [...this.listeners, callback];

    return this;
  }

  /** Removes a listener registered with {@link KialiClient.on}. */
  off<K extends keyof KialiClientEvents>(_event: K, callback: KialiClientEvents[K]): this {
    const index = this.listeners.lastIndexOf(callback);

    if (index !== -1) {
      this.listeners = this.listeners.filter((_, i) => i !== index);
    }

    return this;
  }

  private emit(payload: RequestEvent): void {
    for (const listener of this.listeners) {
      try {
        void ignoreRejection(listener(payload));
      } catch {
        // Observers must never change the outcome of a request.
      }
    }
  }

  // --- Authentication -------------------------------------------------------

  /**
   * Logs in with a Kubernetes token (the `token` auth strategy) and keeps the
   * session cookies for later requests. The token is remembered so the session
   * can be renewed when it expires.
   *
   * `POST /api/authenticate`
   */
  async login(token: string, options?: Pick<CallOptions, 'signal'>): Promise<KialiLoginSession> {
    this.sessionToken = token;

    return this.authenticate(token, options?.signal);
  }

  /**
   * Checks the current session and extends it. `GET /api/authenticate`
   */
  refreshSession(options?: Pick<CallOptions, 'signal'>): Promise<KialiLoginSession> {
    return this.request('GET', '/authenticate', { signal: options?.signal });
  }

  /** Ends the session on the server and clears local cookies. `GET /api/logout` */
  async logout(options?: Pick<CallOptions, 'signal'>): Promise<KialiLogoutResponse | undefined> {
    try {
      return await this.request<KialiLogoutResponse | undefined>('GET', '/logout', {
        signal: options?.signal,
        skipLogin: true,
      });
    } finally {
      this.jar.clear();
      this.sessionToken = undefined;
    }
  }

  /** Replaces the bearer token sent as `Authorization`. */
  setToken(token: string | undefined): this {
    this.token = token;

    return this;
  }

  /** Current session cookies, to persist and pass back as the `cookies` option. */
  session(): Record<string, string> {
    return this.jar.toJSON();
  }

  private hasSession(): boolean {
    return Object.keys(this.jar.toJSON()).some((name) => name.startsWith(SESSION_COOKIE_PREFIX));
  }

  private authenticate(token: string, signal?: AbortSignal): Promise<KialiLoginSession> {
    // Share one login between concurrent requests.
    this.loginPromise ??= this.request<KialiLoginSession>('POST', '/authenticate', {
      form: { token },
      signal,
      skipLogin: true,
    }).finally(() => {
      this.loginPromise = undefined;
    });

    return this.loginPromise;
  }

  // --- Transport ------------------------------------------------------------

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: InternalRequestOptions = {},
  ): Promise<T> {
    if (this.sessionToken && !options.skipLogin && !this.hasSession()) {
      await this.authenticate(this.sessionToken, options.signal);
    }

    try {
      return await this.send<T>(method, path, options);
    } catch (error) {
      // An expired session: log in again once and retry.
      if (
        error instanceof KialiApiError &&
        error.status === 401 &&
        this.sessionToken &&
        !options.skipLogin &&
        !options.retried
      ) {
        this.jar.clear();
        await this.authenticate(this.sessionToken, options.signal);

        return this.send<T>(method, path, { ...options, retried: true });
      }

      throw error;
    }
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    options: InternalRequestOptions,
  ): Promise<T> {
    const url = buildUrl(`${options.root ? this.rootUrl : this.apiUrl}${path}`, options.query);
    const headers: Record<string, string> = { Accept: 'application/json', ...this.extraHeaders };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const cookie = this.jar.header();

    if (cookie) {
      headers.Cookie = cookie;
    }

    const csrf = this.jar.get(CSRF_COOKIE);

    if (csrf && method !== 'GET') {
      headers['X-CSRFToken'] = csrf;
    }

    let body: string | undefined;

    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      init.body = body;
    }

    if (this.credentials) {
      init.credentials = this.credentials;
    }

    const signal = combineSignals(options.signal, this.timeout);

    if (signal) {
      init.signal = signal;
    }

    const startedAt = new Date();

    let statusCode: number | undefined;
    let error: Error | undefined;

    try {
      const response = await this.fetchFn(url, init);

      statusCode = response.status;
      this.jar.update(response.headers);

      if (!response.ok) {
        throw new KialiApiError(response.status, response.statusText, await readBody(response), {
          method,
          url,
        });
      }

      if (options.responseType === 'none') {
        await discardBody(response);

        return undefined as T;
      }

      if (options.responseType === 'text') {
        return (await response.text()) as T;
      }

      const text = await response.text();

      return (text ? JSON.parse(text) : undefined) as T;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));

      throw err;
    } finally {
      const finishedAt = new Date();

      this.emit({
        url,
        method,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        statusCode,
        ...(error ? { error } : {}),
      });
    }
  }

  // --- Server ---------------------------------------------------------------

  /** Liveness probe. Resolves when Kiali answers `GET /healthz` with 2xx. */
  async healthz(options?: Pick<CallOptions, 'signal'>): Promise<void> {
    await this.request<void>('GET', '/healthz', {
      root: true,
      responseType: 'none',
      skipLogin: true,
      signal: options?.signal,
    });
  }

  /** Kiali version, state and external services. `GET /api/status` */
  status(options?: Pick<CallOptions, 'signal'>): Promise<KialiStatus> {
    return this.request('GET', '/status', { signal: options?.signal });
  }

  /** Auth strategy and current session. Does not require a session. `GET /api/auth/info` */
  authInfo(options?: Pick<CallOptions, 'signal'>): Promise<KialiAuthInfo> {
    return this.request('GET', '/auth/info', { signal: options?.signal, skipLogin: true });
  }

  /** Public server configuration. `GET /api/config` */
  config(options?: Pick<CallOptions, 'signal'>): Promise<KialiServerConfig> {
    return this.request('GET', '/config', { signal: options?.signal });
  }

  /** Grafana integration settings. `GET /api/grafana` */
  grafana(options?: Pick<CallOptions, 'signal'>): Promise<KialiGrafanaInfo> {
    return this.request('GET', '/grafana', { signal: options?.signal });
  }

  /** Perses integration settings. `GET /api/perses` */
  perses(options?: Pick<CallOptions, 'signal'>): Promise<KialiPersesInfo> {
    return this.request('GET', '/perses', { signal: options?.signal });
  }

  // --- Namespaces and cluster-wide lists ------------------------------------

  /** Namespaces the user can access, in all clusters. `GET /api/namespaces` */
  namespaces(options?: Pick<CallOptions, 'signal'>): Promise<KialiNamespace[]> {
    return this.request('GET', '/namespaces', { signal: options?.signal });
  }

  /** A namespace. Await it for the namespace info, or chain to reach its resources. */
  namespace(name: string): NamespaceResource {
    return new NamespaceResource(this.ctx, name);
  }

  /** Services of a cluster. `GET /api/clusters/services` */
  services(options?: KialiServiceListOptions): Promise<KialiServiceList> {
    return this.list('/clusters/services', options);
  }

  /** Workloads of a cluster. `GET /api/clusters/workloads` */
  workloads(options?: KialiListOptions): Promise<KialiWorkloadList> {
    return this.list('/clusters/workloads', options);
  }

  /** Apps of a cluster. `GET /api/clusters/apps` */
  apps(options?: KialiListOptions): Promise<KialiAppList> {
    return this.list('/clusters/apps', options);
  }

  private list<T>(path: string, options: KialiListOptions | undefined): Promise<T> {
    const [{ namespaces, ...query }, call] = splitOptions(options);

    return this.request('GET', path, {
      query: clusterQuery(this.ctx, call, { ...query, namespaces: joinList(namespaces) }),
      signal: call.signal,
    });
  }

  /** Health of apps, services and workloads per namespace. `GET /api/clusters/health` */
  health(options?: KialiHealthOptions): Promise<KialiClustersHealth> {
    const [{ namespaces, ...query }, call] = splitOptions(options);

    return this.request('GET', '/clusters/health', {
      query: clusterQuery(this.ctx, call, { ...query, namespaces: joinList(namespaces) }),
      signal: call.signal,
    });
  }

  /** mTLS status per namespace. `GET /api/clusters/tls` */
  tls(options?: KialiNamespacesOption & CallOptions): Promise<KialiTlsStatus[]> {
    const [{ namespaces }, call] = splitOptions(options);

    return this.request('GET', '/clusters/tls', {
      query: clusterQuery(this.ctx, call, { namespaces: joinList(namespaces) }),
      signal: call.signal,
    });
  }

  /** Metrics per namespace. `GET /api/clusters/metrics` */
  metrics(
    query?: KialiMetricsQuery & KialiNamespacesOption & CallOptions,
  ): Promise<KialiMetricsPerNamespace> {
    const [{ namespaces, ...rest }, call] = splitOptions(query);

    return this.request('GET', '/clusters/metrics', {
      query: clusterQuery(this.ctx, call, {
        ...metricsQuery(rest),
        namespaces: joinList(namespaces),
      }),
      signal: call.signal,
    });
  }

  /**
   * Traffic graph of one or more namespaces. `GET /api/namespaces/graph`
   *
   * @example
   * ```typescript
   * const graph = await kiali.graph({
   *   namespaces: ['bookinfo'],
   *   graphType: 'versionedApp',
   *   duration: '600s',
   *   appenders: ['deadNode', 'responseTime', 'securityPolicy'],
   * });
   * ```
   */
  graph(
    query: KialiGraphQuery & KialiNamespacesOption & Pick<CallOptions, 'signal'>,
  ): Promise<KialiGraph> {
    const { namespaces, signal, ...rest } = query;

    return this.request('GET', '/namespaces/graph', {
      query: { ...graphQuery(rest), namespaces: joinList(namespaces) },
      signal,
    });
  }
}
