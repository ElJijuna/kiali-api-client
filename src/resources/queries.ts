import type { KialiGvk } from '../domain/common';
import type { KialiGraphQuery } from '../domain/graph';
import type { KialiIstioConfigQuery } from '../domain/istio';
import type { KialiDashboardQuery, KialiMetricsQuery } from '../domain/metrics';
import type { KialiTracingQuery } from '../domain/tracing';
import { joinList, seg, type QueryParams } from './types';

/**
 * Kiali metrics endpoints take list parameters with a `[]` suffix
 * (`filters[]=a&filters[]=b`).
 * @internal
 */
export function metricsQuery(query: KialiMetricsQuery | KialiDashboardQuery = {}): QueryParams {
  const { filters, byLabels, quantiles, ...rest } = query;

  return {
    ...rest,
    'filters[]': filters,
    'byLabels[]': byLabels,
    'quantiles[]': quantiles,
  };
}

/** @internal */
export function graphQuery(query: KialiGraphQuery = {}): QueryParams {
  const { appenders, boxBy, ...rest } = query;

  return {
    ...rest,
    appenders: typeof appenders === 'string' ? appenders : joinList(appenders),
    boxBy: typeof boxBy === 'string' ? boxBy : joinList(boxBy),
  };
}

/** @internal */
export function tracingQuery(query: KialiTracingQuery = {}): QueryParams {
  const { tags, ...rest } = query;

  return { ...rest, tags: tags ? JSON.stringify(tags) : undefined };
}

/** @internal */
export function istioConfigQuery(query: KialiIstioConfigQuery = {}): QueryParams {
  const { objects, ...rest } = query;

  return {
    ...rest,
    objects: objects
      ?.map((object) => (typeof object === 'string' ? object : gvkToString(object)))
      .join(';'),
  };
}

/**
 * Formats a GVK the way Kiali (and Kubernetes) print it:
 * `networking.istio.io/v1, Kind=VirtualService`, or just the kind for the core group.
 */
export function gvkToString(gvk: KialiGvk): string {
  if (!gvk.group || !gvk.version) {
    return gvk.kind;
  }

  return `${gvk.group}/${gvk.version}, Kind=${gvk.kind}`;
}

/** `/{group}/{version}/{kind}` path segment for Istio config endpoints. @internal */
export function gvkPath(gvk: KialiGvk): string {
  return `/${seg(gvk.group)}/${seg(gvk.version)}/${seg(gvk.kind)}`;
}
