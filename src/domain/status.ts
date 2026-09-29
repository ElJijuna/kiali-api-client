/** An external service Kiali integrates with (Prometheus, Grafana, tracing, ...). */
export interface KialiExternalServiceInfo {
  name: string;
  url?: string;
  version?: string;
  tempoConfig?: Record<string, unknown>;
}

/** Response of `GET /api/status`. */
export interface KialiStatus {
  /** Keys such as `'Kiali version'`, `'Kiali commit hash'`, `'Kiali state'`. */
  status: Record<string, string>;
  externalServices: KialiExternalServiceInfo[];
  warningMessages: string[];
  istioEnvironment?: { istioAPIEnabled: boolean };
}

/** Authentication strategy configured in Kiali. */
export type KialiAuthStrategy = 'anonymous' | 'token' | 'openshift' | 'openid' | 'header';

/** Current session, when authenticated. */
export interface KialiSessionInfo {
  username?: string;
  expiresOn?: string;
  clusterInfo?: Record<string, { name: string }>;
}

/** Response of `GET /api/auth/info`. */
export interface KialiAuthInfo {
  strategy: KialiAuthStrategy;
  authorizationEndpoint?: string;
  authorizationEndpointPerCluster?: Record<string, string>;
  logoutEndpoint?: string;
  logoutRedirect?: string;
  sessionInfo: KialiSessionInfo;
}

/** Session returned by `POST /api/authenticate`. */
export interface KialiLoginSession {
  username?: string;
  expiresOn?: string;
}

/** Response of `GET /api/logout`. */
export interface KialiLogoutResponse {
  redirect_url?: string;
}

/**
 * Response of `GET /api/config`: the public server configuration used by the
 * Kiali UI. Only the most used fields are typed.
 */
export interface KialiServerConfig {
  accessibleNamespaces?: string[];
  authStrategy?: KialiAuthStrategy;
  clusters?: Record<string, KialiClusterInfo>;
  deployment?: { viewOnlyMode?: boolean; [key: string]: unknown };
  istioNamespace?: string;
  istioLabels?: Record<string, string>;
  kialiFeatureFlags?: Record<string, unknown>;
  prometheus?: { globalScrapeInterval?: number; storageTsdbRetention?: number };
  [key: string]: unknown;
}

/** A cluster known to Kiali. */
export interface KialiClusterInfo {
  name: string;
  isKialiHome?: boolean;
  accessible?: boolean;
  apiEndpoint?: string;
  secretName?: string;
  kialiInstances?: {
    namespace: string;
    operatorResource?: string;
    serviceName: string;
    url: string;
    version: string;
  }[];
  [key: string]: unknown;
}

/** Response of `GET /api/grafana`. */
export interface KialiGrafanaInfo {
  datasourceUID?: string;
  externalLinks: { name: string; url: string; variables?: Record<string, string> }[];
}

/** Response of `GET /api/perses`. */
export interface KialiPersesInfo {
  enabled?: boolean;
  externalLinks?: { name: string; url: string; variables?: Record<string, string> }[];
  [key: string]: unknown;
}
