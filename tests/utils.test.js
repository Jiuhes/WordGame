import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  clone,
  normalizeText,
  slugify,
  clipText,
} from "../assets/js/core/utils.js";

describe("escapeHtml", () => {
  it("should escape HTML special characters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
    expect(escapeHtml('"quotes"')).toBe("&quot;quotes&quot;");
    expect(escapeHtml("'single'")).toBe("&#39;single&#39;");
  });

  it("should handle empty strings", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(undefined)).toBe("undefined");
  });

  it("should handle numbers", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(3.14)).toBe("3.14");
  });
});

describe("clone", () => {
  it("should create a deep copy of objects", () => {
    const original = { a: 1, b: { c: 2 } };
    const copied = clone(original);

    expect(copied).toEqual(original);
    expect(copied).not.toBe(original);
    expect(copied.b).not.toBe(original.b);
  });

  it("should create a deep copy of arrays", () => {
    const original = [1, [2, 3], { a: 4 }];
    const copied = clone(original);

    expect(copied).toEqual(original);
    expect(copied).not.toBe(original);
    expect(copied[1]).not.toBe(original[1]);
  });

  it("should handle primitive values", () => {
    expect(clone(42)).toBe(42);
    expect(clone("hello")).toBe("hello");
    expect(clone(true)).toBe(true);
    expect(clone(null)).toBe(null);
  });

  it("should handle Date objects", () => {
    const date = new Date("2024-01-01");
    const copied = clone(date);

    expect(copied).toBeInstanceOf(Date);
    expect(copied.getTime()).toBe(date.getTime());
    expect(copied).not.toBe(date);
  });

  it("should handle RegExp objects", () => {
    const regex = /test/gi;
    const copied = clone(regex);

    expect(copied).toBeInstanceOf(RegExp);
    expect(copied.source).toBe("test");
    expect(copied.flags).toBe("gi");
  });

  it("should handle Map objects", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const copied = clone(map);

    expect(copied).toBeInstanceOf(Map);
    expect([...copied]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("should handle Set objects", () => {
    const set = new Set([1, 2, 3]);
    const copied = clone(set);

    expect(copied).toBeInstanceOf(Set);
    expect([...copied]).toEqual([1, 2, 3]);
  });
});

describe("normalizeText", () => {
  it("should trim and lowercase text", () => {
    expect(normalizeText("  Hello World  ")).toBe("hello world");
    expect(normalizeText("HELLO")).toBe("hello");
    expect(normalizeText("HeLLo WoRLD")).toBe("hello world");
  });

  it("should handle empty values", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("slugify", () => {
  it("should convert text to URL-friendly slug", () => {
    expect(slugify("Hello World")).toBe("hello_world");
    expect(slugify("  Hello  World  ")).toBe("hello_world");
  });

  it("should preserve hyphens and underscores", () => {
    expect(slugify("Hello-World")).toBe("hello-world");
    expect(slugify("hello_world")).toBe("hello_world");
  });

  it("should remove file extensions", () => {
    expect(slugify("document.pdf")).toBe("document");
    expect(slugify("image.png")).toBe("image");
  });

  it("should handle special characters", () => {
    expect(slugify("Hello! World?")).toBe("hello_world");
    expect(slugify("Café")).toBe("caf");
  });

  it("should handle empty values with timestamp fallback", () => {
    expect(slugify("")).toMatch(/^local_\d+$/);
    expect(slugify(null)).toMatch(/^local_\d+$/);
  });
});

describe("clipText", () => {
  it("should clip text longer than max length", () => {
    expect(clipText("Hello World", 8)).toBe("Hello W…");
    expect(clipText("这是一个测试", 5)).toBe("这是一个…");
  });

  it("should not clip text shorter than max length", () => {
    expect(clipText("Hello", 10)).toBe("Hello");
    expect(clipText("Hi", 5)).toBe("Hi");
  });

  it("should handle exact length", () => {
    expect(clipText("Hello", 5)).toBe("Hello");
  });

  it("should handle empty values", () => {
    expect(clipText("", 10)).toBe("");
    expect(clipText(null, 10)).toBe("");
  });
});
