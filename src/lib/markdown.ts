import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
export function renderMarkdown(body: string) {
  return sanitizeHtml(marked.parse(body, { async: false }), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title"],
      a: ["href", "title"],
    },
    allowedSchemes: ["https", "http", "mailto"],
  });
}
