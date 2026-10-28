// Describes the shape of untrusted model output for logs. No React, Next, Prisma, SDK or server-only imports.

const MAX_KEYS = 20;
const MAX_KEY_CHARS = 40;

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Top-level keys and the JavaScript type of each value, such as "status: string, questions: array".
 * Never includes any value. Keys come from the model, so they are cleaned and capped before logging.
 */
export function describeShape(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return typeName(value);

  const entries = Object.entries(value);
  if (entries.length === 0) return "object with no keys";

  const shown = entries
    .slice(0, MAX_KEYS)
    .map(([key, entry]) => `${key.replace(/[^\w$-]/g, "?").slice(0, MAX_KEY_CHARS)}: ${typeName(entry)}`);
  if (entries.length > MAX_KEYS) shown.push(`and ${entries.length - MAX_KEYS} more keys`);
  return shown.join(", ");
}
