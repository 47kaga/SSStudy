// Pure validation for project titles. No React, Next or Prisma imports.

export const PROJECT_TITLE_MAX_LENGTH = 60;

export type TitleResult = { ok: true; title: string } | { ok: false; message: string };

export function validateProjectTitle(input: unknown): TitleResult {
  if (typeof input !== "string") return { ok: false, message: "Enter a project title." };
  const title = input.trim();
  if (title.length === 0) return { ok: false, message: "Enter a project title." };
  if (title.length > PROJECT_TITLE_MAX_LENGTH) {
    return { ok: false, message: `Titles are limited to ${PROJECT_TITLE_MAX_LENGTH} characters.` };
  }
  return { ok: true, title };
}
