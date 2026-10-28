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

type Source = { file: string; text: string };

const sources: Source[] = scannedDirs
  .flatMap((dir) => collectFiles(join(root, dir)))
  .filter((file) => !file.endsWith(".test.ts"))
  .map((file) => ({ file: relative(root, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));

// Tokens are only matched when not glued to a longer word, so `items[i]` or `to-do` prose is not a class.
// The one place a blur is allowed: the modal dialog backdrop.
const BLUR_ALLOWED_IN = "components/Modal.tsx";

const rules: Record<string, RegExp[]> = {
  "gradient utilities": [
    /gradient/g,
    /(?<![\w-])(?:[\w-]+:)*bg-(?:linear|radial|conic)[^\s"'`]*/g,
    /(?<![\w-])(?:[\w-]+:)*(?:from|via|to)-[\w[][^\s"'`]*/g,
  ],
  "arbitrary Tailwind values": [/(?<![\w-])(?:[\w-]+:)*!?-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s"'`]+\]/g],
  "raw hex colors": [/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g],
  "blur, drop-shadow or shadow utilities (outside the modal backdrop)": [
    /(?<![\w-])(?:[\w-]+:)*(?:backdrop-)?(?:blur|drop-shadow|shadow)(?:-[a-z0-9]+)*(?![\w-])/g,
    /backdrop-filter|blur\(/g,
  ],
  "font-weight utilities": [
    /(?<![\w-])(?:[\w-]+:)*font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?![\w-])/g,
  ],
};

/** Files where the rule is not applied. Only the blur rule has an exception: the modal backdrop. */
function exemptFiles(ruleName: string): string[] {
  return ruleName.startsWith("blur") ? [BLUR_ALLOWED_IN] : [];
}

function findViolations(patterns: RegExp[], files: Source[] = sources, exempt: string[] = []): string[] {
  const found: string[] = [];
  for (const { file, text } of files) {
    if (exempt.includes(file)) continue;
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
      expect(findViolations(patterns, sources, exemptFiles(name)), `Found ${name}`).toEqual([]);
    });
  }

  // Proves the blur guard bites: the same rule that passes on the real tree fails on a fake file.
  describe("blur guard", () => {
    const [blurRule] = Object.entries(rules).filter(([name]) => name.startsWith("blur"));
    const [blurName, blurPatterns] = blurRule;
    const check = (file: string, text: string) =>
      findViolations(blurPatterns, [{ file, text }], exemptFiles(blurName));

    it("fails when a blur class appears in another file", () => {
      expect(check("components/Card.tsx", `<div className="p-4 backdrop-blur-modal" />`)).not.toEqual([]);
      expect(check("app/page.tsx", `<div className="blur-sm" />`)).not.toEqual([]);
      expect(check("components/Card.tsx", `<div className="backdrop:backdrop-blur-modal" />`)).not.toEqual([]);
      expect(check("components/Card.tsx", `<div className="shadow-lg" />`)).not.toEqual([]);
      expect(check("components/Card.tsx", `<div className="drop-shadow-md" />`)).not.toEqual([]);
      expect(check("app/globals.css", `.x { backdrop-filter: blur(6px); }`)).not.toEqual([]);
    });

    it("allows the blur in the modal only", () => {
      expect(check("components/Modal.tsx", `<dialog className="backdrop:backdrop-blur-modal" />`)).toEqual([]);
    });

    it("ignores ordinary words that merely contain the letters", () => {
      expect(check("components/Card.tsx", `<div className="text-title">blurb shadowy</div>`)).toEqual([]);
    });
  });
});