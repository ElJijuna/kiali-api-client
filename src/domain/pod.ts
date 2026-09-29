import type { KialiLabels } from './common';

/** A container of a pod. */
export interface KialiContainer {
  name: string;
  image: string;
  isProxy: boolean;
  isReady: boolean;
  isAmbient?: boolean;
}

/** Pod as returned inside workload details and by `GET .../pods/{pod}`. */
export interface KialiPod {
  name: string;
  labels: KialiLabels;
  annotations?: KialiLabels;
  createdAt: string;
  createdBy: { name: string; kind: string }[];
  containers?: KialiContainer[];
  istioContainers?: KialiContainer[];
  istioInitContainers?: KialiContainer[];
  status: string;
  statusMessage?: string;
  statusReason?: string;
  appLabel: boolean;
  versionLabel: boolean;
  serviceAccountName: string;
  proxyStatus?: { CDS: string; EDS: string; LDS: string; RDS: string };
  [key: string]: unknown;
}

/** One log line. */
export interface KialiLogEntry {
  message: string;
  severity: string;
  timestamp: string;
  timestampUnix: number;
  accessLog?: Record<string, string>;
}

/** Response of `GET .../pods/{pod}/logs`. */
export interface KialiPodLogs {
  entries: KialiLogEntry[];
  linesTruncated?: boolean;
}

/** Query parameters for pod logs. */
export interface KialiPodLogsQuery {
  /** Container name. Required when the pod has more than one container. */
  container?: string;
  /** Only return lines newer than this, in seconds (e.g. `600`). */
  duration?: number;
  /** RFC 3339 or Unix timestamp to start from. */
  sinceTime?: string | number;
  maxLines?: number;
  /** `'app'`, `'proxy'`, `'ztunnel'` or `'waypoint'`. */
  logType?: 'app' | 'proxy' | 'ztunnel' | 'waypoint';
  /** Workload name, used to filter ztunnel logs. */
  workload?: string;
  /** Service name, used to filter waypoint logs. */
  service?: string;
}

/** Envoy log level accepted by `setProxyLogLevel()`. */
export type KialiProxyLogLevel =
  | 'off'
  | 'trace'
  | 'debug'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';
