// Installs the packed tarball into a throwaway project and checks that it
// works from CommonJS, ESM and TypeScript (NodeNext) consumers.
//
//   node scripts/test-package.mjs                 # packs the current checkout
//   node scripts/test-package.mjs path/to/pkg.tgz # checks an existing tarball
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), 'kiali-api-client-'));
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
  });
const smoke = `
const assert = require('node:assert/strict');
(async () => {
  const { KialiClient, KialiApiError, gvkToString } = CLIENT;
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/api/authenticate')) {
      return new Response('{"username":"sa"}', { headers: { 'Set-Cookie': 'kiali-token=abc; Path=/' } });
    }
    if (url.includes('/missing/')) {
      return new Response('{"error":"not found"}', { status: 404 });
    }
    return new Response('[{"name":"bookinfo"}]');
  };
  const kiali = new KialiClient({ baseUrl: 'https://kiali.test', sessionToken: 'sa-token', cluster: 'east', fetch });
  const events = [];
  kiali.on('request', () => { throw new Error('observer'); });
  kiali.on('request', (event) => events.push(event.method));
  assert.deepEqual(await kiali.namespaces(), [{ name: 'bookinfo' }]);
  assert.equal(calls[0].init.body, 'token=sa-token');
  assert.equal(calls[1].init.headers.Cookie, 'kiali-token=abc');
  await kiali.namespace('bookinfo').service('reviews');
  assert.equal(calls[2].url, 'https://kiali.test/kiali/api/namespaces/bookinfo/services/reviews?clusterName=east');
  await assert.rejects(kiali.namespace('missing').info(), KialiApiError);
  assert.deepEqual(events, ['POST', 'GET', 'GET', 'GET']);
  assert.equal(gvkToString({ group: 'apps', version: 'v1', kind: 'Deployment' }), 'apps/v1, Kind=Deployment');
})().catch((error) => { console.error(error); process.exitCode = 1; });
`;

try {
  const [, , supplied] = process.argv;

  if (!supplied) {
    run('npm', ['pack', '--ignore-scripts', '--pack-destination', temporary], root);
  }

  const tarball = supplied
    ? resolve(supplied)
    : join(
        temporary,
        readdirSync(temporary).find((name) => name.endsWith('.tgz')),
      );
  const consumer = join(temporary, 'consumer');

  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true }));
  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
    consumer,
  );

  for (const format of ['cjs', 'mjs']) {
    const file = join(consumer, `smoke.${format}`);
    const source =
      format === 'cjs'
        ? smoke.replace('CLIENT', "require('kiali-api-client')")
        : smoke
            .replace(
              "const assert = require('node:assert/strict');",
              "import assert from 'node:assert/strict';",
            )
            .replace('CLIENT', "await import('kiali-api-client')");

    writeFileSync(file, source);
    run(process.execPath, ['--unhandled-rejections=strict', file], consumer);
  }

  // The TypeScript check uses this checkout's compiler (TypeScript 7), so it only runs when packing locally.
  if (!supplied) {
    for (const extension of ['mts', 'cts']) {
      writeFileSync(
        join(consumer, `consumer.${extension}`),
        `
import { KialiClient, KialiApiError, type KialiNamespace, type KialiServiceDetails } from 'kiali-api-client';
const kiali = new KialiClient({ baseUrl: 'https://kiali.test' });
const namespaces: Promise<KialiNamespace[]> = kiali.namespaces();
const details: PromiseLike<KialiServiceDetails> = kiali.namespace('a').service('b');
const error: Error = new KialiApiError(404, 'Not Found');
void namespaces; void details; void error;
`,
      );
    }

    run(
      process.execPath,
      [
        join(root, 'node_modules/@typescript/native/bin/tsc'),
        '--noEmit',
        '--strict',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2022',
        '--lib',
        'ES2022,DOM',
        '--types',
        '',
        'consumer.mts',
        'consumer.cts',
      ],
      consumer,
    );
  }

  console.log('Package consumption checks passed.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
