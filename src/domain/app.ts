import type { KialiGroupVersionKind, KialiLabels, KialiObjectReference } from './common';
import type { KialiAppHealth } from './health';
import type { KialiNamespace } from './namespace';

/** App entry of `GET /api/clusters/apps`. */
export interface KialiAppListItem {
  name: string;
  namespace: string;
  cluster?: string;
  health?: KialiAppHealth;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: KialiObjectReference[];
  istioSidecar: boolean;
  labels: KialiLabels;
  [key: string]: unknown;
}

/** Response of `GET /api/clusters/apps`. */
export interface KialiAppList {
  cluster?: string;
  applications: KialiAppListItem[];
}

/** A workload that belongs to an app. */
export interface KialiAppWorkload {
  workloadName: string;
  namespace: string;
  gvk: KialiGroupVersionKind;
  labels: KialiLabels;
  serviceAccountNames: string[];
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioSidecar: boolean;
  [key: string]: unknown;
}

/** Response of `GET /api/namespaces/{namespace}/apps/{app}`. */
export interface KialiApp {
  name: string;
  namespace: KialiNamespace;
  cluster?: string;
  health?: KialiAppHealth;
  isAmbient: boolean;
  serviceNames: string[];
  workloads: KialiAppWorkload[];
  runtimes: { name: string; dashboardRefs: { template: string; title: string }[] }[];
  [key: string]: unknown;
}
