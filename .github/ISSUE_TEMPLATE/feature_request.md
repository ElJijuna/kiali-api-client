---
name: Feature request
about: Suggest a new endpoint or capability
labels: enhancement
---

## Which Kiali API endpoint should be added?

<!-- e.g. GET /api/namespaces/{namespace}/{app}/usage_metrics -->

## Use case

<!-- Why is this endpoint useful? What problem does it solve? -->

## Proposed API surface

```typescript
// How you'd like to call it
await kiali.namespace('bookinfo').workload('reviews-v1').usageMetrics();
```
