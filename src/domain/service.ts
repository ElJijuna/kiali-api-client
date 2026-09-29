import type {
  KialiLabels,
  KialiObjectReference,
  KialiObjectValidation,
  KialiValidations,
} from './common';
import type { KialiServiceHealth } from './health';
import type { KialiResourcePermissions } from './istio';
import type { KialiTlsStatus } from './tls';

/** Service entry of `GET /api/clusters/services`. */
export interface KialiServiceListItem {
  name: string;
  namespace: string;
  cluster?: string;
  health?: KialiServiceHealth;
  isAmbient: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: KialiObjectReference[];
  istioSidecar: boolean;
  kialiWizard: string;
  labels: KialiLabels;
  ports: Record<string, number>;
  serviceRegistry: string;
  validation?: KialiObjectValidation;
  [key: string]: unknown;
}

/** Response of `GET /api/clusters/services`. */
export interface KialiServiceList {
  cluster?: string;
  services: KialiServiceListItem[];
  validations: KialiValidations;
}

/** Kubernetes service definition as returned inside service details. */
export interface KialiServiceDefinition {
  name: string;
  namespace: string;
  cluster: string;
  createdAt: string;
  resourceVersion: string;
  type: string;
  ip: string;
  ips?: string[];
  externalName: string;
  labels?: KialiLabels;
  annotations: KialiLabels;
  selectors?: KialiLabels;
  ports?: {
    name: string;
    port: number;
    protocol: string;
    appProtocol?: string;
    istioProtocol?: string;
    tlsMode?: string;
  }[];
  [key: string]: unknown;
}

/** Response of `GET /api/namespaces/{namespace}/services/{service}`. */
export interface KialiServiceDetails {
  service: KialiServiceDefinition;
  health?: KialiServiceHealth;
  isAmbient: boolean;
  istioSidecar: boolean;
  istioPermissions: KialiResourcePermissions;
  namespaceMTLS?: KialiTlsStatus;
  validations: KialiValidations;
  virtualServices: Record<string, unknown>[];
  destinationRules: Record<string, unknown>[];
  serviceEntries: Record<string, unknown>[];
  k8sHTTPRoutes: Record<string, unknown>[];
  k8sGRPCRoutes: Record<string, unknown>[];
  endpoints?: Record<string, unknown>[];
  workloads?: Record<string, unknown>[];
  [key: string]: unknown;
}
