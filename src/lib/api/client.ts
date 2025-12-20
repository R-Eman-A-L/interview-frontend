export class ApiError extends Error {
    status: number;
    detail: unknown;

    constructor(message: string, status: number, detail: unknown){
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.detail = detail;
    }
}

const Base_URL = (import.meta as any).env?.PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

function joinUrl(base: string, path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!path.startsWith('/')) path = `/${path}`;
    return `${base}${path}`;
}

export async function fetchJson<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const url = joinUrl(Base_URL, path);

    const headers = new Headers(init.headers || {});
    const hasBody = init.body !== undefined && init.body !== null;

    if (hasBody && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const resp = await fetch(url, {...init, headers });

    let payload: unknown = null;
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            payload = await resp.json();
        } catch {
            payload = null;
        }
    } else {
        try {
            payload = await resp.text();
        } catch {
            payload = null;
        }
    }

    if (!resp.ok) {
        const detail =
        typeof payload === 'object' && payload !== null && 'detail' in payload
        ? (payload as any).detail
        : payload;

        const message =
        typeof detail === 'string'
        ? detail
        : `Request failed with status ${resp.status}`;

        throw new ApiError(message, resp.status, detail);
    }

    return payload as T;
}