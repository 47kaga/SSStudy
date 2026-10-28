import { describe, expect, it } from "vitest";
import { describeShape } from "./shape";

describe("describeShape", () => {
  it("lists top-level keys with the type of each value", () => {
    expect(describeShape({ status: "ok", questions: "oops", count: 3, extra: null, list: [1], flag: true })).toBe(
      "status: string, questions: string, count: number, extra: null, list: array, flag: boolean",
    );
  });

  it("never includes a value", () => {
    const shape = describeShape({ status: "SECRET-VALUE", questions: [{ question: "PRIVATE-TEXT" }] });
    expect(shape).not.toContain("SECRET-VALUE");
    expect(shape).not.toContain("PRIVATE-TEXT");
  });

  it("describes non-objects by type alone", () => {
    expect(describeShape(undefined)).toBe("undefined");
    expect(describeShape(null)).toBe("null");
    expect(describeShape("a string")).toBe("string");
    expect(describeShape([1, 2])).toBe("array");
    expect(describeShape({})).toBe("object with no keys");
  });

  it("cleans and caps keys, since the model chooses them", () => {
    expect(describeShape({ "line\nbreak": 1 })).toBe("line?break: number");
    expect(describeShape({ ["k".repeat(100)]: 1 })).toBe(`${"k".repeat(40)}: number`);

    const many = Object.fromEntries(Array.from({ length: 25 }, (_, n) => [`key${n}`, n]));
    expect(describeShape(many)).toContain("and 5 more keys");
  });
});
