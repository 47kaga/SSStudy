import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level design guardrails. Do not bypass: fix the offending file instead.

const root = fileURLToPath(new URL("../", import.meta.url));
const scannedDirs = ["app", "components", "lib"];
const scannedExtensions = [".ts", ".tsx", ".css"];

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...collectFiles(path));
    else if (scannedExtensions.some((ext) => path.endsWith(ext))) files.push(path);
  }
  return files;
}

const sources = scannedDirs
  .flatMap((dir) => collectFiles(join(root, dir)))
  .filter((file) => !file.endsWith(".test.ts"))
  .map((file) => ({ file: relative(root, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));

// Tokens are only matched when not glued to a longer word, so `items[i]` or `to-do` prose is not a class.
const rules: Record<string, RegExp[]> = {
  "gradient utilities": [
    /gradient/g,
    /(?<![\w-])(?:[\w-]+:)*bg-(?:linear|radial|conic)[^\s"'`]*/g,
    /(?<![\w-])(?:[\w-]+:)*(?:from|via|to)-[\w[][^\s"'`]*/g,
  ],
  "arbitrary Tailwind values": [/(?<![\w-])(?:[\w-]+:)*!?-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s"'`]+\]/g],
  "raw hex colors": [/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g],
  "font-weight utilities": [
    /(?<![\w-])(?:[\w-]+:)*font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?![\w-])/g,
  ],
};

function findViolations(patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const { file, text } of sources) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        found.push(`${file}: "${match[0]}"`);
      }
    }
  }
  return found;
}

describe("design guardrails", () => {
  it("scans at least the app and components folders", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  for (const [name, patterns] of Object.entries(rules)) {
    it(`has no ${name}`, () => {
      expect(findViolations(patterns), `Found ${name}`).toEqual([]);
    });
  }
});
