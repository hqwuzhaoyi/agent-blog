const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const POSIX_HOME = /(?:^|[\s("'])\/(?:Users|home|root)\/[^\s)"']+/i;
const WINDOWS_HOME = /\b[A-Z]:\\Users\\[^\s"']+/i;
const NAMED_SECRET = /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\s*[:=]\s*[^\s,;]+/i;
const TOKEN_SHAPE = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[opusr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/;
const INTERNAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[^/\s]+\.local)(?:[:/][^\s]*)?/i;

function textFields(value) {
  if (!value || typeof value !== "object") return "";
  return [value.title, value.outcome, value.whyItMatters, value.project, value.label]
    .filter((item) => typeof item === "string")
    .join("\n");
}

export function containsSensitiveContent(value, privateTerms = []) {
  const text = typeof value === "string" ? value : textFields(value);
  if (!text) return false;

  const matchesPrivateTerm = privateTerms.some(
    (term) => term && text.toLocaleLowerCase().includes(String(term).toLocaleLowerCase()),
  );

  return (
    matchesPrivateTerm ||
    EMAIL.test(text) ||
    POSIX_HOME.test(text) ||
    WINDOWS_HOME.test(text) ||
    NAMED_SECRET.test(text) ||
    TOKEN_SHAPE.test(text) ||
    INTERNAL_URL.test(text)
  );
}

function safeMetadata(value, fallback, privateTerms) {
  return typeof value === "string" && value.trim() && !containsSensitiveContent(value, privateTerms)
    ? value.trim()
    : fallback;
}

function sanitizeEvidence(items = [], privateTerms = []) {
  return items.flatMap((item) => {
    if (!item?.public || typeof item.url !== "string" || containsSensitiveContent(item.label, privateTerms)) {
      return [];
    }

    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || containsSensitiveContent(url.toString(), privateTerms)) return [];
      url.search = "";
      url.hash = "";
      return [{ label: safeMetadata(item.label, "Public evidence", privateTerms), url: url.toString() }];
    } catch {
      return [];
    }
  });
}

function yamlString(value) {
  return JSON.stringify(value);
}

function renderHighlight(highlight, privateTerms) {
  const evidence = sanitizeEvidence(highlight.evidence, privateTerms);
  const lines = [`### ${highlight.title.trim()}`, "", highlight.outcome.trim()];

  if (highlight.whyItMatters?.trim()) {
    lines.push("", `**Why it matters.** ${highlight.whyItMatters.trim()}`);
  }

  if (evidence.length) {
    lines.push("", evidence.map((item) => `[${item.label}](${item.url})`).join(" · "));
  }

  return lines.join("\n");
}

export function createReviewSubmission({ config, reviewDay, draft }) {
  const privateTerms = config.privateTerms ?? [];
  const proposed = Array.isArray(draft?.highlights) ? draft.highlights : [];
  const safeHighlights = proposed.filter((highlight) => {
    if (!highlight?.title?.trim() || !highlight?.outcome?.trim()) return false;
    return !containsSensitiveContent(highlight, privateTerms);
  });
  const omittedHighlights = proposed.length - safeHighlights.length;

  if (!safeHighlights.length) {
    return { status: "no-update", reason: "no-publication-safe-highlights", omittedHighlights };
  }

  const title = safeMetadata(draft.title, `Daily work review — ${reviewDay}`, privateTerms);
  const summary = safeMetadata(
    draft.summary,
    `Selected work highlights from ${reviewDay}.`,
    privateTerms,
  );
  const sourceLabel = safeMetadata(config.sourceLabel, "OpenClaw", privateTerms);
  const language = config.language === "zh-CN" ? "zh-CN" : "en";
  const platforms = Array.isArray(draft.platforms)
    ? draft.platforms.filter((value) => typeof value === "string" && value.trim() && !containsSensitiveContent(value, privateTerms))
    : [];
  const groups = new Map();

  for (const highlight of safeHighlights) {
    const project = safeMetadata(highlight.project, "Other work", privateTerms);
    const existing = groups.get(project) ?? [];
    existing.push(highlight);
    groups.set(project, existing);
  }

  const body = [...groups.entries()]
    .flatMap(([project, highlights]) => [
      `## ${project}`,
      "",
      highlights.map((highlight) => renderHighlight(highlight, privateTerms)).join("\n\n"),
    ])
    .join("\n\n");

  const markdown = [
    "---",
    `title: ${yamlString(title)}`,
    `summary: ${yamlString(summary)}`,
    `date: ${reviewDay}`,
    `source: ${yamlString(sourceLabel)}`,
    `language: ${yamlString(language)}`,
    `platforms: ${JSON.stringify(platforms.length ? platforms : ["OpenClaw"])}`,
    `highlights: ${safeHighlights.length}`,
    "---",
    "",
    body,
    "",
  ].join("\n");

  return {
    status: "ready",
    markdown,
    omittedHighlights,
    highlights: safeHighlights.length,
    title,
    summary,
  };
}
