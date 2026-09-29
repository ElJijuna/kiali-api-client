import type { KialiGvk, KialiPatch } from '../domain/common';
import type { KialiIstioConfigDetails } from '../domain/istio';
import { gvkPath } from './queries';
import { clusterQuery, seg, splitOptions, type CallOptions, type ResourceContext } from './types';

/** Options for {@link IstioObjectResource.get}. */
export interface KialiIstioObjectOptions extends CallOptions {
  /** Include validations. */
  validate?: boolean;
  /** Include help messages for the object fields. */
  help?: boolean;
}

/**
 * An Istio or Gateway API object. Await it to fetch its details.
 *
 * @example
 * ```typescript
 * const vs = kiali
 *   .namespace('bookinfo')
 *   .istioObject({ group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' }, 'reviews');
 *
 * const details = await vs;
 * await vs.update({ spec: { hosts: ['reviews'] } });
 * await vs.delete();
 * ```
 */
export class IstioObjectResource implements PromiseLike<KialiIstioConfigDetails> {
  private readonly path: string;

  /** @internal */
  constructor(
    private readonly ctx: ResourceContext,
    readonly namespace: string,
    readonly gvk: KialiGvk,
    readonly name: string,
  ) {
    this.path = `/namespaces/${seg(namespace)}/istio${gvkPath(gvk)}/${seg(name)}`;
  }

  then<TResult1 = KialiIstioConfigDetails, TResult2 = never>(
    onfulfilled?: ((value: KialiIstioConfigDetails) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    // eslint-disable-next-line no-restricted-syntax -- PromiseLike must forward both callbacks.
    return this.get().then(onfulfilled, onrejected);
  }

  /** `GET /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}` */
  get(options?: KialiIstioObjectOptions): Promise<KialiIstioConfigDetails> {
    const [{ help, ...query }, call] = splitOptions(options);

    return this.ctx.request('GET', this.path, {
      // Kiali only checks whether `help` is present, so `help=false` would enable it.
      query: clusterQuery(this.ctx, call, { ...query, help: help ? true : undefined }),
      signal: call.signal,
    });
  }

  /**
   * Applies a JSON merge patch to the object.
   *
   * `PATCH /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}`
   */
  update(patch: KialiPatch, options?: CallOptions): Promise<KialiIstioConfigDetails> {
    return this.ctx.request('PATCH', this.path, {
      query: clusterQuery(this.ctx, options),
      body: patch,
      signal: options?.signal,
    });
  }

  /** `DELETE /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}` */
  delete(options?: CallOptions): Promise<void> {
    return this.ctx.request('DELETE', this.path, {
      query: clusterQuery(this.ctx, options),
      responseType: 'none',
      signal: options?.signal,
    });
  }
}
