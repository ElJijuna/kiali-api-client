/**
 * Minimal cookie jar for Kiali session cookies (`kiali-token*`, `csrf-token`).
 * Kiali is a single origin, so domain and path attributes are ignored.
 * @internal
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    for (const [name, value] of Object.entries(initial ?? {})) {
      this.cookies.set(name, value);
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  clear(): void {
    this.cookies.clear();
  }

  /** Stores the cookies from a response's `Set-Cookie` headers. */
  update(headers: Headers): void {
    for (const line of readSetCookie(headers)) {
      const [pair = '', ...attributes] = line.split(';');
      const index = pair.indexOf('=');

      if (index <= 0) {
        continue;
      }

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();

      if (value === '' || isExpired(attributes)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  /** Value for the `Cookie` request header, or `undefined` when empty. */
  header(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined;
    }

    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }
}

function readSetCookie(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const combined = headers.get('set-cookie');

  // Split on commas that start a new `name=` pair, not those inside `Expires`.
  return combined ? combined.split(/,(?=\s*[^;,=\s]+=)/) : [];
}

function isExpired(attributes: string[]): boolean {
  for (const attribute of attributes) {
    const [rawKey = '', ...rest] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join('=').trim();

    if (key === 'max-age' && Number(value) <= 0) {
      return true;
    }

    if (key === 'expires') {
      const time = Date.parse(value);

      if (!Number.isNaN(time) && time <= Date.now()) {
        return true;
      }
    }
  }

  return false;
}
