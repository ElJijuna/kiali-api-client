import type { KialiPod, KialiPodLogs, KialiPodLogsQuery, KialiProxyLogLevel } from '../domain/pod';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';

/**
 * A pod. Await it to fetch the pod details.
 *
 * @example
 * ```typescript
 * const pod = await kiali.namespace('bookinfo').pod('reviews-v1-7d8f9c-abcde');
 * const logs = await kiali.namespace('bookinfo').pod('reviews-v1-7d8f9c-abcde').logs({
 *   container: 'istio-proxy',
 *   maxLines: 100,
 * });
 * ```
 */
export class PodResource implements PromiseLike<KialiPod> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly namespace: string,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(namespace)}/pods/${seg(name)}`;
  }

  then<TResult1 = KialiPod, TResult2 = never>(
    onfulfilled?: ((value: KialiPod) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.get().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/pods/{pod}` */
  get(options?: CallOptions): Promise<KialiPod> {
    return this.ctx.request('GET', this.path, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/pods/{pod}/logs` */
  logs(query?: KialiPodLogsQuery & CallOptions): Promise<KialiPodLogs> {
    const [{ duration, ...rest }, call] = splitOptions(query);

    return this.ctx.request('GET', `${this.path}/logs`, {
      query: clusterQuery(this.ctx, call, {
        ...rest,
        duration: duration === undefined ? undefined : `${duration}s`,
      }),
      signal: call.signal,
    });
  }

  /**
   * Envoy configuration dump of the sidecar, or one section of it.
   *
   * `GET /api/namespaces/{namespace}/pods/{pod}/config_dump[/{resource}]`
   *
   * @param resource - `'clusters'`, `'listeners'`, `'routes'`, `'bootstrap'`, ...
   */
  configDump<T = Record<string, unknown>>(resource?: string, options?: CallOptions): Promise<T> {
    const path = resource
      ? `${this.path}/config_dump/${seg(resource)}`
      : `${this.path}/config_dump`;

    return this.ctx.request('GET', path, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /** `GET /api/namespaces/{namespace}/pods/{pod}/config_dump_ztunnel` */
  ztunnelConfigDump<T = Record<string, unknown>>(options?: CallOptions): Promise<T> {
    return this.ctx.request('GET', `${this.path}/config_dump_ztunnel`, {
      query: clusterQuery(this.ctx, options),
      signal: options?.signal,
    });
  }

  /**
   * Changes the Envoy log level of the sidecar.
   *
   * `POST /api/namespaces/{namespace}/pods/{pod}/logging?level={level}`
   */
  setProxyLogLevel(level: KialiProxyLogLevel, options?: CallOptions): Promise<void> {
    return this.ctx.request('POST', `${this.path}/logging`, {
      query: clusterQuery(this.ctx, options, { level }),
      responseType: 'none',
      signal: options?.signal,
    });
  }
}
