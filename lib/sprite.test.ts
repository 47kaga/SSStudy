import { describe, expect, it } from "vitest";
import { room, sprites } from "@/data/sprites";
import {
  frameIndex,
  rectsToPaths,
  roomPose,
  spriteToRects,
  validateRoom,
  validateSprite,
  type Room,
  type SpriteData,
} from "./sprite";

const palette = { a: "#112233", b: "#AABBCC" };

describe("validateSprite", () => {
  it("accepts a rectangle of palette characters and transparent pixels", () => {
    expect(() => validateSprite(["a.b", "bba"], palette)).not.toThrow();
  });

  it("rejects no rows, empty rows and rows of different length", () => {
    expect(() => validateSprite([], palette)).toThrow(/at least one row/);
    expect(() => validateSprite([""], palette)).toThrow(/cannot be empty/);
    expect(() => validateSprite(["aaa", "aa"], palette)).toThrow(/row 1 has 2 pixels; expected 3/);
  });

  it("rejects a character that is not in the palette, naming where", () => {
    expect(() => validateSprite(["aa", "ax"], palette)).toThrow(/pixel \(1, 1\) uses "x"/);
  });

  it("rejects bad palette keys and colors", () => {
    expect(() => validateSprite(["a"], { ab: "#112233" })).toThrow(/single character/);
    expect(() => validateSprite(["a"], { ".": "#112233" })).toThrow(/reserved/);
    for (const color of ["#123", "112233", "#11223344", "red", "#GG0000", "linear-gradient(red, blue)"]) {
      expect(() => validateSprite(["a"], { a: color }), color).toThrow(/6-digit hex/);
    }
  });
});

describe("spriteToRects", () => {
  it("skips transparent pixels and returns exact rectangles ordered by row then column", () => {
    expect(spriteToRects([".ab", "bb."], palette)).toEqual([
      { x: 1, y: 0, width: 1, height: 1, color: "#112233" },
      { x: 2, y: 0, width: 1, height: 1, color: "#AABBCC" },
      { x: 0, y: 1, width: 2, height: 1, color: "#AABBCC" },
    ]);
  });

  it("merges a run of the same color along a row, and splits it when the color changes", () => {
    expect(spriteToRects(["aaabba"], palette)).toEqual([
      { x: 0, y: 0, width: 3, height: 1, color: "#112233" },
      { x: 3, y: 0, width: 2, height: 1, color: "#AABBCC" },
      { x: 5, y: 0, width: 1, height: 1, color: "#112233" },
    ]);
  });

  it("splits a run at a transparent pixel", () => {
    expect(spriteToRects(["aa.aa"], palette)).toEqual([
      { x: 0, y: 0, width: 2, height: 1, color: "#112233" },
      { x: 3, y: 0, width: 2, height: 1, color: "#112233" },
    ]);
  });

  it("merges two palette characters that share a color", () => {
    expect(spriteToRects(["ab"], { a: "#112233", b: "#112233" })).toEqual([
      { x: 0, y: 0, width: 2, height: 1, color: "#112233" },
    ]);
  });

  it("returns nothing for a fully transparent sprite and is deterministic", () => {
    expect(spriteToRects(["...", "..."], palette)).toEqual([]);
    expect(spriteToRects(["abab", "baba"], palette)).toEqual(spriteToRects(["abab", "baba"], palette));
  });
});

describe("rectsToPaths", () => {
  it("makes one path per color, in first-use order", () => {
    const paths = rectsToPaths(spriteToRects(["ab", "ba"], palette));
    expect(paths).toEqual([
      { color: "#112233", d: "M0 0h1v1h-1zM1 1h1v1h-1z" },
      { color: "#AABBCC", d: "M1 0h1v1h-1zM0 1h1v1h-1z" },
    ]);
  });
});

describe("roomPose", () => {
  it("maps a running timer to the studying pose and no timer to idle", () => {
    expect(roomPose(true)).toBe("studying");
    expect(roomPose(false)).toBe("idle");
  });
});

