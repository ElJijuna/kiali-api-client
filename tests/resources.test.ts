import {
  AppResource,
  gvkToString,
  IstioObjectResource,
  NamespaceResource,
  PodResource,
  ServiceResource,
  WorkloadResource,
} from '../src';
import { json, setup, target } from './helpers';

const VS = { group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' };

describe('NamespaceResource', () => {
  it('is awaitable and resolves to the namespace info', async () => {
    const { client, calls } = setup({ cluster: 'east' }, () => json({ name: 'bookinfo' }));
    const namespace = client.namespace('bookinfo');

    expect(namespace).toBeInstanceOf(NamespaceResource);
    expect(namespace.name).toBe('bookinfo');
    await expect(namespace).resolves.toEqual({ name: 'bookinfo' });
    expect(target(calls[0])).toBe('/kiali/api/namespaces/bookinfo/info?clusterName=east');
  });

  it('propagates rejections through then()', async () => {
    const { client } = setup({}, () => json({ error: 'x' }, { status: 403 }));

    await expect(client.namespace('a')).rejects.toMatchObject({ status: 403 });
  });

  it('encodes path segments', async () => {
    const { client, calls } = setup();

    await client.namespace('a/b').info();
    expect(calls[0]?.url.pathname).toBe('/kiali/api/namespaces/a%2Fb/info');
  });

  it.each([
    [
      'tls',
      (ns: NamespaceResource) => ns.tls(),
      '/kiali/api/namespaces/bookinfo/tls?clusterName=east',
    ],
    [
      'validations',
      (ns: NamespaceResource) => ns.validations(),
      '/kiali/api/namespaces/bookinfo/validations?clusterName=east',
    ],
    [
      'metrics',
      (ns: NamespaceResource) =>
        ns.metrics({
          filters: ['request_count'],
          byLabels: ['app'],
          quantiles: ['0.99'],
          direction: 'inbound',
        }),
      '/kiali/api/namespaces/bookinfo/metrics?direction=inbound&filters[]=request_count&byLabels[]=app&quantiles[]=0.99&clusterName=east',
    ],
    [
      'health',
      (ns: NamespaceResource) => ns.health({ type: 'service', rateInterval: '5m' }),
      '/kiali/api/clusters/health?type=service&rateInterval=5m&namespaces=bookinfo&clusterName=east',
    ],
    [
      'istioConfig',
      (ns: NamespaceResource) => ns.istioConfig({ validate: true, labelSelector: 'app=reviews' }),
      '/kiali/api/namespaces/bookinfo/istio?validate=true&labelSelector=app=reviews&clusterName=east',
    ],
    [
      'aggregateMetrics (not cluster-scoped)',
      (ns: NamespaceResource) =>
        ns.aggregateMetrics('request_operation', 'GetReviews', { duration: 60 }),
      '/kiali/api/namespaces/bookinfo/aggregates/request_operation/GetReviews/metrics?duration=60',
    ],
    [
      'aggregateGraph',
      (ns: NamespaceResource) =>
        ns.aggregateGraph('request_operation', 'Get', { graphType: 'workload' }),
      '/kiali/api/namespaces/bookinfo/aggregates/request_operation/Get/graph?graphType=workload&clusterName=east',
    ],
    [
      'aggregateGraph by service',
      (ns: NamespaceResource) =>
        ns.aggregateGraph('request_operation', 'Get', { service: 'reviews' }),
      '/kiali/api/namespaces/bookinfo/aggregates/request_operation/Get/reviews/graph?clusterName=east',
    ],
    [
      'controlPlaneMetrics',
      (ns: NamespaceResource) => ns.controlPlaneMetrics('istiod', { duration: 60 }),
      '/kiali/api/namespaces/bookinfo/controlplanes/istiod/metrics?duration=60&clusterName=east',
    ],
    [
      'customDashboard',
      (ns: NamespaceResource) => ns.customDashboard('envoy', { rawDataAggregator: 'avg' }),
      '/kiali/api/namespaces/bookinfo/customdashboard/envoy?rawDataAggregator=avg&clusterName=east',
    ],
    [
      'ztunnelDashboard',
      (ns: NamespaceResource) => ns.ztunnelDashboard('ztunnel'),
      '/kiali/api/namespaces/bookinfo/ztunnel/ztunnel/dashboard?clusterName=east',
    ],
  ])('%s', async (_, call, expected) => {
    const { client, calls } = setup({ cluster: 'east' });

    await call(client.namespace('bookinfo'));
    expect(target(calls[0])).toBe(expected);
  });

  it('creates an Istio object', async () => {
    const { client, calls } = setup();
    const object = { metadata: { name: 'reviews' }, spec: { hosts: ['reviews'] } };

    await client.namespace('bookinfo').createIstioObject(VS, object);
    expect(calls[0]?.init.method).toBe('POST');
    expect(target(calls[0])).toBe(
      '/kiali/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService',
    );
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(object);
  });

  it('returns child resources', () => {
    const { client } = setup();
    const ns = client.namespace('bookinfo');

    expect(ns.service('reviews')).toBeInstanceOf(ServiceResource);
    expect(ns.workload('reviews-v1')).toBeInstanceOf(WorkloadResource);
    expect(ns.app('reviews')).toBeInstanceOf(AppResource);
    expect(ns.pod('reviews-v1-abc')).toBeInstanceOf(PodResource);
    expect(ns.istioObject(VS, 'reviews')).toBeInstanceOf(IstioObjectResource);
  });
});

describe('ServiceResource', () => {
  it('gets details (awaitable) and sub-resources', async () => {
    const { client, calls } = setup({ cluster: 'east' });
    const svc = client.namespace('bookinfo').service('reviews');

    await svc;
    await svc.get({ validate: true, rateInterval: '5m', cluster: 'west' });
    await svc.metrics({ duration: 600, step: 15, reporter: 'destination' });
    await svc.dashboard();
    await svc.graph({ graphType: 'workload' });
    await svc.traces({ startMicros: 1, endMicros: 2, limit: 10, tags: { error: 'true' } });
    await svc.spans({ limit: 5 });
    expect(calls.map(target)).toEqual([
      '/kiali/api/namespaces/bookinfo/services/reviews?clusterName=east',
      '/kiali/api/namespaces/bookinfo/services/reviews?validate=true&rateInterval=5m&clusterName=west',
      '/kiali/api/namespaces/bookinfo/services/reviews/metrics?duration=600&step=15&reporter=destination&clusterName=east',
      '/kiali/api/namespaces/bookinfo/services/reviews/dashboard?clusterName=east',
      '/kiali/api/namespaces/bookinfo/services/reviews/graph?graphType=workload&clusterName=east',
      '/kiali/api/namespaces/bookinfo/services/reviews/traces?startMicros=1&endMicros=2&limit=10&tags={"error":"true"}&clusterName=east',
      '/kiali/api/namespaces/bookinfo/services/reviews/spans?limit=5&clusterName=east',
    ]);
  });

  it('patches the service with a pre-serialized body', async () => {
    const { client, calls } = setup();

    await client
      .namespace('bookinfo')
      .service('reviews')
      .update('{"metadata":{}}', { patchType: 'json' });
    expect(calls[0]?.init.method).toBe('PATCH');
    expect(calls[0]?.init.body).toBe('{"metadata":{}}');
    expect(target(calls[0])).toBe('/kiali/api/namespaces/bookinfo/services/reviews?patchType=json');
  });
});

describe('WorkloadResource', () => {
  it('gets details and sub-resources', async () => {
    const { client, calls } = setup();
    const wl = client.namespace('bookinfo').workload('reviews-v1');

    await wl;
    await wl.metrics();
    await wl.dashboard();
    await wl.graph();
    await wl.traces();
    await wl.spans();
    expect(calls.map((call) => call.url.pathname)).toEqual([
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1',
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1/metrics',
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1/dashboard',
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1/graph',
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1/traces',
      '/kiali/api/namespaces/bookinfo/workloads/reviews-v1/spans',
    ]);
  });

  it('sends the workload GVK on update, defaulting to Deployment', async () => {
    const { client, calls } = setup();
    const wl = client.namespace('bookinfo').workload('reviews-v1');

    await wl.update({ spec: { replicas: 2 } });
    await wl.update(
      {},
      { gvk: { group: 'apps', version: 'v1', kind: 'StatefulSet' }, validate: true },
    );
    await wl.update({}, { gvk: 'apps/v1, Kind=DaemonSet' });
    expect(calls.map((call) => call.url.searchParams.get('gvk'))).toEqual([
      'apps/v1, Kind=Deployment',
      'apps/v1, Kind=StatefulSet',
      'apps/v1, Kind=DaemonSet',
    ]);
    expect(calls[1]?.url.searchParams.get('validate')).toBe('true');
  });
});

describe('AppResource', () => {
  it('covers details, metrics, graph and traces', async () => {
    const { client, calls } = setup({}, () => json(3));
    const app = client.namespace('bookinfo').app('reviews');

    await app;
    await app.get({ health: false });
    await app.metrics();
    await app.dashboard();
    await app.graph();
    await app.graph({ version: 'v2', graphType: 'app' });
    await app.traces();
    await app.spans();
    await expect(app.errorTraces({ duration: 600 })).resolves.toBe(3);
    expect(calls.map(target)).toEqual([
      '/kiali/api/namespaces/bookinfo/apps/reviews',
      '/kiali/api/namespaces/bookinfo/apps/reviews?health=false',
      '/kiali/api/namespaces/bookinfo/apps/reviews/metrics',
      '/kiali/api/namespaces/bookinfo/apps/reviews/dashboard',
      '/kiali/api/namespaces/bookinfo/applications/reviews/graph',
      '/kiali/api/namespaces/bookinfo/applications/reviews/versions/v2/graph?graphType=app',
      '/kiali/api/namespaces/bookinfo/apps/reviews/traces',
      '/kiali/api/namespaces/bookinfo/apps/reviews/spans',
      '/kiali/api/namespaces/bookinfo/apps/reviews/errortraces?duration=600',
    ]);
  });
});

describe('PodResource', () => {
  it('covers details, logs, config dumps and log level', async () => {
    const { client, calls } = setup({ cluster: 'east' }, () => json({}));
    const pod = client.namespace('bookinfo').pod('reviews-v1-abc');

    await pod;
    await pod.logs({ container: 'istio-proxy', duration: 600, maxLines: 50, logType: 'proxy' });
    await pod.logs();
    await pod.configDump();
    await pod.configDump('clusters');
    await pod.ztunnelConfigDump();
    await expect(pod.setProxyLogLevel('debug')).resolves.toBeUndefined();
    expect(calls.map(target)).toEqual([
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc?clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/logs?container=istio-proxy&maxLines=50&logType=proxy&duration=600s&clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/logs?clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/config_dump?clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/config_dump/clusters?clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/config_dump_ztunnel?clusterName=east',
      '/kiali/api/namespaces/bookinfo/pods/reviews-v1-abc/logging?level=debug&clusterName=east',
    ]);
    expect(calls.at(-1)?.init.method).toBe('POST');
  });
});

describe('IstioObjectResource', () => {
  it('gets, updates and deletes', async () => {
    const { client, calls } = setup(
      {},
      () => json({}),
      () => json({}),
      () => json({}),
      () => new Response(null),
    );
    const vs = client.namespace('bookinfo').istioObject(VS, 'reviews');
    const path =
      '/kiali/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/reviews';

    await vs;
    await vs.get({ validate: true, help: true });
    await vs.get({ help: false });
    await vs.update({ spec: { hosts: ['x'] } });
    await expect(vs.delete()).resolves.toBeUndefined();
    expect(calls.map(target)).toEqual([path, `${path}?validate=true&help=true`, path, path, path]);
    expect(calls.map((call) => call.init.method)).toEqual(['GET', 'GET', 'GET', 'PATCH', 'DELETE']);
  });
});

describe('gvkToString', () => {
  it('formats like Kubernetes', () => {
    expect(gvkToString(VS)).toBe('networking.istio.io/v1, Kind=VirtualService');
    expect(gvkToString({ group: '', version: 'v1', kind: 'Service' })).toBe('Service');
  });
});
