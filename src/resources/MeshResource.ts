import type { KialiControlPlane, KialiMeshGraph } from '../domain/mesh';
import type { KialiTlsStatus } from '../domain/tls';
import type { CallOptions, QueryParams, ResourceContext } from './types';
import { clusterQuery } from './types';

/**
 * Mesh-wide endpoints: `kiali.mesh`.
 *
 * @example
 * ```typescript
 * const controlPlanes = await kiali.mesh.controlPlanes();
 * const tls = await kiali.mesh.tls({ revision: 'default' });
 * ```
 */
export class MeshResource {
  /** @internal */
  constructor(private readonly ctx: ResourceContext) {}

  /** Mesh topology (clusters, control planes, data planes). `GET /api/mesh/graph` */
  graph(query?: QueryParams, options?: Pick<CallOptions, 'signal'>): Promise<KialiMeshGraph> {
    return this.ctx.request('GET', '/mesh/graph', { query, signal: options?.signal });
  }

  /** Istio control planes. `GET /api/mesh/controlplanes` */
  controlPlanes(options?: Pick<CallOptions, 'signal'>): Promise<KialiControlPlane[]> {
    return this.ctx.request('GET', '/mesh/controlplanes', { signal: options?.signal });
  }

  /** Mesh-wide mTLS status for a control plane revision. `GET /api/mesh/tls` */
  tls(options?: { revision?: string } & CallOptions): Promise<KialiTlsStatus> {
    return this.ctx.request('GET', '/mesh/tls', {
      query: clusterQuery(this.ctx, options, { revision: options?.revision }),
      signal: options?.signal,
    });
  }
}
