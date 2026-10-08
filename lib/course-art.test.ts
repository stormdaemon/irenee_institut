import { describe, expect, test } from "bun:test";
import { courseArtwork } from "./course-art";
import { existsSync } from "node:fs";

describe("Apostolos course illustrations", () => {
  test("history and reason receive distinct editorial worlds", () => {
    expect(courseArtwork("histoire-christianisme-fractures").src).not.toBe(courseArtwork("science-raison-foi").src);
  });
  test("unknown courses have a real accessible local illustration", () => {
    const art = courseArtwork("nouveau-cours");
    expect(art.alt.length).toBeGreaterThan(15);
    expect(existsSync(`public${art.src}`)).toBe(true);
  });
});
