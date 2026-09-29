/** Response of `GET /api/tracing`. */
export interface KialiTracingInfo {
  enabled: boolean;
  integration: boolean;
  provider: string;
  url: string;
  namespaceSelector: boolean;
  whiteListIstioSystem: string[];
  [key: string]: unknown;
}

/** Query parameters for traces and spans. */
export interface KialiTracingQuery {
  /** Start of the range in microseconds since epoch. */
  startMicros?: number;
  /** End of the range in microseconds since epoch. */
  endMicros?: number;
  limit?: number;
  /** Minimum span duration in microseconds. */
  minDuration?: number;
  /** Tag filter as a JSON object, e.g. `{ error: 'true' }`. */
  tags?: Record<string, string>;
}

/** A span (Jaeger format). */
export interface KialiSpan {
  traceID: string;
  spanID: string;
  operationName: string;
  startTime: number;
  duration: number;
  references?: { refType: string; traceID: string; spanID: string }[];
  tags?: { key: string; type: string; value: unknown }[];
  process?: { serviceName: string; tags?: { key: string; value: unknown }[] };
  [key: string]: unknown;
}

/** A trace (Jaeger format). */
export interface KialiTrace {
  traceID: string;
  spans: KialiSpan[];
  processes?: Record<string, { serviceName: string; tags?: unknown[] }>;
  matchedSpans?: KialiSpan[];
  [key: string]: unknown;
}

/** Response of traces endpoints. */
export interface KialiTracingResponse {
  data: KialiTrace[] | null;
  errors: { code?: number; msg: string; traceID?: string }[];
  fromAllNamespaces?: boolean;
  tracingServiceName?: string;
}

/** Response of `GET /api/traces/{traceID}`. */
export interface KialiTracingSingleResponse {
  data: KialiTrace | null;
  errors: { code?: number; msg: string; traceID?: string }[];
}
