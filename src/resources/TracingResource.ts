import type { KialiTracingInfo, KialiTracingSingleResponse } from '../domain/tracing';
import { seg, type CallOptions, type ResourceContext } from './types';

/**
 * Tracing endpoints: `kiali.tracing`. Traces of a service, workload or app are
 * on their own resources (e.g. `kiali.namespace('ns').service('svc').traces()`).
 */
export class TracingResource {
  /** @internal */
  constructor(private readonly ctx: ResourceContext) {}

  /** Tracing integration settings. `GET /api/tracing` */
  info(options?: Pick<CallOptions, 'signal'>): Promise<KialiTracingInfo> {
    return this.ctx.request('GET', '/tracing', { signal: options?.signal });
  }

  /** A trace by ID. `GET /api/traces/{traceID}` */
  trace(
    traceId: string,
    options?: Pick<CallOptions, 'signal'>,
  ): Promise<KialiTracingSingleResponse> {
    return this.ctx.request('GET', `/traces/${seg(traceId)}`, { signal: options?.signal });
  }
}
