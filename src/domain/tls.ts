/** mTLS status of the mesh or a namespace. */
export interface KialiTlsStatus {
  /** e.g. `'MTLS_ENABLED'`, `'MTLS_PARTIALLY_ENABLED'`, `'MTLS_NOT_ENABLED'`. */
  status: string;
  autoMTLSEnabled: boolean;
  minTLS: string;
  cluster?: string;
  namespace?: string;
}