describe("frameIndex", () => {
  it("steps one frame per frameMs", () => {
    expect(frameIndex(0, 2, 500, false)).toBe(0);
    expect(frameIndex(499, 2, 500, false)).toBe(0);
    expect(frameIndex(500, 2, 500, false)).toBe(1);
    expect(frameIndex(999, 2, 500, false)).toBe(1);
    expect(frameIndex(1000, 2, 500, false)).toBe(0);
  });

  it("wraps around after a long time", () => {
    expect(frameIndex(3_600_000, 2, 500, false)).toBe(0);
    expect(frameIndex(3_600_500, 2, 500, false)).toBe(1);
    expect(frameIndex(1500, 3, 500, false)).toBe(0);
  });

  it("is always frame 0 under reduced motion", () => {
    for (const elapsed of [0, 500, 1234, 3_600_500]) expect(frameIndex(elapsed, 2, 500, true)).toBe(0);
  });

  it("rejects impossible input", () => {
    expect(() => frameIndex(0, 0, 500, false)).toThrow(RangeError);
    expect(() => frameIndex(0, 2, 0, false)).toThrow(RangeError);
    expect(() => frameIndex(-1, 2, 500, false)).toThrow(RangeError);
    expect(() => frameIndex(Number.NaN, 2, 500, false)).toThrow(RangeError);
  });
});

describe("validateRoom", () => {
  const tile = (): SpriteData => ({ palette, pixels: Array.from({ length: 4 }, () => "aaaa") });
  const small: Record<string, SpriteData> = {
    t: tile(),
    box: { palette, pixels: ["aaaa", "aaaa", "aaaa", "aaaa", "aaaa", "aaaa", "aaaa", "aaaa"] }, // 1 wide, 2 tall
    hero: tile(),
  };
  const pose = { label: "x", objects: [], character: { frames: ["hero"], x: 0, y: 0 }, frameMs: 500 };
  const valid: Room = {
    tileSize: 4,
    cols: 3,
    rows: 2,
    tiles: ["ttt", "ttt"],
    tileKey: { t: "t" },
    objects: [{ sprite: "box", x: 2, y: 0 }],
    states: { idle: pose, studying: pose },
  };

  it("accepts a valid room", () => {
    expect(() => validateRoom(valid, small)).not.toThrow();
  });

  it("rejects a tile map of the wrong size", () => {
    expect(() => validateRoom({ ...valid, tiles: ["ttt"] }, small)).toThrow(/1 rows; expected 2/);
    expect(() => validateRoom({ ...valid, tiles: ["ttt", "tt"] }, small)).toThrow(/row 1 has 2 tiles; expected 3/);
  });

  it("rejects unknown tile keys and unknown sprites", () => {
    expect(() => validateRoom({ ...valid, tiles: ["ttt", "tzt"] }, small)).toThrow(/unknown tile key "z"/);
    expect(() => validateRoom({ ...valid, objects: [{ sprite: "nope", x: 0, y: 0 }] }, small)).toThrow(
      /unknown sprite "nope"/,
    );
    expect(() => validateRoom({ ...valid, tileKey: { t: "nope" } }, small)).toThrow(/unknown sprite "nope"/);
  });

  it("rejects an object that is not fully inside the room", () => {
    const at = (x: number, y: number) => ({ ...valid, objects: [{ sprite: "box", x, y }] });
    expect(() => validateRoom(at(3, 0), small)).toThrow(/not fully inside/); // starts outside on the right
    expect(() => validateRoom(at(0, 1), small)).toThrow(/not fully inside/); // 2 tall, runs off the bottom
    expect(() => validateRoom(at(-1, 0), small)).toThrow(/not fully inside/);
    expect(() => validateRoom(at(0, -1), small)).toThrow(/not fully inside/);
    expect(() => validateRoom(at(0.5, 0), small)).toThrow(/not fully inside/);
    expect(() => validateRoom(at(2, 0), small)).not.toThrow(); // flush with the right and bottom edges
  });

  it("rejects a pose object or character position outside the room", () => {
    const outside = { ...pose, character: { frames: ["hero"], x: 3, y: 0 } };
    expect(() => validateRoom({ ...valid, states: { idle: pose, studying: outside } }, small)).toThrow(
      /Character in the studying pose/,
    );
    const lamp = { ...pose, objects: [{ sprite: "hero", x: 0, y: 2 }] };
    expect(() => validateRoom({ ...valid, states: { idle: lamp, studying: pose } }, small)).toThrow(
      /Object in the idle pose/,
    );
  });

  it("rejects a pose with no frames or a bad frame time", () => {
    const none = { ...pose, character: { frames: [], x: 0, y: 0 } };
    expect(() => validateRoom({ ...valid, states: { idle: none, studying: pose } }, small)).toThrow(
      /no character frames/,
    );
    expect(() => validateRoom({ ...valid, states: { idle: { ...pose, frameMs: 0 }, studying: pose } }, small)).toThrow(
      /frameMs/,
    );
  });
});

