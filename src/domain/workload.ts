import type {
  KialiGroupVersionKind,
  KialiLabels,
  KialiObjectReference,
  KialiObjectValidation,
  KialiValidations,
} from './common';
import type { KialiWorkloadHealth } from './health';
import type { KialiPod } from './pod';

/** Workload entry of `GET /api/clusters/workloads`. */
export interface KialiWorkloadListItem {
  name: string;
  namespace: string;
  cluster?: string;
  gvk: KialiGroupVersionKind;
  health?: KialiWorkloadHealth;
  appLabel: boolean;
  versionLabel: boolean;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: KialiObjectReference[];
  istioSidecar: boolean;
  labels: KialiLabels;
  validations?: KialiObjectValidation;
  [key: string]: unknown;
}

/** Response of `GET /api/clusters/workloads`. */
export interface KialiWorkloadList {
  cluster?: string;
  workloads: KialiWorkloadListItem[];
  validations: KialiValidations;
}

/** Response of `GET /api/namespaces/{namespace}/workloads/{workload}`. */
export interface KialiWorkload {
  name: string;
  namespace: string;
  cluster?: string;
  gvk: KialiGroupVersionKind;
  createdAt: string;
  resourceVersion: string;
  labels: KialiLabels;
  annotations: KialiLabels;
  appLabel: boolean;
  versionLabel: boolean;
  replicas: number;
  availableReplicas: number;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioSidecar: boolean;
  health?: KialiWorkloadHealth;
  pods: KialiPod[];
  services: Record<string, unknown>[];
  runtimes: { name: string; dashboardRefs: { template: string; title: string }[] }[];
  validations?: KialiValidations;
  [key: string]: unknown;
}
