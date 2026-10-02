import { createHash } from "node:crypto";

export function prepareEpisode({ day, source, publication, parts, duration, audio, shownotes, site = "https://gitlog.si" }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error("Invalid episode day");
  if (!source.title?.trim() || !source.disclosure?.trim() || !publication.summary?.trim()) throw new Error("Title, disclosure and summary are required");
  if (!Number.isFinite(duration) || duration <= 3 || !audio?.length) throw new Error("Measured audio is required");
  if (!Array.isArray(parts) || !parts.length) throw new Error("A measured synthesis manifest is required");
  const starts = new Map();
  let position = 3;
  for (const part of parts) {
    if (!Number.isInteger(part.section) || !Number.isFinite(part.seconds) || part.seconds <= 0 || !Number.isFinite(part.pause_ms) || part.pause_ms < 0) throw new Error("Invalid measured segment");
    if (!starts.has(part.section)) starts.set(part.section, position);
    position += part.seconds + part.pause_ms / 1000;
  }
  if (position > duration + 1 || duration - position > 10) throw new Error("Manifest does not match final audio duration");
  if (!Array.isArray(publication.chapters) || publication.chapters.length < 4 || publication.chapters.length > 6) throw new Error("Choose four to six measured chapters");
  let previous = -1;
  const chapters = publication.chapters.map(({ title, section }) => {
    const start = starts.get(section);
    if (!title?.trim() || start === undefined || start <= previous || start >= duration) throw new Error("Chapters must reference increasing manifest sections");
    previous = start;
    return { title, start: Math.round(start * 1000) / 1000 };
  });
  if (chapters[0].start !== 3) throw new Error("First chapter must include the opening section");
  const publicText = `${source.title}\n${publication.summary}\n${source.disclosure}\n${shownotes}\n${JSON.stringify(chapters)}`;
  if (!shownotes?.trim() || /\/Users\/|\/home\/|MEDIA:|\b(?:192\.168|127\.0|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.|localhost|\bsk-[\w-]{8,}|配乐署名|制作记录|Kevin MacLeod|Funkorama|CC BY/i.test(publicText)) throw new Error("Show notes contain private production or archive-only information");
  const hash = createHash("sha256").update(audio).digest("hex");
  const audioKey = `episodes/${day}/${hash}.mp3`;
  const data = { title: source.title, summary: publication.summary, date: day, duration, disclosure: source.disclosure, draft: false,
    audio: { url: new URL(`/audio/${day}/${hash}.mp3`, site).href, length: audio.length, type: "audio/mpeg" }, chapters };
  return { day, audioKey, data, markdown: `---\n${JSON.stringify(data, null, 2)}\n---\n\n${shownotes.trim()}\n` };
}
