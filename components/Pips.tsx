// Rarity as a row of small flat squares. Built from tokens only: no glyphs, no images.
const TONES = { ink: "bg-ink", accent: "bg-accent", background: "bg-background" } as const;

export type PipTone = keyof typeof TONES;

export function Pips({ count, tone = "ink" }: { count: number; tone?: PipTone }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`h-2 w-2 ${TONES[tone]}`} />
      ))}
    </span>
  );
}
