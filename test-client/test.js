// Live checks against a real Kiali. Read-only: nothing is created or changed.
//
//   KIALI_URL=http://localhost:20001 KIALI_WEB_ROOT=/kiali npm run test:client
//
// Auth: KIALI_SESSION_TOKEN (token strategy) or KIALI_TOKEN (header strategy).
// Optional: KIALI_CLUSTER, KIALI_NAMESPACE (defaults to the first namespace with services).
import assert from 'node:assert/strict';
import { KialiApiError, KialiClient } from '../dist/index.js';

if (!process.env.KIALI_URL) {
  console.error('Set KIALI_URL (and optionally KIALI_WEB_ROOT, KIALI_SESSION_TOKEN, KIALI_TOKEN).');
  process.exit(1);
}

const kiali = KialiClient.fromEnv();

kiali.on('request', (event) => {
  const status = event.statusCode ?? event.error?.name;

  console.log(`  ${event.method} ${event.url} → ${status} (${event.durationMs}ms)`);
});

async function optional(name, operation) {
  try {
    await operation();
  } catch (error) {
    // A failed assertion is a regression, not a missing integration.
    if (error instanceof assert.AssertionError) {
      throw error;
    }

    console.warn(`[SKIP] ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function test() {
  await kiali.healthz();
  console.log('[OK] healthz');

  const auth = await kiali.authInfo();

  console.log('[OK] auth strategy:', auth.strategy);

  const status = await kiali.status();

  assert.ok(status.status['Kiali version']);
  console.log('[OK] Kiali version:', status.status['Kiali version']);

  const config = await kiali.config();

  console.log('[OK] clusters:', Object.keys(config.clusters ?? {}).join(', '));

  const namespaces = await kiali.namespaces();

  assert.ok(Array.isArray(namespaces) && namespaces.length > 0);
  console.log('[OK] namespaces:', namespaces.map((ns) => ns.name).join(', '));

  const services = await kiali.services({ health: false });
  const namespace =
    process.env.KIALI_NAMESPACE ?? services.services[0]?.namespace ?? namespaces[0].name;

  console.log('[OK] services:', services.services.length, '— using namespace', namespace);

  const ns = kiali.namespace(namespace);
  const info = await ns;

  assert.equal(info.name, namespace);
  console.log('[OK] namespace info:', info.name, info.isAmbient ? '(ambient)' : '');
  await optional('namespace tls', async () => console.log('[OK] tls:', (await ns.tls()).status));
  await optional('namespace validations', async () =>
    console.log('[OK] validations:', await ns.validations()),
  );

  const istioConfig = await ns.istioConfig({ validate: true });

  console.log('[OK] istio config types:', Object.keys(istioConfig.resources).length);

  const workloads = await kiali.workloads({ namespaces: [namespace] });
  const apps = await kiali.apps({ namespaces: [namespace] });
  const health = await kiali.health({ namespaces: [namespace] });

  console.log('[OK] workloads/apps:', workloads.workloads.length, apps.applications.length);
  console.log('[OK] health namespaces:', Object.keys(health.namespaceHealth ?? {}).join(', '));

  const service = services.services.find((svc) => svc.namespace === namespace);

  if (service) {
    const details = await ns.service(service.name);

    assert.equal(details.service.name, service.name);
    console.log('[OK] service details:', details.service.name, details.service.type);

    const metrics = await ns.service(service.name).metrics({
      duration: 600,
      filters: ['request_count'],
      direction: 'inbound',
    });

    console.log('[OK] service metrics:', Object.keys(metrics).join(', ') || '(none)');
  }

  const [workload] = workloads.workloads;

  if (workload) {
    const details = await ns.workload(workload.name);
    const [pod] = details.pods;

    console.log('[OK] workload details:', details.name, 'pods:', details.pods.length);

    if (pod) {
      await optional('pod logs', async () => {
        const container = pod.containers?.[0]?.name;
        const logs = await ns.pod(pod.name).logs({ container, maxLines: 5 });

        console.log('[OK] pod logs:', logs.entries.length, 'lines');
      });
    }
  }

  const graph = await kiali.graph({
    namespaces: [namespace],
    graphType: 'versionedApp',
    duration: '600s',
  });

  console.log('[OK] graph nodes:', graph.elements.nodes?.length ?? 0);

  await optional('mesh control planes', async () =>
    console.log('[OK] control planes:', (await kiali.mesh.controlPlanes()).length),
  );
  await optional('istio status', async () =>
    console.log('[OK] istio components:', (await kiali.istio.status()).length),
  );
  await optional('tracing', async () =>
    console.log('[OK] tracing:', (await kiali.tracing.info()).provider),
  );

  await assert.rejects(kiali.namespace('zzq-kiali-api-client-missing').info(), (error) => {
    assert.ok(error instanceof KialiApiError);
    assert.ok([403, 404].includes(error.status));
    console.log('[OK] KialiApiError:', error.message);

    return true;
  });
}

try {
  await test();
  console.log('\nAll live checks passed.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
