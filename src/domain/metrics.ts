/** `[timestamp, value, y0?]` */
export type KialiDatapoint = [number, number, number?];

/** A Prometheus time series. */
export interface KialiMetric {
  name: string;
  labels: Record<string, string>;
  datapoints: KialiDatapoint[];
  stat?: string;
}

/** Metrics keyed by metric name, e.g. `request_count`, `request_duration_millis`. */
export type KialiMetricsMap = Record<string, KialiMetric[]>;

/** Metrics keyed by namespace. */
export type KialiMetricsPerNamespace = Record<string, KialiMetricsMap>;

/** Query parameters for metrics endpoints. */
export interface KialiMetricsQuery {
  /** Time range in seconds. */
  duration?: number;
  /** Resolution in seconds. */
  step?: number;
  /** Prometheus rate interval, e.g. `'1m'`. */
  rateInterval?: string;
  /** `'rate'` or `'irate'`. */
  rateFunc?: 'rate' | 'irate';
  /** End of the range as a Unix timestamp in seconds. */
  queryTime?: number;
  /** Metric names, e.g. `['request_count', 'request_error_count']`. */
  filters?: readonly string[];
  /** Prometheus labels to group by, e.g. `['destination_workload']`. */
  byLabels?: readonly string[];
  /** Histogram quantiles, e.g. `['0.5', '0.95', '0.99']`. */
  quantiles?: readonly string[];
  /** Include histogram averages. */
  avg?: boolean;
  direction?: 'inbound' | 'outbound';
  reporter?: 'source' | 'destination' | 'both';
  requestProtocol?: string;
}

/** Query parameters for dashboard endpoints. */
export interface KialiDashboardQuery extends KialiMetricsQuery {
  /** Prometheus labels to aggregate by, `name:displayName` pairs. */
  additionalLabels?: string;
  labelsFilters?: string;
  rawDataAggregator?: 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'stdvar';
  workload?: string;
  workloadType?: string;
}

/** A dashboard (built-in Istio metrics or a custom dashboard). */
export interface KialiDashboard {
  name: string;
  title: string;
  charts: {
    name: string;
    unit: string;
    spans: number;
    chartType?: string;
    metrics: KialiMetric[];
    [key: string]: unknown;
  }[];
  aggregations: { label: string; displayName: string; singleSelection?: boolean }[];
  externalLinks?: { name: string; url: string }[];
  rows?: number;
  [key: string]: unknown;
}
