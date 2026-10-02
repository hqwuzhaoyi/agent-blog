export interface ListeningChapter { id: string; title: string; start: number }
export interface ListeningEpisode {
  id: string;
  title: string;
  url: string;
  audio: { url: string };
  duration: number;
  chapters: ListeningChapter[];
}

export function chapterIndexAt(chapters: ListeningChapter[], seconds: number) {
  let index = -1;
  if (!Number.isFinite(seconds)) return index;
  for (let i = 0; i < chapters.length && chapters[i].start <= seconds; i++) index = i;
  return index;
}

export function progressWithin(start: number, end: number, seconds: number) {
  return end > start ? Math.max(0, Math.min(1, (seconds - start) / (end - start))) : 0;
}

export function displayTime(seconds: number) {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
