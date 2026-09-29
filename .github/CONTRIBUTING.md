# Contributing

Thank you for your interest in contributing to `kiali-api-client`!

## Development setup

```bash
git clone https://github.com/ElJijuna/kiali-api-client.git
cd kiali-api-client
npm install
```

Node.js 20.19+, 22.13+ or 24+ is required for the tooling (ESLint 10).

## Checks

```bash
npm run check          # lint, format check, typecheck (TypeScript 7), tests, build
npm run test:coverage
npm run test:package   # packs the library and runs CJS, ESM and TypeScript smoke tests
npm run format         # Biome
npm run lint:fix       # ESLint
```

To run read-only checks against a real Kiali (for example with `kubectl port-forward`):

```bash
kubectl -n istio-system port-forward svc/kiali 20001:20001
KIALI_URL=http://localhost:20001 KIALI_SESSION_TOKEN="$(kubectl -n istio-system create token kiali)" \
  npm run test:client
```

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/), checked by
Commitlint on pull requests. Releases are automated with semantic-release.

| Prefix | Release |
| --- | --- |
| `feat:` | Minor |
| `fix:`, `perf:` | Patch |
| `docs:`, `chore:`, `test:`, `ci:`, `refactor:` | None |
| `BREAKING CHANGE:` footer or `feat!:` | Major |

## Adding an endpoint

1. Check the route and its accepted query parameters in Kiali's
   [`routing/routes.go`](https://github.com/kiali/kiali/blob/master/routing/routes.go) and handler.
   Kiali rejects undeclared query parameters, so only send `clusterName` where the handler accepts
   it (use `clusterQuery()`).
2. Add response types in `src/domain/`.
3. Add the method to the resource in `src/resources/`.
4. Export new public types from `src/index.ts`.
5. Add tests in `tests/` and update the README.

## Releases

Merging to `main` runs `.github/workflows/release.yml`:

1. Verify: `npm run check`, package smoke tests on Node.js 20, 22 and 24.
2. semantic-release: computes the version, updates `CHANGELOG.md`, publishes to npm with
   provenance, commits the release, tags `vX.Y.Z` and creates the GitHub release.
3. Publishes the same version to GitHub Packages as `@eljijuna/kiali-api-client`.
4. Deploys the TypeDoc site to GitHub Pages.

Required repository setup: an `NPM_TOKEN` secret (npm automation token), GitHub Pages set to
"GitHub Actions", and permission for `GITHUB_TOKEN` to push the release commit to `main`.
