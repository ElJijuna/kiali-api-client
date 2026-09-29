import type { KialiLabels, KialiValidationStatus } from './common';
import type { KialiMetric } from './metrics';
import type { KialiTlsStatus } from './tls';

/** Namespace as returned by `GET /api/namespaces`. */
export interface KialiNamespace {
  name: string;
  cluster?: string;
  isAmbient?: boolean;
  isControlPlane?: boolean;
  labels?: KialiLabels;
  annotations?: KialiLabels;
  revision?: string;
}

/** Names of resources grouped by health status. */
export interface KialiNamespaceStatus {
  inError: string[];
  inNotReady: string[];
  inSuccess: string[];
  inWarning: string[];
  notAvailable: string[];
}

/** Response of `GET /api/namespaces/{namespace}/info`. */
export interface KialiNamespaceInfo extends KialiNamespace {
  outboundPolicyMode?: string;
  metrics?: KialiMetric[];
  errorMetrics?: KialiMetric[];
  status?: KialiNamespaceStatus;
  statusApp?: KialiNamespaceStatus;
  statusService?: KialiNamespaceStatus;
  statusWorkload?: KialiNamespaceStatus;
  tlsStatus?: KialiTlsStatus;
  validations?: KialiValidationStatus;
  worstStatus?: string;
  [key: string]: unknown;
}
