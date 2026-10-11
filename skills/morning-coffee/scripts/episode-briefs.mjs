const canonical = (value) => {
  const url = new URL(value);
  url.hash = "";
  return url.href;
};

/** Check that the short-news chapter contains the selected summaries, not only a title. */
export function validateEpisodeBriefs({ source, publication, parts }) {
  const briefs = source.briefs;
  if (
    !briefs ||
    !Number.isInteger(briefs.section) ||
    briefs.section < 1 ||
    !Array.isArray(briefs.urls) ||
    briefs.urls.length === 0
  ) {
    throw new Error(
      "episode.briefs must identify a spoken section and its source URLs",
    );
  }
  const section = briefs.section;
  const narration = source.segments?.[section];
  if (typeof narration !== "string" || !narration.trim()) {
    throw new Error("Short-news narration must exist in episode.segments");
  }
  const chapters =
    publication.chapters?.filter((chapter) => chapter.title === "短讯") ?? [];
  if (chapters.length !== 1 || chapters[0].section !== section) {
    throw new Error(
      "Publication must contain one 短讯 chapter at the spoken section",
    );
  }
  const urls = briefs.urls.map(canonical);
  if (new Set(urls).size !== urls.length)
    throw new Error("Short-news sources must be distinct");
  const selected = new Set(
    (source.sources ?? []).map((item) => canonical(item.url)),
  );
  const summaries = new Map(
    (publication.timeline ?? []).map((item) => [
      canonical(item.url),
      item.summary?.trim(),
    ]),
  );
  const materials = new Map(
    (publication.materials ?? []).map((item) => [canonical(item.url), item]),
  );
  for (const url of urls) {
    if (!selected.has(url))
      throw new Error("Spoken short-news URLs must be episode sources");
    const summary = summaries.get(url);
    if (!summary || !narration.includes(summary)) {
      throw new Error(
        "Every short-news summary must be included in the spoken segment",
      );
    }
    if (materials.get(url)?.chapterSection !== section) {
      throw new Error(
        "Short-news material cards must link to the 短讯 chapter",
      );
    }
  }
  if (parts !== undefined) {
    const indexes = parts.flatMap((part, index) =>
      part.section === section ? [index] : [],
    );
    const spoken = indexes.map((index) => parts[index]);
    if (
      !spoken.length ||
      indexes.at(-1) - indexes[0] + 1 !== indexes.length ||
      spoken.some(
        (part) =>
          typeof part.text !== "string" ||
          !Number.isFinite(part.seconds) ||
          part.seconds <= 0,
      ) ||
      spoken.map((part) => part.text).join("") !== narration
    ) {
      throw new Error(
        "Measured short-news audio must contain the complete narration in consecutive parts",
      );
    }
  }
  return { section, sources: urls.length, measured: parts !== undefined };
}
