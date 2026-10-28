import { quiz } from "@/data/quiz";
import { errorResponse, notFoundResponse, quizLabEnabled, readJsonObject } from "@/lib/quiz/http";
import { generateQuiz } from "@/lib/quiz/generate";
import { normalizeSource } from "@/lib/quiz/source";

const MAX_BODY_CHARS = quiz.maxSourceChars * 8; // room for JSON escaping of the pasted text

export async function POST(request: Request) {
  if (!quizLabEnabled()) return notFoundResponse();

  const body = await readJsonObject(request, MAX_BODY_CHARS);
  if (!body) return errorResponse(400, "Send a JSON body like { \"text\": \"...\" }.");

  const source = normalizeSource(body.text);
  if (!source.ok) return errorResponse(400, source.message);

  const result = await generateQuiz(source.text);
  if (result.ok) {
    return Response.json({ quizId: result.quizId, quiz: result.publicQuiz, meta: result.meta });
  }

  switch (result.code) {
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
