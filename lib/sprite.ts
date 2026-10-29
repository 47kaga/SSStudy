// Pure sprite and room logic. No React, Next, Prisma or server-only imports, and no data imports:
// the art is passed in, so tests can use the real data or small broken examples.

/** A palette maps one character to a flat 6-digit hex color. `.` is reserved for transparent. */
export type Palette = Readonly<Record<string, string>>;

/** One sprite: equal-length rows of characters, one per pixel, plus the palette those characters index. */
export type SpriteData = {
  palette: Palette;
  pixels: readonly string[];
};

export type Rect = { x: number; y: number; width: number; height: number; color: string };

export type RoomObject = { sprite: string; x: number; y: number };

export type RoomPose = "idle" | "studying";

export type CharacterPlacement = {
  /** Sprite names, shown in order, one per frame. */
  frames: readonly string[];
  /** Tile coordinates of the character's top-left tile. */
  x: number;
  y: number;
};

export type PoseData = {
  /** What the screen reader announces for this pose. */
  label: string;
  /** Objects that change with the pose (the lamp). Drawn after the fixed objects. */
  objects: readonly RoomObject[];
  character: CharacterPlacement;
  /** How long each frame is shown. */
  frameMs: number;
};

export type Room = {
  tileSize: number;
  cols: number;
  rows: number;
  /** One string per tile row; each character is a key of `tileKey`. */
  tiles: readonly string[];
  /** Maps a tile map character to the name of a tile sprite. */
  tileKey: Readonly<Record<string, string>>;
  /** Fixed objects in tile coordinates, drawn in order. */
  objects: readonly RoomObject[];
  states: Readonly<Record<RoomPose, PoseData>>;
};

export const TRANSPARENT = ".";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Throws a clear error unless the sprite is a non-empty rectangle whose characters are all in the palette. */
export function validateSprite(pixels: readonly string[], palette: Palette): void {
  for (const [key, color] of Object.entries(palette)) {
    if (key.length !== 1) throw new Error(`Palette key "${key}" must be a single character.`);
    if (key === TRANSPARENT) throw new Error(`Palette key "${TRANSPARENT}" is reserved for transparent pixels.`);
    if (!HEX_COLOR.test(color))
      throw new Error(`Palette color for "${key}" is "${color}"; expected a flat 6-digit hex.`);
  }

  if (pixels.length === 0) throw new Error("A sprite needs at least one row.");
  const width = pixels[0].length;
  if (width === 0) throw new Error("A sprite row cannot be empty.");

  pixels.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Sprite row ${y} has ${row.length} pixels; expected ${width} like row 0.`);
    }
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      if (char !== TRANSPARENT && !Object.hasOwn(palette, char)) {
        throw new Error(`Sprite pixel (${x}, ${y}) uses "${char}", which is not in the palette.`);
      }
    }
  });
}

/**
 * The rectangles that draw a sprite: transparent pixels are skipped and a run of the same color along one
 * row is one rectangle. Ordered by row, then column.
 */
export function spriteToRects(pixels: readonly string[], palette: Palette): Rect[] {
  const rects: Rect[] = [];
  pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === TRANSPARENT) {
        x++;
        continue;
      }
      const color = palette[row[x]];
      let end = x + 1;
      while (end < row.length && row[end] !== TRANSPARENT && palette[row[end]] === color) end++;
      rects.push({ x, y, width: end - x, height: 1, color });
      x = end;
    }
  });
  return rects;
}

/** One SVG path per color, so a sprite is a handful of elements instead of hundreds. Colors in first-use order. */
export function rectsToPaths(rects: readonly Rect[]): { color: string; d: string }[] {
  const byColor = new Map<string, string[]>();
  for (const { x, y, width, height, color } of rects) {
    const parts = byColor.get(color) ?? [];
    parts.push(`M${x} ${y}h${width}v${height}h${-width}z`);
    byColor.set(color, parts);
  }
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join("") }));
}

function spriteSize(sprites: Readonly<Record<string, SpriteData>>, name: string, what: string) {
  const sprite = Object.hasOwn(sprites, name) ? sprites[name] : undefined;
  if (!sprite) throw new Error(`${what} uses unknown sprite "${name}".`);
  return { width: sprite.pixels[0].length, height: sprite.pixels.length };
}

/** Throws unless the room is a tile map of the stated size and everything in it exists and fits inside. */
export function validateRoom(room: Room, sprites: Readonly<Record<string, SpriteData>>): void {
  if (room.tiles.length !== room.rows) {
    throw new Error(`Tile map has ${room.tiles.length} rows; expected ${room.rows}.`);
  }
  room.tiles.forEach((row, y) => {
    if (row.length !== room.cols) throw new Error(`Tile map row ${y} has ${row.length} tiles; expected ${room.cols}.`);
    for (const key of row) {
      if (!Object.hasOwn(room.tileKey, key)) throw new Error(`Tile map row ${y} uses unknown tile key "${key}".`);
    }
  });
  for (const [key, name] of Object.entries(room.tileKey)) {
    const size = spriteSize(sprites, name, `Tile key "${key}"`);
    if (size.width !== room.tileSize || size.height !== room.tileSize) {
      throw new Error(`Tile sprite "${name}" is ${size.width} by ${size.height}; tiles are ${room.tileSize} square.`);
    }
  }

  const width = room.cols * room.tileSize;
  const height = room.rows * room.tileSize;
  const checkInside = (name: string, x: number, y: number, what: string) => {
    const size = spriteSize(sprites, name, what);
    const left = x * room.tileSize;
    const top = y * room.tileSize;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      left < 0 ||
      top < 0 ||
      left + size.width > width ||
      top + size.height > height
    ) {
      throw new Error(
        `${what} ("${name}" at tile ${x}, ${y}) is not fully inside the ${room.cols} by ${room.rows} room.`,
      );
    }
  };

  for (const object of room.objects) checkInside(object.sprite, object.x, object.y, "Object");
  for (const [pose, data] of Object.entries(room.states)) {
    for (const object of data.objects) checkInside(object.sprite, object.x, object.y, `Object in the ${pose} pose`);
    if (data.character.frames.length === 0) throw new Error(`The ${pose} pose has no character frames.`);
    for (const frame of data.character.frames) {
      checkInside(frame, data.character.x, data.character.y, `Character in the ${pose} pose`);
    }
    if (!Number.isInteger(data.frameMs) || data.frameMs <= 0) {
      throw new Error(`The ${pose} pose has frameMs ${data.frameMs}; expected a positive integer.`);
    }
  }
}

/** The scene is studying exactly when a timer is running. */
export function roomPose(studying: boolean): RoomPose {
  return studying ? "studying" : "idle";
}

/** Which frame to show after `elapsedMs`. Wraps around, and is always 0 when reduced motion is on. */
export function frameIndex(elapsedMs: number, frameCount: number, frameMs: number, reducedMotion: boolean): number {
  if (!Number.isInteger(frameCount) || frameCount < 1)
    throw new RangeError(`frameCount must be a positive integer, got ${frameCount}.`);
  if (!Number.isFinite(frameMs) || frameMs <= 0) throw new RangeError(`frameMs must be positive, got ${frameMs}.`);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw new RangeError(`elapsedMs must be zero or more, got ${elapsedMs}.`);
  if (reducedMotion) return 0;
  return Math.floor(elapsedMs / frameMs) % frameCount;
}
