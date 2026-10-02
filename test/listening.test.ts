import { describe, expect, test } from "vitest";
import { chapterIndexAt, displayTime, progressWithin } from "../src/lib/listening";
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
