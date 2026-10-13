const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set — check env vars and redeploy.",
  );
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

type ErrorEnvelope = { error?: { code?: string; message?: string } };

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Network-level failure: API asleep, offline, or CORS preflight rejected.
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the API.");
  }

  const text = await res.text();

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      res.status,
      "BAD_RESPONSE",
      `Non-JSON response from ${path}`,
    );
  }

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("memed_token");
    localStorage.removeItem("memed_user");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=1";
    }
  }

  if (!res.ok) {
    const envelope = (data ?? {}) as ErrorEnvelope;
    throw new ApiError(
      res.status,
      envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? `Request failed (${res.status})`,
    );
  }

  return data as T;
}
