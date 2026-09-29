/** HTTP methods used by the Kiali API. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** A single query-string value. Arrays are sent as repeated parameters. */
export type QueryValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[]
  | null
  | undefined;

/** Query-string parameters. `undefined` and `null` values are omitted. */
export type QueryParams = Record<string, QueryValue>;

/** Options accepted by every API method. */
export interface CallOptions {
  /**
   * Target cluster in a multi-cluster mesh, sent as `clusterName`. Overrides
   * the client-level `cluster` option. Ignored by endpoints that are not
   * cluster-scoped.
   */
  cluster?: string;
  /** Aborts the request. */
  signal?: AbortSignal;
}

/** @internal */
export interface RequestOptions {
  query?: QueryParams;
  /** JSON body. Strings are sent as-is (e.g. a pre-serialized patch). */
  body?: unknown;
  /** `application/x-www-form-urlencoded` body. */
  form?: Record<string, string>;
  /** How to read a successful response. Defaults to `'json'`. */
  responseType?: 'json' | 'text' | 'none';
  signal?: AbortSignal;
}

/** @internal */
export type RequestFn = <T>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions,
) => Promise<T>;

/**
 * Shared state handed to every resource.
 * @internal
 */
export interface ResourceContext {
  request: RequestFn;
  /** Client-level default cluster. */
  cluster?: string;
}

/**
 * Builds the query for a cluster-scoped endpoint: adds `clusterName` from the
 * call options, falling back to the client default.
 * @internal
 */
export function clusterQuery(
  ctx: ResourceContext,
  options: CallOptions | undefined,
  query: QueryParams = {},
): QueryParams {
  return { ...query, clusterName: options?.cluster ?? ctx.cluster };
}

/**
 * Removes the {@link CallOptions} keys from an options object so the rest can be
 * sent as query parameters.
 * @internal
 */
export function splitOptions<T extends CallOptions>(
  options: T | undefined,
): [Omit<T, keyof CallOptions>, CallOptions] {
  const { cluster, signal, ...rest } = options ?? ({} as T);

  return [rest, { cluster, signal }];
}

/** Joins a namespace list into Kiali's comma-separated form. @internal */
export function joinList(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'string' ? value : value.join(',');
}

/** Encodes one path segment. @internal */
export const seg = encodeURIComponent;
