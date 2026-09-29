/** Longest `detail` kept from a plain-text error body. */
const MAX_DETAIL_LENGTH = 300;

/**
 * Thrown when the Kiali API returns a non-2xx response.
 *
 * Kiali answers errors with `{ "error": "...", "detail": "..." }`; both are
 * exposed, along with the raw body.
 *
 * @example
 * ```typescript
 * import { KialiApiError } from 'kiali-api-client';
 *
 * try {
 *   await kiali.namespace('missing').info();
 * } catch (err) {
 *   if (err instanceof KialiApiError) {
 *     console.log(err.status); // 404 / 403 / 400 ...
 *     console.log(err.detail); // "namespaces \"missing\" not found"
 *   }
 * }
 * ```
 */
export class KialiApiError extends Error {
  /** HTTP status code (e.g. `401`, `403`, `404`). */
  readonly status: number;
  /** HTTP status text. Often empty over HTTP/2. */
  readonly statusText: string;
  /** Response body: parsed JSON when possible, otherwise raw text. */
  readonly body?: unknown;
  /** Human-readable reason extracted from the body. */
  readonly detail?: string;
  /** Method and URL of the failed request. */
  readonly request?: { method: string; url: string };

  constructor(
    status: number,
    statusText: string,
    body?: unknown,
    request?: { method: string; url: string },
  ) {
    const detail = extractDetail(body);
    const summary = [status, statusText].filter(Boolean).join(' ');
    const reason = detail && detail !== statusText ? ` — ${detail}` : '';

    super(`Kiali API error: ${summary}${reason}`);
    this.name = 'KialiApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.detail = detail;
    this.request = request;
  }
}

function truncate(text: string): string | undefined {
  const trimmed = text.trim();

  // HTML error pages (e.g. from an ingress) carry no useful reason.
  if (!trimmed || trimmed.startsWith('<')) {
    return undefined;
  }

  return trimmed.length > MAX_DETAIL_LENGTH ? `${trimmed.slice(0, MAX_DETAIL_LENGTH)}…` : trimmed;
}

/**
 * Finds the reason in the body shapes Kiali returns: `{ error, detail }`,
 * `{ message }`, or plain text.
 */
function extractDetail(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return truncate(body);
  }

  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const { error, detail, message } = body as Record<string, unknown>;
  const parts = [error, detail]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim());

  if (parts.length > 0) {
    return truncate(parts.join(': '));
  }

  return typeof message === 'string' ? truncate(message) : undefined;
}
