// Pure validation for pasted study text. No React, Next, Prisma, SDK or server-only imports.
import { quiz } from "@/data/quiz";

export type SourceLimits = {
  minSourceChars: number;
  maxSourceChars: number;
  minDistinctWords: number;
};

export type SourceResult = { ok: true; text: string } | { ok: false; message: string };

function countDistinctWords(text: string): number {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words).size;
}

export function normalizeSource(input: unknown, limits: SourceLimits = quiz): SourceResult {
  if (typeof input !== "string") return { ok: false, message: "Paste some text to build a quiz from." };

  const text = input.trim();
  if (text.length < limits.minSourceChars) {
    return { ok: false, message: `Paste at least ${limits.minSourceChars} characters (you have ${text.length}).` };
  }
  if (text.length > limits.maxSourceChars) {
    return { ok: false, message: `Paste at most ${limits.maxSourceChars} characters (you have ${text.length}).` };
  }
  if (countDistinctWords(text) < limits.minDistinctWords) {
    return { ok: false, message: `The text needs at least ${limits.minDistinctWords} different words.` };
  }
  return { ok: true, text };
}
