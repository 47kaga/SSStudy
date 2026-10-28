// Dev tool for tuning the quiz pipeline. It is not part of the study loop: it posts no sessionId, so its
// quizzes are not tied to a study session and award nothing. The real flow is /quiz/[sessionId].
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { quiz } from "@/data/quiz";
import { Divider } from "@/components/Divider";
import { QuizLab } from "@/components/QuizLab";
import { Screen } from "@/components/Screen";
import { quizLabEnabled } from "@/lib/quiz/http";

export default async function QuizLabPage() {
  // Decide per request, not at build time: the page must 404 on a production server.
  await connection();
  if (!quizLabEnabled()) notFound();

  return (
    <Screen>
      <h1 className="text-title">Quiz lab</h1>
      <Divider weight="heavy" />
      <QuizLab minChars={quiz.minSourceChars} maxChars={quiz.maxSourceChars} />
    </Screen>
  );
}
