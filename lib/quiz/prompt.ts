// Builds the user message. No React, Next, Prisma, SDK or server-only imports.

/**
 * Wraps pasted material in <material> tags. Any tag-like text inside the material that could close
 * or reopen the delimiter is removed first, so pasted text cannot break out of the data block.
 *
 * `feedback` is trusted text written by us (a retry instruction). It goes after the closing tag,
 * never inside it, so the model never reads it as part of the untrusted material.
 */
export function buildMaterialMessage(sourceText: string, feedback?: string): string {
  const safe = sourceText.replace(/<\s*\/?\s*material\b[^>]*>?/gi, "");
  const message = `<material>\n${safe}\n</material>`;
  return feedback ? `${message}\n\n${feedback}` : message;
}
