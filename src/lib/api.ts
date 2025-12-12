export const API_BASE = import.meta.env.VITE_API_BASE as string;

type JSONValue = 
  |string
  |number
  |boolean
  |null
  |JSONValue[]
  |{ [Key: string]: JSONValue };

async function call<T>(
  path:string,
  opts: { method?: string; body?: JSONValue; headers?: Record<string, string> } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  // Helper debug in dev
  if(!resp.ok){
    const text = await resp.text().catch(() => "");
    console.error(`[API  ERROR] ${resp.status} ${resp.statusText} at ${url}`, text);
    throw new Error(`API ${resp.status}: ${text || resp.statusText}`);
  }

  return resp.json() as Promise<T>;
}

export const api = {
  post: <T>(path: string, body: JSONValue) => call<T>(path, { method: "POST", body}),
  get: <T>(path: string) => call<T>(path)
}