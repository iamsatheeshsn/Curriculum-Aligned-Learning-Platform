const DEFAULT_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1';

export type ApiClientOptions = {
  baseUrl?: string;
  getToken?: () => string | null;
  getTenantSlug?: () => string | null;
  getSchoolId?: () => string | null;
};

export class ApiClient {
  baseUrl: string;
  getToken?: () => string | null;
  getTenantSlug?: () => string | null;
  getSchoolId?: () => string | null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE;
    this.getToken = options.getToken;
    this.getTenantSlug = options.getTenantSlug;
    this.getSchoolId = options.getSchoolId;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const token = this.getToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const slug = this.getTenantSlug?.();
    if (slug) headers.set('X-Tenant-Slug', slug);
    const schoolId = this.getSchoolId?.();
    if (schoolId) headers.set('X-School-ID', schoolId);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const payload = json as { message?: string; errors?: Record<string, string[] | string> };
      let message = payload.message ?? `Request failed (${res.status})`;
      if (payload.errors) {
        const first = Object.values(payload.errors)[0];
        const detail = Array.isArray(first) ? first[0] : first;
        if (detail) message = detail;
      }
      throw new Error(message);
    }
    return json as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export function createApiClient(options?: ApiClientOptions) {
  return new ApiClient(options);
}

declare global {
  interface ImportMeta {
    env?: Record<string, string>;
  }
}
