import type { KialiApp } from '../domain/app';
import type { KialiGraph, KialiGraphQuery } from '../domain/graph';
import type {
  KialiDashboard,
  KialiDashboardQuery,
  KialiMetricsMap,
  KialiMetricsQuery,
} from '../domain/metrics';
import type { KialiSpan, KialiTracingQuery, KialiTracingResponse } from '../domain/tracing';
import { graphQuery, metricsQuery, tracingQuery } from './queries';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';

/** Options for {@link AppResource.get}. */
export interface KialiAppDetailsOptions extends CallOptions {
  /** Include health. Default `true`. */
  health?: boolean;
  /** Prometheus rate interval for health, e.g. `'10m'`. */
  rateInterval?: string;
}

/** Query for {@link AppResource.graph}. */
export interface KialiAppGraphQuery extends KialiGraphQuery {
  /** Restrict the node graph to one app version (the `version` label). */
  version?: string;
}

/**
 * An application (workloads sharing the `app` label). Await it to fetch the app details.
 *
 * @example
 * ```typescript
 * const app = await kiali.namespace('bookinfo').app('reviews');
 * const graph = await kiali.namespace('bookinfo').app('reviews').graph({ version: 'v2' });
 * ```
 */
export class AppResource implements PromiseLike<KialiApp> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly namespace: string,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(namespace)}/apps/${seg(name)}`;
  }

  then<TResult1 = KialiApp, TResult2 = never>(
    onfulfilled?: ((value: KialiApp) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.get().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/apps/{app}` */
  get(options?: KialiAppDetailsOptions): Promise<KialiApp> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('GET', this.path, {
      query: clusterQuery(this.ctx, call, query),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/apps/{app}/metrics` */
  metrics(query?: KialiMetricsQuery & CallOptions): Promise<KialiMetricsMap> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/metrics`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/apps/{app}/dashboard` */
  dashboard(query?: KialiDashboardQuery & CallOptions): Promise<KialiDashboard> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/dashboard`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /**
   * App node graph.
   *
   * `GET /api/namespaces/{namespace}/applications/{app}[/versions/{version}]/graph`
   */
  graph(query?: KialiAppGraphQuery & CallOptions): Promise<KialiGraph> {
    const [{ version, ...rest }, call] = splitOptions(query);
    const base = `/namespaces/${seg(this.namespace)}/applications/${seg(this.name)}`;
    const path = version ? `${base}/versions/${seg(version)}/graph` : `${base}/graph`;

    return this.ctx.request('GET', path, {
      query: clusterQuery(this.ctx, call, graphQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/apps/{app}/traces` */
  traces(query?: KialiTracingQuery & CallOptions): Promise<KialiTracingResponse> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/traces`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/apps/{app}/spans` */
  spans(query?: KialiTracingQuery & CallOptions): Promise<KialiSpan[]> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/spans`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }

  /**
   * Number of traces with errors in the last `duration` seconds.
   *
   * `GET /api/namespaces/{namespace}/apps/{app}/errortraces`
   */
  errorTraces(options?: { duration?: number } & CallOptions): Promise<number> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('GET', `${this.path}/errortraces`, {
      query: clusterQuery(this.ctx, call, query),
      signal: call.signal,
    });
  }
}
