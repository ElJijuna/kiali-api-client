import type { KialiNamespaceStatus } from './namespace';

/** Health status computed by Kiali. */
export type KialiHealthStatusName = 'Healthy' | 'Degraded' | 'Failure' | 'Not Ready' | 'NA';

/** Status pre-computed by the backend. */
export interface KialiCalculatedHealthStatus {
  status: KialiHealthStatusName | string;
  /** Error ratio as a percentage (0-100). */
  errorRatio?: number;
  /** Total request rate in req/s. */
  totalRequestRate?: number;
}

/** Request rates by protocol and response code, e.g. `{ http: { '200': 1.2 } }`. */
export type KialiRequestRates = Record<string, Record<string, number>>;

/** Traffic health of a service, workload or app. */
export interface KialiRequestHealth {
  healthAnnotations: Record<string, string>;
  inbound: KialiRequestRates;
  outbound: KialiRequestRates;
}

/** Replica and proxy sync status of a workload. */
export interface KialiWorkloadStatus {
  name: string;
  availableReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  syncedProxies: number;
}

/** Health of a service. */
export interface KialiServiceHealth {
  requests: KialiRequestHealth;
  status?: KialiCalculatedHealthStatus;
}

/** Health of an app. */
export interface KialiAppHealth {
  requests: KialiRequestHealth;
  workloadStatuses: KialiWorkloadStatus[];
  status?: KialiCalculatedHealthStatus;
}

/** Health of a workload. */
export interface KialiWorkloadHealth {
  requests: KialiRequestHealth;
  workloadStatus?: KialiWorkloadStatus;
  status?: KialiCalculatedHealthStatus;
}

/** Aggregated health for one namespace. */
export interface KialiNamespaceHealthAggregate {
  statusApp?: KialiNamespaceStatus;
  statusService?: KialiNamespaceStatus;
  statusWorkload?: KialiNamespaceStatus;
  worstStatus: string;
}

/** Response of `GET /api/clusters/health`. Maps are keyed by namespace, then by name. */
export interface KialiClustersHealth {
  namespaceAppHealth?: Record<string, Record<string, KialiAppHealth>>;
  namespaceServiceHealth?: Record<string, Record<string, KialiServiceHealth>>;
  namespaceWorkloadHealth?: Record<string, Record<string, KialiWorkloadHealth>>;
  namespaceHealth?: Record<string, KialiNamespaceHealthAggregate>;
}
