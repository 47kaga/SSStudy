import { errorResponse, notFoundResponse, quizLabEnabled, readJsonObject } from "@/lib/quiz/http";
import { gradeStoredQuiz } from "@/lib/quiz/grading";

const MAX_BODY_CHARS = 2000;

// The body is only a quiz id and the chosen answers. The duration, the material size and every shard amount
// are read from stored rows on the server.
export async function POST(request: Request) {
  // Gated until auth exists (Milestone 10): these routes are unauthenticated and the generate route is paid.
  if (!quizLabEnabled()) return notFoundResponse();

  const body = await readJsonObject(request, MAX_BODY_CHARS);
  if (!body) return errorResponse(400, "Send a JSON body like { \"quizId\": 1, \"answers\": [0, 1] }.");

  const { quizId, answers } = body;
  if (typeof quizId !== "number" || !Number.isInteger(quizId) || quizId < 1) {
    return errorResponse(400, "quizId must be a positive integer.");
  }
  if (!Array.isArray(answers) || answers.some((answer) => typeof answer !== "number")) {
    return errorResponse(400, "answers must be an array of numbers.");
  }

  const result = await gradeStoredQuiz(quizId, answers as number[]);
  if (result.ok) {
    const { correctAnswers, totalQuestions, results, award, balance } = result;
    return Response.json({ correctAnswers, totalQuestions, results, award, balance });
  }

  switch (result.code) {
    case "not-found":
      return errorResponse(404, result.message, result.code);
    case "already-graded":
      return errorResponse(409, result.message, result.code);
    case "invalid-answers":
      return errorResponse(400, result.message, result.code);
    default:
      return errorResponse(500, result.message, result.code);
  }
}
