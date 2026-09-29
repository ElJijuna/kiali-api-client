/** A control plane (istiod revision) discovered by Kiali (`GET /api/mesh/controlplanes`). */
export interface KialiControlPlane {
  istiodName: string;
  istiodNamespace: string;
  revision: string;
  cluster: { name: string; isKialiHome?: boolean; [key: string]: unknown };
  managedClusters?: { name: string; [key: string]: unknown }[];
  managedNamespaces?: { name: string; cluster?: string; [key: string]: unknown }[];
  version?: { name: string; version: string; [key: string]: unknown };
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Response of `GET /api/mesh/graph` (Cytoscape format). */
export interface KialiMeshGraph {
  timestamp: number;
  meshNames?: string[];
  elements: {
    nodes?: {
      data: { id: string; infraType?: string; infraName?: string; [key: string]: unknown };
    }[];
    edges?: { data: { id: string; source: string; target: string; [key: string]: unknown } }[];
  };
  [key: string]: unknown;
}
