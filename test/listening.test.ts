import { describe, expect, test } from "vitest";
import { canExpandPlayer, chapterIndexAt, displayTime, progressWithin } from "../src/lib/listening";
const chapters = [
  { id: "opening", title: "Opening", start: 3 },
  { id: "main", title: "Main story", start: 34.37 },
  { id: "briefs", title: "Briefs", start: 113.804 },
];
describe("Listening position", () => {
  test("keeps intro and exact measured chapter boundaries distinct", () => {
    expect(chapterIndexAt(chapters, 0)).toBe(-1);
    expect(chapterIndexAt(chapters, 3)).toBe(0);
    expect(chapterIndexAt(chapters, 34.369)).toBe(0);
    expect(chapterIndexAt(chapters, 34.37)).toBe(1);
    expect(chapterIndexAt(chapters, 113.804)).toBe(2);
    expect(chapterIndexAt(chapters, NaN)).toBe(-1);
  });
  test("clamps seek progress and handles metadata that is not loaded yet", () => {
    expect(progressWithin(10, 20, 5)).toBe(0);
    expect(progressWithin(10, 20, 15)).toBe(.5);
    expect(progressWithin(10, 20, 25)).toBe(1);
    expect(progressWithin(10, 10, 10)).toBe(0);
    expect(displayTime(NaN)).toBe("00:00");
    expect(displayTime(201.432979)).toBe("03:21");
  });
});


describe("Player scroll boundary", () => {
  test("keeps a docked player docked while the slot jitters near the header", () => {
    for (const top of [111, 113, 112, 110, 114]) expect(canExpandPlayer(top, top + 156, 100, 844, false)).toBe(false);
    expect(canExpandPlayer(128, 284, 100, 844, false)).toBe(true);
    expect(canExpandPlayer(114, 270, 100, 844, true)).toBe(true);
    expect(canExpandPlayer(111, 267, 100, 844, true)).toBe(false);
  });
});
