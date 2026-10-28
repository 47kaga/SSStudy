import { quiz } from "@/data/quiz";
import { errorResponse, notFoundResponse, quizLabEnabled, readJsonObject } from "@/lib/quiz/http";
import { generateQuiz } from "@/lib/quiz/generate";
import { normalizeSource } from "@/lib/quiz/source";

const MAX_BODY_CHARS = quiz.maxSourceChars * 8; // room for JSON escaping of the pasted text

// The body is the pasted text and, optionally, the study session it unlocks. Without a sessionId this is
// a lab quiz that awards nothing. The session's length is read from the database, never from the request.
export async function POST(request: Request) {
  // Gated until auth exists (Milestone 10): these routes are unauthenticated and paid.
  if (!quizLabEnabled()) return notFoundResponse();

  const body = await readJsonObject(request, MAX_BODY_CHARS);
  if (!body) return errorResponse(400, "Send a JSON body like { \"sessionId\": 1, \"text\": \"...\" }.");

  let sessionId: number | null = null;
  if (body.sessionId !== undefined && body.sessionId !== null) {
    if (typeof body.sessionId !== "number" || !Number.isInteger(body.sessionId) || body.sessionId < 1) {
      return errorResponse(400, "sessionId must be a positive integer.");
    }
    sessionId = body.sessionId;
  }

  const source = normalizeSource(body.text);
  if (!source.ok) return errorResponse(400, source.message);

  const result = await generateQuiz(source.text, sessionId);
  if (result.ok) {
    return Response.json({ quizId: result.quizId, quiz: result.publicQuiz, meta: result.meta });
  }

  switch (result.code) {
    case "session-not-found":
      return errorResponse(404, result.message, result.code);
    case "too-short":
      return errorResponse(400, result.message, result.code);
    case "already-has-quiz":
      return errorResponse(409, result.message, result.code);
    case "insufficient":
      return errorResponse(422, result.message, result.code);
    case "rate-limited":
      return errorResponse(429, result.message, result.code);
    case "missing-key":
      return errorResponse(500, result.message, result.code);
    default:
      return errorResponse(502, result.message, result.code);
  }
}
