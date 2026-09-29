import type { KialiGvk, KialiPatch, KialiValidationStatus } from '../domain/common';
import type { KialiGraph, KialiGraphQuery } from '../domain/graph';
import type { KialiClustersHealth } from '../domain/health';
import type {
  KialiIstioConfigDetails,
  KialiIstioConfigList,
  KialiIstioConfigQuery,
  KialiIstioObject,
} from '../domain/istio';
import type {
  KialiDashboard,
  KialiDashboardQuery,
  KialiMetricsMap,
  KialiMetricsQuery,
} from '../domain/metrics';
import type { KialiNamespace, KialiNamespaceInfo } from '../domain/namespace';
import type { KialiTlsStatus } from '../domain/tls';
import { AppResource } from './AppResource';
import { IstioObjectResource } from './IstioObjectResource';
import { PodResource } from './PodResource';
import { graphQuery, gvkPath, istioConfigQuery, metricsQuery } from './queries';
import { ServiceResource } from './ServiceResource';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';
import { WorkloadResource } from './WorkloadResource';

/** Options for {@link NamespaceResource.health}. */
export interface KialiNamespaceHealthOptions extends CallOptions {
  /** Only one kind of health. By default apps, services and workloads are returned. */
  type?: 'app' | 'service' | 'workload';
  /** Prometheus rate interval, e.g. `'10m'`. */
  rateInterval?: string;
  /** Unix timestamp in seconds. */
  queryTime?: number;
}

/**
 * A namespace, and the entry point to the resources inside it. Await it to
 * fetch the namespace info.
 *
 * @example
 * ```typescript
 * const bookinfo = kiali.namespace('bookinfo');
 * const info = await bookinfo;
 * const tls = await bookinfo.tls();
 * const reviews = await bookinfo.service('reviews');
 * ```
 */
export class NamespaceResource implements PromiseLike<KialiNamespaceInfo> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(name)}`;
  }

  then<TResult1 = KialiNamespaceInfo, TResult2 = never>(
    onfulfilled?: ((value: KialiNamespaceInfo) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.info().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/info` */
  info(options?: CallOptions): Promise<KialiNamespaceInfo> {
    return this.ctx.request('GET', `${this.path}/info`, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /**
   * Patches the namespace (e.g. its labels).
   *
   * `PATCH /api/namespaces/{namespace}`
   *
   * @example
   * ```typescript
   * await kiali.namespace('bookinfo').update({ metadata: { labels: { 'istio-injection': 'enabled' } } });
   * ```
   */
  update(patch: KialiPatch, options?: CallOptions): Promise<KialiNamespace> {
    return this.ctx.request('PATCH', this.path, {
      query: clusterQuery(this.ctx, options),
      body: patch,
      signal: options?.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/metrics` */
  metrics(query?: KialiMetricsQuery & CallOptions): Promise<KialiMetricsMap> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/metrics`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** Health of the apps, services and workloads of this namespace (`GET /api/clusters/health`). */
  health(options?: KialiNamespaceHealthOptions): Promise<KialiClustersHealth> {
    const [query, call] = splitOptions(options);

    return this.ctx.request('GET', '/clusters/health', {
      query: clusterQuery(this.ctx, call, { ...query, namespaces: this.name }),
      signal: call.signal,
    });
  }

  /** mTLS status of the namespace. `GET /api/namespaces/{namespace}/tls` */
  tls(options?: CallOptions): Promise<KialiTlsStatus> {
    return this.ctx.request('GET', `${this.path}/tls`, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /** Istio validation summary. `GET /api/namespaces/{namespace}/validations` */
  validations(options?: CallOptions): Promise<KialiValidationStatus> {
    return this.ctx.request('GET', `${this.path}/validations`, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /** Istio config objects in the namespace. `GET /api/namespaces/{namespace}/istio` */
  istioConfig(query?: KialiIstioConfigQuery & CallOptions): Promise<KialiIstioConfigList> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/istio`, {
      query: clusterQuery(this.ctx, call, istioConfigQuery(rest)),
      signal: call.signal,
    });
  }

  /** An Istio or Gateway API object in this namespace. */
  istioObject(gvk: KialiGvk, name: string): IstioObjectResource {
    return new IstioObjectResource(this.ctx, this.name, gvk, name);
  }

  /**
   * Creates an Istio or Gateway API object.
   *
   * `POST /api/namespaces/{namespace}/istio/{group}/{version}/{kind}`
   */
  createIstioObject(
    gvk: KialiGvk,
    object: KialiIstioObject | string,
    options?: CallOptions,
  ): Promise<KialiIstioConfigDetails> {
    return this.ctx.request('POST', `${this.path}/istio${gvkPath(gvk)}`, {
      query: clusterQuery(this.ctx, options),
      body: object,
      signal: options?.signal,
    });
  }

  /** A service in this namespace. */
  service(name: string): ServiceResource {
    return new ServiceResource(this.ctx, this.name, name);
  }

  /** A workload in this namespace. */
  workload(name: string): WorkloadResource {
    return new WorkloadResource(this.ctx, this.name, name);
  }

  /** An app in this namespace. */
  app(name: string): AppResource {
    return new AppResource(this.ctx, this.name, name);
  }

  /** A pod in this namespace. */
  pod(name: string): PodResource {
    return new PodResource(this.ctx, this.name, name);
  }

  /**
   * Metrics of an aggregate (a Prometheus label such as `request_operation`).
   * Not cluster-scoped.
   *
   * `GET /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics`
   */
  aggregateMetrics(
    aggregate: string,
    aggregateValue: string,
    query?: KialiMetricsQuery & Pick<CallOptions, 'signal'>,
  ): Promise<KialiMetricsMap> {
    const { signal, ...rest } = query ?? {};

    return this.ctx.request(
      'GET',
      `${this.path}/aggregates/${seg(aggregate)}/${seg(aggregateValue)}/metrics`,
      { query: metricsQuery(rest), signal },
    );
  }

  /**
   * Node graph of an aggregate, optionally for one service.
   *
   * `GET /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}[/{service}]/graph`
   */
  aggregateGraph(
    aggregate: string,
    aggregateValue: string,
    query?: KialiGraphQuery & CallOptions & { service?: string },
  ): Promise<KialiGraph> {
    const [{ service, ...rest }, call] = splitOptions(query);
    const base = `${this.path}/aggregates/${seg(aggregate)}/${seg(aggregateValue)}`;

    return this.ctx.request('GET', service ? `${base}/${seg(service)}/graph` : `${base}/graph`, {
      query: clusterQuery(this.ctx, call, graphQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/controlplanes/{controlplane}/metrics` */
  controlPlaneMetrics(
    controlPlane: string,
    query?: KialiMetricsQuery & CallOptions,
  ): Promise<KialiMetricsMap> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/controlplanes/${seg(controlPlane)}/metrics`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/customdashboard/{dashboard}` */
  customDashboard(
    dashboard: string,
    query?: KialiDashboardQuery & CallOptions,
  ): Promise<KialiDashboard> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/customdashboard/${seg(dashboard)}`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/ztunnel/{workload}/dashboard` */
  ztunnelDashboard(
    workload: string,
    query?: KialiDashboardQuery & CallOptions,
  ): Promise<KialiDashboard> {
    const [rest, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/ztunnel/${seg(workload)}/dashboard`, {
      query: clusterQuery(this.ctx, call, metricsQuery(rest)),
      signal: call.signal,
    });
  }
}
