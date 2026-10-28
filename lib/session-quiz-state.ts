// Pure: what a finished study session offers next. No React, Next or Prisma imports.
import { sessionEligibility } from "@/lib/economy";

export type SessionQuizState =
  | { kind: "too-short" }
  | { kind: "quiz" }
  | { kind: "resume" }
  | { kind: "graded"; shards: number };

export type SessionQuizFacts = {
  durationSeconds: number;
  /** A quiz is stored for this session. */
  hasQuiz: boolean;
  /** That quiz has been graded. */
  graded: boolean;
  /** Shards the ledger paid for this session (0 when none). */
  shardsAwarded: number;
};

export function sessionQuizState(facts: SessionQuizFacts): SessionQuizState {
  if (facts.hasQuiz && facts.graded) return { kind: "graded", shards: facts.shardsAwarded };
  if (facts.hasQuiz) return { kind: "resume" };
  if (!sessionEligibility(facts.durationSeconds).eligible) return { kind: "too-short" };
  return { kind: "quiz" };
}
