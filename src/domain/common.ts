/** Kubernetes labels or annotations. */
export type KialiLabels = Record<string, string>;

/**
 * Group/version/kind as serialized by Kiali in responses (capitalized keys).
 * Workloads, apps and services only set `Kind`.
 */
export interface KialiGroupVersionKind {
  Group: string;
  Version: string;
  Kind: string;
}

/**
 * Group/version/kind used as input by this client, e.g.
 * `{ group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' }`.
 * Use an empty `group` for the core API group.
 */
export interface KialiGvk {
  group: string;
  version: string;
  kind: string;
}

/** Reference to an Istio object attached to a service, workload or app. */
export interface KialiObjectReference {
  name: string;
  namespace: string;
  objectGVK: KialiGroupVersionKind;
  cluster?: string;
}

/** A single validation check result. */
export interface KialiValidationCheck {
  code?: string;
  message: string;
  path: string;
  severity: 'error' | 'warning' | 'info' | 'none' | string;
}

/** Validation result for one object. */
export interface KialiObjectValidation {
  name: string;
  namespace?: string;
  objectGVK: KialiGroupVersionKind;
  valid: boolean;
  checks: KialiValidationCheck[];
  references?: KialiObjectReference[];
}

/** Validations keyed by kind, then by `name.namespace`. */
export type KialiValidations = Record<string, Record<string, KialiObjectValidation>>;

/** Validation summary for a namespace. */
export interface KialiValidationStatus {
  cluster?: string;
  namespace?: string;
  errors: number;
  warnings: number;
  objectCount?: number;
}

/** Kubernetes JSON merge patch or strategic merge patch body. */
export type KialiPatch = Record<string, unknown> | string;
