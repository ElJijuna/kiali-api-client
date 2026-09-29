import { KialiClient, type KialiClientOptions } from '../src';

export interface Call {
  url: URL;
  init: RequestInit;
  headers: Record<string, string>;
}

type Responder = (call: Call) => Response | Promise<Response>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

/**
 * Builds a client whose `fetch` records every call and answers with the queued
 * responders (the last one repeats), or `{}` when none are queued.
 */
export function setup(options: Partial<KialiClientOptions> = {}, ...responders: Responder[]) {
  const calls: Call[] = [];
  const queue = [...responders];
  const fetch = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: new URL(String(input)),
      init,
      headers: { ...(init.headers as Record<string, string>) },
    };

    calls.push(call);
    const responder = queue.length > 1 ? queue.shift() : queue[0];

    return responder ? responder(call) : json({});
  });
  const client = new KialiClient({
    baseUrl: 'https://kiali.example.com',
    fetch: fetch as unknown as typeof globalThis.fetch,
    ...options,
  });

  return { client, calls, fetch };
}

/** Path plus decoded query of a recorded call, e.g. `/kiali/api/status?a=1`. */
export function target(call: Call | undefined): string {
  if (!call) {
    throw new Error('no call recorded');
  }

  return `${call.url.pathname}${decodeURIComponent(call.url.search)}`;
}

/** Resolves with the rejection reason of `promise`, or fails if it fulfils. */
export async function rejection(promise: PromiseLike<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('expected the promise to reject');
}
