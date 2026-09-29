import type { KialiValidationStatus } from '../domain/common';
import type {
  KialiComponentStatus,
  KialiIstioConfigList,
  KialiIstioConfigQuery,
  KialiIstioPermissions,
} from '../domain/istio';
import { istioConfigQuery } from './queries';
import {
  clusterQuery,
  joinList,
  splitOptions,
  type CallOptions,
  type ResourceContext,
} from './types';

/** Namespaces filter accepted by cross-namespace endpoints. */
export interface KialiNamespacesOption {
  /** Namespaces to include. All accessible namespaces when omitted. */
  namespaces?: string | readonly string[];
}

/**
 * Istio-wide endpoints: `kiali.istio`.
 *
 * @example
 * ```typescript
 * const status = await kiali.istio.status();
 * const config = await kiali.istio.config({ namespaces: ['bookinfo'], validate: true });
 * ```
 */
export class IstioResource {
  /** @internal */
  constructor(private readonly ctx: ResourceContext) {}

  /** Status of the Istio components. `GET /api/istio/status` */
  status(options?: Pick<CallOptions, 'signal'>): Promise<KialiComponentStatus[]> {
    return this.ctx.request('GET', '/istio/status', { signal: options?.signal });
  }

  /** Istio config across namespaces. `GET /api/istio/config` */
  config(
    query?: KialiIstioConfigQuery & KialiNamespacesOption & CallOptions,
  ): Promise<KialiIstioConfigList> {
    const [{ namespaces, ...rest }, call] = splitOptions(query);

    return this.ctx.request('GET', '/istio/config', {
      query: clusterQuery(this.ctx, call, {
        ...istioConfigQuery(rest),
        namespaces: joinList(namespaces),
      }),
      signal: call.signal,
    });
  }

  /** Validation summaries per namespace. `GET /api/istio/validations` */
  validations(options?: KialiNamespacesOption & CallOptions): Promise<KialiValidationStatus[]> {
    const [{ namespaces }, call] = splitOptions(options);

    return this.ctx.request('GET', '/istio/validations', {
      query: clusterQuery(this.ctx, call, { namespaces: joinList(namespaces) }),
      signal: call.signal,
    });
  }

  /** Create/update/delete permissions per namespace and type. `GET /api/istio/permissions` */
  permissions(options?: KialiNamespacesOption & CallOptions): Promise<KialiIstioPermissions> {
    const [{ namespaces }, call] = splitOptions(options);

    return this.ctx.request('GET', '/istio/permissions', {
      query: clusterQuery(this.ctx, call, { namespaces: joinList(namespaces) }),
      signal: call.signal,
    });
  }
}
