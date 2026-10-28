// Small helpers shared by the quiz routes and the lab page.

/**
 * The quiz endpoints are paid and unauthenticated, so they only exist outside production
 * until auth arrives (Milestone 10). The gating stays until then, including for the session quiz page's routes.
 */
export function quizLabEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function errorResponse(status: number, message: string, code?: string): Response {
  return Response.json(code ? { error: message, code } : { error: message }, { status });
}

export function notFoundResponse(): Response {
  return errorResponse(404, "Not found.");
}

/** Reads a JSON object body defensively. Returns null for a malformed, oversized or non-object body. */
export async function readJsonObject(request: Request, maxChars: number): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length > maxChars) return null;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
