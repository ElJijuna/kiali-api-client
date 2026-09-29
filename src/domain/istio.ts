import type { KialiGroupVersionKind, KialiObjectValidation, KialiValidations } from './common';

/** Whether the user can create, update or delete an object type. */
export interface KialiResourcePermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
}

/** Kubernetes object metadata. */
export interface KialiObjectMeta {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resourceVersion?: string;
  creationTimestamp?: string;
  [key: string]: unknown;
}

/** An Istio or Gateway API object. */
export interface KialiIstioObject {
  apiVersion?: string;
  kind?: string;
  metadata: KialiObjectMeta;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Response of `GET /api/namespaces/{namespace}/istio` and `GET /api/istio/config`. */
export interface KialiIstioConfigList {
  /** Objects keyed by GVK string, e.g. `'networking.istio.io/v1, Kind=VirtualService'`. */
  resources: Record<string, KialiIstioObject[]>;
  validations: KialiValidations;
  permissions?: Record<string, KialiResourcePermissions>;
}

/** Query parameters for Istio config lists. */
export interface KialiIstioConfigQuery {
  /** Only these object types, as GVK strings or `{ group, version, kind }`. */
  objects?: readonly (string | { group: string; version: string; kind: string })[];
  /** Include validations. */
  validate?: boolean;
  labelSelector?: string;
  workloadSelector?: string;
}

/** Response of `GET /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}`. */
export interface KialiIstioConfigDetails {
  namespace: { name: string };
  cluster?: string;
  gvk: KialiGroupVersionKind;
  resource: KialiIstioObject;
  permissions: KialiResourcePermissions;
  validation?: KialiObjectValidation;
  references?: Record<string, unknown>;
  help?: { objectField: string; message: string }[];
  [key: string]: unknown;
}

/** Status of an Istio control plane component (`GET /api/istio/status`). */
export interface KialiComponentStatus {
  name: string;
  cluster: string;
  isCore: boolean;
  meshId?: string;
  status: 'Healthy' | 'Unhealthy' | 'Unreachable' | 'NotFound' | 'NotReady' | string;
}

/** Response of `GET /api/istio/permissions`: namespace → GVK string → permissions. */
export type KialiIstioPermissions = Record<string, Record<string, KialiResourcePermissions>>;
