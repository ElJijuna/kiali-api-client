/** Graph type. */
export type KialiGraphType = 'app' | 'versionedApp' | 'workload' | 'service';

/** Query parameters for graph endpoints. */
export interface KialiGraphQuery {
  graphType?: KialiGraphType;
  /** Time range, e.g. `'600s'`. */
  duration?: string;
  /** End of the range as a Unix timestamp in seconds. */
  queryTime?: number;
  /** Comma-separated or list of appenders, e.g. `['deadNode', 'responseTime']`. */
  appenders?: string | readonly string[];
  boxBy?: string | readonly ('app' | 'cluster' | 'namespace' | 'none')[];
  includeIdleEdges?: boolean;
  injectServiceNodes?: boolean;
  ambientTraffic?: 'none' | 'total' | 'waypoint' | 'ztunnel';
  rateGrpc?: 'none' | 'received' | 'requests' | 'sent' | 'total';
  rateHttp?: 'none' | 'requests';
  rateTcp?: 'none' | 'received' | 'sent' | 'total';
  responseTime?: 'avg' | '50' | '95' | '99';
  throughputType?: 'request' | 'response';
  waypoints?: boolean;
  /** Refresh interval hint for the graph cache, e.g. `'60s'`. */
  refreshInterval?: string;
}

/** Node data (Cytoscape format). */
export interface KialiGraphNodeData {
  id: string;
  nodeType: 'aggregate' | 'app' | 'box' | 'service' | 'unknown' | 'workload' | string;
  cluster: string;
  namespace: string;
  app?: string;
  service?: string;
  workload?: string;
  version?: string;
  parent?: string;
  traffic?: { protocol: string; rates?: Record<string, string> }[];
  healthData?: unknown;
  [key: string]: unknown;
}

/** Edge data (Cytoscape format). */
export interface KialiGraphEdgeData {
  id: string;
  source: string;
  target: string;
  responseTime?: number;
  throughput?: number;
  isMTLS?: number;
  traffic?: { protocol: string; rates?: Record<string, string>; responses?: unknown };
  [key: string]: unknown;
}

/** Graph response. */
export interface KialiGraph {
  timestamp: number;
  duration: number;
  graphType: KialiGraphType;
  elements: {
    nodes?: { data: KialiGraphNodeData }[];
    edges?: { data: KialiGraphEdgeData }[];
  };
}
