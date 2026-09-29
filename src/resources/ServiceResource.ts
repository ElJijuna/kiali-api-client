import type { KialiPatch } from '../domain/common';
import type { KialiGraph, KialiGraphQuery } from '../domain/graph';
import type {
  KialiDashboard,
  KialiDashboardQuery,
  KialiMetricsMap,
  KialiMetricsQuery,
} from '../domain/metrics';
import type { KialiServiceDetails } from '../domain/service';
import type { KialiSpan, KialiTracingQuery, KialiTracingResponse } from '../domain/tracing';
import { graphQuery, metricsQuery, tracingQuery } from './queries';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';

/** Options for {@link ServiceResource.get}. */
export interface KialiServiceDetailsOptions extends CallOptions {
  /** Include health. Default `true`. */
  health?: boolean;
  /** Include Istio validations. */
  validate?: boolean;
  /** Prometheus rate interval for health, e.g. `'10m'`. */
  rateInterval?: string;
}

/** Options for {@link ServiceResource.update}. */
export interface KialiServiceUpdateOptions extends CallOptions {
  /** `'merge'` (default) or `'json'`. */
  patchType?: 'merge' | 'json';
  validate?: boolean;
  rateInterval?: string;
}

/**
 * A Kubernetes service in a namespace. Await it to fetch the service details.
 *
 * @example
 * ```typescript
 * const details = await kiali.namespace('bookinfo').service('reviews');
 * const metrics = await kiali.namespace('bookinfo').service('reviews').metrics({ duration: 600 });
 * ```
 */
export class ServiceResource implements PromiseLike<KialiServiceDetails> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly namespace: string,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(namespace)}/services/${seg(name)}`;
  }

  then<TResult1 = KialiServiceDetails, TResult2 = never>(
    onfulfilled?: ((value: KialiServiceDetails) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.get().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/services/{service}` */
  get(options?: KialiServiceDetailsOptions): Promise<KialiServiceDetails> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('GET', this.path, {
      query: clusterQuery(this.ctx, call, query),
      signal: call.signal,
    });
  }

  /** Patches the Kubernetes service. `PATCH /api/namespaces/{namespace}/services/{service}` */
  update(patch: KialiPatch, options?: KialiServiceUpdateOptions): Promise<KialiServiceDetails> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('PATCH', this.path, {
      query: clusterQuery(this.ctx, call, query),
      body: patch,
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/services/{service}/metrics` */
  metrics(query?: KialiMetricsQuery & CallOptions): Promise<KialiMetricsMap> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/metrics`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/services/{service}/dashboard` */
  dashboard(query?: KialiDashboardQuery & CallOptions): Promise<KialiDashboard> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/dashboard`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** Service node graph. `GET /api/namespaces/{namespace}/services/{service}/graph` */
  graph(query?: KialiGraphQuery & CallOptions): Promise<KialiGraph> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/graph`, {
      query: clusterQuery(this.ctx, call, graphQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/services/{service}/traces` */
  traces(query?: KialiTracingQuery & CallOptions): Promise<KialiTracingResponse> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/traces`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/services/{service}/spans` */
  spans(query?: KialiTracingQuery & CallOptions): Promise<KialiSpan[]> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/spans`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }
}
