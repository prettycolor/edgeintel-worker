export function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export function textResponse(
  body: string,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }
  return new Response(body, {
    ...init,
    headers,
  });
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return jsonResponse({ error: message }, { status: 404 });
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts: number;
    delayMs: number;
  },
): Promise<{ value: T; attempts: number }> {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < options.attempts) {
    attempts += 1;
    try {
      const value = await operation();
      return { value, attempts };
    } catch (error) {
      lastError = error;
      if (attempts >= options.attempts) break;
      await sleep(options.delayMs * attempts);
    }
  }

  throw lastError instanceof Error
    ? Object.assign(lastError, { attempts })
    : new Error("Retryable operation failed");
}
