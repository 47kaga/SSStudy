import { rectsToPaths, spriteToRects, type SpriteData } from "@/lib/sprite";

// One sprite as flat SVG paths (one per color). Drawn in logical pixels at (x, y), inside an <svg> that
// sets shape-rendering="crispEdges". No state.
export function PixelSprite({ sprite, x = 0, y = 0 }: { sprite: SpriteData; x?: number; y?: number }) {
  const paths = rectsToPaths(spriteToRects(sprite.pixels, sprite.palette));
  return (
    <g transform={`translate(${x} ${y})`}>
      {paths.map(({ color, d }) => (
        <path key={color} d={d} fill={color} />
      ))}
    </g>
  );
}
