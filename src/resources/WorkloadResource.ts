import type { KialiGvk, KialiPatch } from '../domain/common';
import type { KialiGraph, KialiGraphQuery } from '../domain/graph';
import type {
  KialiDashboard,
  KialiDashboardQuery,
  KialiMetricsMap,
  KialiMetricsQuery,
} from '../domain/metrics';
import type { KialiWorkload } from '../domain/workload';
import type { KialiSpan, KialiTracingQuery, KialiTracingResponse } from '../domain/tracing';
import { graphQuery, gvkToString, metricsQuery, tracingQuery } from './queries';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';

/** Options for {@link WorkloadResource.get}. */
export interface KialiWorkloadDetailsOptions extends CallOptions {
  /** Include health. Default `true`. */
  health?: boolean;
  /** Include Istio validations. */
  validate?: boolean;
  /** Prometheus rate interval for health, e.g. `'10m'`. */
  rateInterval?: string;
}

/** Options for {@link WorkloadResource.update}. */
export interface KialiWorkloadUpdateOptions extends CallOptions {
  /**
   * Kind of the workload object. Default `{ group: 'apps', version: 'v1', kind: 'Deployment' }`.
   * Accepts a GVK string such as `'apps/v1, Kind=StatefulSet'`.
   */
  gvk?: KialiGvk | string;
  /** `'merge'` (default) or `'json'`. */
  patchType?: 'merge' | 'json';
  validate?: boolean;
}

const DEFAULT_WORKLOAD_GVK: KialiGvk = { group: 'apps', version: 'v1', kind: 'Deployment' };

/**
 * A workload (Deployment, StatefulSet, ...) in a namespace. Await it to fetch the workload details.
 *
 * @example
 * ```typescript
 * const details = await kiali.namespace('bookinfo').workload('reviews-v1');
 * const metrics = await kiali.namespace('bookinfo').workload('reviews-v1').metrics({ duration: 600 });
 * ```
 */
export class WorkloadResource implements PromiseLike<KialiWorkload> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly namespace: string,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(namespace)}/workloads/${seg(name)}`;
  }

  then<TResult1 = KialiWorkload, TResult2 = never>(
    onfulfilled?: ((value: KialiWorkload) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.get().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/workloads/{workload}` */
  get(options?: KialiWorkloadDetailsOptions): Promise<KialiWorkload> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('GET', this.path, {
      query: clusterQuery(this.ctx, call, query),
      signal: call.signal,
    });
  }

  /** Patches the workload object. `PATCH /api/namespaces/{namespace}/workloads/{workload}` */
  update(patch: KialiPatch, options?: KialiWorkloadUpdateOptions): Promise<KialiWorkload> {
    const [{ gvk = DEFAULT_WORKLOAD_GVK, ...query }, call] = splitOptions(options);

    return this.ctx.request('PATCH', this.path, {
      query: clusterQuery(this.ctx, call, {
        ...query,
        gvk: typeof gvk === 'string' ? gvk : gvkToString(gvk),
      }),
      body: patch,
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/workloads/{workload}/metrics` */
  metrics(query?: KialiMetricsQuery & CallOptions): Promise<KialiMetricsMap> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/metrics`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/workloads/{workload}/dashboard` */
  dashboard(query?: KialiDashboardQuery & CallOptions): Promise<KialiDashboard> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/dashboard`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** Workload node graph. `GET /api/namespaces/{namespace}/workloads/{workload}/graph` */
  graph(query?: KialiGraphQuery & CallOptions): Promise<KialiGraph> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/graph`, {
      query: clusterQuery(this.ctx, call, graphQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/workloads/{workload}/traces` */
  traces(query?: KialiTracingQuery & CallOptions): Promise<KialiTracingResponse> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/traces`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/workloads/{workload}/spans` */
  spans(query?: KialiTracingQuery & CallOptions): Promise<KialiSpan[]> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/spans`, {
      query: clusterQuery(this.ctx, call, tracingQuery(rest)),
      signal: call.signal,
    });
  }
}
