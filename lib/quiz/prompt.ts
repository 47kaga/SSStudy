// Builds the user message. No React, Next, Prisma, SDK or server-only imports.

/**
 * Wraps pasted material in <material> tags. Any tag-like text inside the material that could close
 * or reopen the delimiter is removed first, so pasted text cannot break out of the data block.
 */
export function buildMaterialMessage(sourceText: string): string {
  const safe = sourceText.replace(/<\s*\/?\s*material\b[^>]*>?/gi, "");
  return `<material>\n${safe}\n</material>`;
}