describe("the real art and room", () => {
  const widths = Object.entries(sprites).map(([name, sprite]) => [name, sprite] as const);

  for (const [name, sprite] of widths) {
    it(`sprite "${name}" is valid, with a small palette and a whole number of tiles`, () => {
      expect(() => validateSprite(sprite.pixels, sprite.palette)).not.toThrow();
      expect(Object.keys(sprite.palette).length).toBeLessThanOrEqual(6);
      expect(sprite.pixels[0].length % room.tileSize).toBe(0);
      expect(sprite.pixels.length % room.tileSize).toBe(0);
    });
  }

  it("has the planned tile sizes: tiles 16 square, room 10 by 6", () => {
    expect([room.tileSize, room.cols, room.rows]).toEqual([16, 10, 6]);
    expect(room.cols * room.tileSize).toBe(160);
    expect(room.rows * room.tileSize).toBe(96);
  });

  it("has a valid room layout", () => {
    expect(() => validateRoom(room, sprites)).not.toThrow();
  });

  it("has the sprites the plan asks for, with the planned sizes in tiles", () => {
    const size = (name: string) => [sprites[name].pixels[0].length / 16, sprites[name].pixels.length / 16];
    expect(size("floor")).toEqual([1, 1]);
    expect(size("wall")).toEqual([1, 1]);
    expect(size("window")).toEqual([1, 1]);
    expect(size("rug")).toEqual([2, 1]);
    expect(size("desk")).toEqual([2, 1]);
    expect(size("chair")).toEqual([1, 1]);
    expect(size("lamp-off")).toEqual([1, 1]);
    expect(size("lamp-on")).toEqual([1, 1]);
    expect(size("bookshelf")).toEqual([1, 2]);
    expect(size("plant")).toEqual([1, 1]);
    for (const name of ["character-idle-1", "character-idle-2", "character-study-1", "character-study-2"]) {
      expect(size(name), name).toEqual([1, 1]);
    }
  });

  it("gives each pose 2 frames of 500 ms, the lamp on only when studying, and the character in the right place", () => {
    expect(room.states.idle.character.frames).toHaveLength(2);
    expect(room.states.studying.character.frames).toHaveLength(2);
    expect(room.states.idle.frameMs).toBe(500);
    expect(room.states.studying.frameMs).toBe(500);
    expect(room.states.idle.objects.map((object) => object.sprite)).toEqual(["lamp-off"]);
    expect(room.states.studying.objects.map((object) => object.sprite)).toEqual(["lamp-on"]);
    // Studying: seated on the chair. Idle: standing somewhere else.
    const chair = room.objects.find((object) => object.sprite === "chair")!;
    expect(room.states.studying.character).toMatchObject({ x: chair.x, y: chair.y });
    expect(room.states.idle.character).not.toMatchObject({ x: chair.x, y: chair.y });
  });

  it("has the fixed objects: desk, chair, bookshelf, plant and a window", () => {
    const names = room.objects.map((object) => object.sprite);
    for (const needed of ["desk", "chair", "bookshelf", "plant", "window"]) expect(names).toContain(needed);
  });
});
